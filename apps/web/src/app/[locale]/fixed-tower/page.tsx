import type { LucideIcon } from 'lucide-react';
import { Check, ClipboardList, Factory, PencilRuler, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { Container, RbLink, SectionHeading, VideoHero } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { getCaseBySlug } from '@/lib/cases';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.fixedTower', path: '/fixed-tower' });
}

const HERO_IMAGE = '/media/fixed-tower-hero.jpg';
const HERO_VIDEO = '/media/fixed-tower.mp4';
const OVERVIEW_IMAGE = '/media/ft-overview-detail.png';
const PATH_STANDARD_IMAGE = '/media/ft-path-standard.png';
const PATH_CUSTOM_IMAGE = '/media/ft-path-custom.png';
const RELATED_IMAGES = [
  '/media/ft-path-standard.png',
  '/media/ft-path-custom.png',
  '/media/burn-room.webp',
] as const;

const PROCESS_ICONS: LucideIcon[] = [ClipboardList, PencilRuler, Factory, ShieldCheck];

/**
 * 固定塔 Hub 精选案例：文案/链接用真实案例。
 * 封面必须与案例详情 `coverImage` 同源（content/case-*-hero），避免卡片→详情视觉跳变。
 */
const FEATURED_CASES = [
  { slug: 'henan-fire-rescue', image: '/media/case-henan-hero.png' },
  { slug: 'guangdong-cfbt', image: '/media/case-gd-hero.png' },
  { slug: 'jiangsu-university', image: '/media/case-js-hero.png' },
] as const;

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
  const relatedHrefs = ['/fixed-tower/series', '/fixed-tower/custom', '/burn-rooms'] as const;

  const featuredCases = FEATURED_CASES.map(({ slug, image }) => {
    const study = getCaseBySlug(slug);
    if (!study) return null;
    return {
      slug,
      image,
      title: study.title,
      location: study.location,
      summary: study.summary,
    };
  }).filter((c): c is NonNullable<typeof c> => c !== null);

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
            image: HERO_IMAGE,
          }),
        ]}
      />
      <div className="pb-20">
        <VideoHero
          eyebrow={t('hero.eyebrow')}
          title={t('hero.title')}
          description={t('hero.description')}
          video={HERO_VIDEO}
          poster={HERO_IMAGE}
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
                    <span className="mx-2.5 text-neutral-300 select-none sm:mx-3" aria-hidden="true">
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
                  alt={t('overview.title')}
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
                <article key={col.title} className="flex flex-col border border-neutral-300 bg-white">
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
          links={relatedLinks.map((l, i) => ({
            ...l,
            href: relatedHrefs[i]!,
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
              <RbLink href="/modular-tower">{t('cta.secondaryLink')}</RbLink>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
