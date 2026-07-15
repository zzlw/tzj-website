import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Container, RbButton, SectionHeading } from '@/components/ui';
import { getLocalizedSolutions } from '@/lib/i18n/solutions';

export async function SolutionsSection() {
  const t = await getTranslations('home.solutions');
  const solutions = await getLocalizedSolutions();

  return (
    <section className="bg-neutral-100 py-20 lg:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow={t('eyebrow')}
            title={t('title')}
            description={t('description')}
          />
          <div className="shrink-0">
            <RbButton href="/solutions">{t('viewAll')}</RbButton>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.slug}
                href={`/solutions/${s.slug}`}
                className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors duration-300 hover:border-neutral-900 lg:p-8"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center bg-primary/10 transition-colors group-hover:bg-primary">
                  <Icon
                    className="h-6 w-6 text-primary transition-colors group-hover:text-white"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="rb-h5 text-neutral-900 transition-colors group-hover:text-primary">
                  {s.name}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">
                  {s.tagline}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                  {t('viewSolution')}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
