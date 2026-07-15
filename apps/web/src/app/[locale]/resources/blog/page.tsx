import type { Blog } from '@tzj/types';
import { ArrowRight, Clock } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ContentListShell, ContentPaginationShell } from '@/components/content/ContentListShell';
import { ContentPagination } from '@/components/content/ContentPagination';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { Container, PageHero, RbButton, SectionHeading } from '@/components/ui';
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

const RELATED_HREFS = ['/resources/faqs', '/cases', '/resources/design-center'];

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
      items = items.filter((p) => p.slug !== featured!.slug);
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
              <div className="relative min-h-[240px] overflow-hidden bg-neutral-900">
                <Image
                  src={pickCoverImage(featured.coverImage, '/media/tower-wylie.jpg')}
                  alt={featured.title}
                  fill
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
                      className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
                    >
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
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <Container className="pt-4 lg:pt-8">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="text-secondary-text">{t('cta.description')}</p>
          <RbButton href="/contact">{tCta('bookConsult')}</RbButton>
        </div>
      </Container>
    </div>
  );
}
