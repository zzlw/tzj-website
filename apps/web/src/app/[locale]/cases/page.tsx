import { ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ContentListShell, ContentPaginationShell } from '@/components/content/ContentListShell';
import { ContentPagination } from '@/components/content/ContentPagination';
import { MediaImage as Image } from '@/components/MediaImage';
import { RelatedLinks } from '@/components/sections/blocks';
import { StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero, RbButton } from '@/components/ui';
import { getCases } from '@/lib/api';
import { caseTypeLabel, formatContentDate } from '@/lib/content-labels';
import {
  buildListQuery,
  normalizePagination,
  parseContentListState,
  pickCoverImage,
  pickSummary,
} from '@/lib/content-list';
import { getCaseTypeFilter } from '@/lib/i18n/content-filters';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { getCaseSortOptions } from '@/lib/i18n/sort-options';

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.cases', path: '/cases' });
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CasesPage({ searchParams }: PageProps) {
  const t = await getTranslations('pages.cases');
  const tList = await getTranslations('content.list');
  const tContent = await getTranslations('content');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const caseTypeFilter = await getCaseTypeFilter();
  const caseSortOptions = await getCaseSortOptions();

  const raw = await searchParams;
  const state = parseContentListState(raw, {
    limit: 9,
    sortBy: 'completionDate',
    sortOrder: 'desc',
    filterKey: 'type',
  });

  let items: Awaited<ReturnType<typeof getCases>>['data'] = [];
  let pagination = normalizePagination(undefined, state.page, state.limit);

  try {
    const res = await getCases(buildListQuery(state, 'type'));
    items = res.data ?? [];
    pagination = normalizePagination(res.pagination, state.page, state.limit);
  } catch {
    /* empty list handled by UI */
  }

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <ContentListShell
            toolbar={{
              filters: [caseTypeFilter],
              sortOptions: caseSortOptions,
              defaultSort: caseSortOptions[0]!,
            }}
          >
            {items.length === 0 ? (
              <p className="mt-8 border border-dashed border-neutral-300 py-16 text-center text-sm text-secondary-text">
                {tList('emptyCases')}
              </p>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const summary = pickSummary(
                    (item as { summary?: string }).summary,
                    item.description,
                  );
                  const client = (item as { client?: string }).client ?? item.clientName ?? '';
                  return (
                    <Link
                      key={item.id}
                      href={`/cases/${item.slug}`}
                      className="group flex flex-col overflow-hidden border border-neutral-300 bg-white transition-colors duration-300 hover:border-neutral-900"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
                        <Image
                          src={pickCoverImage(item.coverImage)}
                          alt={item.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 rb-media-shade opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-accessible">
                            {caseTypeLabel(item.caseType)}
                          </span>
                          {item.location ? (
                            <span className="inline-flex items-center gap-1 text-xs text-secondary-text">
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              {item.location}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-2 font-display text-lg font-bold leading-snug text-neutral-900 transition-colors group-hover:text-primary">
                          {item.title}
                        </h2>
                        {summary ? (
                          <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-secondary-text">
                            {summary}
                          </p>
                        ) : null}
                        {client ? (
                          <p className="mt-2 text-xs text-secondary-text">
                            {tContent('labels.client')}
                            {client}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-secondary-text">
                          {formatContentDate(item.completionDate)}
                        </p>
                        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                          {tList('viewCase')}
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <ContentPaginationShell>
              <ContentPagination
                pagination={pagination}
                unit={tContent('pagination.units.cases')}
              />
            </ContentPaginationShell>
          </ContentListShell>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks('titleDefault')}
        learnMore={tBlocks('learnMore')}
        eyebrow={tBlocks('eyebrow')}
        links={(t.raw('relatedLinks') as Array<{ label: string; desc: string }>).map((l, i) => ({
          ...l,
          href: ['/fixed-tower', '/modular-tower', '/specialized-training'][i]!,
        }))}
      />

      <Container>
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t('cta.title')}</h2>
          <p className="text-secondary-text">{t('cta.description')}</p>
          <RbButton href="/contact">{tCta('bookConsult')}</RbButton>
        </div>
      </Container>
    </div>
  );
}
