import { Check, X } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BaiduSafeVideoHero as VideoHero } from '@/components/BaiduSafeVideoHero';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import {
  FeatureImageGrid,
  ProductGallery,
  UsersBand,
} from '@/components/products/ProductLineMedia';
import { RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, RbLink, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { productLineHeroImage, productLineOgImage } from '@/lib/product-catalog';
import { relatedLinksWithImages, requireProductLine } from '@/lib/product-line-page';

const LINE = requireProductLine('modular-tower');

/** 与 i18n `features` 数组顺序一一对应 */
const FEATURE_IDS = [
  'openplan',
  'reconfigure',
  'expand',
  'nointernal',
  'install',
  'upgrade',
] as const;

const HERO_POSTER = productLineHeroImage(LINE);
const HERO_VIDEO = '/media/hero.mp4';
const GALLERY_SRCS = LINE.detailImages ?? [LINE.image];
const FEATURE_IMAGES = LINE.featureImages ?? {};
const EXTRA_SRC = LINE.extraImage;
const USERS_SRC = LINE.usersImage;
const RELATED_HREFS = [
  '/modular-tower/series',
  '/modular-tower/vs-containers',
  '/fixed-tower',
] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.modularTower',
    path: '/modular-tower',
    image: productLineOgImage(LINE),
  });
}

export default async function ModularTowerPage() {
  const t = await getTranslations('pages.modularTower');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const gallery = t.raw('gallery') as Array<{ alt: string }>;
  const features = t.raw('features') as Array<{ title: string; desc: string }>;
  const series = t.raw('series') as Array<{ name: string; desc: string; spec: string }>;
  const compareRows = t.raw('compareRows') as Array<{
    label: string;
    modx: string;
    container: string;
  }>;
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;
  const users = t.raw('users') as string[];

  const galleryItems = gallery.map((g, i) => ({
    src: GALLERY_SRCS[i] ?? GALLERY_SRCS[0] ?? LINE.image,
    alt: g.alt,
  }));

  const featureItems = features.map((f, i) => {
    const featureId = FEATURE_IDS[i] ?? FEATURE_IDS[0];
    return {
      id: featureId,
      title: f.title,
      desc: f.desc,
      src: FEATURE_IMAGES[featureId] ?? LINE.image,
    };
  });

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

      <ProductGallery items={galleryItems} fallbackSrc={LINE.image} />

      <section id="overview" className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('overview.eyebrow')}
              title={t('overview.title')}
              description={t('overview.description')}
            />
            <div className="flex flex-col justify-center gap-4 border-l-2 border-primary pl-6">
              {EXTRA_SRC ? (
                <div className="rb-img-shimmer relative mb-4 aspect-[4/3] overflow-hidden bg-neutral-200">
                  <Image
                    src={EXTRA_SRC}
                    alt={t('extraImageAlt')}
                    fill
                    quality={70}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <p className="text-lg leading-relaxed text-neutral-900">{t('overview.lead')}</p>
              <p className="text-secondary-text">{t('overview.body')}</p>
            </div>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('featuresSection.eyebrow')}
            title={t('featuresSection.title')}
            description={t('featuresSection.description')}
          />
          <FeatureImageGrid items={featureItems} columns={3} />
        </Container>
      </section>

      <section id="series" className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('seriesSection.eyebrow')}
            title={t('seriesSection.title')}
            description={t('seriesSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {series.map((s) => (
              <div
                key={s.name}
                className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
              >
                <h3 className="rb-h4 text-neutral-900">{s.name}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
                <p className="mt-4 border-t border-neutral-300 pt-3 text-xs font-bold text-primary">
                  {s.spec}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <RbLink href="/modular-tower/series">{t('seriesSection.linkText')}</RbLink>
          </div>
        </Container>
      </section>

      <section id="vs-containers" className="scroll-mt-24 bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('compareSection.eyebrow')}
            title={t('compareSection.title')}
            description={t('compareSection.description')}
          />
          <div className="mt-10 overflow-hidden border border-neutral-300">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-neutral-900 text-white">
                  <th className="p-4 text-sm font-bold">{t('compareSection.headers.feature')}</th>
                  <th className="p-4 text-sm font-bold text-primary">
                    {t('compareSection.headers.modular')}
                  </th>
                  <th className="p-4 text-sm font-bold">{t('compareSection.headers.container')}</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? 'bg-neutral-100' : 'bg-white'}>
                    <td className="p-4 align-top text-sm font-bold text-neutral-900">
                      {row.label}
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm leading-relaxed text-neutral-900">{row.modx}</span>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-start gap-2">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                        <span className="text-sm leading-relaxed text-secondary-text">
                          {row.container}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8">
            <RbLink href="/modular-tower/vs-containers">{t('compareSection.linkText')}</RbLink>
          </div>
        </Container>
      </section>

      <UsersBand
        eyebrow={t('usersSection.eyebrow')}
        title={t('usersSection.title')}
        description={t('usersSection.description')}
        imageSrc={USERS_SRC}
        imageAlt={t('usersImageAlt')}
        users={users}
      />

      <section id="custom" className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <SectionHeading
                eyebrow={t('customSection.eyebrow')}
                title={t('customSection.title')}
                description={t('customSection.description')}
              />
              <RbLink href="/modular-tower/custom">{t('customSection.linkText')}</RbLink>
            </div>
            <div className="flex flex-col justify-center gap-5">
              <p className="text-lg leading-relaxed text-neutral-900">{t('customSection.lead')}</p>
              <p className="text-secondary-text">{t('customSection.body')}</p>
            </div>
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

      <Container className="pt-16 lg:pt-24">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="text-secondary-text">{t('cta.description')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <BookConsultButton message={tCommon('bookConsultProduct')}>
              {tCta('bookConsult')}
            </BookConsultButton>
            <RbLink href="/burn-rooms">{t('cta.secondaryLink')}</RbLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
