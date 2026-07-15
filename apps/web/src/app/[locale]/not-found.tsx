import { getTranslations } from 'next-intl/server';
import { Container, RbButton } from '@/components/ui';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-8xl font-extrabold text-neutral-300">404</p>
      <h1 className="rb-h2 mt-4 text-neutral-900">{t('title')}</h1>
      <p className="mt-3 max-w-md text-secondary-text">{t('description')}</p>
      <div className="mt-8">
        <RbButton href="/">{t('backHome')}</RbButton>
      </div>
      <Link href="/contact" className="mt-4 text-sm text-primary hover:underline">
        {t('contactHelp')}
      </Link>
    </Container>
  );
}
