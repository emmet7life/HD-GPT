import axios from "axios";

function tansParams(params: { [key: string]: any }) {
    let result = ''
    for (const propName of Object.keys(params)) {
        const value = params[propName];
        var part = encodeURIComponent(propName) + "=";
        if (value !== null && value !== "" && typeof (value) !== "undefined") {
            if (typeof value === 'object') {
                for (const key of Object.keys(value)) {
                    if (value[key] !== null && value[key] !== "" && typeof (value[key]) !== 'undefined') {
                        let params = propName + '[' + key + ']';
                        var subPart = encodeURIComponent(params) + "=";
                        result += subPart + encodeURIComponent(value[key]) + "&";
                    }
                }
            } else {
                result += part + encodeURIComponent(value) + "&";
            }
        }
    }
    return result
}

// 创建axios实例
const service = axios.create({
    baseURL: process.env.BASE_API, // api的base_url
    timeout: 15000 // 请求超时时间
});

// request拦截器
service.interceptors.request.use(
    config => {
        console.log("service.interceptors.request config", config.url, config);
        config.headers["login-type"] = "pc";
        // if (store.getters.token) {
        //     // 让每个请求携带自定义token 请根据实际情况自行修改
        //     config.headers["Authorization"] = getToken();
        // }

        // get请求映射params参数
        if (config.method === 'get' && config.params) {
            let url = config.url + '?' + tansParams(config.params);
            url = url.slice(0, -1);
            config.params = {};
            config.url = url;
        }

        return config;
    },
    error => {
        // Do something with request error
        console.log("service.interceptors.request error", error); // for debug
        Promise.reject(error);
    }
);

// respone拦截器
service.interceptors.response.use(
    response => {
        console.log(
            "service.interceptors.response: url",
            response.config && response.config.url,
            ", data",
            response.data
        );
        /**
         * code为非200是抛错 可结合自己业务进行修改
         */
        const res = response.data;
        if (res.code !== 200) {
            if (response.request.responseType === 'blob') {
                return response.data;
            }

            // Message({
            //     message: res.message,
            //     type: "error",
            //     duration: 3 * 1000
            // });

            // 401:未登录;
            if (res.code === 401) {
                // MessageBox.confirm(
                //     "你已被登出，可以取消继续留在该页面，或者重新登录",
                //     "确定登出",
                //     {
                //         confirmButtonText: "重新登录",
                //         cancelButtonText: "取消",
                //         type: "warning"
                //     }
                // ).then(() => {
                //     store.dispatch("FedLogOut").then(() => {
                //         location.reload(); // 为了重新实例化vue-router对象 避免bug
                //     });
                // });
            }
            return Promise.reject("error");
        } else {
            return response.data;
        }
    },
    error => {
        console.log("service.interceptors.response error", error); // for debug
        // Message({
        //     message: error.message,
        //     type: "error",
        //     duration: 3 * 1000
        // });
        return Promise.reject(error);
    }
);

export default service;