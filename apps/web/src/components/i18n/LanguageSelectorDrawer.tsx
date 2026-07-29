'use client';

import { ScrollArea } from '@tzj/ui';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { LANGUAGE_MARKETS, type LanguageMarket, type LanguageOption } from '@/lib/locale-config';
import { cn } from '@/lib/utils';

interface LanguageSelectorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Rosenbauer 风格语言抽屉 — 自右向左滑出，左上角切角 */
export function LanguageSelectorDrawer({ open, onOpenChange }: LanguageSelectorDrawerProps) {
  const t = useTranslations('language');
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  function selectLanguage(nextLocale: AppLocale) {
    if (nextLocale === locale) {
      onOpenChange(false);
      return;
    }

    /**
     * 直接调用 router.replace，让 next-intl 内部处理语言切换。
     * routing.ts 中已配置 localePrefix: "always"，所有语言都有 URL 前缀，
     * 无需依赖 cookie 持久化语言偏好，彻底避免 cookie 作用域问题。
     */
    router.replace(pathname, { locale: nextLocale });
    onOpenChange(false);
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[70] bg-neutral-900/30 backdrop-blur-md transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-selector-title"
        inert={!open || undefined}
        className={cn(
          'fixed inset-y-0 right-0 z-[71] flex w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(.75,0,.35,1)]',
          'lg:inset-y-5 lg:right-5 lg:w-[36rem] lg:max-w-none',
          '[clip-path:polygon(2.75rem_0,100%_0,100%_100%,0_100%,0_2.75rem)]',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-[120%]',
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rb-control-icon absolute right-4 top-4 z-20 lg:right-6 lg:top-6"
          aria-label={t('close')}
        >
          <span className="rb-control-icon__icon">
            <X className="h-4 w-4" strokeWidth={2.25} />
          </span>
        </button>

        <ScrollArea className="min-h-0 flex-1 px-6 pb-10 pt-16 sm:px-10 sm:pt-20 lg:px-12 lg:pt-24">
          <h2
            id="language-selector-title"
            className="font-display text-2xl font-extrabold text-neutral-900 sm:text-3xl"
          >
            {t('title')}
          </h2>

          <div className="mt-10 grid gap-10 lg:grid-cols-1 lg:gap-12">
            {LANGUAGE_MARKETS.map((market) => (
              <LanguageMarketSection
                key={market.id}
                market={market}
                activeLocale={locale}
                marketLabel={t(`markets.${market.nameKey}`)}
                optionLabel={(loc) => t(`options.${loc}`)}
                onSelect={selectLanguage}
              />
            ))}
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}

function LocaleFlag({ country }: { country: string }) {
  return (
    <span
      className="relative inline-flex h-[1.125rem] w-7 shrink-0 overflow-hidden rounded-[2px] border border-neutral-200 bg-neutral-100 shadow-sm"
      aria-hidden="true"
    >
      {/* 豁免 next/image：三方 flagcdn 小图标（已带 srcSet/尺寸/lazy），不值得过代理优化 */}
      <img
        src={`https://flagcdn.com/w40/${country}.png`}
        srcSet={`https://flagcdn.com/w80/${country}.png 2x`}
        alt=""
        width={28}
        height={18}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </span>
  );
}

function LanguageMarketSection({
  market,
  marketLabel,
  activeLocale,
  optionLabel,
  onSelect,
}: {
  market: LanguageMarket;
  marketLabel: string;
  activeLocale: AppLocale;
  optionLabel: (locale: AppLocale) => string;
  onSelect: (locale: AppLocale) => void;
}) {
  return (
    <section aria-labelledby={`market-${market.id}`}>
      <h3
        id={`market-${market.id}`}
        className="mb-2 font-display text-lg font-extrabold text-neutral-900 sm:text-xl"
      >
        {marketLabel}
      </h3>
      <ul className="divide-y divide-neutral-200">
        {market.options.map((option) => (
          <LanguageOptionRow
            key={option.locale}
            option={option}
            marketLabel={marketLabel}
            optionName={optionLabel(option.locale)}
            active={option.locale === activeLocale}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}

function LanguageOptionRow({
  option,
  marketLabel,
  optionName,
  active,
  onSelect,
}: {
  option: LanguageOption;
  marketLabel: string;
  optionName: string;
  active: boolean;
  onSelect: (locale: AppLocale) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(option.locale)}
        aria-current={active ? 'true' : undefined}
        aria-label={`${marketLabel} · ${optionName} (${option.code})`}
        className={cn(
          'group flex w-full min-h-[3.25rem] items-center justify-between gap-4 py-4 text-left transition-colors',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <LocaleFlag country={option.flagCountry} />
          <span
            className={cn(
              'truncate text-base font-medium text-neutral-800 sm:text-base group-hover:text-primary',
              active ? 'text-primary' : 'text-neutral-900',
            )}
          >
            {marketLabel}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 font-display text-base font-bold uppercase tracking-wide group-hover:text-primary',
            active ? 'text-primary' : 'text-neutral-900',
          )}
        >
          {option.code}
        </span>
      </button>
    </li>
  );
}
