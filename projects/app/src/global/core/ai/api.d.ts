import { ChatMessageItemType } from '@fastgpt/global/core/ai/type.d';

export type CreateQuestionGuideParams = {
  messages: ChatMessageItemType[];
  shareId?: string;
};

export type CreateOcrQuestionParams = {
  message: string;
  shareId?: string;
}

export type CreateOcrRequestParams = {
  imageUrl: string,
  apiBaseUrl: string,
  apiPath: string
}
