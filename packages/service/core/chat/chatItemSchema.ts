import { connectionMongo, type Model } from '../../common/mongo';
const { Schema, model, models } = connectionMongo;
import { ChatItemSchema as ChatItemType } from '@fastgpt/global/core/chat/type';
import { ChatRoleMap } from '@fastgpt/global/core/chat/constants';
import { getNanoid } from '@fastgpt/global/common/string/tools';
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import { appCollectionName } from '../app/schema';
import { userCollectionName } from '../../support/user/schema';
import { ModuleOutputKeyEnum } from '@fastgpt/global/core/module/constants';

export const ChatItemCollectionName = 'chatitems';

const ChatItemSchema = new Schema({
  teamId: {
    type: Schema.Types.ObjectId,
    ref: TeamCollectionName,
    required: true
  },
  tmbId: {
    type: Schema.Types.ObjectId,
    ref: TeamMemberCollectionName,
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: userCollectionName
  },
  chatId: {
    type: String,
    require: true
  },
  dataId: {
    type: String,
    require: true,
    default: () => getNanoid(22)
  },
  appId: {
    type: Schema.Types.ObjectId,
    ref: appCollectionName,
    required: true
  },
  // 删除标记：0未删除 1已删除
  delFlag: {
    type: Number,
    default: 0
  },
  time: {
    type: Date,
    default: () => new Date()
  },
  obj: {
    // chat role
    type: String,
    required: true,
    enum: Object.keys(ChatRoleMap)
  },
  value: {
    // chat content
    type: String,
    default: ''
  },
  userGoodFeedback: {
    type: String
  },
  userBadFeedback: {
    type: String
  },
  customFeedbacks: {
    type: [String]
  },
  adminFeedback: {
    type: {
      datasetId: String,
      collectionId: String,
      dataId: String,
      q: String,
      a: String
    }
  },
  [ModuleOutputKeyEnum.responseData]: {
    type: Array,
    default: []
  }
});

try {
  ChatItemSchema.index({ dataId: 1 }, { background: true });
  /* delete by app; 
     delete by chat id;
     get chat list; 
     get chat logs; 
     close custom feedback; 
  */
  ChatItemSchema.index({ appId: 1, chatId: 1, dataId: 1 }, { background: true });
  ChatItemSchema.index({ time: -1 }, { background: true });
  ChatItemSchema.index({ userGoodFeedback: 1 }, { background: true });
  ChatItemSchema.index({ userBadFeedback: 1 }, { background: true });
  ChatItemSchema.index({ customFeedbacks: 1 }, { background: true });
  ChatItemSchema.index({ adminFeedback: 1 }, { background: true });
} catch (error) {
  console.log(error);
}

export const MongoChatItem: Model<ChatItemType> =
  models[ChatItemCollectionName] || model(ChatItemCollectionName, ChatItemSchema);

//   // 只执行一次
// async function addDelFlagToAllDocuments() {
//   try {
//     // 更新所有ChatItem文档，如果没有del_flag字段则添加并设为0
//     await MongoChatItem.updateMany({}, { $set: { delFlag: 0 } }, { upsert: false });
//     console.log("成功为所有ChatItem文档添加delFlag字段并设为0");
//   } catch (error) {
//     console.error("更新过程中发生错误:", error);
//   }
// }
// addDelFlagToAllDocuments();

MongoChatItem.syncIndexes();
