import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, RelatedLinks } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import { getProductLine, productLineHeroImage, productLineOgImage } from '@/lib/product-catalog';
import { relatedLinksWithImages } from '@/lib/product-line-page';

const maritimeLine = getProductLine('maritime');
if (!maritimeLine) throw new Error('missing product line: maritime');
const LINE = maritimeLine;

/** 与 i18n `props` 数组顺序一一对应 */
const FEATURE_IDS = ['bridge', 'hatch', 'door', 'engine', 'maze', 'cargo'] as const;

const HERO_SRC = productLineHeroImage(LINE);
const GALLERY_SRCS = LINE.detailImages ?? [LINE.image];
const FEATURE_IMAGES = LINE.featureImages ?? {};
const CONFIG_SRC = LINE.configImage;
const EXTRA_SRC = LINE.extraImage;
const USERS_SRC = LINE.usersImage;
const RELATED_HREFS = ['/fixed-tower', '/modular-tower', '/accessories'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    namespace: 'pages.accessoriesMaritime',
    path: '/accessories/maritime',
    image: productLineOgImage(LINE),
  });
}

export default async function MaritimePage() {
  const t = await getTranslations('pages.accessoriesMaritime');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tBread = await getTranslations('breadcrumbs');

  const gallery = t.raw('gallery') as Array<{ alt: string }>;
  const props = t.raw('props') as Array<{ title: string; desc: string }>;
  const extraFeatures = t.raw('extraFeatures') as string[];
  const config = t.raw('config') as Array<{ label: string; value: string }>;
  const users = t.raw('users') as string[];
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('hero.eyebrow'), path: '/specialized-training' },
            { name: t('meta.title'), path: '/accessories/maritime' },
          ]),
          productJsonLd({
            name: LINE.title,
            description: t('meta.description'),
            path: '/accessories/maritime',
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
              eyebrow={t('why.eyebrow')}
              title={t('why.title')}
              description={t('why.description')}
            />
            <div className="flex flex-col justify-center">
              <p className="text-base leading-relaxed text-neutral-900">{t('why.lead')}</p>
              <p className="mt-4 text-base leading-relaxed text-secondary-text">{t('why.body')}</p>
            </div>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('propsSection.eyebrow')} title={t('propsSection.title')} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.map((p, i) => {
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
                      alt={p.title}
                      fill
                      quality={70}
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="rb-h5 text-neutral-900">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-secondary-text">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeading eyebrow={t('extraSection.eyebrow')} title={t('extraSection.title')} />
              {EXTRA_SRC ? (
                <div className="rb-img-shimmer relative mt-8 aspect-[4/3] overflow-hidden bg-neutral-200">
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
              <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {extraFeatures.map((f) => (
                  <li
                    key={f}
                    className="border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionHeading
                eyebrow={t('configSection.eyebrow')}
                title={t('configSection.title')}
              />
              {CONFIG_SRC ? (
                <div className="rb-img-shimmer relative mt-8 aspect-[16/9] overflow-hidden bg-neutral-200">
                  <Image
                    src={CONFIG_SRC}
                    alt={t('configImageAlt')}
                    fill
                    quality={75}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <dl className="mt-8 divide-y divide-neutral-200 border border-neutral-300 bg-white">
                {config.map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-4 px-5 py-4">
                    <dt className="text-sm text-secondary-text">{c.label}</dt>
                    <dd className="text-right font-display text-sm font-bold text-neutral-900">
                      {c.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-sm leading-relaxed text-secondary-text">
                {t('configSection.note')}
              </p>
            </div>
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
