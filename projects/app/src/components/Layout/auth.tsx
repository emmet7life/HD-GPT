import { useRouter } from 'next/router';
import { useToast } from '@chakra-ui/react';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useQuery } from '@tanstack/react-query';

const unAuthPage: { [key: string]: boolean } = {
  '/': true,
  '/login': true,
  '/login/provider': true,
  '/login/fastlogin': true,
  '/appStore': true,
  '/chat/share': true,
  '/tools/price': true
};

const Auth = ({ children }: { children: JSX.Element }) => {
  console.log('Layout >> Auth组件 初始化', children);

  const router = useRouter();
  const toast = useToast({
    title: '请先登录',
    position: 'top',
    status: 'warning'
  });
  const { userInfo, initUserInfo } = useUserStore();
  console.log('Layout >> Auth组件 初始化 >> userInfo', userInfo);
  console.log('Layout >> Auth组件 初始化 >> router.pathname', router.pathname);

  useQuery(
    [router.pathname],
    () => {
      console.log('Layout >> Auth组件 初始化 >> useQuery 执行 userInfo', userInfo);
      console.log('Layout >> Auth组件 初始化 >> useQuery 执行 router.pathname', router.pathname);
      if (unAuthPage[router.pathname] === true || userInfo) {
        return null;
      } else {
        return initUserInfo();
      }
    },
    {
      onError(error) {
        console.log('error->', error);
        router.replace(
          `/login?lastRoute=${encodeURIComponent(location.pathname + location.search)}`
        );
        toast();
      }
    }
  );

  return userInfo || unAuthPage[router.pathname] === true ? children : null;
};

export default Auth;
