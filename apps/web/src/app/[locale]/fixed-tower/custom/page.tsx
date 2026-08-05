import { Blocks, Check, Maximize, Puzzle, Ruler } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BaiduSafeVideoHero as VideoHero } from '@/components/BaiduSafeVideoHero';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import { FeatureGrid, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n } from '@/components/sections/blocks-i18n';
import { Container, RbLink, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

const CAPABILITY_ICONS = [Ruler, Puzzle, Blocks, Maximize] as const;
const RELATED_HREFS = ['/fixed-tower/series', '/burn-rooms', '/cases'] as const;
/** 与 Hub「延伸了解」定制卡同源 */
const HERO_POSTER = '/media/ft-path-custom.png';
const HERO_VIDEO = '/media/fixed-tower.mp4';
const DETAIL_IMAGE = '/media/fixed-tower-custom-detail.png';
const RELATED_IMAGES = [
  '/media/ft-path-standard.png',
  '/media/burn-room.webp',
  '/media/case-henan-hero.png',
] as const;

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.fixedTowerCustom', path: '/fixed-tower/custom' });
}

export default async function FixedTowerCustomPage() {
  const t = await getTranslations('pages.fixedTowerCustom');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const features = t.raw('features') as string[];
  const capabilitiesRaw = t.raw('capabilities') as Array<{ title: string; desc: string }>;
  const capabilities = capabilitiesRaw.map((item, i) => ({ ...item, icon: CAPABILITY_ICONS[i]! }));
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <VideoHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
        video={HERO_VIDEO}
        poster={HERO_POSTER}
      >
        <BookConsultButton variant="light" message={tCommon('bookConsultProduct')}>
          {tCta('bookConsult')}
        </BookConsultButton>
      </VideoHero>

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeading
                eyebrow={t('customSection.eyebrow')}
                title={t('customSection.title')}
                description={t('customSection.description')}
              />
              <ul className="mt-8 flex flex-col gap-4">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-base text-neutral-900">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden border border-neutral-300 bg-neutral-200">
              <Image
                src={DETAIL_IMAGE}
                alt={t('customSection.title')}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('capabilitiesSection.eyebrow')}
            title={t('capabilitiesSection.title')}
            description={t('capabilitiesSection.description')}
          />
          <div className="mt-10">
            <FeatureGrid items={capabilities} columns={4} />
          </div>
          <div className="mt-12 flex flex-col items-start gap-4 border border-neutral-300 bg-white p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="rb-h4 text-neutral-900">{t('midCta.title')}</h3>
              <p className="mt-2 text-sm text-secondary-text">{t('midCta.description')}</p>
            </div>
            <BookConsultButton message={tCommon('bookConsultProduct')}>
              {tCta('bookConsult')}
            </BookConsultButton>
          </div>
        </Container>
      </section>

      <ProcessBandI18n />

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => ({
          ...l,
          href: RELATED_HREFS[i]!,
          image: RELATED_IMAGES[i],
        }))}
      />

      <Container className="pt-16 lg:pt-24">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="text-secondary-text">{t('cta.description')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <BookConsultButton message={tCommon('bookConsultProduct')}>
              {tCta('bookConsult')}
            </BookConsultButton>
            <RbLink href="/fixed-tower/series">{t('cta.secondaryLabel')}</RbLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
