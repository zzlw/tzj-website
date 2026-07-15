'use client';

import { Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useLanguageSelector } from '@/components/i18n/LanguageSelector';
import type { AppLocale } from '@/i18n/routing';
import { LOCALE_REGION_LABEL } from '@/lib/locale-config';

export function FooterLanguageTrigger() {
  const locale = useLocale() as AppLocale;
  const tHeader = useTranslations('header');
  const { open } = useLanguageSelector();

  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center gap-1.5 transition-colors hover:text-primary"
      aria-label={tHeader('languageSwitch')}
    >
      <Globe className="h-4 w-4 text-neutral-500" aria-hidden="true" />
      {LOCALE_REGION_LABEL[locale]}
    </button>
  );
}
