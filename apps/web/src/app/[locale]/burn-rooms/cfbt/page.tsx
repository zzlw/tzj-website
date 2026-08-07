import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import {
  CasesBand,
  FeatureImageGrid,
  ProductGallery,
  ProductHeroBand,
  UsersBand,
} from '@/components/products/ProductLineMedia';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import { productLineHeroImage, productLineOgImage } from '@/lib/product-catalog';
import {
  fetchFeaturedCases,
  relatedLinksWithImages,
  requireProductLine,
} from '@/lib/product-line-page';

const LINE = requireProductLine('cfbt');

/** 与 i18n `features` 数组顺序一一对应 */
const FEATURE_IDS = ['smoke', 'heat', 'flashover', 'tactics', 'observe', 'safety'] as const;

const HERO_SRC = productLineHeroImage(LINE);
const GALLERY_SRCS = LINE.detailImages ?? [LINE.image];
const FEATURE_IMAGES = LINE.featureImages ?? {};
const CONFIG_SRC = LINE.configImage;
const EXTRA_SRC = LINE.extraImage;
const USERS_SRC = LINE.usersImage;
const RELATED_HREFS = [
  '/burn-rooms/liner',
  '/burn-rooms/fire-simulation',
  '/solutions/fire-rescue',
] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.burnRoomsCfbt',
    path: '/burn-rooms/cfbt',
    image: productLineOgImage(LINE),
  });
}

export default async function CfbtPage() {
  const t = await getTranslations('pages.burnRoomsCfbt');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tBread = await getTranslations('breadcrumbs');

  const gallery = t.raw('gallery') as Array<{ alt: string }>;
  const features = t.raw('features') as Array<{ title: string; desc: string }>;
  const programs = t.raw('programs') as string[];
  const users = t.raw('users') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  const featuredCases = await fetchFeaturedCases(LINE.relatedCaseSlugs);

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
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('hero.eyebrow'), path: '/burn-rooms' },
            { name: t('meta.title'), path: '/burn-rooms/cfbt' },
          ]),
          productJsonLd({
            name: LINE.title,
            description: t('meta.description'),
            path: '/burn-rooms/cfbt',
            image: HERO_SRC,
          }),
        ]}
      />

      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <ProductHeroBand src={HERO_SRC} alt={t('heroImageAlt')} />
      <ProductGallery items={galleryItems} fallbackSrc={LINE.image} />

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

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('programsSection.eyebrow')}
              title={t('programsSection.title')}
              description={t('programsSection.description')}
            />
            <div className="flex flex-col justify-center">
              {EXTRA_SRC ? (
                <div className="rb-img-shimmer relative mb-8 aspect-[4/3] overflow-hidden bg-neutral-200">
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
              <ul className="grid grid-cols-1 gap-3">
                {programs.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-3 border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('configSection.eyebrow')}
            title={t('configSection.title')}
            description={t('configSection.description')}
          />
          {CONFIG_SRC ? (
            <div className="rb-img-shimmer relative mt-10 aspect-[21/9] overflow-hidden bg-neutral-200">
              <Image
                src={CONFIG_SRC}
                alt={t('configImageAlt')}
                fill
                quality={75}
                sizes="100vw"
                className="object-cover"
              />
            </div>
          ) : null}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <p className="text-base leading-relaxed text-neutral-900">
              {t('configSection.point1')}
            </p>
            <p className="text-base leading-relaxed text-secondary-text">
              {t('configSection.point2')}
            </p>
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

      <CasesBand
        eyebrow={t('casesSection.eyebrow')}
        title={t('casesSection.title')}
        description={t('casesSection.description')}
        linkText={t('casesSection.linkText')}
        cases={featuredCases}
      />

      <ProcessBandI18n image={LINE.processImage} />

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
        secondaryHref="/burn-rooms"
      />
    </div>
  );
}
