import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ChatBottomGuideItem } from '@fastgpt/global/core/hd/type.d';

type State = {
  chatBottomGuideItems: ChatBottomGuideItem[];
  setChatBottomGuideItems: (item: ChatBottomGuideItem[]) => void;
};

export const useChatStore = create<State>()(
  devtools(
    // persist(
    immer((set, get) => ({
      chatBottomGuideItems: [],
      setChatBottomGuideItems(items: ChatBottomGuideItem[]) {
        set((state) => {
          let mapedItems = items.map((item) => {
            let mapItem: ChatBottomGuideItem = {
              question: item.question,
              questionId: item.questionId
            };
            return mapItem;
          });
          mapedItems.unshift({
            question: '转人工',
            questionId: 'human-handler'
          });
          state.chatBottomGuideItems = mapedItems;
        });
      }
    }))
    // ,
    // {
    //     name: 'HDChatStore',
    //     partialize: (state) => ({
    //         chatBottomGuideItems: state.chatBottomGuideItems,
    //     })
    // }
    // )
  )
);
