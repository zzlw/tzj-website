import {
  Boxes,
  Building,
  Clock,
  DoorClosed,
  FileText,
  Layers,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { MediaImage as Image } from '@/components/MediaImage';
import { FeatureGrid, RelatedLinks } from '@/components/sections/blocks';
import { Container, Eyebrow, RbLink, SectionHeading } from '@/components/ui';
import { Link as I18nLink } from '@/i18n/navigation';
import { getCases } from '@/lib/api';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { relatedLinksWithImages } from '@/lib/product-line-page';
import { RESOURCES_IMAGES } from '@/lib/resources-images';

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.resourcesInspections',
    path: '/resources/inspections',
    image: RESOURCES_IMAGES.inspections.og,
  });
}

const CATEGORY_ICONS = [DoorClosed, Building, Boxes, Layers, Wrench, FileText] as const;
const WHY_ICONS = [ShieldCheck, Clock, FileText] as const;
const RELATED_HREFS = ['/resources/warranty', '/burn-rooms/liner', '/burn-rooms/comparison'];

interface FeaturedCase {
  slug: string;
  title: string;
  location: string;
  summary: string;
  image: string;
}

/** 拉取最近交付的案例（检测服务面向全部设施，不限分类）；接口异常时降级为空。 */
async function fetchFeaturedCases(limit = 3): Promise<FeaturedCase[]> {
  try {
    const res = await getCases({ limit, sortBy: 'completionDate', sortOrder: 'desc' });
    return (res.data ?? [])
      .filter((c) => c.coverImage)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        location: c.location ?? '',
        summary: ((c as unknown as { summary?: string }).summary ?? c.description) || '',
        image: c.coverImage,
      }));
  } catch {
    return [];
  }
}

export default async function InspectionsPage() {
  const t = await getTranslations('pages.resourcesInspections');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const reviewItems = t.raw('reviewItems') as string[];
  const categoriesRaw = t.raw('categories') as Array<{ title: string; desc: string }>;
  const categories = categoriesRaw.map((item, i) => ({ ...item, icon: CATEGORY_ICONS[i]! }));
  const whyRaw = t.raw('why') as Array<{ title: string; desc: string }>;
  const why = whyRaw.map((item, i) => ({ ...item, icon: WHY_ICONS[i]! }));
  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;
  const sceneImageAlts = t.raw('sceneImageAlts') as string[];
  const featuredCases = await fetchFeaturedCases();

  return (
    <div className="pb-20">
      <section className="relative h-[380px] overflow-hidden bg-neutral-800 lg:h-[460px]">
        <Image
          src={RESOURCES_IMAGES.inspections.hero}
          alt={t('hero.title')}
          fill
          preload
          loading="eager"
          fetchPriority="high"
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
              eyebrow={t('scheduleSection.eyebrow')}
              title={t('scheduleSection.title')}
              description={t('scheduleSection.description')}
            />
            <div className="flex flex-col justify-center gap-4">
              <div className="flex items-center justify-between gap-4 border border-neutral-300 bg-white px-6 py-5">
                <div>
                  <div className="rb-h5 text-neutral-900">{t('scheduleSection.classA.title')}</div>
                  <div className="mt-1 text-sm text-secondary-text">
                    {t('scheduleSection.classA.subtitle')}
                  </div>
                </div>
                <div className="text-right font-display text-lg font-bold text-primary">
                  {t('scheduleSection.classA.interval')}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border border-neutral-300 bg-white px-6 py-5">
                <div>
                  <div className="rb-h5 text-neutral-900">{t('scheduleSection.classB.title')}</div>
                  <div className="mt-1 text-sm text-secondary-text">
                    {t('scheduleSection.classB.subtitle')}
                  </div>
                </div>
                <div className="text-right font-display text-lg font-bold text-primary">
                  {t('scheduleSection.classB.interval')}
                </div>
              </div>
              <p className="text-xs leading-relaxed text-secondary-text">
                {t('scheduleSection.footnote')}
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('reviewSection.eyebrow')}
            title={t('reviewSection.title')}
            description={t('reviewSection.description')}
          />
          <div className="mt-10 flex flex-wrap gap-3">
            {reviewItems.map((i) => (
              <span
                key={i}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-900"
              >
                {i}
              </span>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('categoriesSection.eyebrow')}
            title={t('categoriesSection.title')}
          />
          <div className="mt-10">
            <FeatureGrid items={categories} columns={3} />
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('whySection.eyebrow')} title={t('whySection.title')} />
          <div className="mt-10">
            <FeatureGrid items={why} columns={3} />
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {RESOURCES_IMAGES.inspections.detailImages.map((src, i) => (
              <div
                key={src}
                className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200"
              >
                <Image
                  src={src}
                  alt={sceneImageAlts[i] ?? t('hero.title')}
                  fill
                  quality={75}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </Container>
      </section>

      {featuredCases.length > 0 ? (
        <section>
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('cases.eyebrow')}
              title={t('cases.title')}
              description={t('cases.description')}
            />
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {featuredCases.map((item) => (
                <I18nLink
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
                </I18nLink>
              ))}
            </div>
            <div className="mt-8">
              <RbLink href="/cases">{t('cases.linkText')}</RbLink>
            </div>
          </Container>
        </section>
      ) : null}

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinksWithImages(relatedLinks, RELATED_HREFS)}
      />

      <Container>
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="max-w-xl text-secondary-text">{t('cta.description')}</p>
          {/* CTA 仅保留单一「预约咨询」按钮（拨号/询盘入口已全局移除） */}
          <BookConsultButton message={tCommon('bookConsultContent')}>
            {tCta('bookConsult')}
          </BookConsultButton>
        </div>
      </Container>
    </div>
  );
}
