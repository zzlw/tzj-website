import { Brain, Check, Gauge, Mountain, ShieldCheck, Users, Zap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, FeatureGrid, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, Eyebrow, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';

const IMAGE = '/media/tower-ocean-springs.jpg';
const FEATURE_ICONS = [Mountain, Brain, Users, Zap, Gauge, ShieldCheck] as const;
const RELATED_HREFS = [
  '/specialized-training/rope-rescue',
  '/accessories/fitness-equipment',
  '/solutions/military',
];

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.specializedTrainingPsychological',
    path: '/specialized-training/psychological',
  });
}

export default async function PsychologicalPage() {
  const t = await getTranslations('pages.specializedTrainingPsychological');
  const tCta = await getTranslations('cta');
  const tBread = await getTranslations('breadcrumbs');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const featuresRaw = t.raw('features') as Array<{ title: string; desc: string }>;
  const features = featuresRaw.map((item, i) => ({ ...item, icon: FEATURE_ICONS[i]! }));
  const programs = t.raw('programs') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('breadcrumb.parent'), path: '/specialized-training' },
            { name: t('breadcrumb.current'), path: '/specialized-training/psychological' },
          ]),
          productJsonLd({
            name: t('jsonLd.productName'),
            description: t('jsonLd.productDescription'),
            path: '/specialized-training/psychological',
            image: IMAGE,
          }),
        ]}
      />
      <div className="pb-20">
        <section className="relative h-[420px] overflow-hidden bg-neutral-900 lg:h-[500px]">
          <Image
            src={IMAGE}
            alt={t('hero.imageAlt')}
            fill
            preload
            loading="eager"
            quality={90}
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 rb-media-shade-strong" />
          <Container className="rb-on-media relative z-10 flex h-full flex-col justify-end pb-12 pt-24">
            <Eyebrow inverted>{t('hero.eyebrow')}</Eyebrow>
            <h1 className="rb-h1 mt-4 max-w-3xl text-white">{t('hero.title')}</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
              {t('hero.description')}
            </p>
          </Container>
        </section>
        <section>
          <Container className="py-16 lg:py-24">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
              <SectionHeading
                eyebrow={t('overview.eyebrow')}
                title={t('overview.title')}
                description={t('overview.description')}
              />
              <div className="flex flex-col justify-center gap-4 border-l-2 border-primary pl-6">
                <p className="text-lg leading-relaxed text-neutral-900">{t('overview.lead')}</p>
                <p className="text-secondary-text">{t('overview.body')}</p>
              </div>
            </div>
          </Container>
        </section>
        <section className="bg-neutral-100">
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('featuresSection.eyebrow')}
              title={t('featuresSection.title')}
            />
            <div className="mt-10">
              <FeatureGrid items={features} columns={3} />
            </div>
          </Container>
        </section>
        <section>
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('programsSection.eyebrow')}
              title={t('programsSection.title')}
            />
            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 border border-neutral-300 bg-white p-5"
                >
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm leading-relaxed text-neutral-900">{p}</span>
                </li>
              ))}
            </ul>
          </Container>
        </section>
        <StatBandI18n />
        <ProcessBandI18n />
        <RelatedLinks
          title={tBlocks('titleDefault')}
          learnMore={tBlocks('learnMore')}
          eyebrow={tBlocks('eyebrow')}
          links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
        />
        <CtaBand
          title={t('cta.title')}
          description={t('cta.description')}
          primaryLabel={tCta('bookConsult')}
        />
      </div>
    </>
  );
}
