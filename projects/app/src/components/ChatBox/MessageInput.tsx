import { useSpeech } from '@/web/common/hooks/useSpeech';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import {
  Box, Flex, Image as ChakraImage, Spinner, Textarea, Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton, useDisclosure, Button
} from '@chakra-ui/react';
import React, { useRef, useEffect, useCallback, useState, useTransition } from 'react';
import { useTranslation } from 'next-i18next';
import MyTooltip from '../MyTooltip';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useRouter } from 'next/router';
import { useSelectFile } from '@/web/common/file/hooks/useSelectFile';
import { compressImgFileAndUpload } from '@/web/common/file/controller';
import { customAlphabet } from 'nanoid';
import { IMG_BLOCK_KEY } from '@fastgpt/global/core/chat/constants';
import { addDays } from 'date-fns';
import { useRequest } from '@/web/common/hooks/useRequest';
import { MongoImageTypeEnum } from '@fastgpt/global/common/file/image/constants';
import { postOcrQuestion } from '@/web/core/ai/api';
import { postOcrRequest } from '@/web/core/ai/api';
import { ocrModel } from '@/web/common/system/staticData';
import { useEditOcrQuestion } from '@/web/common/hooks/useEditOcrQuestion';
import Cropper, { Area } from 'react-easy-crop'
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 6);

enum FileTypeEnum {
  image = 'image',
  file = 'file'
}
type FileItemType = {
  id: string;
  rawFile: File;
  type: `${FileTypeEnum}`;
  name: string;
  icon: string; // img is base64
  src?: string;
};

const MessageInput = ({
  onChange,
  onSendMessage,
  onStop,
  isChatting,
  TextareaDom,
  showFileSelector = false,
  resetInputVal,
  safeAreaBottom = 0
}: {
  onChange?: (e: string) => void;
  onSendMessage: (e: string) => void;
  onStop: () => void;
  isChatting: boolean;
  showFileSelector?: boolean;
  TextareaDom: React.MutableRefObject<HTMLTextAreaElement | null>;
  resetInputVal: (val: string) => void;
  safeAreaBottom?: number;
}) => {
  const [, startSts] = useTransition();

  const { shareId } = useRouter().query as { shareId?: string };
  const {
    isSpeaking,
    isTransCription,
    stopSpeak,
    startSpeak,
    speakingTimeString,
    renderAudioGraph,
    stream
  } = useSpeech({ shareId });
  const { isPc } = useSystemStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useTranslation();
  const textareaMinH = 34;
  const [fileList, setFileList] = useState<FileItemType[]>([]);
  const [fileUploading, setFileUploading] = useState<boolean>();
  const [ocrRequesting, setOcrRequesting] = useState<boolean>();
  const [isQuestionMaking, setIsQuestionMaking] = useState<boolean>(false);
  const havInput = !!TextareaDom.current?.value && !fileUploading && !ocrRequesting; // || fileList.length > 0;
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrQuestion, setOcrQuestion] = useState<string>('');
  const [ocrImageSrc, setOcrImageSrc] = useState<string>('');

  // 图片裁剪
  // const [originChoosedFile, setOriginChoosedFile] = useState<FileItemType>();
  const [base64ImageData, setBase64ImageData] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area>();
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area>();
  const [rotation, setRotation] = useState(0);
  const [cropSize, setCropSize] = useState({ width: 0, height: 0 });
  const [mediaSize, setMediaSize] = useState({
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0,
  })
  const onCropComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      console.log("onCropComplete croppedArea", croppedArea);
      console.log("onCropComplete croppedAreaPixels", croppedAreaPixels);
      setCroppedArea(croppedArea);
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [base64ImageData]
  );

  const onCropImage = useCallback(async () => {
    try {
      console.log("onCropImage", croppedAreaPixels);
      if (croppedAreaPixels) {
        const croppedImage = await getCroppedImg(
          {
            imageSrc: base64ImageData,
            pixelCrop: croppedAreaPixels,
            rotation,
            flip: { horizontal: false, vertical: false }
          }
        );
        console.log('onCropImage croppedImage', { croppedImage })
        if (croppedImage) {
          setBase64ImageData(croppedImage);
          const images = fileList.filter((item) => item.type === FileTypeEnum.image);
          if (images && images.length > 0) {
            const file = images[0];
            uploadFile({ ...file, ...{ base64ImgData: croppedImage } });
          }
        }
      }

    } catch (e) {
      console.error(e)
    }
  }, [croppedAreaPixels, base64ImageData, rotation, fileList]);

  const {
    isOpen: isCropImageModalOpen,
    onOpen: OnCropImageModalOpen,
    onClose: onCropImageModalClose
  } = useDisclosure();

  const onCropImageModalClosed = () => {
    setFileList([]);
    setFileUploading(false);
    setBase64ImageData("");
    setCroppedArea(undefined);
    setCroppedAreaPixels(undefined);
    setRotation(0);
    onCropImageModalClose();
  };

  const createImage = useCallback((url: string): Promise<CanvasImageSource & { width: number; height: number; }> => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
      image.src = url
    })
  }, []);

  const getRadianAngle = useCallback((degreeValue: number) => {
    return (degreeValue * Math.PI) / 180;
  }, []);

  const rotateSize = useCallback((width: number, height: number, rotation: number): { width: number, height: number } => {
    const rotRad = getRadianAngle(rotation);

    return {
      width:
        Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
      height:
        Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    }
  }, []);

  const getCroppedImg = useCallback(async ({
    imageSrc,
    pixelCrop,
    rotation = 0,
    flip = { horizontal: false, vertical: false } }: {
      imageSrc: string;
      pixelCrop: Area;
      rotation: number;
      flip: { horizontal: boolean, vertical: boolean }
    }): Promise<string | null> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return null
    }

    const rotRad = getRadianAngle(rotation)

    // calculate bounding box of the rotated image
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
      image.width,
      image.height,
      rotation
    )

    // set canvas size to match the bounding box
    canvas.width = bBoxWidth
    canvas.height = bBoxHeight

    // translate canvas context to a central location to allow rotating and flipping around the center
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
    ctx.rotate(rotRad)
    ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
    ctx.translate(-image.width / 2, -image.height / 2)

    // draw rotated image
    ctx.drawImage(image, 0, 0)

    const croppedCanvas = document.createElement('canvas')

    const croppedCtx = croppedCanvas.getContext('2d')

    if (!croppedCtx) {
      return null
    }

    // Set the size of the cropped canvas
    croppedCanvas.width = pixelCrop.width
    croppedCanvas.height = pixelCrop.height

    // Draw the cropped image onto the new canvas
    croppedCtx.drawImage(
      canvas,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    )

    // As Base64 string
    return croppedCanvas.toDataURL('image/jpeg');
    // As a blob
    // return new Promise((resolve, reject) => {
    //   croppedCanvas.toBlob((file) => {
    //     resolve(URL.createObjectURL(file))
    //   }, 'image/png')
    // })
  }, []);

  const { onOpenModal, EditModal: EditOcrQuestionModal } = useEditOcrQuestion({
    ocrText: ocrText,
    ocrQuestion: ocrQuestion,
    imgSrc: ocrImageSrc,
    shareId: shareId
  });

  const { File, onOpen: onOpenSelectFile } = useSelectFile({
    fileType: 'image/*',
    multiple: false,
    maxCount: 1
  });

  const { mutate: uploadFile } = useRequest({
    mutationFn: async (file: FileItemType & { base64ImgData?: string; }) => {
      if (file.type === FileTypeEnum.image) {
        try {
          const src = await compressImgFileAndUpload({
            type: MongoImageTypeEnum.chatImage,
            file: file.rawFile,
            base64ImgData: file.base64ImgData,
            maxW: 4329,
            maxH: 4329,
            maxSize: 1024 * 1024 * 20,// 20M
            // 30 day expired.
            expiredTime: addDays(new Date(), 99999999),
            shareId
          });
          setFileList((state) =>
            state.map((item) =>
              item.id === file.id
                ? {
                  ...item,
                  src: `${location.origin}${src}`
                }
                : item
            )
          );
          setFileUploading(false);
        } catch (error) {
          setFileList((state) => state.filter((item) => item.id !== file.id));
          console.log(error);
          setFileUploading(false);
          return Promise.reject(error);
        }
      } else {
        setFileUploading(false);
      }
    },
    errorToast: t('common.Upload File Failed')
  });

  const onTextareaDomTextChangedHandler = useCallback(() => {
    if (TextareaDom.current) {
      // 当前光标所在位置
      let currentCursorPosition = TextareaDom.current.selectionStart;

      // 调整文本框高度
      // TextareaDom.current.value += '\n';
      TextareaDom.current.style.height = `${textareaMinH}px`;
      TextareaDom.current.style.height = `${Math.max(
        TextareaDom.current.scrollHeight,
        textareaMinH
      )}px`;

      // 将光标移动到新行末尾（即当前行下一行的开始）
      TextareaDom.current.selectionStart = currentCursorPosition;
      TextareaDom.current.selectionEnd = currentCursorPosition;
      // e.preventDefault(); // 阻止默认行为，即阻止执行其他可能的操作（如发送）
    }
  }, [textareaMinH]);

  const onMakeLLMQuestion = useCallback(async (ocrText: string) => {
    var finalQuestion = '';
    try {
      setIsQuestionMaking(true);
      if (ocrText) {
        const question = await postOcrQuestion({ message: ocrText, shareId: '' });
        console.log('OCR:', question);
        finalQuestion = question;
        // 更新内容
        // setOcrQuestion(question);
      } else {
        // 处理 OCR 文本为空的情况
      }
    } catch (error) {
      console.log('Error making question:', error);
    } finally {
      setIsQuestionMaking(false);
      return finalQuestion;
    }
  }, []);

  // const replaceHostAndPort = useCallback((url: string, newHost: string) => {
  //   try {
  //     const parsedUrl = new URL(url);
  //     const newParsedUrl = new URL(newHost);

  //     parsedUrl.protocol = newParsedUrl.protocol;
  //     parsedUrl.hostname = newParsedUrl.hostname;
  //     parsedUrl.port = newParsedUrl.port;

  //     return parsedUrl.toString();
  //   } catch (error) {
  //     console.error('Invalid URL:', error);
  //     return url;
  //   }
  // }, []);

  const onSelectFile = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) {
        return;
      }
      const loadFiles = await Promise.all(
        files.map((file) => {
          setFileUploading(true);
          return new Promise<FileItemType>((resolve, reject) => {
            if (file.type.includes('image')) {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => {
                const item = {
                  id: nanoid(),
                  rawFile: file,
                  type: FileTypeEnum.image,
                  name: file.name,
                  icon: reader.result as string
                };
                console.log("onSelectFile loadFiles item", item);
                // uploadFile(item);
                OnCropImageModalOpen();
                // setOriginChoosedFile(item);
                setBase64ImageData(item.icon);
                setFileUploading(false);
                resolve(item);
              };
              reader.onerror = () => {
                reject(reader.error);
              };
            } else {
              resolve({
                id: nanoid(),
                rawFile: file,
                type: FileTypeEnum.file,
                name: file.name,
                icon: 'file/pdf'
              });
            }
          });
        })
      );

      // setFileList((state) => [...state, ...loadFiles]);
      setFileList(loadFiles); // 暂时只允许传递一张图片
    },
    [uploadFile]
  );

  useEffect(() => {
    console.log('PROGRESS fileList updated', fileList);
    const ocrRequest = async () => {
      try {
        setOcrRequesting(true);
        const images = fileList.filter((item) => item.type === FileTypeEnum.image);
        const imgSrcList = images.map((img) => img.src);
        for (let index = 0; index < imgSrcList.length; index++) {
          const imgSrc = imgSrcList[index] || '';
          if (imgSrc) {
            // const ocrContent = ``;
            // const result = await postOcrQuestion({ message: ocrContent, shareId: shareId });
            // console.log("MessageInput.tsx >> onSelectFile OCR 识别总结:", result);
            // if (TextareaDom.current) {
            //   TextareaDom.current.value = result;
            // }
            // console.log("global.ocrEnv", global.ocrEnv);

            // console.log("PROGRESS ocrRequest ocrModel", ocrModel);

            // const result = await postOcrRequest({
            //   imageUrl: replaceHostAndPort(imgSrc, "https://hd.hdmicrowave.com"),
            //   apiBaseUrl: ocrModel.apiBaseUrl,
            //   apiPath: ocrModel.apiPath
            // });
            // console.log("PROGRESS ocrRequest postOcrRequest OCR识别:", result);

            // setOcrText(result.content);
            // setOcrImageSrc(result.url);

            setOcrText('');
            setOcrQuestion('');
            setOcrImageSrc(imgSrc);
            onCropImageModalClosed();

            onOpenModal({
              defaultVal: imgSrc,
              onSuccess: (questionText) => {
                console.log('XXXXX questionText', questionText);
                if (TextareaDom.current && questionText) {
                  var newValue = TextareaDom.current.value;
                  if (newValue) {
                    newValue += '\n';
                  }
                  TextareaDom.current.value = newValue + (questionText || '');
                  onTextareaDomTextChangedHandler();
                }
              }
            });

            setFileList([]);

            // if (TextareaDom.current && result) {
            //   var newValue = TextareaDom.current.value;
            //   if (newValue) {
            //     newValue += "\n";
            //   }
            //   TextareaDom.current.value = newValue + (result.content || "");
            //   onTextareaDomTextChangedHandler();
            // }
          }
        }
        setOcrRequesting(false);
      } catch (error) {
        console.log('PROGRESS ocrRequest catch error', error);
        setOcrRequesting(false);
      }
    };
    ocrRequest();
  }, [fileList]);

  const handleSend = useCallback(async () => {
    const textareaValue = TextareaDom.current?.value || '';

    //     const images = fileList.filter((item) => item.type === FileTypeEnum.image);
    //     const imagesText =
    //       images.length === 0
    //         ? ''
    //         : `\`\`\`${IMG_BLOCK_KEY}
    // ${images.map((img) => JSON.stringify({ src: img.src })).join('\n')}
    // \`\`\`
    // `;
    //     const inputMessage = `${imagesText}${textareaValue}`;
    const inputMessage = `${textareaValue}`;

    onSendMessage(inputMessage);
    setFileList([]);
  }, [TextareaDom, fileList, onSendMessage]);

  useEffect(() => {
    if (!stream) {
      return;
    }
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 1;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const renderCurve = () => {
      if (!canvasRef.current) return;
      renderAudioGraph(analyser, canvasRef.current);
      window.requestAnimationFrame(renderCurve);
    };
    renderCurve();
  }, [renderAudioGraph, stream]);

  // console.log("safeAreaBottom", safeAreaBottom);

  let _safeAreaBottom = safeAreaBottom;
  if (!_safeAreaBottom) {
    _safeAreaBottom = 3; // 保底的bottom内边距值
  }

  return (
    <Box
      m={['0px auto', '10px auto']}
      {...(isPc
        ? {}
        : {
          boxShadow: isSpeaking ? `0 0 10px rgba(54,111,255,0.4)` : `0 0 10px rgba(0,0,0,0.2)`,
          bg: 'white'
        })}
      pb={[`${_safeAreaBottom || 0}px`, '0px']}
      w={'100%'}
      maxW={['auto', 'min(800px, 100%)']}
      px={[0, 5]}
    >
      <Box
        {...(isPc
          ? {
            boxShadow: isSpeaking ? `0 0 10px rgba(54,111,255,0.4)` : `0 0 10px rgba(0,0,0,0.2)`
          }
          : {})}
        pt={fileList.length > 0 ? '10px' : ['14px', '18px']}
        pb={['6px', '18px']}
        position={'relative'}
        borderRadius={['none', 'md']}
        bg={'white'}
        overflow={'hidden'}
        {...(isPc
          ? {
            border: '1px solid',
            borderColor: 'rgba(0,0,0,0.12)'
          }
          : {
            borderTop: '1px solid',
            borderTopColor: 'rgba(0,0,0,0.15)'
          })}
      >
        {/* translate loading */}
        <Flex
          position={'absolute'}
          top={0}
          bottom={0}
          left={0}
          right={0}
          zIndex={10}
          pl={5}
          alignItems={'center'}
          bg={'white'}
          color={'primary.500'}
          visibility={isSpeaking && isTransCription ? 'visible' : 'hidden'}
        >
          <Spinner size={'sm'} mr={4} />
          {t('core.chat.Converting to text')}
        </Flex>

        {/* file preview */}
        <Flex wrap={'wrap'} px={[2, 4]} userSelect={'none'}>
          {fileList.map((item) => (
            <Box
              key={item.id}
              border={'1px solid rgba(0,0,0,0.12)'}
              mr={2}
              mb={2}
              rounded={'md'}
              position={'relative'}
              _hover={{
                '.close-icon': { display: item.src ? 'block' : 'none' }
              }}
            >
              {/* uploading */}
              {!item.src && (
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
                  <Spinner />
                </Flex>
              )}
              <MyIcon
                name={'closeSolid'}
                w={'16px'}
                h={'16px'}
                color={'myGray.700'}
                cursor={'pointer'}
                _hover={{ color: 'primary.500' }}
                position={'absolute'}
                bg={'white'}
                right={'-8px'}
                top={'-8px'}
                onClick={() => {
                  setFileList((state) => state.filter((file) => file.id !== item.id));
                }}
                className="close-icon"
                display={['', 'none']}
              />
              {item.type === FileTypeEnum.image && (
                <ChakraImage
                  alt={'img'}
                  src={item.icon}
                  w={['50px', '70px']}
                  h={['50px', '70px']}
                  borderRadius={'md'}
                  objectFit={'contain'}
                />
              )}
            </Box>
          ))}
        </Flex>

        <Flex
          bg={'white'}
          pb={['8px', '0px']}
          alignItems={'flex-end'}
          mt={fileList.length > 0 ? 1 : 0}
          pl={[3, 4]}
        >
          {/* file selector */}
          {showFileSelector && (
            <Flex
              h={'34px'}
              marginRight={['2', '2']}
              alignItems={'center'}
              justifyContent={'center'}
              cursor={'pointer'}
              transform={'translateY(1px)'}
              onClick={() => {
                if (isSpeaking) return;
                onOpenSelectFile();
              }}
            >
              <MyTooltip label={t('core.chat.Select Image')}>
                <MyIcon name={'core/chat/fileSelect'} w={'18px'} color={'myGray.600'} />
              </MyTooltip>
              <File onSelect={onSelectFile} />
            </Flex>
          )}

          {/* input area */}
          <Textarea
            ref={TextareaDom}
            py={1.5}
            pl={2}
            fontSize={'1rem'}
            pr={['3px', '3px']}
            {...(isPc
              ? {
                border: 'none',
                _focusVisible: {
                  border: 'none'
                }
              }
              : {
                border: '1px solid rgba(212, 212, 212, 1.0)',
                _focusVisible: {
                  border: '1px solid #20599b'
                }
              })}
            placeholder={isSpeaking ? t('core.chat.Speaking') : t('core.chat.Type a message')}
            resize={'none'}
            overflow={'auto'}
            borderRadius={'8px'}
            rows={1}
            w={['calc(100% - 76px)', 'calc(100% - 75px)']}
            h={'34px'}
            minH={'34px'}
            lineHeight={'1.5rem'}
            maxHeight={'150px'}
            maxLength={-1}
            overflowY={'auto'}
            whiteSpace={'pre-wrap'}
            wordBreak={'break-all'}
            boxShadow={'none !important'}
            color={'myGray.900'}
            isDisabled={isSpeaking}
            onChange={(e) => {
              const textarea = e.target;
              textarea.style.height = `${textareaMinH}px`;
              textarea.style.height = `${Math.max(textarea.scrollHeight, textareaMinH)}px`;
              startSts(() => {
                onChange?.(textarea.value);
              });
            }}
            onKeyDown={(e) => {
              // enter send.(pc or iframe && enter and unPress shift)
              const isEnter = e.keyCode === 13;
              if (TextareaDom.current && isEnter && ((isPc && (e.ctrlKey || e.altKey)) || !isPc)) {
                onTextareaDomTextChangedHandler();
                return;
              }

              // 全选内容
              // @ts-ignore
              e.key === 'a' && e.ctrlKey && e.target?.select();

              if ((isPc || window !== parent) && e.keyCode === 13 && !e.shiftKey) {
                handleSend();
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              const clipboardData = e.clipboardData;
              if (clipboardData && showFileSelector) {
                const items = clipboardData.items;
                const files = Array.from(items)
                  .map((item) => (item.kind === 'file' ? item.getAsFile() : undefined))
                  .filter(Boolean) as File[];
                onSelectFile(files);
              }
            }}
          />
          <Flex
            alignItems={'center'}
            position={'absolute'}
            right={[3, 4]}
            bg={'transparent'}
            bottom={['15px', '18px']}
          >
            {/* voice-input */}
            {!shareId && !havInput && !isChatting && (
              <>
                <canvas
                  ref={canvasRef}
                  style={{
                    height: '30px',
                    width: isSpeaking && !isTransCription ? '100px' : 0,
                    background: 'white',
                    zIndex: 0
                  }}
                />
                <Flex
                  mr={'0px'}
                  alignItems={'center'}
                  justifyContent={'center'}
                  flexShrink={0}
                  h={['26px', '32px']}
                  w={['26px', '32px']}
                  marginRight={[3, 3]}
                  borderRadius={'md'}
                  cursor={'pointer'}
                  _hover={{ bg: '#F5F5F8' }}
                  onClick={() => {
                    if (isSpeaking) {
                      return stopSpeak();
                    }
                    startSpeak(resetInputVal);
                  }}
                >
                  <MyTooltip label={isSpeaking ? t('core.chat.Stop Speak') : t('core.chat.Record')}>
                    <MyIcon
                      name={isSpeaking ? 'core/chat/stopSpeechFill' : 'core/chat/recordFill'}
                      width={['20px', '22px']}
                      height={['20px', '22px']}
                      color={'primary.500'}
                    />
                  </MyTooltip>
                </Flex>
              </>
            )}
            {/* send and stop icon */}
            {isSpeaking ? (
              <Box color={'#5A646E'} w={'36px'} textAlign={'right'}>
                {speakingTimeString}
              </Box>
            ) : (
              <Flex
                mr={'0px'}
                alignItems={'center'}
                justifyContent={'center'}
                flexShrink={0}
                h={['34px', '32px']}
                w={['34px', '32px']}
                borderRadius={'md'}
                bg={isSpeaking || isChatting ? '' : !havInput ? '#E5E5E5' : 'primary.main'}
                cursor={havInput ? 'pointer' : 'not-allowed'}
                lineHeight={1}
                onClick={() => {
                  if (isChatting) {
                    return onStop();
                  }
                  if (havInput) {
                    return handleSend();
                  }
                }}
              >
                {isChatting ? (
                  <MyIcon
                    animation={'zoomStopIcon 0.4s infinite alternate'}
                    width={['22px', '25px']}
                    height={['22px', '25px']}
                    cursor={'pointer'}
                    name={'stop'}
                    color={'gray.500'}
                  />
                ) : (
                  <MyTooltip label={t('core.chat.Send Message')}>
                    <MyIcon
                      name={'core/chat/sendFill'}
                      width={['18px', '20px']}
                      height={['18px', '20px']}
                      color={'white'}
                    />
                  </MyTooltip>
                )}
              </Flex>
            )}
          </Flex>
        </Flex>

        <EditOcrQuestionModal
          iconSrc={ocrImageSrc}
          isQuestionMaking={isQuestionMaking}
          onMakeLLMQuestion={onMakeLLMQuestion}
        />

        <Modal isOpen={isCropImageModalOpen} onClose={onCropImageModalClosed} isCentered>
          <ModalOverlay />
          <ModalContent w={"100%"} h={"100%"} boxShadow={'none'} bg={'transparent'}>
            <Box position={"absolute"} top={0} left={0} right={0} bottom={0} w={"100%"} >
              <Cropper
                image={base64ImageData}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                // aspect={4 / 3}
                onRotationChange={setRotation}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                setMediaSize={setMediaSize}
                setCropSize={setCropSize}
              />
              <Box position={"absolute"} left={0} bottom={12} w={"100%"} padding={4}>
                <Button mr={3} variant={'primary'} w={"100%"} onClick={onCropImage}>
                  {t('core.chat.ocr.Crop Image')}
                </Button>
              </Box>
            </Box>
          </ModalContent>
          <ModalCloseButton bg={'myWhite.500'} zIndex={999999} />
        </Modal>
      </Box>
    </Box>
  );
};

export default React.memo(MessageInput);
