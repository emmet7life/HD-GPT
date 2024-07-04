import React, {
  useCallback,
  useRef,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  ForwardedRef,
  useEffect
} from 'react';
import Script from 'next/script';
import { throttle } from 'lodash';
import type { ExportChatType } from '@/types/chat.d';
import type { ChatItemType, ChatSiteItemType } from '@fastgpt/global/core/chat/type.d';
import type { ChatHistoryItemResType } from '@fastgpt/global/core/chat/type.d';
import { useToast } from '@/web/common/hooks/useToast';
import { useAudioPlay } from '@/web/common/utils/voice';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { useCopyData } from '@/web/common/hooks/useCopyData';
import {
  Box,
  Card,
  Flex,
  Input,
  Button,
  useTheme,
  BoxProps,
  FlexProps,
  Image,
  Textarea,
  Checkbox,
  HStack
} from '@chakra-ui/react';
import { feConfigs } from '@/web/common/system/staticData';
import { EventNameEnum, eventBus } from '@/web/common/utils/eventbus';
import { adaptChat2GptMessages } from '@fastgpt/global/core/chat/adapt';
import { useMarkdown } from '@/web/common/hooks/useMarkdown';
import { ModuleItemType } from '@fastgpt/global/core/module/type.d';
import { VariableInputEnum } from '@fastgpt/global/core/module/constants';
import { UseFormReturn, useForm } from 'react-hook-form';
import type { ChatMessageItemType } from '@fastgpt/global/core/ai/type.d';
import { fileDownload } from '@/web/common/file/utils';
import { htmlTemplate } from '@/constants/common';
import { useRouter } from 'next/router';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useTranslation } from 'next-i18next';
import { customAlphabet } from 'nanoid';
import {
  closeCustomFeedback,
  updateChatAdminFeedback,
  updateChatUserFeedback
} from '@/web/core/chat/api';
import type { AdminMarkType } from './SelectMarkCollection';

import MyIcon from '@fastgpt/web/components/common/Icon';
import Avatar from '@/components/Avatar';
import { HUMAN_ICON, LOGO_ICON } from '@fastgpt/global/common/system/constants';
import Markdown, { CodeClassName } from '@/components/Markdown';
import MySelect from '@/components/Select';
import MyTooltip from '../MyTooltip';
import dynamic from 'next/dynamic';
const ResponseTags = dynamic(() => import('./ResponseTags'));
const FeedbackModal = dynamic(() => import('./FeedbackModal'));
const ReadFeedbackModal = dynamic(() => import('./ReadFeedbackModal'));
const SelectMarkCollection = dynamic(() => import('./SelectMarkCollection'));

import styles from './index.module.scss';
import MarkdownStyles from '@/components/Markdown/index.module.scss';
import { postQuestionGuide } from '@/web/core/ai/api';
import { splitGuideModule } from '@fastgpt/global/core/module/utils';
import type { AppTTSConfigType, VariableItemType } from '@fastgpt/global/core/module/type.d';
import MessageInput from './MessageInput';
import { ModuleOutputKeyEnum } from '@fastgpt/global/core/module/constants';
import ChatBoxDivider from '../core/chat/Divider';
import type { ChatBottomGuideItem } from '@fastgpt/global/core/hd/type.d';
import { useChatStore as useHDChatStore } from '@/web/core/chat/hd/storeChat';
import { useConfirm } from '@/web/common/hooks/useConfirm';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 24);

const textareaMinH = '22px';

type generatingMessageProps = { text?: string; name?: string; status?: 'running' | 'finish' };

export type StartChatFnProps = {
  chatList: ChatSiteItemType[];
  messages: ChatMessageItemType[];
  controller: AbortController;
  variables: Record<string, any>;
  generatingMessage: (e: generatingMessageProps) => void;
};

export type ComponentRef = {
  getChatHistories: () => ChatSiteItemType[];
  resetVariables: (data?: Record<string, any>) => void;
  resetHistory: (history: ChatSiteItemType[]) => void;
  scrollToBottom: (behavior?: 'smooth' | 'auto') => void;
  sendPrompt: (question: string) => void;
};

enum FeedbackTypeEnum {
  user = 'user',
  admin = 'admin',
  hidden = 'hidden'
}

const MessageCardStyle: BoxProps = {
  px: 4,
  py: 3,
  borderRadius: '0 8px 8px 8px',
  boxShadow: '0 0 4px rgb(212, 212, 212)',
  display: 'inline-block',
  maxW: ['calc(100% - 25px)', 'calc(100% - 40px)'],
  overflowX: 'auto',
  fontSize: '15px',// 用户消息字体大小
};

const WelcomeContainerStyle: BoxProps = {
  px: 4,
  py: 3,
  borderRadius: '0 8px 8px 8px',
  boxShadow: '0 0 4px rgb(212, 212, 212)',
  display: 'inline-block',
  maxW: ['calc(100% - 0px)', 'calc(100% - 10px)'],
  overflowX: 'auto',
  position: 'relative',
  zIndex: 2
};

const WelcomeCardStyle: BoxProps = {
  borderRadius: '0 0px 0px 0px',
  boxShadow: '0 0 0px rgb(0, 0, 0)',
  display: 'inline-block',
  maxW: ['calc(100% - 0px)', 'calc(100% - 10px)'],
  overflowX: 'hidden',
  overflowY: 'hidden',
  position: 'relative',
  zIndex: 10
};

type Props = {
  feedbackType?: `${FeedbackTypeEnum}`;
  showMarkIcon?: boolean; // admin mark dataset
  showVoiceIcon?: boolean;
  showEmptyIntro?: boolean;
  appAvatar?: string;
  userAvatar?: string;
  userGuideModule?: ModuleItemType;
  showFileSelector?: boolean;
  active?: boolean; // can use
  safeAreaBottom?: number;

  // not chat test params
  appId?: string;
  chatId?: string;
  shareId?: string;
  outLinkUid?: string;

  // add params
  userId?: string;

  onUpdateVariable?: (e: Record<string, any>) => void;
  onStartChat?: (e: StartChatFnProps) => Promise<{
    responseText: string;
    [ModuleOutputKeyEnum.responseData]: ChatHistoryItemResType[];
    isNewChat?: boolean;
  }>;
  onDelMessage?: (e: { contentId?: string; index: number }) => void;
};

const ChatBox = (
  {
    feedbackType = FeedbackTypeEnum.hidden,
    showMarkIcon = false,
    showVoiceIcon = true,
    showEmptyIntro = false,
    appAvatar,
    userAvatar,
    userGuideModule,
    showFileSelector,
    active = true,
    appId,
    chatId,
    shareId,
    outLinkUid,
    userId,
    safeAreaBottom = 0,
    onUpdateVariable,
    onStartChat,
    onDelMessage
  }: Props,
  ref: ForwardedRef<ComponentRef>
) => {
  const ChatBoxRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isPc, setLoading } = useSystemStore();
  const TextareaDom = useRef<HTMLTextAreaElement>(null);
  const chatController = useRef(new AbortController());
  const questionGuideController = useRef(new AbortController());
  const isNewChatReplace = useRef(false);
  const isWxMiniProgramEnv = useRef(true);

  const { openConfirm, ConfirmModal } = useConfirm({
    content: t('core.chat.Confirm to transfer human service')
  });


  const [refresh, setRefresh] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatSiteItemType[]>([]);
  const [feedbackId, setFeedbackId] = useState<string>();
  const [readFeedbackData, setReadFeedbackData] = useState<{
    chatItemId: string;
    content: string;
  }>();
  const [adminMarkData, setAdminMarkData] = useState<AdminMarkType & { chatItemId: string }>();
  const [questionGuides, setQuestionGuide] = useState<string[]>([]);

  const isChatting = useMemo(
    () =>
      chatHistory[chatHistory.length - 1] &&
      chatHistory[chatHistory.length - 1]?.status !== 'finish',
    [chatHistory]
  );

  const { welcomeText, variableModules, questionGuide, ttsConfig } = useMemo(
    () => splitGuideModule(userGuideModule),
    [userGuideModule]
  );

  // compute variable input is finish.
  const chatForm = useForm<{
    variables: Record<string, any>;
  }>({
    defaultValues: {
      variables: {}
    }
  });
  const { setValue, watch, handleSubmit } = chatForm;
  const variables = watch('variables');

  const [variableInputFinish, setVariableInputFinish] = useState(false); // clicked start chat button
  const variableIsFinish = useMemo(() => {
    if (!variableModules || variableModules.length === 0 || chatHistory.length > 0) return true;

    for (let i = 0; i < variableModules.length; i++) {
      const item = variableModules[i];
      if (item.required && !variables[item.key]) {
        return false;
      }
    }

    return variableInputFinish;
  }, [chatHistory.length, variableInputFinish, variableModules, variables]);

  // 滚动到底部
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (!ChatBoxRef.current) return;
    ChatBoxRef.current.scrollTo({
      top: ChatBoxRef.current.scrollHeight,
      behavior
    });
  };

  // 聊天信息生成中……获取当前滚动条位置，判断是否需要滚动到底部
  const generatingScroll = useCallback(
    throttle(() => {
      if (!ChatBoxRef.current) return;
      const isBottom =
        ChatBoxRef.current.scrollTop + ChatBoxRef.current.clientHeight + 150 >=
        ChatBoxRef.current.scrollHeight;

      isBottom && scrollToBottom('auto');
    }, 100),
    []
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generatingMessage = useCallback(
    ({ text = '', status, name }: generatingMessageProps) => {
      setChatHistory((state) =>
        state.map((item, index) => {
          if (index !== state.length - 1) return item;
          return {
            ...item,
            ...(text
              ? {
                value: item.value + text
              }
              : {}),
            ...(status && name
              ? {
                status,
                moduleName: name
              }
              : {})
          };
        })
      );
      generatingScroll();
    },
    [generatingScroll]
  );

  const { chatBottomGuideItems } = useHDChatStore();

  // 重置输入内容
  const resetInputVal = useCallback((val: string) => {
    if (!TextareaDom.current) return;

    setTimeout(() => {
      /* 回到最小高度 */
      if (TextareaDom.current) {
        TextareaDom.current.value = val;
        TextareaDom.current.style.height =
          val === '' ? textareaMinH : `${TextareaDom.current.scrollHeight}px`;
      }
      setRefresh((state) => !state);
    }, 100);
  }, []);

  // create question guide
  const createQuestionGuide = useCallback(
    async ({ history }: { history: ChatSiteItemType[] }) => {
      if (!questionGuide || chatController.current?.signal?.aborted) return;

      try {
        const abortSignal = new AbortController();
        questionGuideController.current = abortSignal;

        const result = await postQuestionGuide(
          {
            messages: adaptChat2GptMessages({ messages: history, reserveId: false }).slice(-6),
            shareId
          },
          abortSignal
        );
        if (Array.isArray(result)) {
          setQuestionGuide(result);
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }
      } catch (error) { }
    },
    [questionGuide, shareId]
  );

  /**
   * human service handler 人工客服处理器
   */
  const humanServiceHandler = useCallback(({ action = '' }: {
    action?: string;
  }) => {
    let postData = {
      data: { messageType: 'ai-xiaoda-chat', action: action || 'human-handler' }
    };
    let backDelta = { delta: 1 };
    if (parent.wx) {
      // 当网页被嵌入iframe组件时，应通过宿主页面的js来调用
      // 因此宿主页面也必须添加<script type="text/javascript" src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"></script>
      // 来加载js文件（本项目中，该页面的宿主页面是xiaoda.html）
      parent.wx?.miniProgram?.postMessage(postData);
      parent.wx?.miniProgram?.navigateBack(backDelta);
    } else {
      // 当页面被直接加载时，可直接调用
      wx?.miniProgram?.postMessage(postData);
      wx?.miniProgram?.navigateBack(backDelta);
    }
  }, []);

  /**
   * user confirm send prompt
   */
  const sendPrompt = useCallback(
    ({
      directHandle = false,
      inputVal = '',
      history = chatHistory
    }: {
      directHandle?: boolean;
      inputVal?: string;
      history?: ChatSiteItemType[];
    }) => {
      handleSubmit(async ({ variables }) => {
        if (!onStartChat) return;
        if (isChatting) {
          toast({
            title: '正在聊天中...请等待结束',
            status: 'warning'
          });
          return;
        }
        questionGuideController.current?.abort('stop');
        // get input value
        const val = inputVal.trim();

        if (!val) {
          toast({
            title: '内容为空',
            status: 'warning'
          });
          return;
        }

        // 微信小程序环境下才判断是否转人工客服的逻辑
        if (!isWxMiniProgramEnv.current) {
          // 如果值是false，则再检测一遍
          // @ts-ignore
          isWxMiniProgramEnv.current = window.__wxjs_environment === 'miniprogram' || (parent && parent.window && parent.window.__wxjs_environment === 'miniprogram') ? true : false;
        }

        if (!directHandle && isWxMiniProgramEnv.current) {
          const humanServiceKeywords: string[] = [
            "转人工",
            "转接人工",
            "转人工服务",
            "转人工客服",
            "转接人工服务",
            "转接人工客服",
            "请帮我转接人工服务",
            "请帮我转人工客服",
            "人工服务",
            "人工客服",
          ];

          const isNeedHumanService = () => {
            return humanServiceKeywords.some((keyword) => inputVal.includes(keyword)) || inputVal === "人工";
          }

          if (isNeedHumanService()) {
            // console.log("弹窗提示，人工服务");
            openConfirm(
              // 弹窗确认
              () => {
                // 人工客服
                humanServiceHandler({});
                // 清空输入内容
                resetInputVal('');
              },
              // 弹窗取消
              () => {
                // 继续提问
                sendPrompt({
                  inputVal: inputVal,
                  history: history,
                  directHandle: true,
                });
              }
            )();
            return;
            // 弹窗，终止执行后续代码
          }
        }

        const newChatList: ChatSiteItemType[] = [
          ...history,
          {
            dataId: nanoid(),
            obj: 'Human',
            value: val,
            status: 'finish',
            sessionUserId: userId || "root"
          },
          {
            dataId: nanoid(),
            obj: 'AI',
            value: '',
            status: 'loading'
          }
        ];

        // 插入内容
        setChatHistory(newChatList);

        // 清空输入内容
        resetInputVal('');
        setQuestionGuide([]);
        setTimeout(() => {
          scrollToBottom();
        }, 100);
        try {
          // create abort obj
          const abortSignal = new AbortController();
          chatController.current = abortSignal;

          const messages = adaptChat2GptMessages({ messages: newChatList, reserveId: true });

          console.log("sendPrompt >> messages", messages);

          const {
            responseData,
            responseText,
            isNewChat = false
          } = await onStartChat({
            chatList: newChatList.map((item) => ({
              dataId: item.dataId,
              obj: item.obj,
              sessionUserId: item.sessionUserId,// 会话用户ID
              value: item.value,
              status: item.status,
              moduleName: item.moduleName
            })),
            messages,
            controller: abortSignal,
            generatingMessage,
            variables
          });

          isNewChatReplace.current = isNewChat;

          // set finish status
          setChatHistory((state) =>
            state.map((item, index) => {
              if (index !== state.length - 1) return item;
              return {
                ...item,
                status: 'finish',
                responseData
              };
            })
          );

          setTimeout(() => {
            createQuestionGuide({
              history: newChatList.map((item, i) =>
                i === newChatList.length - 1
                  ? {
                    ...item,
                    value: responseText
                  }
                  : item
              )
            });
            generatingScroll();
            isPc && TextareaDom.current?.focus();
          }, 100);
        } catch (err: any) {
          toast({
            title: t(getErrText(err, 'core.chat.error.Chat error')),
            status: 'error',
            duration: 5000,
            isClosable: true
          });

          if (!err?.responseText) {
            resetInputVal(inputVal);
            setChatHistory(newChatList.slice(0, newChatList.length - 2));
          }

          // set finish status
          setChatHistory((state) =>
            state.map((item, index) => {
              if (index !== state.length - 1) return item;
              return {
                ...item,
                status: 'finish'
              };
            })
          );
        }
      })();
    },
    [
      chatHistory,
      createQuestionGuide,
      generatingMessage,
      generatingScroll,
      handleSubmit,
      isChatting,
      isPc,
      onStartChat,
      resetInputVal,
      t,
      toast
    ]
  );

  // retry input
  const retryInput = useCallback(
    async (index: number) => {
      if (!onDelMessage) return;
      const delHistory = chatHistory.slice(index);

      setLoading(true);

      try {
        await Promise.all(
          delHistory.map((item, i) => onDelMessage({ contentId: item.dataId, index: index + i }))
        );
        setChatHistory((state) => (index === 0 ? [] : state.slice(0, index)));

        sendPrompt({
          inputVal: delHistory[0].value,
          history: chatHistory.slice(0, index)
        });
      } catch (error) { }
      setLoading(false);
    },
    [chatHistory, onDelMessage, sendPrompt, setLoading]
  );
  // delete one message
  const delOneMessage = useCallback(
    ({ dataId, index }: { dataId?: string; index: number }) => {
      setChatHistory((state) => state.filter((chat) => chat.dataId !== dataId));
      onDelMessage?.({
        contentId: dataId,
        index
      });
    },
    [onDelMessage]
  );

  // output data
  useImperativeHandle(ref, () => ({
    getChatHistories: () => chatHistory,
    resetVariables(e) {
      const defaultVal: Record<string, any> = {};
      variableModules?.forEach((item) => {
        defaultVal[item.key] = '';
      });

      setValue('variables', e || defaultVal);
    },
    resetHistory(e) {
      setVariableInputFinish(!!e.length);
      setChatHistory(e);
    },
    scrollToBottom,
    sendPrompt: (question: string) => {
      sendPrompt({
        inputVal: question
      });
    }
  }));

  /* style start */
  const showEmpty = useMemo(
    () =>
      feConfigs?.show_emptyChat &&
      showEmptyIntro &&
      chatHistory.length === 0 &&
      !variableModules?.length &&
      !welcomeText,
    [chatHistory.length, showEmptyIntro, variableModules, welcomeText]
  );

  type WelcomeTextTimePeriod = {
    start: number;
    end: number;
  }

  type WelcomeTextElement = {
    timePeriod: WelcomeTextTimePeriod;
    welcomeTexts: string[];
  }

  type WelcomeTextJsonObj = {
    data: WelcomeTextElement[]
  }

  // 获取当前时间的小时单位
  const getCurrentHour = function () {
    var date = new Date();
    return date.getHours();
  }

  /* 随机从问候语数据（可能返回的是一个JSON对象序列化后的字符串）中抽出一个问候语 */
  const randomWelcomeText = useMemo(() => {
    if (!welcomeText) return welcomeText;
    try {
      const welcomeTextObj = JSON.parse(welcomeText) as WelcomeTextJsonObj;
      if (welcomeTextObj) {
        var currentHour = getCurrentHour();
        const jsonData = welcomeTextObj.data;
        for (var i = 0; i < jsonData.length; i++) {
          var welcomeElement = jsonData[i];
          var timePeriod = welcomeElement.timePeriod;
          if (currentHour >= timePeriod.start && currentHour < timePeriod.end) {
            const welcomeTextStr = welcomeElement.welcomeTexts[Math.floor(Math.random() * welcomeElement.welcomeTexts.length)];
            return welcomeTextStr;
          }
        }
      }
    } catch (error) {
      console.warn("问候语解析失败");
    }
    // 默认返回
    return "<span style=\"color: #20599b; font-size: 18px; font-weight: 900;\">您好</span>\n欢迎光临恒达微波!我是您的A助手\"**小达**\"随时随地为您提供产品咨询、业务办理等各类服务，期待我的服务能给您带来愉快的体验。请问小达能为您做什么呢?";
  }, [welcomeText]);

  const statusBoxData = useMemo(() => {
    const colorMap = {
      loading: 'myGray.700',
      running: '#67c13b',
      finish: 'primary.500'
    };
    if (!isChatting) return;
    const chatContent = chatHistory[chatHistory.length - 1];
    if (!chatContent) return;

    return {
      bg: colorMap[chatContent.status] || colorMap.loading,
      name: t(chatContent.moduleName || '') || t('common.Loading')
    };
  }, [chatHistory, isChatting, t]);
  /* style end */

  // page change and abort request
  useEffect(() => {
    isNewChatReplace.current = false;
    setQuestionGuide([]);
    return () => {
      chatController.current?.abort('leave');
      if (!isNewChatReplace.current) {
        questionGuideController.current?.abort('leave');
      }
    };
  }, [router.query]);

  // jweixin-1.6.0.js loaded callback
  const jweixinFileLoaded = useCallback(() => {
    console.log("jweixinFileLoaded >> window", window);
    // @ts-ignore
    if (window.__wxjs_environment === 'miniprogram' || (parent && parent.window && parent.window.__wxjs_environment === 'miniprogram') ? true : false) {
      isWxMiniProgramEnv.current = true;
    } else {
      isWxMiniProgramEnv.current = false;
    }
  }, [window]);

  // add listener
  useEffect(() => {
    const windowMessage = (event: MessageEvent) => {
      // if (event.origin !== 'https://xiaoda.hdmicrowave.com'/*'http://localhost:5173'*/) {
      //   console.log("ChatBox eventListener windowMessage 1 event", event);
      //   return;
      // }

      // 使用正则匹配hdmicrowave.com下的所有子域名
      const isProd = process.env.NODE_ENV === 'production';
      const originRegex = isProd ? /^https:\/\/(?:[a-zA-Z0-9-]+\.)*hdmicrowave\.com$/ : /^http:\/\/localhost:5173$/;
      if (!originRegex.test(event.origin)) {
        console.log("ChatBox eventListener windowMessage 1 event", event);
        return;
      }

      console.log("ChatBox eventListener windowMessage 2 event", event);

      const { data }: MessageEvent<{ type: 'sendPrompt'; text: string }> = event;
      if (data?.type === 'sendPrompt' && data?.text) {
        sendPrompt({
          inputVal: data.text
        });
      }
      console.log('ChatBox eventListener windowMessage Received message from parent:', event.data);
    };
    window.removeEventListener('message', windowMessage);
    window.addEventListener('message', windowMessage);
    console.log('ChatBox eventListener addEventListener');

    eventBus.on(EventNameEnum.sendQuestion, ({ text }: { text: string }) => {
      if (!text) return;
      sendPrompt({
        inputVal: text
      });
    });
    eventBus.on(EventNameEnum.editQuestion, ({ text }: { text: string }) => {
      if (!text) return;
      resetInputVal(text);
    });

    return () => {
      window.removeEventListener('message', windowMessage);
      eventBus.off(EventNameEnum.sendQuestion);
      eventBus.off(EventNameEnum.editQuestion);
    };
  }, [resetInputVal, sendPrompt]);

  const onSubmitVariables = useCallback(
    (data: Record<string, any>) => {
      setVariableInputFinish(true);
      onUpdateVariable?.(data);
    },
    [onUpdateVariable]
  );

  return (
    <Flex flexDirection={'column'} h={'100%'} bg="myGray.100">
      <Script src="/js/html2pdf.bundle.min.js" strategy="lazyOnload"></Script>
      <Script src="/js/jweixin-1.6.0.js" strategy="lazyOnload" onLoad={() => {
        // <Script src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js" strategy="lazyOnload" onLoad={() => {
        console.log("jweixin-1.6.0.js loaded successfully");
        // @ts-ignore
        if (!window.WeixinJSBridge || !WeixinJSBridge.invoke) {
          console.log("WeixinJSBridge Not Ready");
          document.addEventListener('WeixinJSBridgeReady', jweixinFileLoaded, false);
          try {
            parent.document.addEventListener('WeixinJSBridgeReady', jweixinFileLoaded, false);
          } catch (error) {
            console.warn("WeixinJSBridge 跨域访问 error", error);
          }
        } else {
          console.log("WeixinJSBridge is Ready");
          jweixinFileLoaded();
        }
      }}></Script>
      <ConfirmModal confirmText='人工服务' closeText='继续提问' />
      {/* chat box container */}
      <Box ref={ChatBoxRef} flex={'1 0 0'} h={0} w={'100%'} overflow={'overlay'} px={[4, 0]} pb={3}>
        <Box id="chat-container" maxW={['100%', '92%']} h={'100%'} mx={'auto'}>
          {showEmpty && <Empty />}
          {!!randomWelcomeText && <WelcomeText welcomeText={randomWelcomeText} />}
          {/* variable input */}
          {!!variableModules?.length && (
            <VariableInput
              appAvatar={appAvatar}
              variableModules={variableModules}
              variableIsFinish={variableIsFinish}
              chatForm={chatForm}
              onSubmitVariables={onSubmitVariables}
            />
          )}
          {/* chat history */}
          <Box id={'history'} pb={'28px'}>
            {chatHistory.map((item, index) => (
              <Box key={item.dataId} py={5}>
                {item.obj === 'Human' && (
                  <>
                    {/* control icon */}
                    <Flex w={'100%'} alignItems={'center'} justifyContent={'flex-end'}>
                      <ChatControllerComponent
                        chat={item}
                        onDelete={
                          onDelMessage
                            ? () => {
                              delOneMessage({ dataId: item.dataId, index });
                            }
                            : undefined
                        }
                        onRetry={() => retryInput(index)}
                      />
                      <ChatAvatar src={userAvatar} type={'Human'} placeholder={HUMAN_ICON} />
                    </Flex>
                    {/* content */}
                    <Box mt={['6px', 2]} textAlign={'right'}>
                      <Card
                        className="markdown"
                        {...MessageCardStyle}
                        color="white"
                        bg={'primary.humanGradient'}
                        borderRadius={'8px 0 8px 8px'}
                        textAlign={'left'}
                      >
                        {/* <Markdown source={item.value} isChatting={false} /> */}
                        <span>{item.value}</span>
                      </Card>
                    </Box>
                  </>
                )}
                {item.obj === 'AI' && (
                  <>
                    <Flex w={'100%'} alignItems={'center'}>
                      <ChatAvatar src={appAvatar} type={'AI'} placeholder={LOGO_ICON} />
                      {/* control icon */}
                      <ChatControllerComponent
                        ml={2}
                        chat={item}
                        setChatHistory={setChatHistory}
                        display={index === chatHistory.length - 1 && isChatting ? 'none' : 'flex'}
                        showVoiceIcon={showVoiceIcon}
                        ttsConfig={ttsConfig}
                        onDelete={
                          onDelMessage
                            ? () => {
                              delOneMessage({ dataId: item.dataId, index });
                            }
                            : undefined
                        }
                        onMark={
                          showMarkIcon
                            ? () => {
                              if (!item.dataId) return;
                              if (item.adminFeedback) {
                                setAdminMarkData({
                                  chatItemId: item.dataId,
                                  datasetId: item.adminFeedback.datasetId,
                                  collectionId: item.adminFeedback.collectionId,
                                  dataId: item.adminFeedback.dataId,
                                  q: item.adminFeedback.q || chatHistory[index - 1]?.value || '',
                                  a: item.adminFeedback.a
                                });
                              } else {
                                setAdminMarkData({
                                  chatItemId: item.dataId,
                                  q: chatHistory[index - 1]?.value || '',
                                  a: item.value
                                });
                              }
                            }
                            : undefined
                        }
                        onAddUserLike={
                          feedbackType !== FeedbackTypeEnum.user || item.userBadFeedback
                            ? undefined
                            : () => {
                              if (!item.dataId || !chatId || !appId) return;

                              const isGoodFeedback = !!item.userGoodFeedback;
                              setChatHistory((state) =>
                                state.map((chatItem) =>
                                  chatItem.dataId === item.dataId
                                    ? {
                                      ...chatItem,
                                      userGoodFeedback: isGoodFeedback ? undefined : 'yes'
                                    }
                                    : chatItem
                                )
                              );
                              try {
                                updateChatUserFeedback({
                                  appId,
                                  chatId,
                                  chatItemId: item.dataId,
                                  shareId,
                                  outLinkUid,
                                  userGoodFeedback: isGoodFeedback ? undefined : 'yes'
                                });
                              } catch (error) { }
                            }
                        }
                        onCloseUserLike={
                          feedbackType === FeedbackTypeEnum.admin
                            ? () => {
                              if (!item.dataId || !chatId || !appId) return;
                              setChatHistory((state) =>
                                state.map((chatItem) =>
                                  chatItem.dataId === item.dataId
                                    ? { ...chatItem, userGoodFeedback: undefined }
                                    : chatItem
                                )
                              );
                              updateChatUserFeedback({
                                appId,
                                chatId,
                                chatItemId: item.dataId,
                                userGoodFeedback: undefined
                              });
                            }
                            : undefined
                        }
                        onAddUserDislike={(() => {
                          if (feedbackType !== FeedbackTypeEnum.user || item.userGoodFeedback) {
                            return;
                          }
                          if (item.userBadFeedback) {
                            return () => {
                              if (!item.dataId || !chatId || !appId) return;
                              setChatHistory((state) =>
                                state.map((chatItem) =>
                                  chatItem.dataId === item.dataId
                                    ? { ...chatItem, userBadFeedback: undefined }
                                    : chatItem
                                )
                              );
                              try {
                                updateChatUserFeedback({
                                  appId,
                                  chatId,
                                  chatItemId: item.dataId,
                                  shareId,
                                  outLinkUid
                                });
                              } catch (error) { }
                            };
                          } else {
                            return () => setFeedbackId(item.dataId);
                          }
                        })()}
                        onReadUserDislike={
                          feedbackType === FeedbackTypeEnum.admin
                            ? () => {
                              if (!item.dataId) return;
                              setReadFeedbackData({
                                chatItemId: item.dataId || '',
                                content: item.userBadFeedback || ''
                              });
                            }
                            : undefined
                        }
                      />
                      {/* chatting status */}
                      {statusBoxData && index === chatHistory.length - 1 && (
                        <Flex
                          ml={3}
                          alignItems={'center'}
                          px={3}
                          py={'1px'}
                          borderRadius="md"
                          border={theme.borders.base}
                        >
                          <Box
                            className={styles.statusAnimation}
                            bg={statusBoxData.bg}
                            w="8px"
                            h="8px"
                            borderRadius={'50%'}
                            mt={'1px'}
                          ></Box>
                          <Box ml={2} color={'myGray.600'}>
                            {statusBoxData.name}
                          </Box>
                        </Flex>
                      )}
                    </Flex>
                    {/* content */}
                    <Box textAlign={'left'} mt={['6px', 2]}>
                      <Card bg={'white'} {...MessageCardStyle}>
                        <Markdown
                          source={(() => {
                            const text = item.value as string;

                            // replace quote tag: [source1] 标识第一个来源，需要提取数字1，从而去数组里查找来源
                            const quoteReg = /\[source:(.+)\]/g;
                            const replaceText = text.replace(quoteReg, `[QUOTE SIGN]($1)`);

                            // question guide
                            if (
                              index === chatHistory.length - 1 &&
                              !isChatting &&
                              questionGuides.length > 0
                            ) {
                              return `${replaceText}\n\`\`\`${CodeClassName.questionGuide
                                }\n${JSON.stringify(questionGuides)}`;
                            }
                            return replaceText;
                          })()}
                          isChatting={index === chatHistory.length - 1 && isChatting}
                        />

                        <ResponseTags responseData={item.responseData} isShare={!!shareId} />

                        {/* custom feedback */}
                        {item.customFeedbacks && item.customFeedbacks.length > 0 && (
                          <Box>
                            <ChatBoxDivider
                              icon={'core/app/customFeedback'}
                              text={t('core.app.feedback.Custom feedback')}
                            />
                            {item.customFeedbacks.map((text, i) => (
                              <Box key={`${text}${i}`}>
                                <MyTooltip label={t('core.app.feedback.close custom feedback')}>
                                  <Checkbox
                                    onChange={(e) => {
                                      if (e.target.checked && appId && chatId && item.dataId) {
                                        closeCustomFeedback({
                                          appId,
                                          chatId,
                                          chatItemId: item.dataId,
                                          index: i
                                        });
                                        // update dom
                                        setChatHistory((state) =>
                                          state.map((chatItem) =>
                                            chatItem.dataId === item.dataId
                                              ? {
                                                ...chatItem,
                                                customFeedbacks: chatItem.customFeedbacks?.filter(
                                                  (item, index) => index !== i
                                                )
                                              }
                                              : chatItem
                                          )
                                        );
                                      }
                                      console.log(e);
                                    }}
                                  >
                                    {text}
                                  </Checkbox>
                                </MyTooltip>
                              </Box>
                            ))}
                          </Box>
                        )}
                        {/* admin mark content */}
                        {showMarkIcon && item.adminFeedback && (
                          <Box fontSize={'sm'}>
                            <ChatBoxDivider
                              icon="core/app/markLight"
                              text={t('core.chat.Admin Mark Content')}
                            />
                            <Box whiteSpace={'pre'}>
                              <Box color={'black'}>{item.adminFeedback.q}</Box>
                              <Box color={'myGray.600'}>{item.adminFeedback.a}</Box>
                            </Box>
                          </Box>
                        )}
                      </Card>
                    </Box>
                  </>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <Box h={'0px'}>
        <ChatStopChattingComponent
          onStop={() => chatController.current?.abort('stop')}
          isChatting={isChatting}
        />
      </Box>
      <Box h={'0px'}>
        <ChatBottomGuideComponent
          items={chatBottomGuideItems}
          onClickGuideItem={(index) => {
            if (index >= 0 && index < chatBottomGuideItems.length) {
              const guideItem = chatBottomGuideItems[index];
              if (guideItem.questionId === 'human-handler') {
                humanServiceHandler({});
              } else {
                sendPrompt({
                  inputVal: guideItem.question
                });
              }
            }
          }}
          isChatting={isChatting}
        />
      </Box>
      {/* message input */}
      {onStartChat && variableIsFinish && active && (
        <MessageInput
          onSendMessage={(inputVal) => {
            sendPrompt({
              inputVal
            });
          }}
          onStop={() => chatController.current?.abort('stop')}
          isChatting={isChatting}
          TextareaDom={TextareaDom}
          resetInputVal={resetInputVal}
          showFileSelector={showFileSelector}
          safeAreaBottom={safeAreaBottom}
        />
      )}
      {/* user feedback modal */}
      {!!feedbackId && chatId && appId && (
        <FeedbackModal
          appId={appId}
          chatId={chatId}
          chatItemId={feedbackId}
          shareId={shareId}
          outLinkUid={outLinkUid}
          onClose={() => setFeedbackId(undefined)}
          onSuccess={(content: string) => {
            setChatHistory((state) =>
              state.map((item) =>
                item.dataId === feedbackId ? { ...item, userBadFeedback: content } : item
              )
            );
            setFeedbackId(undefined);
          }}
        />
      )}
      {/* admin read feedback modal */}
      {!!readFeedbackData && (
        <ReadFeedbackModal
          content={readFeedbackData.content}
          onClose={() => setReadFeedbackData(undefined)}
          onCloseFeedback={() => {
            setChatHistory((state) =>
              state.map((chatItem) =>
                chatItem.dataId === readFeedbackData.chatItemId
                  ? { ...chatItem, userBadFeedback: undefined }
                  : chatItem
              )
            );
            try {
              if (!chatId || !appId) return;
              updateChatUserFeedback({
                appId,
                chatId,
                chatItemId: readFeedbackData.chatItemId
              });
            } catch (error) { }
            setReadFeedbackData(undefined);
          }}
        />
      )}
      {/* admin mark data */}
      {!!adminMarkData && (
        <SelectMarkCollection
          adminMarkData={adminMarkData}
          setAdminMarkData={(e) => setAdminMarkData({ ...e, chatItemId: adminMarkData.chatItemId })}
          onClose={() => setAdminMarkData(undefined)}
          onSuccess={(adminFeedback) => {
            console.log(adminMarkData);
            if (!appId || !chatId || !adminMarkData.chatItemId) return;
            updateChatAdminFeedback({
              appId,
              chatId,
              chatItemId: adminMarkData.chatItemId,
              ...adminFeedback
            });

            // update dom
            setChatHistory((state) =>
              state.map((chatItem) =>
                chatItem.dataId === adminMarkData.chatItemId
                  ? {
                    ...chatItem,
                    adminFeedback
                  }
                  : chatItem
              )
            );

            if (readFeedbackData && chatId && appId) {
              updateChatUserFeedback({
                appId,
                chatId,
                chatItemId: readFeedbackData.chatItemId,
                userBadFeedback: undefined
              });
              setChatHistory((state) =>
                state.map((chatItem) =>
                  chatItem.dataId === readFeedbackData.chatItemId
                    ? { ...chatItem, userBadFeedback: undefined }
                    : chatItem
                )
              );
              setReadFeedbackData(undefined);
            }
          }}
        />
      )}
    </Flex>
  );
};

export default React.memo(forwardRef(ChatBox));

export const useChatBox = () => {
  const onExportChat = useCallback(
    ({ type, history }: { type: ExportChatType; history: ChatItemType[] }) => {
      const getHistoryHtml = () => {
        const historyDom = document.getElementById('history');
        if (!historyDom) return;
        const dom = Array.from(historyDom.children).map((child, i) => {
          const avatar = `<img src="${child.querySelector<HTMLImageElement>('.avatar')
            ?.src}" alt="" />`;

          const chatContent = child.querySelector<HTMLDivElement>('.markdown');

          if (!chatContent) {
            return '';
          }

          const chatContentClone = chatContent.cloneNode(true) as HTMLDivElement;

          const codeHeader = chatContentClone.querySelectorAll('.code-header');
          codeHeader.forEach((childElement: any) => {
            childElement.remove();
          });

          return `<div class="chat-item">
          ${avatar}
          ${chatContentClone.outerHTML}
        </div>`;
        });

        const html = htmlTemplate.replace('{{CHAT_CONTENT}}', dom.join('\n'));
        return html;
      };

      const map: Record<ExportChatType, () => void> = {
        md: () => {
          fileDownload({
            text: history.map((item) => item.value).join('\n\n'),
            type: 'text/markdown',
            filename: 'chat.md'
          });
        },
        html: () => {
          const html = getHistoryHtml();
          html &&
            fileDownload({
              text: html,
              type: 'text/html',
              filename: '聊天记录.html'
            });
        },
        pdf: () => {
          const html = getHistoryHtml();

          html &&
            // @ts-ignore
            html2pdf(html, {
              margin: 0,
              filename: `聊天记录.pdf`
            });
        }
      };

      map[type]();
    },
    []
  );

  return {
    onExportChat
  };
};

const WelcomeText = React.memo(function Welcome({
  welcomeText
}: {
  welcomeText: string;
}) {
  return (
    <Box py={3}>
      {/* message */}
      <Box position='relative' w={'100%'} {...WelcomeContainerStyle} textAlign={'left'}>
        {/* background */}
        <Image src="/icon/welcomeBg.png" w={'100%'} h={'100%'} alt={''} objectFit={'cover'}
          position="absolute"
          top={0}
          left={0}
          bottom={0}
          right={0}
          zIndex="1" />
        {/* message card */}
        <Card order={2} mt={2} {...WelcomeCardStyle} bg={'transparent'}>
          <Flex w={'calc(100%)'} alignItems={'flex-end'} >
            {/* source={`~~~guide \n${welcomeText}`} */}
            <Markdown source={`${welcomeText}`} isChatting={false} customClassName={`${MarkdownStyles.welcomeCard}`} />
            <Box w={'148px'} mr={'-20px'} mb={'-5px'} backgroundColor={"transparent"}>
              <Image src="/icon/xiaodaCartoon.png" w={'100%'} alt={''} objectFit={'cover'} />
            </Box>
          </Flex>
        </Card>
      </Box>
    </Box>
  );
});
const VariableInput = React.memo(function VariableInput({
  appAvatar,
  variableModules,
  variableIsFinish,
  chatForm,
  onSubmitVariables
}: {
  appAvatar?: string;
  variableModules: VariableItemType[];
  variableIsFinish: boolean;
  onSubmitVariables: (e: Record<string, any>) => void;
  chatForm: UseFormReturn<{
    variables: Record<string, any>;
  }>;
}) {
  const { t } = useTranslation();
  const { register, setValue, handleSubmit: handleSubmitChat, watch } = chatForm;
  const variables = watch('variables');

  return (
    <Box py={3}>
      {/* avatar */}
      <ChatAvatar src={appAvatar} type={'AI'} placeholder={LOGO_ICON} />
      {/* message */}
      <Box textAlign={'left'}>
        <Card order={2} mt={2} bg={'white'} w={'400px'} {...MessageCardStyle}>
          {variableModules.map((item) => (
            <Box key={item.id} mb={4}>
              <Box as={'label'} display={'inline-block'} position={'relative'} mb={1}>
                {item.label}
                {item.required && (
                  <Box
                    position={'absolute'}
                    top={'-2px'}
                    right={'-10px'}
                    color={'red.500'}
                    fontWeight={'bold'}
                  >
                    *
                  </Box>
                )}
              </Box>
              {item.type === VariableInputEnum.input && (
                <Input
                  isDisabled={variableIsFinish}
                  bg={'myWhite.400'}
                  {...register(`variables.${item.key}`, {
                    required: item.required
                  })}
                />
              )}
              {item.type === VariableInputEnum.textarea && (
                <Textarea
                  isDisabled={variableIsFinish}
                  bg={'myWhite.400'}
                  {...register(`variables.${item.key}`, {
                    required: item.required
                  })}
                  rows={5}
                  maxLength={4000}
                />
              )}
              {item.type === VariableInputEnum.select && (
                <MySelect
                  width={'100%'}
                  isDisabled={variableIsFinish}
                  list={(item.enums || []).map((item) => ({
                    label: item.value,
                    value: item.value
                  }))}
                  {...register(`variables.${item.key}`, {
                    required: item.required
                  })}
                  value={variables[item.key]}
                  onchange={(e) => {
                    setValue(`variables.${item.key}`, e);
                  }}
                />
              )}
            </Box>
          ))}
          {!variableIsFinish && (
            <Button
              leftIcon={<MyIcon name={'core/chat/chatFill'} w={'16px'} />}
              size={'sm'}
              maxW={'100px'}
              onClick={handleSubmitChat((data) => {
                onSubmitVariables(data);
              })}
            >
              {t('core.chat.Start Chat')}
            </Button>
          )}
        </Card>
      </Box>
    </Box>
  );
});

function ChatAvatar({
  src,
  type,
  placeholder
}: {
  src?: string;
  type: 'Human' | 'AI';
  placeholder?: string;
}) {
  const theme = useTheme();
  return (
    <Box
      w={['2.36rem', '2.68rem']}
      h={['2.36rem', '2.68rem']}
      p={'0px'}
      borderRadius={'50%'}
      border={theme.borders.base}
      boxShadow={'0 0 4px rgb(212,212,212)'}
      bg={type === 'Human' ? 'white' : 'primary.50'}
    >
      <Avatar
        src={src}
        w={'100%'}
        h={'100%'}
        placeholder={placeholder ?? ''}
        borderRadius={'50%'}
      />
    </Box>
  );
}

function Empty() {
  const { data: chatProblem } = useMarkdown({ url: '/chatProblem.md' });
  const { data: versionIntro } = useMarkdown({ url: '/versionIntro.md' });

  return (
    <Box pt={6} w={'85%'} maxW={'600px'} m={'auto'} alignItems={'center'} justifyContent={'center'}>
      {/* version intro */}
      <Card p={4} mb={10} minH={'200px'}>
        <Markdown source={versionIntro} />
      </Card>
      <Card p={4} minH={'600px'}>
        <Markdown source={chatProblem} />
      </Card>
    </Box>
  );
}

const ChatBottomGuideComponent = React.memo(function ChatBottomGuideComponent({
  items,
  onClickGuideItem,
  isChatting = false
}: {
  items: ChatBottomGuideItem[];
  onClickGuideItem?: (index: number) => void;
  isChatting: boolean;
}) {
  return (
    <Box
      display={isChatting ? 'none' : 'flex'}
      overflowX="auto"
      whiteSpace="nowrap"
      pl={3}
      pr={3}
      pb={2}
      bg={'transparent'}
      style={{
        transform: 'translateY(-100%)'
      }}
      zIndex={100}
    >
      <HStack spacing={'8px'} alignItems="center" whiteSpace={'nowrap'} overflowX={'auto'} zIndex={100}>
        {items.map((item, index) => (
          <Button
            key={item.questionId}
            height={'30px'}
            variant="primaryMain"
            style={{
              flexShrink: '0',
              minWidth: '60px',
              paddingLeft: '10px',
              paddingRight: '10px'
            }}
            onClick={() => {
              onClickGuideItem && onClickGuideItem(index);
            }}
          >
            {item.question}
          </Button>
        ))}
      </HStack>
    </Box>
  );
});

const ChatStopChattingComponent = React.memo(function ChatStopChattingComponent({
  onStop,
  isChatting
}: {
  onStop: () => void;
  isChatting: boolean;
}) {
  return (
    <Flex
      display={isChatting ? 'flex' : 'none'}
      style={{ backgroundColor: 'transparent', transform: 'translateY(-100%)' }}
      p={3}
      justifyContent="center"
    >
      <Button
        variant={'primaryGray'}
        pl={1}
        pr={3}
        h={'100%'}
        borderRadius={'xl'}
        leftIcon={<MyIcon name={'core/chat/chatStop'} w={'26px'} />}
        overflow={'hidden'}
        onClick={() => onStop()}
      >
        停止生成
      </Button>
    </Flex>
  );
});

const ChatControllerComponent = React.memo(function ChatControllerComponent({
  chat,
  setChatHistory,
  display,
  showVoiceIcon,
  ttsConfig,
  onReadUserDislike,
  onCloseUserLike,
  onMark,
  onRetry,
  onDelete,
  onAddUserDislike,
  onAddUserLike,
  ml,
  mr
}: {
  chat: ChatSiteItemType;
  setChatHistory?: React.Dispatch<React.SetStateAction<ChatSiteItemType[]>>;
  showVoiceIcon?: boolean;
  ttsConfig?: AppTTSConfigType;
  onRetry?: () => void;
  onDelete?: () => void;
  onMark?: () => void;
  onReadUserDislike?: () => void;
  onCloseUserLike?: () => void;
  onAddUserLike?: () => void;
  onAddUserDislike?: () => void;
} & FlexProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { copyData } = useCopyData();
  const { audioLoading, audioPlaying, hasAudio, playAudio, cancelAudio } = useAudioPlay({
    ttsConfig
  });
  const controlIconStyle = {
    w: '16px',
    cursor: 'pointer',
    p: 1,
    bg: 'white',
    borderRadius: 'md',
    boxShadow: '0 0 5px rgba(0,0,0,0.1)',
    border: theme.borders.base,
    mr: 3
  };
  const controlContainerStyle = {
    className: 'control',
    color: 'myGray.400',
    display: 'flex',
    pl: 1
  };

  return (
    <Flex {...controlContainerStyle} ml={ml} mr={mr} display={display}>
      <MyTooltip label={t('common.Copy')}>
        <MyIcon
          {...controlIconStyle}
          name={'copy'}
          _hover={{ color: 'primary.600' }}
          onClick={() => copyData(chat.value)}
        />
      </MyTooltip>
      {!!onDelete && (
        <>
          {onRetry && (
            <MyTooltip label={t('core.chat.retry')}>
              <MyIcon
                {...controlIconStyle}
                name={'common/retryLight'}
                _hover={{ color: 'green.500' }}
                onClick={onRetry}
              />
            </MyTooltip>
          )}
          <MyTooltip label={t('common.Delete')}>
            <MyIcon
              {...controlIconStyle}
              name={'delete'}
              _hover={{ color: 'red.600' }}
              onClick={onDelete}
            />
          </MyTooltip>
        </>
      )}
      {showVoiceIcon &&
        hasAudio &&
        (audioLoading ? (
          <MyTooltip label={t('common.Loading')}>
            <MyIcon {...controlIconStyle} name={'common/loading'} />
          </MyTooltip>
        ) : audioPlaying ? (
          <Flex alignItems={'center'} mr={2}>
            <MyTooltip label={t('core.chat.tts.Stop Speech')}>
              <MyIcon
                {...controlIconStyle}
                mr={1}
                name={'core/chat/stopSpeech'}
                color={'#E74694'}
                onClick={() => cancelAudio()}
              />
            </MyTooltip>
            <Image src="/icon/speaking.gif" w={'23px'} alt={''} />
          </Flex>
        ) : (
          <MyTooltip label={t('core.app.TTS')}>
            <MyIcon
              {...controlIconStyle}
              name={'common/voiceLight'}
              _hover={{ color: '#E74694' }}
              onClick={async () => {
                const response = await playAudio({
                  buffer: chat.ttsBuffer,
                  chatItemId: chat.dataId,
                  text: chat.value
                });

                if (!setChatHistory || !response.buffer) return;
                setChatHistory((state) =>
                  state.map((item) =>
                    item.dataId === chat.dataId
                      ? {
                        ...item,
                        ttsBuffer: response.buffer
                      }
                      : item
                  )
                );
              }}
            />
          </MyTooltip>
        ))}
      {!!onMark && (
        <MyTooltip label={t('core.chat.Mark')}>
          <MyIcon
            {...controlIconStyle}
            name={'core/app/markLight'}
            _hover={{ color: 'primary.main' }}
            onClick={onMark}
          />
        </MyTooltip>
      )}
      {!!onCloseUserLike && chat.userGoodFeedback && (
        <MyTooltip label={t('core.chat.feedback.Close User Like')}>
          <MyIcon
            {...controlIconStyle}
            color={'white'}
            bg={'primary.main'}
            fontWeight={'bold'}
            name={'core/chat/feedback/goodLight'}
            onClick={onCloseUserLike}
          />
        </MyTooltip>
      )}
      {!!onReadUserDislike && chat.userBadFeedback && (
        <MyTooltip label={t('core.chat.feedback.Read User dislike')}>
          <MyIcon
            {...controlIconStyle}
            color={'white'}
            bg={'primary.coral'}
            fontWeight={'bold'}
            name={'core/chat/feedback/badLight'}
            onClick={onReadUserDislike}
          />
        </MyTooltip>
      )}
      {!!onAddUserLike && (
        <MyIcon
          {...controlIconStyle}
          {...(!!chat.userGoodFeedback
            ? {
              color: 'white',
              bg: 'primary.main',
              fontWeight: 'bold'
            }
            : {
              _hover: { color: 'primary.main' }
            })}
          name={'core/chat/feedback/goodLight'}
          onClick={onAddUserLike}
        />
      )}
      {!!onAddUserDislike && (
        <MyIcon
          {...controlIconStyle}
          {...(!!chat.userBadFeedback
            ? {
              color: 'white',
              bg: 'primary.coral',
              fontWeight: 'bold',
              onClick: onAddUserDislike
            }
            : {
              _hover: { color: 'primary.coral' },
              onClick: onAddUserDislike
            })}
          name={'core/chat/feedback/badLight'}
        />
      )}
    </Flex>
  );
});
