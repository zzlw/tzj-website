import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MediaImage as Image } from '@/components/MediaImage';
import { CtaBand } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, PageHero } from '@/components/ui';
import { createPageMetadata } from '@/lib/i18n/metadata';

const PROGRAM_IMAGES = [
  '/media/maritime-astoria.jpg',
  '/media/tactical.jpg',
  '/media/hazmat-trailer.webp',
] as const;

export async function generateMetadata() {
  return createPageMetadata({
    namespace: 'pages.specializedTraining',
    path: '/specialized-training',
  });
}

export default async function SpecializedTrainingPage() {
  const t = await getTranslations('pages.specializedTraining');
  const tCta = await getTranslations('cta');
  const tBlocks = await getTranslations('blocks.relatedLinks');

  const programs = t.raw('programs') as Array<{ title: string; href: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {programs.map((p, i) => (
              <Link
                key={p.href}
                href={p.href}
                className="group flex flex-col overflow-hidden border border-neutral-300 bg-white transition-colors duration-300 hover:border-neutral-900"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
                  <Image
                    src={PROGRAM_IMAGES[i]!}
                    alt={p.title}
                    fill
                    quality={70}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 rb-media-shade opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="rb-h4 text-neutral-900 transition-colors group-hover:text-primary">
                    {p.title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-secondary-text">
                    {p.desc}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                    {tBlocks('learnMore')}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </span>
                </div>
              </Link>
            ))}
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
  );
}
