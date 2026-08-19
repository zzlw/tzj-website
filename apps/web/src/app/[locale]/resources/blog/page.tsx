import type { Blog } from '@tzj/types';
import { ArrowRight, Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { ContentListShell, ContentPaginationShell } from '@/components/content/ContentListShell';
import { ContentPagination } from '@/components/content/ContentPagination';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { getBlogs } from '@/lib/api';
import { blogCategoryLabel, formatContentDate } from '@/lib/content-labels';
import {
  buildListQuery,
  normalizePagination,
  parseContentListState,
  pickCoverImage,
  pickSummary,
} from '@/lib/content-list';
import { getBlogCategoryFilter } from '@/lib/i18n/content-filters';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { getBlogSortOptions } from '@/lib/i18n/sort-options';
import { relatedLinksWithImages } from '@/lib/product-line-page';

const RELATED_HREFS = ['/resources/faqs', '/cases', '/resources/design-center'] as const;

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.resourcesBlog', path: '/resources/blog' });
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function fetchFeaturedBlog(): Promise<Blog | null> {
  try {
    const res = await getBlogs({ limit: 24, sortBy: 'publishedAt', sortOrder: 'desc' });
    return res.data?.find((b) => b.isFeatured) ?? res.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export default async function BlogPage({ searchParams }: PageProps) {
  const t = await getTranslations('pages.resourcesBlog');
  const tList = await getTranslations('content.list');
  const tContent = await getTranslations('content');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');
  const tCommon = await getTranslations('common');

  const categoryFilter = await getBlogCategoryFilter();
  const sortOptions = await getBlogSortOptions();

  const raw = await searchParams;
  const state = parseContentListState(raw, {
    limit: 9,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
    filterKey: 'category',
  });

  const showFeatured = state.page === 1 && !state.filter;

  let items: Blog[] = [];
  let pagination = normalizePagination(undefined, state.page, state.limit);
  let featured: Blog | null = null;

  try {
    const [listRes, featuredBlog] = await Promise.all([
      getBlogs(buildListQuery(state, 'category')),
      showFeatured ? fetchFeaturedBlog() : Promise.resolve(null),
    ]);
    items = listRes.data ?? [];
    pagination = normalizePagination(listRes.pagination, state.page, state.limit);
    featured = featuredBlog;
    if (featured) {
      const featuredSlug = featured.slug; // 局部常量：闭包内 TS 不保留 let 收窄
      items = items.filter((p) => p.slug !== featuredSlug);
    }
  } catch {
    /* empty */
  }

  const relatedLinks = t.raw('relatedLinks') as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      {featured ? (
        <section>
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('featuredSection.eyebrow')}
              title={t('featuredSection.title')}
            />
            <Link
              href={`/resources/blog/${featured.slug}`}
              className="group mt-10 grid grid-cols-1 overflow-hidden border border-neutral-300 bg-white transition-colors hover:border-neutral-900 lg:grid-cols-2"
            >
              <div className="rb-img-shimmer relative min-h-[240px] overflow-hidden bg-neutral-200">
                {/* 首屏 featured 大图是 LCP 候选：preload + eager 避免 LCP 告警与延迟加载 */}
                <Image
                  src={pickCoverImage(featured.coverImage, '/media/fixed-tower-hero.jpg')}
                  alt={featured.title}
                  fill
                  preload
                  loading="eager"
                  fetchPriority="high"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-5 top-5 bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  {blogCategoryLabel(featured.category)}
                </span>
              </div>
              <div className="flex flex-col justify-center p-8 lg:p-12">
                <h2 className="rb-h3 text-neutral-900 transition-colors group-hover:text-primary">
                  {featured.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-secondary-text">
                  {pickSummary(featured.excerpt)}
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm text-secondary-text">
                  <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                  {formatContentDate(featured.publishedAt)}
                  {featured.readTime ? ` · ${featured.readTime}` : null}
                </div>
              </div>
            </Link>
          </Container>
        </section>
      ) : null}

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t('listSection.eyebrow')} title={t('listSection.title')} />

          <div className="mt-8">
            <ContentListShell
              toolbar={{
                filters: [categoryFilter],
                sortOptions,
                // biome-ignore lint/style/noNonNullAssertion: getBlogSortOptions() 恒返回含默认排序的列表，defaultSort 必传
                defaultSort: sortOptions[0]!,
              }}
            >
              {items.length === 0 ? (
                <p className="mt-8 border border-dashed border-neutral-300 bg-white py-16 text-center text-sm text-secondary-text">
                  {tList('emptyBlog')}
                </p>
              ) : (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <Link
                      key={p.id}
                      href={`/resources/blog/${p.slug}`}
                      className="group flex h-full flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-200">
                        <Image
                          src={pickCoverImage(p.coverImage, '/media/fixed-tower-hero.jpg')}
                          alt={p.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <span className="text-xs font-bold uppercase tracking-wide text-primary">
                          {blogCategoryLabel(p.category)}
                        </span>
                        <h3 className="rb-h5 mt-2 text-neutral-900 transition-colors group-hover:text-primary">
                          {p.title}
                        </h3>
                        <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">
                          {pickSummary(p.excerpt)}
                        </p>
                        <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-secondary-text">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatContentDate(p.publishedAt)}
                            {p.readTime ? ` · ${p.readTime}` : null}
                          </span>
                          <ArrowRight className="h-4 w-4 text-primary transition-transform duration-300 group-hover:translate-x-1.5" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <ContentPaginationShell>
                <ContentPagination
                  pagination={pagination}
                  unit={tContent('pagination.units.articles')}
                />
              </ContentPaginationShell>
            </ContentListShell>
          </div>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinksWithImages(relatedLinks, RELATED_HREFS)}
      />

      <Container className="pt-4 lg:pt-8">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="text-secondary-text">{t('cta.description')}</p>
          <BookConsultButton message={tCommon('bookConsultContent')}>
            {tCta('bookConsult')}
          </BookConsultButton>
        </div>
      </Container>
    </div>
  );
}
