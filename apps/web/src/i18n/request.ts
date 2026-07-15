import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { loadMessages } from '@/lib/i18n/load-messages';
import { type AppLocale, routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as AppLocale)) {
    locale = routing.defaultLocale;
  }

  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') ?? '/';

  return {
    locale,
    messages: await loadMessages(locale as AppLocale, pathname),
  };
});
