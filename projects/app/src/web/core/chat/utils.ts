import { chatModelList, ocrModel } from '@/web/common/system/staticData';
import { FlowNodeTypeEnum } from '@fastgpt/global/core/module/node/constant';
import { ModuleItemType } from '@fastgpt/global/core/module/type.d';

export function checkChatSupportSelectFileByChatModels(models: string[] = []) {
  // for (const model of models) {
  //   const modelData = chatModelList.find((item) => item.model === model || item.name === model);
  //   if (modelData?.vision) {
  //     return true;
  //   }
  // }
  // return false;
  // 只判断config.json中ocrEnv的apiBaseUrl和apiPath是否配置了参数
  return ocrModel.apiBaseUrl && ocrModel.apiPath ? true : false;
}

export function checkChatSupportSelectFileByModules(modules: ModuleItemType[] = []) {
  const chatModules = modules.filter((item) => item.flowType === FlowNodeTypeEnum.chatNode);
  const models: string[] = chatModules.map(
    (item) => item.inputs.find((item) => item.key === 'model')?.value || ''
  );
  return checkChatSupportSelectFileByChatModels(models);
}
