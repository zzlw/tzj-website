import type { SitePublicSettings } from "@tzj/types";

/** C 端站点设置默认值（与 API settings.defaults 对齐） */
export const DEFAULT_SITE_PUBLIC_SETTINGS: SitePublicSettings = {
  contact: {
    phone: "0371-58691119",
    email: "REDACTED-EMAIL",
    address: {
      "zh-CN": "河南省郑州市高新技术开发区科学大道",
      "zh-TW": "河南省鄭州市高新技術開發區科學大道",
      en: "Kexue Avenue, High-tech Development Zone, Zhengzhou, Henan",
    },
  },
  legal: {
    beian: "豫ICP备XXXXXXXX号",
    beianUrl: "https://beian.miit.gov.cn",
  },
  social: {
    channels: [
      {
        id: "wechat-1",
        platform: "wechat",
        purpose: "contact",
        enabled: true,
        sortOrder: 0,
        qr: "content/wechat.jpg",
      },
      {
        id: "douyin-1",
        platform: "douyin",
        purpose: "follow",
        enabled: true,
        sortOrder: 1,
        qr: "content/douyin.jpg",
      },
    ],
  },
  analytics: {
    geoMode: "ip",
  },
};
