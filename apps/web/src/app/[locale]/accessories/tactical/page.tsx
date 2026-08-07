import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, RbLink, SectionHeading } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { getCase } from '@/lib/api';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import { getProductLine, productLineHeroImage, productLineOgImage } from '@/lib/product-catalog';
import { relatedLinksWithImages } from '@/lib/product-line-page';

const tacticalLine = getProductLine('tactical');
if (!tacticalLine) throw new Error('missing product line: tactical');
const LINE = tacticalLine;

/** 与 i18n `scenarios` 数组顺序一一对应 */
const FEATURE_IDS = ['breach', 'cqb', 'stairwell', 'rope'] as const;

const HERO_SRC = productLineHeroImage(LINE);
const GALLERY_SRCS = LINE.detailImages ?? [LINE.image];
const FEATURE_IMAGES = LINE.featureImages ?? {};
const CONFIG_SRC = LINE.configImage;
const EXTRA_SRC = LINE.extraImage;
const USERS_SRC = LINE.usersImage;
const RELATED_HREFS = ['/fixed-tower', '/modular-tower', '/accessories'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.accessoriesTactical',
    path: '/accessories/tactical',
    image: productLineOgImage(LINE),
  });
}

export default async function TacticalPage() {
  const t = await getTranslations('pages.accessoriesTactical');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tBread = await getTranslations('breadcrumbs');

  const gallery = t.raw('gallery') as Array<{ alt: string }>;
  const scenarios = t.raw('scenarios') as Array<{ title: string; desc: string }>;
  const skillTags = t.raw('skillTags') as string[];
  const customPoints = t.raw('customPoints') as Array<{ title: string; desc: string }>;
  const users = t.raw('users') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  const caseSlugs = LINE.relatedCaseSlugs ?? [];
  const featuredCases = (
    await Promise.all(
      caseSlugs.map(async (slug) => {
        try {
          const res = await getCase(slug);
          const item = res.data;
          if (!item?.coverImage) return null;
          // API 列表/详情含 summary；共享 Case 类型尚未收录该字段
          const apiSummary = (item as unknown as { summary?: string }).summary ?? item.description;
          return {
            slug,
            title: item.title,
            location: item.location ?? '',
            summary: apiSummary,
            image: item.coverImage,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className="pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('hero.eyebrow'), path: '/specialized-training' },
            { name: t('meta.title'), path: '/accessories/tactical' },
          ]),
          productJsonLd({
            name: LINE.title,
            description: t('meta.description'),
            path: '/accessories/tactical',
            image: HERO_SRC,
          }),
        ]}
      />

      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <section>
        <Container className="pt-16 lg:pt-24">
          <div className="rb-img-shimmer relative aspect-[21/9] overflow-hidden bg-neutral-200">
            <Image
              src={HERO_SRC}
              alt={t('heroImageAlt')}
              fill
              preload
              loading="eager"
              fetchPriority="high"
              quality={90}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </Container>
      </section>

      <section>
        <Container className="pt-4 lg:pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {gallery.map((g, i) => (
              <div
                key={GALLERY_SRCS[i] ?? `${g.alt}-${i}`}
                className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200"
              >
                <Image
                  src={GALLERY_SRCS[i] ?? GALLERY_SRCS[0] ?? LINE.image}
                  alt={g.alt}
                  fill
                  quality={70}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t('modularSection.eyebrow')}
              title={t('modularSection.title')}
              description={t('modularSection.description')}
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

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('scenariosSection.eyebrow')}
            title={t('scenariosSection.title')}
            description={t('scenariosSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {scenarios.map((s, i) => {
              const featureId = FEATURE_IDS[i] ?? FEATURE_IDS[0];
              const src = FEATURE_IMAGES[featureId] ?? LINE.image;
              return (
                <div
                  key={featureId}
                  className="flex flex-col overflow-hidden border border-neutral-300 bg-white"
                >
                  <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
                    <Image
                      src={src}
                      alt={s.title}
                      fill
                      quality={70}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="rb-h5 text-neutral-900">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
                  </div>
                </div>
              );
            })}
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
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {customPoints.map((p, i) => (
              <div key={p.title} className="border border-neutral-300 bg-white p-6">
                <span className="font-display text-2xl font-bold text-primary">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="rb-h5 mt-3 text-neutral-900">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <RbLink href="/fixed-tower">{t('customSection.linkFixedTower')}</RbLink>
            <RbLink href="/modular-tower">{t('customSection.linkModularTower')}</RbLink>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('usersSection.eyebrow')}
            title={t('usersSection.title')}
            description={t('usersSection.description')}
          />
          <div className="mt-10 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
            {USERS_SRC ? (
              <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
                <Image
                  src={USERS_SRC}
                  alt={t('usersImageAlt')}
                  fill
                  quality={75}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="flex flex-wrap content-center gap-3">
              {users.map((u) => (
                <span
                  key={u}
                  className="border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-900"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {featuredCases.length > 0 ? (
        <section>
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('casesSection.eyebrow')}
              title={t('casesSection.title')}
              description={t('casesSection.description')}
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
                    {item.location ? (
                      <p className="text-xs font-bold tracking-wide text-primary">
                        {item.location}
                      </p>
                    ) : null}
                    <h3 className="rb-h5 mt-2 text-neutral-900">{item.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-secondary-text">
                      {item.summary}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8">
              <RbLink href="/cases">{t('casesSection.linkText')}</RbLink>
            </div>
          </Container>
        </section>
      ) : null}

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
        secondaryHref="/specialized-training"
      />
    </div>
  );
}
