'use client';

import { Loading } from '@tzj/ui';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/ui';

/**
 * 加载态取客户端文案：loading.tsx 拿不到 params，无法调 setRequestLocale，
 * 走 next-intl/server 会回退读请求头，把所在路由整条打成动态渲染。
 */
export default function LoadingPage() {
  const t = useTranslations('common');

  return (
    <Container>
      <Loading label={t('loading')} labelClassName="text-secondary-text" />
    </Container>
  );
}
