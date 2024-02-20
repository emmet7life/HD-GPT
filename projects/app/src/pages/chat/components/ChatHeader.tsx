import React, { useMemo } from 'react';
import { Flex, useTheme, Box } from '@chakra-ui/react';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import MyIcon from '@fastgpt/web/components/common/Icon';
import Tag from '@/components/Tag';
import Avatar from '@/components/Avatar';
import ToolMenu from './ToolMenu';
import type { ChatItemType } from '@fastgpt/global/core/chat/type';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { chatContentReplaceBlock } from '@fastgpt/global/core/chat/utils';
import { LOGO_ICON } from '@fastgpt/global/common/system/constants';

const ChatHeader = ({
  history,
  appName,
  appAvatar,
  chatModels,
  appId,
  showHistory,
  onOpenSlider
}: {
  history: ChatItemType[];
  appName: string;
  appAvatar: string;
  chatModels?: string[];
  appId?: string;
  showHistory?: boolean;
  onOpenSlider: () => void;
}) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const { isPc } = useSystemStore();
  const title = useMemo(
    () =>
      chatContentReplaceBlock(history[history.length - 2]?.value)?.slice(0, 8) ||
      appName ||
      t('core.chat.New Chat'),
    [appName, history]
  );

  return (
    <Flex
      alignItems={['flex-start', 'center']}
      px={[4, 5]}
      h={['30px', '60px']}
      borderBottom={theme.borders.sm}
      overflow={'hidden'}
      color={'myGray.900'}
      bg={'white'}
    >
      {isPc ? (
        <>
          <Box mr={3} color={'myGray.1000'}>
            {title}
          </Box>
          <Tag colorSchema="main">
            <MyIcon name={'history'} w={'14px'} />
            <Box ml={1}>
              {history.length === 0
                ? t('core.chat.New Chat')
                : t('core.chat.History Amount', { amount: history.length })}
            </Box>
          </Tag>
          {!!chatModels && chatModels.length > 0 && (
            <Tag ml={2} colorSchema={'green'}>
              <MyIcon name={'core/chat/chatModelTag'} w={'14px'} />
              <Box ml={1}>{chatModels.join(',')}</Box>
            </Tag>
          )}
          <Box flex={1} />
        </>
      ) : (
        <>
          {showHistory && (
            <MyIcon
              name={'menu'}
              w={'20px'}
              h={'28px'}
              color={'myGray.900'}
              onClick={onOpenSlider}
            />
          )}

          <Flex
            bg="transparent"
            px={3}
            alignItems={'center'}
            flex={'1 0 0'}
            w={0}
            justifyContent={'center'}
          >
            <Avatar src={appAvatar} w={'28px'} placeholder={LOGO_ICON} />
            <Box
              ml={1}
              className="textEllipsis"
              fontWeight="bold"
              fontSize="18px"
              onClick={() => {
                appId && router.push(`/app/detail?appId=${appId}`);
              }}
            >
              {appName}
            </Box>
          </Flex>
        </>
      )}
      {/* control */}
      <ToolMenu history={history} isEnabled={false} />
    </Flex>
  );
};

export default ChatHeader;
