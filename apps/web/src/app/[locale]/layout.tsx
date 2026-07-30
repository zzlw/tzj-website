import type { Metadata } from 'next';
import { Archivo, Geist } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { ViewTransitions } from 'next-view-transitions';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BaiduAnalytics } from '@/components/analytics/BaiduAnalytics';
import { ConsoleBranding } from '@/components/ConsoleBranding';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { LanguageSelectorProvider } from '@/components/i18n/LanguageSelector';
import { JsonLd } from '@/components/JsonLd';
import { Footer } from '@/components/layout/Footer';
import { HeaderShell } from '@/components/layout/HeaderShell';
import { DeferredVisitorTracker } from '@/components/performance/DeferredVisitorTracker';
import { ProductLineNav } from '@/components/products/ProductLineNav';
import { SearchProvider } from '@/components/search/SearchProvider';
import { type AppLocale, routing } from '@/i18n/routing';
import { organizationJsonLd } from '@/lib/jsonld';
import { LOCALE_HTML_LANG } from '@/lib/locale-config';
import { getMediaOrigin } from '@/lib/media-origin';
import { metadataBase } from '@/lib/seo';
import { getFaviconUrl, getSitePublicSettings, localizedAddress } from '@/lib/site-settings';
import { cn } from '@/lib/utils';
import '../globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * 全站 metadata 兜底：未定义 generateMetadata 的页面至少拥有本地化的
 * title/description；子页裸 title 经 title.template 统一追加品牌后缀。
 * 注意：兜底层不输出 canonical/hreflang（否则无自定义 metadata 的子页
 * canonical 会错指首页），该信息由各页 generateSeo 按真实 path 输出。
 */
export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  const brand = t('brandName');
  return {
    metadataBase,
    title: {
      default: t('siteTitle'),
      template: `%s | ${brand}`,
    },
    description: t('siteDescription'),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const tCommon = await getTranslations('common');
  const tContact = await getTranslations('contact');
  const mediaOrigin = getMediaOrigin();
  const siteSettings = await getSitePublicSettings();
  const streetAddress = localizedAddress(siteSettings, locale, tContact('address'));
  const faviconUrl = await getFaviconUrl();

  return (
    <html
      lang={LOCALE_HTML_LANG[locale as AppLocale]}
      className={cn('font-sans', geist.variable, archivo.variable)}
      style={{ scrollPaddingTop: 'var(--site-header-offset)' }}
    >
      <head>
        {faviconUrl && <link rel="icon" href={faviconUrl} />}
        <link rel="preconnect" href={mediaOrigin} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={mediaOrigin} />
        <link rel="dns-prefetch" href="https://flagcdn.com" />
        {/* 空闲时预取 Vditor 的 lute 解析引擎，缩短聊天 Markdown 预览初始化等待；
            用 prefetch 而非 preload：该脚本仅在访客打开聊天时才执行，preload 会触发
            「预加载未及时使用」控制台警告并抢占首屏带宽 */}
        <link rel="prefetch" as="script" href="/vditor-assets/dist/js/lute/lute.min.js" />
        {/* 旧版浏览器检测与升级引导：ES5 自包含脚本，主包解析失败时仍能提示；defer 不阻塞渲染 */}
        <script src="/browser-support.js" defer />
      </head>
      <body className="bg-background text-text antialiased">
        <NextIntlClientProvider messages={messages}>
          <LanguageSelectorProvider>
            <SearchProvider>
              <JsonLd
                data={organizationJsonLd({
                  legalName: tCommon('legalName'),
                  brandName: tCommon('brandName'),
                  description: tCommon('siteDescription'),
                  phone: siteSettings.contact.phone,
                  email: siteSettings.contact.email,
                  streetAddress,
                  addressLocality: tContact('addressLocality'),
                  addressRegion: tContact('addressRegion'),
                })}
              />
              <Suspense fallback={null}>
                <DeferredVisitorTracker />
              </Suspense>
              <BaiduAnalytics hmId={siteSettings.analytics.baiduHmId} />
              <ConsoleBranding />
              <ChatWidget
                businessHours={siteSettings.businessHours}
                agentProfile={siteSettings.agentProfile}
                chatPrompts={siteSettings.chatPrompts}
              />
              <HeaderShell />
              <ProductLineNav />
              <ViewTransitions>
                <main className="min-h-screen">{children}</main>
              </ViewTransitions>
              <Footer />
            </SearchProvider>
          </LanguageSelectorProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
