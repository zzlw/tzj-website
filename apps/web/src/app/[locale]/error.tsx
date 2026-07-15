'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Container, RbButton } from '@/components/ui';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="rb-h2 text-neutral-900">{t('title')}</h1>
      <p className="mt-3 max-w-md text-secondary-text">{t('description')}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <RbButton onClick={reset}>{t('retry')}</RbButton>
        <RbButton href="/" variant="secondary">
          {t('backHome')}
        </RbButton>
      </div>
    </Container>
  );
}
