import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SearchPageHero } from '@/components/search/SearchPageHero';
import { SearchPagination } from '@/components/search/SearchPagination';
import { SearchResultsList } from '@/components/search/SearchResultsList';
import { SearchZeroResultsTracker } from '@/components/search/SearchZeroResultsTracker';
import { Container } from '@/components/ui';
import { type AppLocale, routing } from '@/i18n/routing';
import { runSiteSearch } from '@/lib/search/run-search';
import { generateSeo } from '@/lib/seo';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function spString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const raw = await searchParams;
  const q = spString(raw.q).trim();
  const t = await getTranslations('search');
  const tCommon = await getTranslations('common');

  const title = q ? t('meta.titleWithQuery', { query: q }) : t('meta.title');

  return generateSeo({
    title,
    description: t('meta.description'),
    path: q ? `/search?q=${encodeURIComponent(q)}` : '/search',
    siteName: tCommon('brandName'),
  });
}

export default async function SearchPage({ params, searchParams }: PageProps) {
  const { locale: localeParam } = await params;
  const locale = routing.locales.includes(localeParam as AppLocale)
    ? (localeParam as AppLocale)
    : routing.defaultLocale;

  const raw = await searchParams;
  const q = spString(raw.q).trim();
  const page = Math.max(1, Number(spString(raw.page)) || 1);
  const limit = Math.min(48, Math.max(1, Number(spString(raw.limit)) || 12));

  const t = await getTranslations('search');

  const data =
    q.length >= 2
      ? await runSiteSearch(q, locale, { page, limit })
      : {
          query: q,
          results: [],
          pagination: { page: 1, pageSize: limit, total: 0, totalPages: 1 },
        };

  return (
    <div className="bg-white pb-20">
      <SearchPageHero query={q} title={t('resultsTitle')} />

      <Container className="max-w-4xl py-6 md:py-8">
        {q.length < 2 ? (
          <p className="border-t border-neutral-200 pt-8 text-center text-sm text-secondary-text">
            {t('noQuery')}
          </p>
        ) : (
          <>
            <p className="border-t border-neutral-200 pt-8 text-base text-neutral-900">
              {t('resultsSummary', { count: data.pagination.total, query: q })}
            </p>

            {data.results.length === 0 ? (
              <>
                <SearchZeroResultsTracker query={q} />
                <p className="border-t border-neutral-200 py-16 text-center text-sm text-secondary-text">
                  {t('empty')}
                </p>
              </>
            ) : (
              <>
                <SearchResultsList results={data.results} />
                <div className="mt-4 border-t border-neutral-200 pt-8">
                  <SearchPagination pagination={data.pagination} unit={t('paginationUnit')} />
                </div>
              </>
            )}
          </>
        )}
      </Container>
    </div>
  );
}
