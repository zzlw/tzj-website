import { isUsableExternalUrl } from '@tzj/utils';
import { CalendarDays, Eye, Handshake, MapPin, MessagesSquare } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ContentListShell, ContentPaginationShell } from '@/components/content/ContentListShell';
import { ContentPagination } from '@/components/content/ContentPagination';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand, FeatureGrid, RelatedLinks } from '@/components/sections/blocks';
import { StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, SectionHeading } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { getTradeShows } from '@/lib/api';
import { formatContentDateRange, tradeShowTypeLabel } from '@/lib/content-labels';
import {
  buildListQuery,
  normalizePagination,
  parseContentListState,
  pickCoverImage,
  pickSummary,
} from '@/lib/content-list';
import { getTradeShowTypeFilter } from '@/lib/i18n/content-filters';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { getTradeShowSortOptions } from '@/lib/i18n/sort-options';
import { relatedLinksWithImages } from '@/lib/product-line-page';

const FEATURE_ICONS = [Eye, MessagesSquare, Handshake] as const;
const RELATED_HREFS = ['/cases', '/resources/news', '/resources/design-center'];

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.resourcesTradeShows',
    path: '/resources/trade-shows',
  });
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TradeShowsPage({ searchParams }: PageProps) {
  const t = await getTranslations('pages.resourcesTradeShows');
  const tList = await getTranslations('content.list');
  const tContent = await getTranslations('content');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const typeFilter = await getTradeShowTypeFilter();
  const sortOptions = await getTradeShowSortOptions();

  const raw = await searchParams;
  const state = parseContentListState(raw, {
    limit: 8,
    sortBy: 'startDate',
    sortOrder: 'desc',
    filterKey: 'eventType',
  });

  let items: Awaited<ReturnType<typeof getTradeShows>>['data'] = [];
  let pagination = normalizePagination(undefined, state.page, state.limit);

  try {
    const res = await getTradeShows(buildListQuery(state, 'eventType'));
    items = res.data ?? [];
    pagination = normalizePagination(res.pagination, state.page, state.limit);
  } catch {
    /* empty */
  }

  const featuresRaw = t.raw('features') as Array<{ title: string; desc: string }>;
  const features = featuresRaw.map((item, i) => ({ ...item, icon: FEATURE_ICONS[i]! }));
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
                filters: [typeFilter],
                sortOptions,
                defaultSort: sortOptions[0]!,
              }}
            >
              {items.length === 0 ? (
                <p className="mt-8 border border-dashed border-neutral-300 py-16 text-center text-sm text-secondary-text">
                  {tList('emptyTradeShows')}
                </p>
              ) : (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {items.map((e) => {
                    const cardInner = (
                      <>
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-200">
                          <Image
                            src={pickCoverImage(e.coverImage)}
                            alt={e.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>
                        <div className="flex flex-1 flex-col p-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-primary">
                              {tradeShowTypeLabel(e.eventType)}
                            </span>
                            {e.isFeatured ? (
                              <span className="bg-neutral-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                {tContent('labels.featured')}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="rb-h5 mt-2 text-neutral-900">{e.title}</h3>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-secondary-text">
                            {e.location ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-primary" aria-hidden />
                                {e.location}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                              {e.eventDateLabel || formatContentDateRange(e.startDate, e.endDate)}
                            </span>
                          </div>
                          {e.boothNumber ? (
                            <p className="mt-2 text-xs font-medium text-neutral-900">
                              {tContent('labels.booth')}
                              {e.boothNumber}
                            </p>
                          ) : null}
                          <p className="mt-3 text-sm leading-relaxed text-secondary-text">
                            {pickSummary(e.summary)}
                          </p>
                        </div>
                      </>
                    );

                    if (isUsableExternalUrl(e.externalUrl)) {
                      return (
                        <a
                          key={e.id}
                          href={e.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex h-full flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
                        >
                          {cardInner}
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={e.id}
                        href={`/resources/trade-shows/${e.slug}`}
                        className="group flex h-full flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
                      >
                        {cardInner}
                      </Link>
                    );
                  })}
                </div>
              )}

              <ContentPaginationShell>
                <ContentPagination
                  pagination={pagination}
                  unit={tContent('pagination.units.events')}
                  pageSizeOptions={[8, 12, 24]}
                />
              </ContentPaginationShell>
            </ContentListShell>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t('whyVisitSection.eyebrow')}
            title={t('whyVisitSection.title')}
          />
          <div className="mt-10">
            <FeatureGrid items={features} columns={3} />
          </div>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={relatedLinksWithImages(relatedLinks, RELATED_HREFS)}
      />

      <CtaBand title={t('cta.title')} primaryLabel={tCta('bookConsult')} />
    </div>
  );
}
