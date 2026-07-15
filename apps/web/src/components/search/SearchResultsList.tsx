import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SearchResult } from '@/lib/search/types';

export async function SearchResultsList({ results }: { results: SearchResult[] }) {
  const t = await getTranslations('search');

  return (
    <ul className="divide-y divide-neutral-200">
      {results.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="group flex items-center gap-5 py-8 transition-colors md:gap-8 md:py-10"
          >
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center bg-neutral-900 md:h-16 md:w-16"
              aria-hidden="true"
            >
              <span className="font-display text-lg font-extrabold tracking-tight text-neutral-400 md:text-xl">
                TZ
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold leading-snug text-neutral-900 transition-colors group-hover:text-primary md:text-xl">
                {item.title}
              </h2>
              {item.excerpt ? (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-secondary-text md:text-base group-hover:text-primary">
                  {item.excerpt}
                </p>
              ) : null}
            </div>

            <span className="mt-1 flex shrink-0 items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center bg-primary transition-colors group-hover:bg-primary-hover">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white">
                  <ArrowRight
                    className="h-3 w-3 text-white transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </span>
              </span>
              <span className="hidden text-sm font-bold text-neutral-900 sm:inline group-hover:text-primary">
                {t('moreDetails')}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
