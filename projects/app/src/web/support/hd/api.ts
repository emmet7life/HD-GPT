import { GET } from '@/web/common/api/request';
// import request from '@/web/common/api/hd/request';
const isProd = process.env.NODE_ENV === 'production';
console.log("process.env.NODE_ENV", process.env.NODE_ENV);
// const baseURL = isProd ? "https://hd.hdmicrowave.com/v1" : "http://192.168.16.71:8082";
const baseURL = "https://hd.hdmicrowave.com/v1";
import type { ChatBottomGuideItem } from '@fastgpt/global/core/hd/type.d';

// export const getChatPageGuideItems = () => request({
//     url: "/userInfo/wx/getAreaManagerInfo/92",
//     method: "get",
// });

export const getChatPageGuideItems = () => GET<ChatBottomGuideItem[]>("/ai/getCommonQuestionList", {}, {
    baseURL: baseURL,
});
