import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { ProductHubNav } from '@/components/products/ProductHubNav';
import { ProductLinesOverview } from '@/components/products/ProductLinesGrid';
import { CtaBand } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { PageHero } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.towers', path: '/towers' });
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

        <ProductHubNav />

        <section
          id="overview"
          className="scroll-mt-below-sticky-hub border-b border-neutral-300 bg-white"
        >
          <ProductLinesOverview />
        </section>

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
