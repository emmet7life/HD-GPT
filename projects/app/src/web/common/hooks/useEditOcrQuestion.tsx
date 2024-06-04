import React, { useCallback, useRef } from 'react';
import { ModalFooter, ModalBody, useDisclosure, Button, Box, Textarea } from '@chakra-ui/react';
import MyModal from '@/components/MyModal';
import { useToast } from './useToast';
import { useTranslation } from 'next-i18next';

export const useEditOcrQuestion = ({
  title,
  tip,
  placeholder = '',
  canEmpty = true,
  valueRule
}: {
  title: string;
  tip?: string;
  placeholder?: string;
  canEmpty?: boolean;
  valueRule?: (val: string) => string | void;
}) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const onSuccessCb = useRef<(content: string) => void | Promise<void>>();
  const onErrorCb = useRef<(err: any) => void>();
  const { toast } = useToast();
  const defaultValue = useRef('');

  const onOpenModal = useCallback(
    ({
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
      defaultValue.current = defaultVal;
    },
    [onOpen]
  );

  const onclickConfirm = useCallback(async () => {
    if (!inputRef.current || !onSuccessCb.current) return;
    const val = inputRef.current.value;

    if (!canEmpty && !val) {
      inputRef.current.focus();
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

  // eslint-disable-next-line react/display-name
  const EditModal = useCallback(
    ({
      maxLength = 30,
      iconSrc = 'modal/edit',
      closeBtnText = t('common.Close')
    }: {
      maxLength?: number;
      iconSrc?: string;
      closeBtnText?: string;
    }) => (
      <MyModal isOpen={isOpen} onClose={onClose} iconSrc={iconSrc} title={title} maxW={'500px'}>
        <ModalBody>
          {!!tip && (
            <Box mb={2} color={'myGray.500'} fontSize={'sm'}>
              {tip}
            </Box>
          )}

          <Box mt={4} mb={1}>
            {t('core.app.App intro')}
          </Box>

          <Textarea
            rows={4}
            maxLength={500}
            placeholder={t('core.app.Make a brief introduction of your app')}
            bg={'myWhite.600'}
          />

          <Box mt={4} mb={1}>
            {t('core.app.App intro')}
          </Box>

          <Textarea
            rows={4}
            maxLength={500}
            placeholder={t('core.app.Make a brief introduction of your app')}
            bg={'myWhite.600'}
          />
        </ModalBody>
        <ModalFooter>
          {!!closeBtnText && (
            <Button mr={3} variant={'whiteBase'} onClick={onClose}>
              {closeBtnText}
            </Button>
          )}
          <Button onClick={onclickConfirm}>{t('common.Confirm')}</Button>
        </ModalFooter>
      </MyModal>
    ),
    [isOpen, onClose, onclickConfirm, placeholder, tip, title]
  );

  return {
    onOpenModal,
    EditModal
  };
};
