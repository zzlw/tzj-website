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

const COMPARISON = getProductPageImages('burn-comparison');
const RELATED_HREFS = ['/burn-rooms/liner', '/burn-rooms', '/resources/inspections'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.burnRoomsComparison',
    path: '/burn-rooms/comparison',
    image: COMPARISON.ogImage ?? COMPARISON.heroImage,
  });
}

export default async function ComparisonPage() {
  const t = await getTranslations('pages.burnRoomsComparison');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tBread = await getTranslations('breadcrumbs');

  const rows = t.raw('rows') as Array<{ feature: string; interlock: string; traditional: string }>;
  const steps = t.raw('steps') as Array<{ step: string; title: string; desc: string }>;
  const chooseLiner = t.raw('chooseLiner') as string[];
  const chooseSimulation = t.raw('chooseSimulation') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('hero.eyebrow'), path: '/burn-rooms' },
            { name: t('meta.title'), path: '/burn-rooms/comparison' },
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
              <h3 className="rb-h5 text-neutral-900">{t('decisionSection.linerTitle')}</h3>
              <ul className="mt-6 grid grid-cols-1 gap-3">
                {chooseLiner.map((item) => (
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
              <h3 className="rb-h5 text-neutral-900">{t('decisionSection.simulationTitle')}</h3>
              <ul className="mt-6 grid grid-cols-1 gap-3">
                {chooseSimulation.map((item) => (
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
                    {t('tableHeaders.interlock')}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-secondary-text">
                    {t('tableHeaders.traditional')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-b border-neutral-300 align-top">
                    <td className="p-4 text-sm font-bold text-neutral-900">{r.feature}</td>
                    <td className="p-4 text-sm leading-relaxed text-neutral-900">{r.interlock}</td>
                    <td className="p-4 text-sm leading-relaxed text-secondary-text">
                      {r.traditional}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('retrofitSection.eyebrow')}
            title={t('retrofitSection.title')}
            description={t('retrofitSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s) => (
              <div key={s.step} className="border-t-2 border-primary bg-white p-5">
                <span className="font-display text-2xl font-bold text-primary">{s.step}</span>
                <h3 className="rb-h5 mt-2 text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

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
        secondaryHref="/burn-rooms/liner"
      />
    </div>
  );
}
