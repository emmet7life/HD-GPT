import { GET, POST, PUT, DELETE } from '@/web/common/api/request';
import type { CreateQuestionGuideParams } from '@/global/core/ai/api.d';
import type { CreateOcrQuestionParams } from '@/global/core/ai/api.d';
import type { CreateOcrRequestParams } from '@/global/core/ai/api.d';

export type OcrRequestResult = {
  content: string,
  url: string
}

export const postQuestionGuide = (data: CreateQuestionGuideParams, cancelToken: AbortController) =>
  POST<string[]>('/core/ai/agent/createQuestionGuide', data, { cancelToken });

export const postOcrQuestion = (data: CreateOcrQuestionParams) =>
  POST<string>('/core/ai/agent/ocrRequest', data);

export const postOcrRequest = (data: CreateOcrRequestParams) =>
  POST<OcrRequestResult>(data.apiPath, { url: data.imageUrl }, { baseURL: data.apiBaseUrl });