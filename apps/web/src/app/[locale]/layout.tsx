import { Toaster } from '@tzj/ui';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { ViewTransitions } from 'next-view-transitions';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BaiduAnalytics } from '@/components/analytics/BaiduAnalytics';
import { ConsoleBranding } from '@/components/ConsoleBranding';
import { ChatWidgetLazy } from '@/components/chat/ChatWidgetLazy';
import { LanguageSelectorProvider } from '@/components/i18n/LanguageSelector';
import { JsonLd } from '@/components/JsonLd';
import { Footer } from '@/components/layout/Footer';
import { HeaderShell } from '@/components/layout/HeaderShell';
import { MarketingPopup } from '@/components/marketing/MarketingPopup';
import { DeferredVisitorTracker } from '@/components/performance/DeferredVisitorTracker';
import { ProductLineNav } from '@/components/products/ProductLineNav';
import { SearchProvider } from '@/components/search/SearchProvider';
import { AgentPhoneProvider } from '@/features/chat/AgentPhoneContext';
import { legacyDetectJsHref } from '@/generated/legacy-css';
import { type AppLocale, routing } from '@/i18n/routing';
import { env } from '@/lib/env';
import { organizationJsonLd } from '@/lib/jsonld';
import { LOCALE_HTML_LANG } from '@/lib/locale-config';
import { getMediaOrigin } from '@/lib/media-origin';
import { getS3PublicDomain, getStaticsUrl } from '@/lib/media-url';
import { metadataBase } from '@/lib/seo';
import {
  getFaviconUrl,
  getSitePublicSettings,
  localizedAddress,
  resolveContactPhones,
} from '@/lib/site-settings';
import { cn } from '@/lib/utils';
import '../globals.css';

const geist = localFont({
  src: '../../fonts/geist-var.woff2',
  variable: '--font-geist',
  display: 'swap',
});

const archivo = localFont({
  // 全站只用 600/700/800（rb-* 标题 700、font-bold/extrabold/semibold）；
  // 可变字体限定 600-800 字重区间，其余字重回退 Geist，与原 next/font/google 行为一致
  src: '../../fonts/archivo-var.woff2',
  weight: '600 800',
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
    // 百度搜索资源平台（站长平台）站点归属校验：该 meta 需常驻首页 <head>，
    // 验证通过后不可删除。verification.other 会在全站每页输出
    // <meta name="baidu-site-verification" content="..." />，供改版工具等能力使用。
    verification: {
      other: {
        'baidu-site-verification': 'codeva-uyyRhMh9Qw',
      },
    },
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
  // statics/ 对象位于 bucket 内，文件 URL 必须用带 bucket 的公开域前缀
  // （preconnect/dns-prefetch 仍用 origin，避免多余 path 干扰连接复用）
  const mediaBase = getS3PublicDomain();
  // statics 资源（browser-support）统一走 getStaticsUrl 的规则收口：
  // 生产 OSS，开发/测试走应用自身 public/
  // （vditor lute 解析引擎不再全站 prefetch：聊天组件懒加载后由其内部按需拉取）
  const browserSupportUrl = getStaticsUrl(mediaBase, 'browser-support.js');
  // 站点设置与 favicon 相互独立：并行拉取，避免两个 3s 超时串行叠加
  const [siteSettings, faviconUrl] = await Promise.all([getSitePublicSettings(), getFaviconUrl()]);
  // 主电话：用于「点击咨询」无人在线时的兜底拨号与结构化数据（后台可配置）
  const { primary: primaryPhone } = resolveContactPhones(siteSettings);
  const streetAddress = localizedAddress(siteSettings, locale, tContact('address'));

  return (
    <html
      lang={LOCALE_HTML_LANG[locale as AppLocale]}
      className={cn('font-sans', geist.variable, archivo.variable)}
      style={{ scrollPaddingTop: 'var(--site-header-offset)' }}
    >
      <head>
        {faviconUrl && <link rel="icon" href={faviconUrl} />}
        <link rel="apple-touch-icon" href={`${mediaBase}/statics/apple-touch-icon.png`} />
        <link rel="preconnect" href={mediaOrigin} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={mediaOrigin} />
        <link rel="dns-prefetch" href="https://flagcdn.com" />
        {/* 旧版浏览器检测与升级引导：ES5 自包含脚本，主包解析失败时仍能提示；defer 不阻塞渲染 */}
        <script src={browserSupportUrl} defer />
        {/* 双轨 CSS 客户端检测：beforeInteractive 在首屏渲染前注入 legacy.css，避免 FOUC */}
        {env.legacyCssEnabled && <Script src={legacyDetectJsHref} strategy="beforeInteractive" />}
      </head>
      <body className="bg-background text-text antialiased">
        <NextIntlClientProvider messages={messages}>
          <AgentPhoneProvider phone={primaryPhone}>
            <LanguageSelectorProvider>
              <SearchProvider>
                <JsonLd
                  data={organizationJsonLd({
                    legalName: tCommon('legalName'),
                    brandName: tCommon('brandName'),
                    description: tCommon('siteDescription'),
                    phone: primaryPhone,
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
                <ChatWidgetLazy
                  businessHours={siteSettings.businessHours}
                  agentProfile={siteSettings.agentProfile}
                  chatPrompts={siteSettings.chatPrompts}
                  phone={primaryPhone}
                />
                <MarketingPopup phone={primaryPhone} />
                <HeaderShell />
                <ProductLineNav />
                <ViewTransitions>
                  <main className="min-h-screen">{children}</main>
                </ViewTransitions>
                <Footer />
                <Toaster />
              </SearchProvider>
            </LanguageSelectorProvider>
          </AgentPhoneProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
