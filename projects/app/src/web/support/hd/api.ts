import { GET, POST } from '@/web/common/api/request';
// import request from '@/web/common/api/hd/request';
const isProd = process.env.NODE_ENV === 'production';
console.log("process.env.NODE_ENV", process.env.NODE_ENV);
// const baseURL = isProd ? "https://hd.hdmicrowave.com/v1" : "http://192.168.16.71:8082";
const baseURL = "https://hd.hdmicrowave.com/v1";
const baseURL_xd = "https://xiaoda.hdmicrowave.com/xd";
import type { ChatBottomGuideItem } from '@fastgpt/global/core/hd/type.d';

// export const getChatPageGuideItems = () => request({
//     url: "/userInfo/wx/getAreaManagerInfo/92",
//     method: "get",
// });

export const getChatPageGuideItems = () => GET<ChatBottomGuideItem[]>("/ai/getCommonQuestionList", {}, {
    baseURL: baseURL,
});

export const xd_refreshToken = (token: string) => POST("/user/refreshToken", {}, {
    baseURL: baseURL_xd,
    headers: {
        "Authorization": `Bearer ${token}`
    },
    getCode: true
});
