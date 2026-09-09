import { type AppLocale, locales } from '@/i18n/routing';
import { PAGE_IDS, pageContentIdFromPath } from './page-ids';

/** 各路由共享、体积较小的模块（cta 已含于 blocks.json；content 多路由共用，始终加载）。 */
const ALWAYS_EXTRA = ['blocks', 'error', 'catalog', 'content'] as const;

const PRODUCT_PATH_PREFIXES = [
  '/fixed-tower',
  '/modular-tower',
  '/burn-rooms',
  '/accessories',
  '/specialized-training',
  '/education-center',
  '/towers',
] as const;

export interface MessageLoadPlan {
  extraModules: string[];
  pageIds: string[];
}

/** 去掉 locale 前缀，得到站内路径（如 /zh-TW/why-us → /why-us）。 */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] && (locales as readonly string[]).includes(segments[0] as AppLocale)) {
    segments.shift();
  }
  const path = '/' + segments.join('/');
  return path === '/' ? '/' : path.replace(/\/$/, '') || '/';
}

function isHomePath(path: string): boolean {
  return path === '/';
}

function isProductPath(path: string): boolean {
  return PRODUCT_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isSolutionsPath(path: string): boolean {
  return path === '/solutions' || path.startsWith('/solutions/');
}

/** 根据当前路径决定加载哪些 i18n 模块（按需，非全量 pages/*）。 */
export function resolveMessageLoadPlan(pathname: string): MessageLoadPlan {
  const path = stripLocalePrefix(pathname);
  const extraModules = new Set<string>(ALWAYS_EXTRA);
  const pageIds = new Set<string>();

  if (isHomePath(path)) {
    extraModules.add('home');
    extraModules.add('solutions');
  }
  if (path === '/search') {
    extraModules.add('solutions');
  }
  if (isProductPath(path)) extraModules.add('catalog');
  if (isSolutionsPath(path)) extraModules.add('solutions');

  const staticId = pageContentIdFromPath(path);
  if ((PAGE_IDS as readonly string[]).includes(staticId)) {
    pageIds.add(staticId);
  }

  // Hub 页复用子页系列卡片文案（系列网格）
  if (path === '/fixed-tower') pageIds.add('fixed-tower-series');

  if (/^\/resources\/news\/[^/]+$/.test(path)) pageIds.add('resources-news');
  if (/^\/resources\/blog\/[^/]+$/.test(path)) pageIds.add('resources-blog');
  if (/^\/solutions\/[^/]+$/.test(path)) pageIds.add('solution-detail');

  return {
    extraModules: [...extraModules],
    pageIds: [...pageIds],
  };
}

/**
 * 全量文案（不读请求 pathname）。
 * getRequestConfig 若调用 headers() 会把整站打成 dynamic / no-store，
 * 投放落地的 HTML 就无法 ISR；全量加载后按 locale 静态化，客户端仍只下发
 * pickClientMessages，HTML 体积不跟着涨。
 */
export function resolveFullMessageLoadPlan(): MessageLoadPlan {
  return {
    extraModules: [...ALWAYS_EXTRA, 'home', 'solutions'],
    pageIds: [...PAGE_IDS],
  };
}

/**
 * 客户端 hydration 真正用到的命名空间。
 * layout 里 NextIntlClientProvider 只下发这些，避免把 pages/catalog/blocks
 * 等仅服务端使用的文案打进 HTML（投放落地页可少十几 KB）。
 */
export const CLIENT_MESSAGE_NAMESPACES = [
  'common',
  'header',
  'nav',
  'search',
  'language',
  'contact',
  'cta',
  'content',
  'error',
] as const;

export function pickClientMessages(messages: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of CLIENT_MESSAGE_NAMESPACES) {
    if (key in messages) picked[key] = messages[key];
  }
  return picked;
}
