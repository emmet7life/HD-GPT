import React from 'react';
import { Image } from '@chakra-ui/react';
import type { ImageProps } from '@chakra-ui/react';
import { HUMAN_ICON } from '@fastgpt/global/common/system/constants';

const Avatar = ({ w = '30px', src, placeholder, ...props }: ImageProps) => {
  return (
    <Image
      fallbackSrc={placeholder || HUMAN_ICON}
      fallbackStrategy={'onError'}
      borderRadius={'md'}
      objectFit={'contain'}
      alt=""
      w={w}
      h={w}
      p={'1px'}
      src={src || placeholder}
      {...props}
    />
  );
};

export default Avatar;
