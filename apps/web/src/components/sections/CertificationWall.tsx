import { Award, BadgeCheck, FileCheck, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Container, SectionHeading } from '@/components/ui';

const CERT_KEYS = ['iso9001', 'hitech', 'patents', 'safety'] as const;
const CERT_ICONS = [ShieldCheck, Award, FileCheck, BadgeCheck] as const;

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
  const t = await getTranslations('home.certification');

  return (
    <section className="bg-neutral-100 py-16 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          align="center"
        />

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {CERT_KEYS.map((key, i) => {
            const Icon = CERT_ICONS[i]!;
            return (
              <div
                key={key}
                className="flex flex-col items-center border border-neutral-300 bg-white p-6 text-center"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center bg-primary/10">
                  <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-display text-sm font-bold text-neutral-900">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="mt-1 text-xs text-secondary-text">{t(`items.${key}.subtitle`)}</p>
              </div>
            );
          })}
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
