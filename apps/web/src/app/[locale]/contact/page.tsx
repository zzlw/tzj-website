import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CertificationWall } from '@/components/sections/CertificationWall';
import { ContactSectionDynamic } from '@/components/sections/ContactSectionDynamic';
import { PageHero } from '@/components/ui';
import { generateSeo } from '@/lib/seo';
import { getSitePublicSettings, localizedAddress } from '@/lib/site-settings';

/** next-intl 4 + Next 16 的 auto 模式不会静态化 [locale] 路由，需显式声明；本页无动态 API。 */
export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact.page');
  const tCommon = await getTranslations('common');
  return generateSeo({
    title: t('title'),
    description: t('metaDescription'),
    locale,
    path: '/contact',
    siteName: tCommon('brandName'),
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact.page');
  const tContact = await getTranslations('contact');
  const settings = await getSitePublicSettings();
  const address = localizedAddress(settings, locale, tContact('address'));

  return (
    <div>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('heroDescription')} />
      <CertificationWall />
      <ContactSectionDynamic settings={settings} address={address} />
    </div>
  );
}
