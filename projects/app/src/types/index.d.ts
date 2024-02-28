import {
  AudioSpeechModelType,
  ChatModelItemType,
  FunctionModelItemType,
  LLMModelItemType,
  ReRankModelItemType,
  VectorModelItemType,
  WhisperModelType
} from '@fastgpt/global/core/ai/model.d';
import { TrackEventName } from '@/constants/common';
import { AppSimpleEditConfigTemplateType } from '@fastgpt/global/core/app/type';

export type PagingData<T> = {
  pageNum: number;
  pageSize: number;
  data: T[];
  total?: number;
};

export type RequestPaging = { pageNum: number; pageSize: number; [key]: any };

// 微信JSSDK接口定义
export interface MiniProgramAPI {
  postMessage(message: any): void;
  navigateBack(options?: any): void;
}

export interface WxGlobal {
  miniProgram: MiniProgramAPI | undefined;
}

declare global {
  var wx: WxGlobal | undefined;
  var qaQueueLen: number;
  var vectorQueueLen: number;

  var chatModels: ChatModelItemType[];
  var vectorModels: VectorModelItemType[];
  var qaModels: LLMModelItemType[];
  var cqModels: FunctionModelItemType[];
  var extractModels: FunctionModelItemType[];
  var qgModels: LLMModelItemType[];
  var audioSpeechModels: AudioSpeechModelType[];
  var whisperModel: WhisperModelType;
  var reRankModels: ReRankModelItemType[];

  var systemVersion: string;

  var simpleModeTemplates: AppSimpleEditConfigTemplateType[];

  interface Window {
    grecaptcha: any;
    QRCode: any;
    umami?: {
      track: (event: `${TrackEventName}`, data: any) => void;
    };
  }
}
