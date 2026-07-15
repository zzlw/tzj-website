import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';
import { getLocalizedSolutions } from '@/lib/i18n/solutions';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export async function generateMetadata() {
  return createPageMetadata({ namespace: 'pages.solutions', path: '/solutions' });
}

export default async function SolutionsPage() {
  const t = await getTranslations('pages.solutions');
  const tCta = await getTranslations('cta');
  const tBread = await getTranslations('breadcrumbs');
  const solutions = await getLocalizedSolutions();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('breadcrumb.current'), path: '/solutions' },
          ]),
        ]}
      />

      <div className="pb-20">
        <PageHero
          eyebrow={t('hero.eyebrow')}
          title={t('hero.title')}
          description={t('hero.description')}
        />

        <section>
          <Container className="py-16 lg:py-24">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {solutions.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.slug}
                    href={`/solutions/${s.slug}`}
                    className="group flex flex-col overflow-hidden border border-neutral-300 bg-white transition-colors duration-300 hover:border-neutral-900"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
                      <Image
                        src={s.image}
                        alt={s.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 rb-media-shade" />
                      <div className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center bg-primary">
                        <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                      </div>
                      <h2 className="absolute bottom-4 left-5 right-5 font-display text-xl font-bold text-white">
                        {s.name}
                      </h2>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <p className="flex-1 text-sm leading-relaxed text-secondary-text">
                        {s.tagline}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                        {t('viewSolution')}
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>

        <StatBandI18n />

        <ProcessBandI18n />

        <CtaBand
          title={t('cta.title')}
          description={t('cta.description')}
          primaryLabel={tCta('bookConsult')}
        />
      </div>
    </>
  );
}
