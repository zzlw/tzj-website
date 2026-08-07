import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { ProductHeroBand } from '@/components/products/ProductLineMedia';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { getProductPageImages } from '@/lib/product-images';
import { relatedLinksWithImages } from '@/lib/product-line-page';

const COMPARISON = getProductPageImages('modular-vs-containers');
const RELATED_HREFS = ['/modular-tower/series', '/fixed-tower', '/cases'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.modularTowerVsContainers',
    path: '/modular-tower/vs-containers',
    image: COMPARISON.ogImage ?? COMPARISON.heroImage,
  });
}

export default async function VsContainersPage() {
  const t = await getTranslations('pages.modularTowerVsContainers');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tBread = await getTranslations('breadcrumbs');

  const rows = t.raw('rows') as Array<{ feature: string; modular: string; container: string }>;
  const chooseModular = t.raw('chooseModular') as string[];
  const chooseContainer = t.raw('chooseContainer') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('hero.eyebrow'), path: '/modular-tower' },
            { name: t('meta.title'), path: '/modular-tower/vs-containers' },
          ]),
        ]}
      />

      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <ProductHeroBand src={COMPARISON.heroImage} alt={t('heroImageAlt')} />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('decisionSection.eyebrow')}
            title={t('decisionSection.title')}
            description={t('decisionSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="border border-neutral-300 bg-white p-8">
              <h3 className="rb-h5 text-neutral-900">{t('decisionSection.modularTitle')}</h3>
              <ul className="mt-6 grid grid-cols-1 gap-3">
                {chooseModular.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-neutral-300 bg-white p-8">
              <h3 className="rb-h5 text-neutral-900">{t('decisionSection.containerTitle')}</h3>
              <ul className="mt-6 grid grid-cols-1 gap-3">
                {chooseContainer.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('compareSection.eyebrow')} title={t('compareSection.title')} />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-neutral-900">
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                    {t('tableHeaders.feature')}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-primary">
                    {t('tableHeaders.modular')}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-secondary-text">
                    {t('tableHeaders.container')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-b border-neutral-300 align-top">
                    <td className="p-4 text-sm font-bold text-neutral-900">{r.feature}</td>
                    <td className="p-4 text-sm leading-relaxed text-neutral-900">{r.modular}</td>
                    <td className="p-4 text-sm leading-relaxed text-secondary-text">
                      {r.container}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <ProcessBandI18n />

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinksWithImages(relatedLinks, RELATED_HREFS)}
      />

      <CtaBand
        title={t('cta.title')}
        description={t('cta.description')}
        primaryLabel={tCta('bookConsult')}
        secondaryLabel={t('cta.secondaryLabel')}
        secondaryHref="/modular-tower/series"
      />
    </div>
  );
}
