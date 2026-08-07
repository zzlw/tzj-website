import type { LucideIcon } from 'lucide-react';
import { Check, ClipboardList, Factory, PencilRuler, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BaiduSafeVideoHero as VideoHero } from '@/components/BaiduSafeVideoHero';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { UsersBand } from '@/components/products/ProductLineMedia';
import { RelatedLinks } from '@/components/sections/blocks';
import { Container, RbLink, SectionHeading } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import { productLineHeroImage, productLineOgImage } from '@/lib/product-catalog';
import { getProductPageImages } from '@/lib/product-images';
import {
  fetchFeaturedCases,
  relatedLinksWithImages,
  requireProductLine,
} from '@/lib/product-line-page';

const LINE = requireProductLine('fixed-tower');
const SERIES_IMAGES = getProductPageImages('fixed-series');
const CUSTOM_IMAGES = getProductPageImages('fixed-custom');

const HERO_POSTER = productLineHeroImage(LINE);
const HERO_VIDEO = '/media/hero.mp4';
const OVERVIEW_IMAGE = LINE.extraImage ?? LINE.detailImages?.[0] ?? LINE.image;
const PATH_STANDARD_IMAGE =
  SERIES_IMAGES.detailImages?.[0] ?? '/media/product/towers/fixed-series-structure-1.webp';
const PATH_CUSTOM_IMAGE =
  CUSTOM_IMAGES.detailImages?.[0] ?? '/media/product/towers/fixed-custom-structure-1.webp';
const USERS_SRC = LINE.usersImage;
const CONFIG_SRC = LINE.configImage;

const PROCESS_ICONS: LucideIcon[] = [ClipboardList, PencilRuler, Factory, ShieldCheck];

const RELATED_HREFS = ['/fixed-tower/series', '/fixed-tower/custom', '/burn-rooms'] as const;

type SeriesCard = {
  name: string;
  variants: string;
  desc: string;
  image: string;
};

type PathColumn = {
  title: string;
  points: string[];
  linkText: string;
};

type ProcessStep = { title: string; desc: string };

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.fixedTower',
    path: '/fixed-tower',
    image: productLineOgImage(LINE),
  });
}

export default async function FixedTowerPage() {
  const t = await getTranslations('pages.fixedTower');
  const tSeries = await getTranslations('pages.fixedTowerSeries');
  const tCta = await getTranslations('cta');
  const tBread = await getTranslations('breadcrumbs');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const specStrip = t.raw('specStrip') as string[];
  const seriesRaw = tSeries.raw('series');
  const seriesCards = (Array.isArray(seriesRaw) ? seriesRaw : []) as SeriesCard[];
  const pathStandard = t.raw('paths.standard') as PathColumn;
  const pathCustom = t.raw('paths.custom') as PathColumn;
  const processSteps = t.raw('process.steps') as ProcessStep[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;
  const users = t.raw('users') as string[];

  const featuredCases = await fetchFeaturedCases(LINE.relatedCaseSlugs);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('breadcrumb.current'), path: '/fixed-tower' },
          ]),
          productJsonLd({
            name: t('jsonLd.productName'),
            description: t('jsonLd.productDescription'),
            path: '/fixed-tower',
            image: HERO_POSTER,
          }),
        ]}
      />
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

        <section aria-label={t('overview.eyebrow')} className="border-b border-neutral-300">
          <Container className="py-5 lg:py-6">
            <p className="text-center text-sm leading-7 text-secondary-text sm:leading-8">
              {specStrip.map((item, i) => (
                <span key={item}>
                  {i > 0 ? (
                    <span
                      className="mx-2.5 text-neutral-300 select-none sm:mx-3"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                  ) : null}
                  <span className="text-neutral-800">{item}</span>
                </span>
              ))}
            </p>
          </Container>
        </section>

        <section id="overview" className="scroll-mt-24">
          <Container className="py-16 lg:py-24">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <SectionHeading
                eyebrow={t('overview.eyebrow')}
                title={t('overview.title')}
                description={t('overview.description')}
              />
              <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
                <Image
                  src={OVERVIEW_IMAGE}
                  alt={t('overviewImageAlt')}
                  fill
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="object-cover"
                />
              </div>
            </div>
          </Container>
        </section>

        <section id="paths" className="scroll-mt-24 bg-neutral-100">
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('paths.eyebrow')}
              title={t('paths.title')}
              description={t('paths.description')}
            />
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {(
                [
                  { col: pathStandard, image: PATH_STANDARD_IMAGE, href: '/fixed-tower/series' },
                  { col: pathCustom, image: PATH_CUSTOM_IMAGE, href: '/fixed-tower/custom' },
                ] as const
              ).map(({ col, image, href }) => (
                <article
                  key={col.title}
                  className="flex flex-col border border-neutral-300 bg-white"
                >
                  <div className="rb-img-shimmer relative aspect-[16/10] overflow-hidden bg-neutral-200">
                    <Image
                      src={image}
                      alt={col.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 560px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-8">
                    <h3 className="rb-h4 text-neutral-900">{col.title}</h3>
                    <ul className="mt-5 space-y-3">
                      {col.points.map((p) => (
                        <li key={p} className="flex items-start gap-3">
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span className="text-sm leading-relaxed text-neutral-900">{p}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8">
                      <RbLink href={href}>{col.linkText}</RbLink>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <section id="series" className="scroll-mt-24">
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('series.eyebrow')}
              title={t('series.title')}
              description={t('series.description')}
            />
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {seriesCards.map((s) => (
                <Link
                  key={s.name}
                  href="/fixed-tower/series"
                  className="group flex flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
                >
                  <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden border-b border-neutral-300 bg-neutral-200">
                    <Image
                      src={s.image}
                      alt={s.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="rb-h5 text-neutral-900">{s.name}</h3>
                    <span className="mt-1 text-xs font-bold text-primary">{s.variants}</span>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-secondary-text">
                      {s.desc}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8">
              <RbLink href="/fixed-tower/series">{t('series.linkText')}</RbLink>
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

        {CONFIG_SRC ? (
          <section className="bg-neutral-100">
            <Container className="py-16 lg:py-24">
              <SectionHeading
                eyebrow={t('configSection.eyebrow')}
                title={t('configSection.title')}
                description={t('configSection.description')}
              />
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
            </Container>
          </section>
        ) : null}

        <UsersBand
          eyebrow={t('usersSection.eyebrow')}
          title={t('usersSection.title')}
          description={t('usersSection.description')}
          imageSrc={USERS_SRC}
          imageAlt={t('usersImageAlt')}
          users={users}
        />

        <section id="cases" className="scroll-mt-24 bg-neutral-100">
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('cases.eyebrow')}
              title={t('cases.title')}
              description={t('cases.description')}
            />
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {featuredCases.map((item) => (
                <Link
                  key={item.slug}
                  href={`/cases/${item.slug}`}
                  className="group flex flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
                >
                  <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-bold tracking-wide text-primary">{item.location}</p>
                    <h3 className="rb-h5 mt-2 text-neutral-900">{item.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-secondary-text">
                      {item.summary}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8">
              <RbLink href="/cases">{t('cases.linkText')}</RbLink>
            </div>
          </Container>
        </section>

        <section id="process" className="scroll-mt-24">
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('process.eyebrow')}
              title={t('process.title')}
              description={t('process.description')}
            />
            <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step, i) => {
                const Icon = PROCESS_ICONS[i] ?? ClipboardList;
                return (
                  <li key={step.title} className="relative border border-neutral-300 bg-white p-6">
                    <span className="absolute right-4 top-4 font-display text-2xl font-bold text-neutral-200">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="rb-h5 text-neutral-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-secondary-text">{step.desc}</p>
                  </li>
                );
              })}
            </ol>
          </Container>
        </section>

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
              <RbLink href="/modular-tower">{t('cta.secondaryLink')}</RbLink>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
