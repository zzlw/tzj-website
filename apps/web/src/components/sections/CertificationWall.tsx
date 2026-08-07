import { getTranslations } from 'next-intl/server';
import { CertificationWallCards } from '@/components/sections/CertificationWallCards';
import { Container, RbLink, SectionHeading } from '@/components/ui';

const CERT_KEYS = ['iso9001', 'iso14001', 'iso45001', 'aftersales'] as const;
const CERT_IMAGES: Record<(typeof CERT_KEYS)[number], string> = {
  iso9001: '/media/cert-iso9001.webp',
  iso14001: '/media/cert-iso14001.webp',
  iso45001: '/media/cert-iso45001.webp',
  aftersales: '/media/cert-after-sales-5star.webp',
};

const CLIENT_KEYS = [
  'fire',
  'police',
  'mine',
  'university',
  'tourism',
  'military',
  'petrochemical',
  'maritime',
] as const;

export async function CertificationWall() {
  const t = await getTranslations('blocks.certification');

  const certs = CERT_KEYS.map((key) => ({
    key,
    image: CERT_IMAGES[key],
    title: t(`items.${key}.title`),
    subtitle: t(`items.${key}.subtitle`),
  }));

  return (
    <section className="bg-neutral-100 py-16 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          align="center"
        />

        <CertificationWallCards
          certs={certs}
          detailHref="/why-us/certification"
          viewLargeLabel={t('viewLarge')}
        />

        <div className="mt-10 text-center">
          <RbLink href="/why-us/certification">{t('viewCerts')}</RbLink>
        </div>

        <div className="mt-12 border-t border-neutral-300 pt-10">
          <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.18em] text-secondary-text">
            {t('clientsHeading')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {CLIENT_KEYS.map((key) => (
              <span
                key={key}
                className="border border-neutral-300 bg-white px-4 py-2 font-display text-sm font-bold text-neutral-700"
              >
                {t(`clients.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
