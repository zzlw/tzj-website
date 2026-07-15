import { NextResponse } from 'next/server';
import { type AppLocale, routing } from '@/i18n/routing';
import { runSearchSuggestions } from '@/lib/search/run-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const localeParam = searchParams.get('locale') ?? routing.defaultLocale;
  const locale = routing.locales.includes(localeParam as AppLocale)
    ? (localeParam as AppLocale)
    : routing.defaultLocale;

  const suggestions = await runSearchSuggestions(q, locale);
  return NextResponse.json(
    { query: q.trim(), suggestions },
    {
      headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
    },
  );
}
