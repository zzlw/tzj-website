import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { HeroSection } from '@/components/sections/HeroSection';
import { HomeBelowFold } from '@/components/sections/HomeBelowFold';
import { HomeBelowFoldSkeleton } from '@/components/sections/HomeBelowFoldSkeleton';
import { generateSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
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

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <Suspense fallback={<HomeBelowFoldSkeleton />}>
        <HomeBelowFold />
      </Suspense>
    </>
  );
}
