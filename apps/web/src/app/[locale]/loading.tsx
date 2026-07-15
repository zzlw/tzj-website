import { Loading } from '@tzj/ui';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui';

export default async function LoadingPage() {
  const t = await getTranslations('common');

  return (
    <Container>
      <Loading label={t('loading')} labelClassName="text-secondary-text" />
    </Container>
  );
}
