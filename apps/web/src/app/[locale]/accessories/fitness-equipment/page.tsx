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
import { getProductPageImages } from '@/lib/product-images';
import { fetchFeaturedCases, relatedLinksWithImages } from '@/lib/product-line-page';

const IMGS = getProductPageImages('accessories-fitness');

/** 与 i18n `features` 数组顺序一一对应 */
const FEATURE_IDS = [
  'strength',
  'vestibular',
  'balance',
  'cardio',
  'adjustable',
  'durable',
] as const;

const HERO_SRC = IMGS.heroImage;
const GALLERY_SRCS = IMGS.detailImages ?? [];
const FEATURE_IMAGES = IMGS.featureImages ?? {};
const CONFIG_SRC = IMGS.configImage;
const EXTRA_SRC = IMGS.extraImage;
const USERS_SRC = IMGS.usersImage;
const RELATED_HREFS = [
  '/accessories/competition',
  '/specialized-training/psychological',
  '/accessories',
] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.accessoriesFitnessEquipment',
    path: '/accessories/fitness-equipment',
    image: IMGS.ogImage ?? IMGS.heroImage,
  });
}

export default async function FitnessEquipmentPage() {
  const t = await getTranslations('pages.accessoriesFitnessEquipment');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tBread = await getTranslations('breadcrumbs');

  const gallery = t.raw('gallery') as Array<{ alt: string }>;
  const features = t.raw('features') as Array<{ title: string; desc: string }>;
  const programs = t.raw('programs') as string[];
  const users = t.raw('users') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  const featuredCases = await fetchFeaturedCases(IMGS.relatedCaseSlugs);

  const galleryItems = gallery.map((g, i) => ({
    src: GALLERY_SRCS[i] ?? GALLERY_SRCS[0] ?? HERO_SRC,
    alt: g.alt,
  }));

  const featureItems = features.map((f, i) => {
    const featureId = FEATURE_IDS[i] ?? FEATURE_IDS[0];
    return {
      id: featureId,
      title: f.title,
      desc: f.desc,
      src: FEATURE_IMAGES[featureId] ?? HERO_SRC,
    };
  });

  return (
    <div className="pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('breadcrumb.parent'), path: '/accessories' },
            { name: t('breadcrumb.current'), path: '/accessories/fitness-equipment' },
          ]),
          productJsonLd({
            name: t('jsonLd.productName'),
            description: t('jsonLd.productDescription'),
            path: '/accessories/fitness-equipment',
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
      <ProductGallery items={galleryItems} fallbackSrc={HERO_SRC} />

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
        secondaryHref="/accessories"
      />
    </div>
  );
}
