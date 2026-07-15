import type { AppLocale } from '@/i18n/routing';

/** 弹窗中展示的语言选项 */
export type LanguageOption = {
  locale: AppLocale;
  /** 右侧短码，如 简体 / 繁體 / EN */
  code: string;
  /** ISO 3166-1 alpha-2，用于国旗展示 */
  flagCountry: string;
};

/**
 * 语言市场分组 — Rosenbauer 式分区展示。
 * 扩展新语言：在 routing.locales、messages/{locale}.json、下方 options 三处追加即可。
 */
export type LanguageMarket = {
  id: string;
  /** messages 中的分组标题 key：language.markets.{id} */
  nameKey: string;
  options: LanguageOption[];
};

export const LANGUAGE_MARKETS: LanguageMarket[] = [
  {
    id: 'china',
    nameKey: 'china',
    options: [{ locale: 'zh-CN', code: '简体', flagCountry: 'cn' }],
  },
  {
    id: 'greaterChina',
    nameKey: 'greaterChina',
    options: [{ locale: 'zh-TW', code: '繁體', flagCountry: 'cn' }],
  },
  {
    id: 'international',
    nameKey: 'international',
    options: [{ locale: 'en', code: 'EN', flagCountry: 'us' }],
  },
];

/** 各 locale 对应的国旗 emoji（跨平台回退） */
export const LOCALE_FLAG_EMOJI: Record<AppLocale, string> = {
  'zh-CN': '🇨🇳',
  'zh-TW': '🇨🇳',
  en: '🇺🇸',
};

export const LOCALE_SHORT: Record<AppLocale, string> = {
  'zh-CN': 'CN',
  'zh-TW': 'HK',
  en: 'EN',
};

export const LOCALE_HTML_LANG: Record<AppLocale, string> = {
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en',
};

export const LOCALE_REGION_LABEL: Record<AppLocale, string> = {
  'zh-CN': '中国 · 简体中文',
  'zh-TW': '香港 · 繁體中文',
  en: 'Global · English',
};
