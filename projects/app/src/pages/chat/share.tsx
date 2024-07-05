import SideBar from '@/components/SideBar';
import { gptMessage2ChatType } from '@/utils/adapt';
import { streamFetch } from '@/web/common/api/fetch';
import { useToast } from '@/web/common/hooks/useToast';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useShareChatStore } from '@/web/core/chat/storeShareChat';
import { Box, Drawer, DrawerContent, DrawerOverlay, Flex, useDisclosure } from '@chakra-ui/react';
import { getErrText } from '@fastgpt/global/common/error/utils';
import type { ChatHistoryItemType, ChatSiteItemType } from '@fastgpt/global/core/chat/type.d';
import { useQuery } from '@tanstack/react-query';
import { customAlphabet } from 'nanoid';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 12);

import ChatBox, { type ComponentRef, type StartChatFnProps } from '@/components/ChatBox';
import PageContainer from '@/components/PageContainer';
import MyBox from '@/components/common/MyBox';
import { POST } from '@/web/common/api/request';
import { serviceSideProps } from '@/web/common/utils/i18n';
import { getInitOutLinkChatInfo } from '@/web/core/chat/api';
import { useChatStore as useHDChatStore } from '@/web/core/chat/hd/storeChat';
import { useChatStore } from '@/web/core/chat/storeChat';
import { checkChatSupportSelectFileByChatModels } from '@/web/core/chat/utils';
import { getChatPageGuideItems, xd_refreshToken } from '@/web/support/hd/api';
import { ChatStatusEnum } from '@fastgpt/global/core/chat/constants';
import { chatContentReplaceBlock } from '@fastgpt/global/core/chat/utils';
import { useTranslation } from 'next-i18next';
import { useSearchParams } from 'next/navigation';
import ChatHeader from './components/ChatHeader';
import ChatHistorySlider from './components/ChatHistorySlider';

const OutLink = ({
  shareId,
  chatId,
  showHistory,
  authToken
}: {
  shareId: string;
  chatId: string;
  showHistory: '0' | '1';
  authToken?: string;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const { isOpen: isOpenSlider, onClose: onCloseSlider, onOpen: onOpenSlider } = useDisclosure();
  const { isPc } = useSystemStore();
  const ChatBoxRef = useRef<ComponentRef>(null);
  const forbidRefresh = useRef(false);
  const initSign = useRef(false);
  const [isEmbed, setIdEmbed] = useState(true);
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams);
  const avatarUrl = params.get('avatarUrl');
  const accessToken = params.get('accessToken') || undefined;
  const miniProgramUserId = params.get('miniProgramUserId') || undefined;// 微信小程序端传入的用户ID
  let safeAreaBottom = 0;
  if (params.get('safeAreaBottom')) {
    try {
      safeAreaBottom = Number(params.get('safeAreaBottom'));
    } catch (error) { }
  }
  console.log('OutLink >> params searchParams', searchParams);
  console.log('OutLink >> params', params);
  console.log('OutLink >> params get miniProgramUserId', miniProgramUserId);
  console.log('OutLink >> params get avatarUrl', avatarUrl);
  console.log('OutLink >> params get accessToken', accessToken);
  console.log('OutLink >> params get safeAreaBottom', safeAreaBottom);

  const {
    localUId,
    shareChatHistory, // abandon
    clearLocalHistory // abandon
  } = useShareChatStore();
  const {
    histories,
    loadHistories,
    pushHistory,
    updateHistory,
    delOneHistory,
    chatData,
    setChatData,
    delOneHistoryItem,
    clearHistories
  } = useChatStore();
  const {
    setChatBottomGuideItems
  } = useHDChatStore();
  const appId = chatData.appId;
  const outLinkUid: string = authToken || localUId;

  const startChat = useCallback(
    async ({ messages, controller, generatingMessage, variables }: StartChatFnProps) => {
      const prompts = messages.slice(-2);
      const completionChatId = chatId ? chatId : nanoid();

      const { responseText, responseData } = await streamFetch({
        data: {
          messages: prompts,
          variables,
          shareId,
          chatId: completionChatId,
          outLinkUid,
          userId: miniProgramUserId || "root",// 会话用户ID
        },
        onMessage: generatingMessage,
        abortSignal: controller
      });

      const newTitle =
        chatContentReplaceBlock(prompts[0].content).slice(0, 20) ||
        prompts[1]?.value?.slice(0, 20) ||
        t('core.chat.New Chat');

      // new chat
      if (completionChatId !== chatId) {
        const newHistory: ChatHistoryItemType = {
          chatId: completionChatId,
          updateTime: new Date(),
          title: newTitle,
          appId,
          top: false
        };
        pushHistory(newHistory);
        if (controller.signal.reason !== 'leave') {
          forbidRefresh.current = true;
          router.replace({
            query: {
              ...router.query,
              chatId: completionChatId
            }
          });
        }
      } else {
        // update chat
        const currentChat = histories.find((item) => item.chatId === chatId);
        currentChat &&
          updateHistory({
            ...currentChat,
            updateTime: new Date(),
            title: newTitle,
            shareId,
            outLinkUid
          });
      }

      // update chat window
      setChatData((state) => ({
        ...state,
        title: newTitle,
        history: ChatBoxRef.current?.getChatHistories() || state.history
      }));

      /* post message to report result */
      const result: ChatSiteItemType[] = gptMessage2ChatType(prompts).map((item) => ({
        ...item,
        status: 'finish'
      }));
      result[1].value = responseText;
      result[1].responseData = responseData;

      window.top?.postMessage(
        {
          type: 'shareChatFinish',
          data: {
            question: result[0]?.value,
            answer: result[1]?.value
          }
        },
        '*'
      );

      return { responseText, responseData, isNewChat: forbidRefresh.current };
    },
    [chatId, shareId, outLinkUid, setChatData, appId, pushHistory, router, histories, updateHistory]
  );

  const loadChatInfo = useCallback(
    async (shareId: string, chatId: string) => {
      if (!shareId) return null;

      try {
        const res = await getInitOutLinkChatInfo({
          chatId,
          shareId,
          outLinkUid
        });
        const history = res.history.map((item) => ({
          ...item,
          status: ChatStatusEnum.finish
        }));

        setChatData({
          ...res,
          history
        });

        ChatBoxRef.current?.resetHistory(history);
        ChatBoxRef.current?.resetVariables(res.variables);

        // send init message
        if (!initSign.current) {
          initSign.current = true;
          if (window !== top) {
            window.top?.postMessage({ type: 'shareChatReady' }, '*');
          }
        }

        if (chatId && res.history.length > 0) {
          setTimeout(() => {
            ChatBoxRef.current?.scrollToBottom('auto');
          }, 500);
        }
      } catch (e: any) {
        console.log(e);
        toast({
          status: 'error',
          title: getErrText(e, t('core.shareChat.Init Error'))
        });
        if (chatId) {
          router.replace({
            query: {
              ...router.query,
              chatId: ''
            }
          });
        }
      }

      return null;
    },
    [outLinkUid, router, setChatData, t, toast]
  );

  const { isFetching } = useQuery(['init', shareId, chatId], () => {
    if (forbidRefresh.current) {
      forbidRefresh.current = false;
      return null;
    }

    return loadChatInfo(shareId, chatId);
  });

  const {
    data
  } = useQuery(['getChatPageGuideItems'], getChatPageGuideItems, {
    onSuccess(res) {
      console.log("getChatPageGuideItems success", res);
      if (res) {
        setChatBottomGuideItems(res);
      }
    }
  });
  console.log("getChatPageGuideItems data", data);

  // const xd_refreshToken_wrapper = async (token: string) => {
  //   try {
  //     const response = await xd_refreshToken(token);
  //     console.log("xd_refreshToken xd_refreshToken_wrapper response", response)
  //     return response;
  //   } catch (error) {

  //   }
  //   return null;
  // }

  if (accessToken) {
    console.log("xd_refreshToken starting");
    const token = accessToken;
    const { isLoading, data: tokenData, error } = useQuery(["xd_refreshToken", token],
      () => xd_refreshToken(token), {
      onSuccess(data) {
        console.log("xd_refreshToken onSuccess, data", data);
      },
      onError(err) {
        console.log("xd_refreshToken onError, err", err);
        // @ts-ignore
        if (err && err.code === 401) {
          setTimeout(() => {
            // console.log('share.tsx window postMessage to http://localhost:5173');
            // if (window !== top) {
            //   window.top?.postMessage("Logout", "http://localhost:5173");
            // } else {
            //   window.postMessage("Logout", "http://localhost:5173");
            // }
            userLogout();
          }, 2000);
        }
      },
    });
    console.log("xd_refreshToken end, isLoading", isLoading, ", tokenData", tokenData, ",error", error);
  }

  const userLogout = () => {
    console.warn("share page userLogout method invoked");
    const isProd = process.env.NODE_ENV === 'production';
    const origin = isProd ? "https://xiaoda.hdmicrowave.com" : "http://localhost:5173";
    console.warn("share page userLogout method invoked, origin", origin);
    var step = 0;
    if (window && window.top) {
      console.warn("share page userLogout method invoked, window.top not NULL");
      try {
        window.top.postMessage("Logout", origin);
        step += 1;
        console.warn("share page userLogout method invoked, window.top not NULL, step 1");
        window.top.location.replace(
          "/login?action=logout"
        );
        console.warn("share page userLogout method invoked, window.top not NULL, step 2");
      } catch (error) {
        if (step <= 0) {
          window.top?.location.replace(
            "/login?action=logout"
          );
        }
        console.warn("share page userLogout top window post replace route catch error", error);
      }
    } else {
      try {
        console.warn("share page userLogout method invoked, window.top is NULL");
        window.postMessage("Logout", origin);
        step += 1;
        console.warn("share page userLogout method invoked, window.top is NULL, step 1");
        window.location.replace(
          "/login?action=logout"
        );
        console.warn("share page userLogout method invoked, window.top is NULL, step 2");
      } catch (error) {
        if (step <= 0) {
          window.location.replace(
            "/login?action=logout"
          );
        }
        console.warn("share page userLogout window post replace route catch error", error);
      }
    }

  }

  // load histories
  useQuery(['loadHistories', outLinkUid, shareId], () => {
    if (shareId && outLinkUid) {
      return loadHistories({
        shareId,
        outLinkUid
      });
    }
    return null;
  });

  // window init
  useEffect(() => {
    setIdEmbed(window !== top);
  }, []);

  // todo:4.6.4 init: update local chat history, add outLinkUid
  useEffect(() => {
    const activeHistory = shareChatHistory.filter((item) => !item.delete);
    if (!localUId || !shareId || activeHistory.length === 0) return;
    (async () => {
      try {
        await POST('/core/chat/initLocalShareHistoryV464', {
          shareId,
          outLinkUid: localUId,
          chatIds: shareChatHistory.map((item) => item.chatId)
        });
        clearLocalHistory();
        // router.reload();
      } catch (error) {
        toast({
          status: 'warning',
          title: getErrText(error, t('core.shareChat.Init Error'))
        });
      }
    })();
  }, [clearLocalHistory, localUId, router, shareChatHistory, shareId, t, toast]);

  return (
    <PageContainer
      {...(isEmbed
        ? { p: '0 !important', insertProps: { borderRadius: '0', boxShadow: 'none' } }
        : { p: [0, 5] })}
    >
      <Head>
        <title>{chatData.app.name}</title>
      </Head>
      <MyBox
        isLoading={isFetching}
        h={'100%'}
        display={'flex'}
        flexDirection={['column', 'row']}
        bg={'transparent'}
      >
        {showHistory === '1'
          ? ((children: React.ReactNode) => {
            return isPc ? (
              <SideBar>{children}</SideBar>
            ) : (
              <Drawer
                isOpen={isOpenSlider}
                placement="left"
                autoFocus={false}
                size={'xs'}
                onClose={onCloseSlider}
              >
                <DrawerOverlay backgroundColor={'rgba(0,0,0,0.3)'} />
                <DrawerContent maxWidth={'250px'} boxShadow={'2px 0 10px rgba(0,0,0,0.15)'}>
                  {children}
                </DrawerContent>
              </Drawer>
            );
          })(
            <ChatHistorySlider
              accessToken={accessToken}
              appName={chatData.app.name}
              appAvatar={chatData.app.avatar}
              activeChatId={chatId}
              history={histories.map((item) => ({
                id: item.chatId,
                title: item.title,
                customTitle: item.customTitle,
                top: item.top
              }))}
              onClose={onCloseSlider}
              onChangeChat={(chatId) => {
                router.replace({
                  query: {
                    ...router.query,
                    chatId: chatId || ''
                  }
                });
                if (!isPc) {
                  onCloseSlider();
                }
              }}
              onDelHistory={({ chatId }) =>
                delOneHistory({ appId: chatData.appId, chatId, shareId, outLinkUid })
              }
              onClearHistory={() => {
                clearHistories({ shareId, outLinkUid });
                router.replace({
                  query: {
                    ...router.query,
                    chatId: ''
                  }
                });
              }}
              onSetHistoryTop={(e) => {
                updateHistory({
                  ...e,
                  appId: chatData.appId,
                  shareId,
                  outLinkUid
                });
              }}
              onSetCustomTitle={async (e) => {
                updateHistory({
                  appId: chatData.appId,
                  chatId: e.chatId,
                  title: e.title,
                  customTitle: e.title,
                  shareId,
                  outLinkUid
                });
              }}
              onLogout={() => {
                userLogout();
              }}
            />
          )
          : null}

        {/* chat container */}
        <Flex
          position={'relative'}
          h={[0, '100%']}
          w={['100%', 0]}
          flex={'1 0 0'}
          flexDirection={'column'}
        >
          {/* header */}
          <ChatHeader
            appAvatar={chatData.app.avatar}
            appName={chatData.app.name}
            history={chatData.history}
            showHistory={showHistory === '1'}
            onOpenSlider={onOpenSlider}
          />
          {/* chat box */}
          <Box flex={1}>
            <ChatBox
              active={!!chatData.app.name}
              ref={ChatBoxRef}
              appAvatar={chatData.app.avatar}
              userAvatar={avatarUrl || ''}
              safeAreaBottom={safeAreaBottom}
              userGuideModule={chatData.app?.userGuideModule}
              showFileSelector={checkChatSupportSelectFileByChatModels(chatData.app.chatModels)}
              feedbackType={'user'}
              onUpdateVariable={(e) => { }}
              onStartChat={startChat}
              onDelMessage={(e) =>
                delOneHistoryItem({ ...e, appId: chatData.appId, chatId, shareId, outLinkUid })
              }
              appId={chatData.appId}
              chatId={chatId}
              shareId={shareId}
              outLinkUid={outLinkUid}
              userId={miniProgramUserId}
              accessToken={accessToken}
            />
          </Box>
        </Flex>
      </MyBox>
    </PageContainer>
  );
};

export async function getServerSideProps(context: any) {
  const shareId = context?.query?.shareId || '';
  const chatId = context?.query?.chatId || '';
  const showHistory = context?.query?.showHistory || '1';
  const authToken = context?.query?.authToken || '';

  return {
    props: {
      shareId,
      chatId,
      showHistory,
      authToken,
      ...(await serviceSideProps(context))
    }
  };
}

export default OutLink;
