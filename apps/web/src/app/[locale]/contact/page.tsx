import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CertificationWall } from '@/components/sections/CertificationWall';
import { ContactSectionDynamic } from '@/components/sections/ContactSectionDynamic';
import { PageHero } from '@/components/ui';
import { generateSeo } from '@/lib/seo';
import { getSitePublicSettings, localizedAddress } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contact.page');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  return generateSeo({
    title: t('title'),
    description: t('metaDescription'),
    locale,
    path: '/contact',
    siteName: tCommon('brandName'),
  });
}

export default async function ContactPage() {
  const t = await getTranslations('contact.page');
  const tContact = await getTranslations('contact');
  const settings = await getSitePublicSettings();
  const locale = await getLocale();
  const address = localizedAddress(settings, locale, tContact('address'));

  return (
    <div>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('heroDescription')} />
      <CertificationWall />
      <ContactSectionDynamic settings={settings} address={address} />
    </div>
  );
}
