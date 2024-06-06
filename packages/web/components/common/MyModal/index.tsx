import React, { WheelEventHandler, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalContentProps,
  Box,
  Image,
  useDisclosure
} from '@chakra-ui/react';
import MyIcon from '../Icon';

export interface MyModalProps extends ModalContentProps {
  iconSrc?: string;
  iconW?: string;
  iconH?: string;
  title?: any;
  isCentered?: boolean;
  isOpen: boolean;
  onClose?: () => void;
  isPc?: boolean;
}

const CustomModal = ({
  isOpen,
  onClose,
  iconSrc,
  iconW,
  iconH,
  title,
  children,
  isCentered,
  w = 'auto',
  maxW = ['90vw', '600px'],
  ...props
}: MyModalProps) => {
  const {
    isOpen: isImageModalOpen,
    onOpen: OnImageModalOpen,
    onClose: onImageModalClose
  } = useDisclosure();
  const [scale, setScale] = useState(1);

  const handleWheel: WheelEventHandler<HTMLImageElement> = (e) => {
    setScale((prevScale) => {
      const newScale = prevScale + e.deltaY * 0.5 * -0.01;
      if (newScale < 0.5) return 0.5;
      if (newScale > 10) return 10;
      return newScale;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose && onClose()}
      autoFocus={false}
      isCentered={isCentered}
    >
      <ModalOverlay />
      <ModalContent
        w={w}
        minW={['90vw', '400px']}
        maxW={maxW}
        position={'relative'}
        maxH={'85vh'}
        boxShadow={'7'}
        {...props}
      >
        {!title && onClose && <ModalCloseButton zIndex={1} />}
        {!!title && (
          <ModalHeader
            display={'flex'}
            alignItems={'center'}
            fontWeight={500}
            background={'#FBFBFC'}
            borderBottom={'1px solid #F4F6F8'}
            roundedTop={'lg'}
            py={'10px'}
          >
            {iconSrc && (
              <>
                {iconSrc.startsWith('/') || iconSrc.startsWith('http') ? (
                  <Image
                    mr={3}
                    objectFit={'contain'}
                    alt=""
                    src={iconSrc}
                    w={iconW || '20px'}
                    h={iconH || 'auto'}
                    onClick={OnImageModalOpen}
                  />
                ) : (
                  <MyIcon mr={3} name={iconSrc as any} w={'20px'} />
                )}
              </>
            )}
            {title}
            <Box flex={1} />
            {onClose && (
              <ModalCloseButton position={'relative'} fontSize={'sm'} top={0} right={0} />
            )}
          </ModalHeader>
        )}

        <Box
          overflow={props.overflow || 'overlay'}
          h={'100%'}
          display={'flex'}
          flexDirection={'column'}
        >
          {children}
        </Box>

        <Modal isOpen={isImageModalOpen} onClose={onImageModalClose} isCentered>
          <ModalOverlay />
          <ModalContent boxShadow={'none'} maxW={'auto'} w="auto" bg={'transparent'}>
            <Image
              transform={`scale(${scale})`}
              borderRadius={'md'}
              src={iconSrc}
              alt={''}
              w={'100%'}
              maxH={'80vh'}
              referrerPolicy="no-referrer"
              fallbackSrc={'/imgs/errImg.png'}
              fallbackStrategy={'onError'}
              objectFit={'contain'}
              onWheel={handleWheel}
            />
          </ModalContent>
          <ModalCloseButton bg={'myWhite.500'} zIndex={999999} />
        </Modal>
      </ModalContent>
    </Modal>
  );
};

export default CustomModal;
