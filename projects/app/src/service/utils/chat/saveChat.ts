import type { ChatItemType } from '@fastgpt/global/core/chat/type.d';
import { MongoApp } from '@fastgpt/service/core/app/schema';
import { ChatSourceEnum } from '@fastgpt/global/core/chat/constants';
import { MongoChatItem } from '@fastgpt/service/core/chat/chatItemSchema';
import { MongoChat } from '@fastgpt/service/core/chat/chatSchema';
import { addLog } from '@fastgpt/service/common/system/log';
import { chatContentReplaceBlock } from '@fastgpt/global/core/chat/utils';

// 函数参数类型定义
type Props = {
  chatId: string;
  appId: string;
  teamId: string;
  tmbId: string;
  variables?: Record<string, any>;
  updateUseTime: boolean;
  source: `${ChatSourceEnum}`;
  shareId?: string;
  outLinkUid?: string;
  userId?: string;
  content: [ChatItemType, ChatItemType];
  metadata?: Record<string, any>;
};

// 函数的主要目的是将聊天记录保存到数据库中，并根据需要更新相关记录和元数据。
export async function saveChat({
  chatId,
  appId,
  teamId,
  tmbId,
  userId,
  variables,
  updateUseTime,
  source,
  shareId,
  outLinkUid,
  content,
  metadata = {}
}: Props) {

  content.forEach((item, index) => {
    console.log("saveChat.ts >> saveChat >> content forEach ", index + 1, ", item.value", item.value, ", item", item);
  });

  try {
    // 查找聊天记录:
    const chat = await MongoChat.findOne(
      {
        chatId,
        teamId,
        tmbId,
        appId
      },
      '_id metadata'
    );

    // 合并元数据:
    const metadataUpdate = {
      ...chat?.metadata,
      ...metadata
    };

    // 过滤出 value 不为空的 content 项
    const validContent = content.filter(item => item.value !== undefined && item.value !== null && item.value !== '');

    validContent.forEach((item, index) => {
      console.log("saveChat.ts >> saveChat >> validContent forEach ", index + 1, ", item.value", item.value, ", item", item);
    });

    if (validContent.length === 0) {
      throw new Error('No valid content to save');
    }

    // 插入聊天项:
    const promise: any[] = [
      MongoChatItem.insertMany(
        validContent.map((item) => ({
          chatId,
          teamId,
          tmbId,
          appId,
          sessionUserId: userId || "root",
          ...item
        }))
      )
    ];

    // 生成标题:
    const title =
      chatContentReplaceBlock(content[0].value).slice(0, 20) ||
      content[1]?.value?.slice(0, 20) ||
      'Chat';


    // 更新或创建聊天记录:
    if (chat) {
      promise.push(
        MongoChat.updateOne(
          { appId, chatId },
          {
            title,
            updateTime: new Date(),
            metadata: metadataUpdate
          }
        )
      );
    } else {
      promise.push(
        MongoChat.create({
          chatId,
          teamId,
          tmbId,
          appId,
          sessionUserId: userId || "root",
          variables,
          title,
          source,
          shareId,
          outLinkUid,
          metadata: metadataUpdate
        })
      );
    }

    // 更新应用使用时间:
    if (updateUseTime && source === ChatSourceEnum.online) {
      promise.push(
        MongoApp.findByIdAndUpdate(appId, {
          updateTime: new Date()
        })
      );
    }

    // 并发执行所有操作:
    await Promise.all(promise);
  } catch (error) {
    addLog.error(`update chat history error`, error);
  }
}
