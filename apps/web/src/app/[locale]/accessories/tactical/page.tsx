import { Layers, Maximize, Move, Shield, Wrench } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, RbLink, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.accessoriesTactical',
    path: '/accessories/tactical',
  });
}

const CUSTOM_ICONS = [Wrench, Move, Layers, Maximize] as const;
const RELATED_HREFS = ['/fixed-tower', '/modular-tower', '/accessories'] as const;

export default async function TacticalPage() {
  const t = await getTranslations('pages.accessoriesTactical');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const scenarios = t.raw('scenarios') as Array<{ title: string; desc: string }>;
  const skillTags = t.raw('skillTags') as string[];
  const customPointsRaw = t.raw('customPoints') as Array<{ title: string; desc: string }>;
  const customPoints = customPointsRaw.map((item, i) => ({
    ...item,
    icon: CUSTOM_ICONS[i] ?? CUSTOM_ICONS[0],
  }));
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <section>
        <Container className="pt-16 lg:pt-24">
          <div className="rb-img-shimmer relative aspect-[21/9] overflow-hidden bg-neutral-200">
            <Image
              src="/media/tactical.jpg"
              alt={t('heroImageAlt')}
              fill
              quality={90}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('scenariosSection.eyebrow')}
            title={t('scenariosSection.title')}
            description={t('scenariosSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {scenarios.map((s) => (
              <div key={s.title} className="border border-neutral-300 bg-white p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="rb-h5 text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('modularSection.eyebrow')}
              title={t('modularSection.title')}
              description={t('modularSection.description')}
            />
            <div className="flex flex-col justify-center">
              <p className="text-base leading-relaxed text-neutral-900">
                {t('modularSection.lead')}
              </p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                {skillTags.map((s) => (
                  <span
                    key={s}
                    className="border border-neutral-300 bg-white px-3.5 py-1.5 text-sm font-bold text-neutral-900"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('customSection.eyebrow')}
            title={t('customSection.title')}
            description={t('customSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {customPoints.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="border border-neutral-300 bg-white p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="rb-h5 text-neutral-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary-text">{p.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <RbLink href="/fixed-tower">{t('customSection.linkFixedTower')}</RbLink>
            <RbLink href="/modular-tower">{t('customSection.linkModularTower')}</RbLink>
          </div>
        </Container>
      </section>

      <ProcessBandI18n />

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i] ?? RELATED_HREFS[0] }))}
      />

      <CtaBand
        title={t('cta.title')}
        description={t('cta.description')}
        primaryLabel={tCta('bookConsult')}
        secondaryLabel={t('cta.secondaryLabel')}
        secondaryHref="/specialized-training"
      />
    </div>
  );
}
