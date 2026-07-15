import { NextResponse } from 'next/server';
import { type AppLocale, routing } from '@/i18n/routing';
import { runSiteSearch } from '@/lib/search/run-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const localeParam = searchParams.get('locale') ?? routing.defaultLocale;
  const locale = routing.locales.includes(localeParam as AppLocale)
    ? (localeParam as AppLocale)
    : routing.defaultLocale;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(48, Math.max(1, Number(searchParams.get('limit')) || 12));

  const data = await runSiteSearch(q, locale, { page, limit });
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
