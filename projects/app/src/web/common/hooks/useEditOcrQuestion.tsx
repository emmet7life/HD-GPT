import React, { useCallback, useRef, useState } from 'react';
import {
  ModalFooter,
  ModalBody,
  useDisclosure,
  Button,
  Box,
  Textarea,
  Spinner,
  Flex
} from '@chakra-ui/react';
import MyModal from '@/components/MyModal';
import { useToast } from './useToast';
import { useTranslation } from 'next-i18next';
import { postOcrRequest } from '@/web/core/ai/api';
import { postOcrQuestion } from '@/web/core/ai/api';
import { ocrModel } from '@/web/common/system/staticData';

export const useEditOcrQuestion = ({
  ocrText,
  ocrQuestion,
  imgSrc,
  shareId = '',
  tip = '',
  canEmpty = false,
  valueRule
}: {
  ocrText: string;
  ocrQuestion: string;
  imgSrc: string;
  shareId?: string;
  tip?: string;
  canEmpty?: boolean;
  valueRule?: (val: string) => string | void;
}) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const onMakeLLQuestionCb = useRef<(content: string) => Promise<string>>();
  const onSuccessCb = useRef<(content: string) => void | Promise<void>>();
  const onErrorCb = useRef<(err: any) => void>();
  const { toast } = useToast();
  const ocrTextDomRef = useRef<HTMLTextAreaElement | null>(null);
  const ocrQuestionDomRef = useRef<HTMLTextAreaElement | null>(null);

  const replaceHostAndPort = useCallback((url: string, newHost: string) => {
    try {
      const parsedUrl = new URL(url);
      const newParsedUrl = new URL(newHost);

      parsedUrl.protocol = newParsedUrl.protocol;
      parsedUrl.hostname = newParsedUrl.hostname;
      parsedUrl.port = newParsedUrl.port;

      return parsedUrl.toString();
    } catch (error) {
      console.error('Invalid URL:', error);
      return url;
    }
  }, []);

  const onOpenModal = useCallback(
    async ({
      defaultVal,
      onSuccess,
      onError
    }: {
      defaultVal: string;
      onSuccess: (content: string) => any;
      onError?: (err: any) => void;
    }) => {
      onOpen();
      onSuccessCb.current = onSuccess;
      onErrorCb.current = onError;

      const result = await postOcrRequest({
        imageUrl: replaceHostAndPort(defaultVal, 'https://hd.hdmicrowave.com'),
        apiBaseUrl: ocrModel.apiBaseUrl,
        apiPath: ocrModel.apiPath
      });
      console.log('PROGRESS ocrRequest postOcrRequest OCR:', result);
      if (ocrTextDomRef.current) {
        ocrTextDomRef.current.value = result.content;
      }
    },
    [onOpen]
  );

  const onClickConfirm = useCallback(async () => {
    if (!ocrQuestionDomRef.current || !onSuccessCb.current) return;
    const val = ocrQuestionDomRef.current.value;

    if (!canEmpty && !val) {
      ocrQuestionDomRef.current.focus();
      return toast({
        status: 'warning',
        title: t('core.chat.ocr.Tips Question Empty')
      });
      return;
    }

    if (valueRule) {
      const result = valueRule(val);
      if (result) {
        return toast({
          status: 'warning',
          title: result
        });
      }
    }

    try {
      await onSuccessCb.current(val);

      onClose();
    } catch (err) {
      onErrorCb.current?.(err);
    }
  }, [canEmpty, onClose]);

  const onPrepareMakeLLMQuestion = useCallback(async () => {
    try {
      const ocrContent = ocrTextDomRef.current?.value || '';
      if (ocrContent) {
        if (onMakeLLQuestionCb.current) {
          const result = await onMakeLLQuestionCb.current(ocrContent);
          // setIsQuestionMaking(true);
          // const result = await postOcrQuestion({ message: ocrContent, shareId: shareId });
          console.log('useEditOcrQuestion.tsx >> onMakeLLMQuestion OCR:', result);
          if (ocrQuestionDomRef.current && result) {
            ocrQuestionDomRef.current.value = result;
          }
          // setIsQuestionMaking(false);
        }
      } else {
        ocrTextDomRef.current?.focus();
        toast({
          status: 'warning',
          title: t('core.chat.ocr.Tips OCR Text Empty')
        });
      }
    } catch (error) {
      console.log('onMakeLLMQuestion catch error', error);
      // setIsQuestionMaking(false);
    }
  }, []);

  // eslint-disable-next-line react/display-name
  const EditModal = useCallback(
    ({
      iconSrc = 'modal/edit',
      closeBtnText = t('common.Close'),
      isQuestionMaking,
      onMakeLLMQuestion
    }: {
      iconSrc?: string;
      closeBtnText?: string;
      isQuestionMaking: boolean;
      onMakeLLMQuestion: (ocrText: string) => Promise<string>;
    }) => {
      onMakeLLQuestionCb.current = onMakeLLMQuestion;
      return (
        <MyModal
          isOpen={isOpen}
          onClose={onClose}
          iconSrc={iconSrc}
          title={t('core.chat.ocr.Modal Title')}
          maxW={'500px'}
          iconW="40px"
        >
          <ModalBody>
            {!!tip && (
              <Box mb={2} color={'myGray.500'} fontSize={'sm'}>
                {tip}
              </Box>
            )}

            <Box mt={0} mb={1}>
              {t('core.chat.ocr.OCR Text')}
            </Box>

            <Textarea
              ref={ocrTextDomRef}
              rows={4}
              maxLength={500}
              placeholder={t('core.chat.ocr.OCR Text Placeholder')}
              bg={'myWhite.600'}
            />

            <Box
              mt={2}
              mb={1}
              position="relative"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <Button
                mt={3}
                width={'100%'}
                variant={'primaryMain'}
                onClick={onPrepareMakeLLMQuestion}
              >
                {t('core.chat.ocr.Generate Question')}
              </Button>
              {isQuestionMaking && (
                <Flex
                  position={'absolute'}
                  alignItems={'center'}
                  justifyContent={'center'}
                  rounded={'md'}
                  color={'primary.500'}
                  top={0}
                  left={0}
                  bottom={0}
                  right={0}
                  bg={'rgba(255,255,255,0.8)'}
                >
                  <Spinner position="absolute" top={'40%'} />
                </Flex>
              )}
            </Box>

            <Box mt={4} mb={1}>
              {t('core.chat.ocr.LLM Question With OCR Text')}
            </Box>

            <Textarea
              ref={ocrQuestionDomRef}
              rows={4}
              maxLength={500}
              placeholder={t('core.chat.ocr.LLM Question With OCR Text Placeholder')}
              bg={'myWhite.600'}
            />
          </ModalBody>
          <ModalFooter>
            {!!closeBtnText && (
              <Button mr={3} variant={'whiteBase'} onClick={onClose}>
                {closeBtnText}
              </Button>
            )}
            <Button onClick={onClickConfirm}>{t('common.Confirm')}</Button>
          </ModalFooter>
        </MyModal>
      );
    },
    [isOpen, onClose, onClickConfirm, onPrepareMakeLLMQuestion, ocrText, ocrQuestion, tip, imgSrc]
  );

  return {
    onOpenModal,
    EditModal
  };
};
