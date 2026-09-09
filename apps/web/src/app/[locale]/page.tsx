import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { HeroSection } from '@/components/sections/HeroSection';
import { HomeBelowFold } from '@/components/sections/HomeBelowFold';
import { HomeBelowFoldSkeleton } from '@/components/sections/HomeBelowFoldSkeleton';
import { generateSeo } from '@/lib/seo';

/** next-intl 4 + Next 16 的 auto 模式不会静态化 [locale] 路由，需显式声明；本页无动态 API。 */
export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home.meta');
  const tCommon = await getTranslations('common');
  return generateSeo({
    title: t('title'),
    description: t('description'),
    locale,
    path: '/',
    // 首页标题自含品牌，绕开 layout 的 title.template 避免双后缀
    noSuffix: true,
    siteName: tCommon('brandName'),
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <HeroSection />
      <Suspense fallback={<HomeBelowFoldSkeleton />}>
        <HomeBelowFold />
      </Suspense>
    </>
  );
}
