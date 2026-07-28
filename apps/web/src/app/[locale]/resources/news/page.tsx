import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ContentListShell, ContentPaginationShell } from '@/components/content/ContentListShell';
import { ContentPagination } from '@/components/content/ContentPagination';
import { RelatedLinks } from '@/components/sections/blocks';
import { StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, RbButton, SectionHeading } from '@/components/ui';
import { getNewsList } from '@/lib/api';
import { formatContentDate, newsCategoryLabel } from '@/lib/content-labels';
import {
  buildListQuery,
  normalizePagination,
  parseContentListState,
  pickSummary,
} from '@/lib/content-list';
import { getNewsCategoryFilter } from '@/lib/i18n/content-filters';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { getNewsSortOptions } from '@/lib/i18n/sort-options';

const RELATED_HREFS = ['/cases', '/resources/blog', '/resources/trade-shows'];

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.resourcesNews', path: '/resources/news' });
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewsPage({ searchParams }: PageProps) {
  const t = await getTranslations('pages.resourcesNews');
  const tList = await getTranslations('content.list');
  const tContent = await getTranslations('content');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const categoryFilter = await getNewsCategoryFilter();
  const sortOptions = await getNewsSortOptions();

  const raw = await searchParams;
  const state = parseContentListState(raw, {
    limit: 10,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
    filterKey: 'category',
  });

  let items: Awaited<ReturnType<typeof getNewsList>>['data'] = [];
  let pagination = normalizePagination(undefined, state.page, state.limit);

  try {
    const res = await getNewsList(buildListQuery(state, 'category'));
    items = res.data ?? [];
    pagination = normalizePagination(res.pagination, state.page, state.limit);
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

      <section>
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
                <p className="mt-8 border border-dashed border-neutral-300 py-16 text-center text-sm text-secondary-text">
                  {tList('emptyNews')}
                </p>
              ) : (
                <div className="rb-content-list mt-8">
                  {items.map((n) => (
                    <Link
                      key={n.id}
                      href={`/resources/news/${n.slug}`}
                      className="rb-content-list-row group"
                    >
                      <div className="max-w-3xl">
                        <span className="text-xs font-bold uppercase tracking-wide text-primary">
                          {newsCategoryLabel(n.category)}
                        </span>
                        <h3 className="rb-h5 mt-2 text-neutral-900 transition-colors group-hover:text-primary">
                          {n.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-secondary-text">
                          {pickSummary(n.summary)}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-3 text-sm text-secondary-text">
                        {formatContentDate(n.publishedAt)}
                        <ArrowRight className="h-4 w-4 text-primary transition-transform duration-300 group-hover:translate-x-1.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              <ContentPaginationShell>
                <ContentPagination
                  pagination={pagination}
                  unit={tContent('pagination.units.articles')}
                  pageSizeOptions={[10, 20, 50]}
                />
              </ContentPaginationShell>
            </ContentListShell>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <Container className="pt-4 lg:pt-8">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <RbButton href="/contact">{tCta('bookConsult')}</RbButton>
        </div>
      </Container>
    </div>
  );
}
