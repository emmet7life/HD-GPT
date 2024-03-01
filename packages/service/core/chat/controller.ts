import type { ChatItemType } from '@fastgpt/global/core/chat/type';
import { MongoChatItem } from './chatItemSchema';
import { addLog } from '../../common/system/log';

export async function getChatItems({
  appId,
  chatId,
  limit = 30,
  field
}: {
  appId: string;
  chatId?: string;
  limit?: number;
  field: string;
}): Promise<{ history: ChatItemType[] }> {
  if (!chatId) {
    return { history: [] };
  }

  // 查询历史记录时，过滤掉delFlag不为0的数据，0标识数据正常，其他表示数据被删除等异常数据
  const history = await MongoChatItem.find({ appId, chatId, delFlag: 0 }, field)
    .sort({ _id: -1 })
    .limit(limit)
    .lean();

  history.reverse();

  // console.log("getChatItems >> history", history);

  return { history };
}

export const addCustomFeedbacks = async ({
  appId,
  chatId,
  chatItemId,
  feedbacks
}: {
  appId: string;
  chatId?: string;
  chatItemId?: string;
  feedbacks: string[];
}) => {
  if (!chatId || !chatItemId) return;

  try {
    await MongoChatItem.findOneAndUpdate(
      {
        chatId,
        dataId: chatItemId
      },
      {
        $push: { customFeedbacks: { $each: feedbacks } }
      }
    );
  } catch (error) {
    addLog.error('addCustomFeedbacks error', error);
  }
};
