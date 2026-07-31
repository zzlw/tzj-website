/** 营销弹窗活动（GET /trade-shows/marketing/active 白名单字段） */
export interface MarketingActivity {
  id: string;
  /** 展会详情页路径成分：externalUrl 留空时 CTA 跳 /resources/trade-shows/[slug] */
  slug: string;
  title: string;
  content: string | null;
  /** 弹窗专用文案（Markdown）；留空回退 content（详情正文仅服务详情页） */
  popupContent: string | null;
  coverImage: string | null;
  /** 弹窗专用头图；留空回退 coverImage（封面图仅服务列表/详情页） */
  popupImage: string | null;
  /** 活动类型 slug（exhibition/seminar/roadshow/promotion），弹窗眉标 i18n 用 */
  eventType: string;
  triggerMode: 'immediate' | 'delay' | 'scroll';
  delaySeconds: number;
  frequency: 'session' | 'daily' | 'once';
  excludePages: string[];
  targetDevice: 'all' | 'mobile' | 'desktop';
  ctaText: string;
  /** 官网链接：填了则 CTA 新标签页打开，留空回退站内详情页 */
  externalUrl: string | null;
}
