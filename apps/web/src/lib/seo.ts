import type { Metadata } from 'next';
import { type AppLocale, locales, routing } from '@/i18n/routing';
import { resolveMediaUrl } from '@/lib/media-url';
import { siteConfig } from '@/lib/site';

interface SeoProps {
  title: string;
  description: string;
  /** 当前请求 locale（`getLocale()` 取值），用于 canonical / hreflang / og:locale */
  locale: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  noSuffix?: boolean;
  siteName?: string;
}

export const metadataBase = new URL(siteConfig.url);

/** og:locale 采用 Open Graph 的 territory 格式 */
const OG_LOCALE: Record<AppLocale, string> = {
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  en: 'en_US',
};

function toAppLocale(locale: string): AppLocale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as AppLocale)
    : routing.defaultLocale;
}

/**
 * 拼接带 locale 前缀的绝对 URL（localePrefix: 'always' 下的真实可达页）。
 * 首页 path='/' 必须归一为空串：`/zh-CN/` 会被 trailingSlash: false 308 到
 * `/zh-CN`，不归一会让首页 canonical 指向跳转页。
 */
export function localizedUrl(locale: AppLocale, path: string): string {
  const p = path === '/' ? '' : path;
  return `${siteConfig.url}/${locale}${p}`;
}

export function generateSeo({
  title,
  description,
  locale,
  path = '',
  image,
  type = 'website',
  noSuffix = false,
  siteName,
}: SeoProps): Metadata {
  const brand = siteName ?? siteConfig.name;
  const currentLocale = toAppLocale(locale);
  const url = localizedUrl(currentLocale, path);
  const defaultImage = resolveMediaUrl('/og-default.jpg');
  const ogImage = image ? resolveMediaUrl(image) : defaultImage;

  // hreflang：三语言互指 + x-default 指向默认语（zh-CN）
  const languages: Record<string, string> = Object.fromEntries(
    locales.map((l) => [l, localizedUrl(l, path)]),
  );
  languages['x-default'] = localizedUrl(routing.defaultLocale, path);

  return {
    // 品牌后缀由 [locale]/layout 的 title.template 统一追加；
    // noSuffix 用 absolute 绕开 template（首页等标题自含品牌的页面）
    title: noSuffix ? { absolute: title } : title,
    description,
    keywords: [...siteConfig.keywords],
    metadataBase,
    openGraph: {
      title,
      description,
      url,
      siteName: brand,
      type,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      locale: OG_LOCALE[currentLocale],
      alternateLocale: locales.filter((l) => l !== currentLocale).map((l) => OG_LOCALE[l]),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: { canonical: url, languages },
  };
}
