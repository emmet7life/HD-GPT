import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { UserUpdateParams } from '@/types/user';
import type { UserType } from '@fastgpt/global/support/user/type.d';
import { formatStorePrice2Read } from '@fastgpt/global/support/wallet/bill/tools';
import { getTokenLogin, putUserInfo } from '@/web/support/user/api';

type State = {
  userInfo: UserType | null; // 用户信息
  initUserInfo: () => Promise<UserType>; // 初始化用户信息
  setUserInfo: (user: UserType | null) => void; // 设置用户信息
  updateUserInfo: (user: UserUpdateParams) => Promise<void>; // 更新用户信息
};

export const useUserStore = create<State>()(
  devtools(
    persist(
      immer((set, get) => ({
        userInfo: null,
        async initUserInfo() {
          const res = await getTokenLogin();

          console.log('useUserStore >> initUserInfo getTokenLogin res', res);

          get().setUserInfo(res);

          return res;
        },
        setUserInfo(user: UserType | null) {
          set((state) => {
            state.userInfo = user
              ? {
                  ...user,
                  balance: formatStorePrice2Read(user.balance)
                }
              : null;
          });
        },
        async updateUserInfo(user: UserUpdateParams) {
          const oldInfo = (get().userInfo ? { ...get().userInfo } : null) as UserType | null;
          set((state) => {
            if (!state.userInfo) return;
            state.userInfo = {
              ...state.userInfo,
              ...user
            };
          });
          try {
            await putUserInfo(user);
          } catch (error) {
            set((state) => {
              state.userInfo = oldInfo;
            });
            return Promise.reject(error);
          }
        }
      })),
      {
        name: 'userStore',
        partialize: (state) => ({})
      }
    )
  )
);
