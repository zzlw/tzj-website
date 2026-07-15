import { Factory, PencilRuler, Truck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.resourcesWarranty', path: '/resources/warranty' });
}

const RESPONSIBILITY_ICONS = [PencilRuler, Factory, Truck] as const;
const RELATED_HREFS = ['/resources/inspections', '/resources/how-to-buy', '/resources/faqs'];

export default async function WarrantyPage() {
  const t = await getTranslations('pages.resourcesWarranty');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const responsibilityRaw = t.raw('responsibility') as Array<{ title: string; desc: string }>;
  const responsibility = responsibilityRaw.map((item, i) => ({
    ...item,
    icon: RESPONSIBILITY_ICONS[i]!,
  }));
  const warrantyRows = t.raw('warrantyRows') as Array<{
    item: string;
    scope: string;
    note: string;
  }>;
  const support = t.raw('support') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;
  const tableHeaders = t.raw('tableHeaders') as { item: string; scope: string; note: string };

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
              eyebrow={t('integratedSection.eyebrow')}
              title={t('integratedSection.title')}
              description={t('integratedSection.description')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {responsibility.map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.title} className="border border-neutral-300 bg-white p-6 text-center">
                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="rb-h5 text-neutral-900">{r.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-secondary-text">{r.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('warrantySection.eyebrow')}
            title={t('warrantySection.title')}
          />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-neutral-900">
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                    {tableHeaders.item}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-primary">
                    {tableHeaders.scope}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-secondary-text">
                    {tableHeaders.note}
                  </th>
                </tr>
              </thead>
              <tbody>
                {warrantyRows.map((r) => (
                  <tr key={r.item} className="border-b border-neutral-300 align-top">
                    <td className="p-4 text-sm font-bold text-neutral-900">{r.item}</td>
                    <td className="p-4 text-sm text-neutral-900">{r.scope}</td>
                    <td className="p-4 text-sm leading-relaxed text-secondary-text">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-secondary-text">{t('warrantyFootnote')}</p>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('supportSection.eyebrow')} title={t('supportSection.title')} />
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {support.map((s) => (
              <li
                key={s}
                className="border-l-2 border-primary bg-white p-5 text-base text-neutral-900"
              >
                {s}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <ProcessBandI18n />

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
        secondaryHref="/resources/inspections"
      />
    </div>
  );
}
