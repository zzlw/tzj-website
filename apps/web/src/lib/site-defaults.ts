import type { SitePublicSettings } from '@tzj/types';

/** C 端站点设置默认值（与 API settings.defaults 对齐） */
export const DEFAULT_SITE_PUBLIC_SETTINGS: SitePublicSettings = {
  contact: {
    phone: '0371-58691119',
    phoneAlt: 'REDACTED-PHONE',
    primaryPhone: 'phone',
    email: 'contact@tzjii.com',
    address: {
      'zh-CN': '河南省郑州市高新技术开发区科学大道',
      'zh-TW': '河南省鄭州市高新技術開發區科學大道',
      en: 'Kexue Avenue, High-tech Development Zone, Zhengzhou, Henan',
    },
  },
  legal: {
    beian: '豫ICP备20013982号',
    beianUrl: 'https://beian.miit.gov.cn',
    gonganBeian: '豫公网安备41010702004123号',
    gonganBeianUrl: 'https://beian.mps.gov.cn/#/query/webSearch',
  },
  social: {
    channels: [
      {
        id: 'wechat-1',
        platform: 'wechat',
        purpose: 'contact',
        enabled: true,
        sortOrder: 0,
        qr: 'content/wechat.jpg',
      },
      {
        id: 'douyin-1',
        platform: 'douyin',
        purpose: 'follow',
        enabled: true,
        sortOrder: 1,
        qr: 'content/douyin.jpg',
      },
    ],
  },
  analytics: {
    geoMode: 'ip',
    ipGeoSource: 'offline',
  },
  businessHours: {
    enabled: true,
    timezone: 'Asia/Shanghai',
    weekdays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 18,
    holidays: [],
  },
  agentProfile: {
    name: '客服小拓',
    avatar: '',
    title: '在线客服',
    greeting: '您好 👋\n\n请描述您的问题，我会尽快为您解答。',
  },
  chatPrompts: {
    offlineMessage: {},
    noAgentMessage: {},
  },
  screenWatermark: {
    enabled: false,
    text: '',
    opacity: 0.08,
  },
};
