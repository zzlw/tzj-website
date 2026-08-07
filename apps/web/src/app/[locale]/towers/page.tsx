import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { ProductHubNav } from '@/components/products/ProductHubNav';
import { ProductHeroBand } from '@/components/products/ProductLineMedia';
import { ProductLinesOverview } from '@/components/products/ProductLinesGrid';
import { CtaBand } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { CertificationWall } from '@/components/sections/CertificationWall';
import { PageHero } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { getProductPageImages } from '@/lib/product-images';

const HUB = getProductPageImages('towers-hub');

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.towers',
    path: '/towers',
    image: HUB.ogImage ?? HUB.heroImage,
  });
}

export default async function TowersPage() {
  const t = await getTranslations('pages.towers');
  const tCta = await getTranslations('cta');
  const tBread = await getTranslations('breadcrumbs');

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('breadcrumb.current'), path: '/towers' },
          ]),
        ]}
      />

      <div className="pb-20">
        <PageHero
          eyebrow={t('hero.eyebrow')}
          title={t('hero.title')}
          description={t('hero.description')}
        />

        <ProductHeroBand src={HUB.heroImage} alt={t('heroImageAlt')} />

        <ProductHubNav />

        <section
          id="overview"
          className="scroll-mt-below-sticky-hub border-b border-neutral-300 bg-white"
        >
          <ProductLinesOverview />
        </section>

        <CertificationWall />

        <StatBandI18n />
        <ProcessBandI18n />

        <CtaBand
          title={t('cta.title')}
          description={t('cta.description')}
          primaryLabel={tCta('bookConsult')}
          secondaryLabel={t('cta.secondaryLabel')}
          secondaryHref="/solutions"
        />
      </div>
    </>
  );
}
