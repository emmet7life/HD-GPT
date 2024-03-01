import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase } from '@/service/mongo';
import { MongoChatItem } from '@fastgpt/service/core/chat/chatItemSchema';
import { autChatCrud } from '@/service/support/permission/auth/chat';
import type { DeleteChatItemProps } from '@/global/core/chat/api.d';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectToDatabase();
    const { appId, chatId, contentId, shareId, outLinkUid } = req.query as DeleteChatItemProps;

    if (!contentId || !chatId) {
      return jsonRes(res);
    }

    await autChatCrud({
      req,
      authToken: true,
      appId,
      chatId,
      shareId,
      outLinkUid,
      per: 'w'
    });

    // deleteOne 更改为 updateOne 实现假删除
    await MongoChatItem.updateOne({
      appId,
      chatId,
      dataId: contentId
    }, {
      $set: {
        delFlag: 1
      }
    });

    jsonRes(res);
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
