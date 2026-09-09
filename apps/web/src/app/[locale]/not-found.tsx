'use client';

import { useTranslations } from 'next-intl';
import { Container, RbButton } from '@/components/ui';
import { Link } from '@/i18n/navigation';

/**
 * 404 取客户端文案：not-found.tsx 拿不到 params，无法调 setRequestLocale，
 * 走 next-intl/server 会回退读请求头，把所在路由整条打成动态渲染。
 */
export default function NotFound() {
  const t = useTranslations('notFound');

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
