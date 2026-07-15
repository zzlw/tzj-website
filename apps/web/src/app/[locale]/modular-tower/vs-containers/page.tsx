import { getTranslations } from 'next-intl/server';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

const RELATED_HREFS = ['/modular-tower/series', '/fixed-tower', '/cases'];

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.modularTowerVsContainers',
    path: '/modular-tower/vs-containers',
  });
}

export default async function VsContainersPage() {
  const t = await getTranslations('pages.modularTowerVsContainers');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const rows = t.raw('rows') as Array<{ feature: string; modular: string; container: string }>;
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('overview.eyebrow')}
              title={t('overview.title')}
              description={t('overview.description')}
            />
            <div className="flex flex-col justify-center">
              <p className="text-base leading-relaxed text-neutral-900">{t('overview.lead')}</p>
              <p className="mt-4 text-base leading-relaxed text-secondary-text">
                {t('overview.body')}
              </p>
            </div>
          </div>
        </Container>
      </section>

      <StatBandI18n />

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

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <CtaBand
        title={t('cta.title')}
        primaryLabel={tCta('bookConsult')}
        secondaryLabel={t('cta.secondaryLabel')}
        secondaryHref="/modular-tower/series"
      />
    </div>
  );
}
