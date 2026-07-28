import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, RbButton, RbLink, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

const SERIES_IMAGES = [
  '/media/modular-m.jpg',
  '/media/modular-o.png',
  '/media/modular-d.png',
  '/media/modular-x.png',
] as const;
const RELATED_HREFS = ['/modular-tower/vs-containers', '/fixed-tower', '/resources/design-center'];

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.modularTowerSeries',
    path: '/modular-tower/series',
  });
}

export default async function ModularSeriesPage() {
  const t = await getTranslations('pages.modularTowerSeries');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const series = t.raw('series') as Array<{
    code: string;
    name: string;
    desc: string;
    use: string;
  }>;
  const advantages = t.raw('advantages') as string[];
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
          <SectionHeading eyebrow={t('seriesSection.eyebrow')} title={t('seriesSection.title')} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {series.map((s, i) => (
              <div key={s.code} className="flex flex-col border border-neutral-300 bg-white">
                <div className="relative aspect-[16/10] overflow-hidden border-b border-neutral-300 bg-neutral-100">
                  <Image
                    src={SERIES_IMAGES[i]!}
                    alt={`${s.code} ${s.name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-contain p-4"
                  />
                </div>
                <div className="p-6">
                  <span className="text-xs font-bold uppercase tracking-wide text-primary">
                    {s.code}
                  </span>
                  <h3 className="rb-h5 mt-1 text-neutral-900">{s.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
                  <span className="mt-4 inline-block border border-neutral-300 px-3 py-1 text-xs font-bold text-neutral-900">
                    {t('seriesUsePrefix')}
                    {s.use}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('advantagesSection.eyebrow')}
            title={t('advantagesSection.title')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {advantages.map((a) => (
              <div
                key={a}
                className="border-l-2 border-primary bg-white p-5 text-base text-neutral-900"
              >
                {a}
              </div>
            ))}
          </div>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, idx) => ({ ...l, href: RELATED_HREFS[idx]! }))}
      />

      <Container className="pt-16 lg:pt-24">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <RbButton href="/contact">{tCta('bookConsult')}</RbButton>
            <RbLink href="/modular-tower/vs-containers">{t('cta.compareLink')}</RbLink>
            <RbLink href="/docs/modular-tower-specs.pdf">{tCta('downloadPdf')}</RbLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
