import { ArrowRight, Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { FeatureGrid } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, Eyebrow, RbButton, RbLink, SectionHeading } from '@/components/ui';
import { getLocalizedSolution, getLocalizedSolutions } from '@/lib/i18n/solutions';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { generateSeo } from '@/lib/seo';
import { getAllSolutionSlugs } from '@/lib/solutions';

interface SolutionPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSolutionSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SolutionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = await getLocalizedSolution(slug);
  if (!solution) return {};

  const t = await getTranslations('pages.solutionDetail');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  return generateSeo({
    title: `${solution.name}${t('meta.titleSuffix')}`,
    description: solution.tagline,
    locale,
    path: `/solutions/${slug}`,
    image: solution.image,
    siteName: tCommon('brandName'),
  });
}

export default async function SolutionDetailPage({ params }: SolutionPageProps) {
  const { slug } = await params;
  const solution = await getLocalizedSolution(slug);
  if (!solution) notFound();

  const t = await getTranslations('pages.solutionDetail');
  const tCta = await getTranslations('cta');
  const tBread = await getTranslations('breadcrumbs');
  const others = (await getLocalizedSolutions()).filter((s) => s.slug !== solution.slug);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: tBread('solutions'), path: '/solutions' },
            { name: solution.name, path: `/solutions/${slug}` },
          ]),
        ]}
      />

      <div className="pb-20">
        <section className="relative h-[420px] overflow-hidden bg-neutral-900 lg:h-[500px]">
          <Image
            src={solution.image}
            alt={solution.name}
            fill
            preload
            loading="eager"
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 rb-media-shade-strong" />
          <Container className="rb-on-media relative z-10 flex h-full flex-col justify-end pb-12 pt-24">
            <Eyebrow inverted>
              {t('hero.eyebrowPrefix')}
              {solution.name}
            </Eyebrow>
            <h1 className="rb-h1 mt-4 max-w-3xl text-white">
              {solution.name}
              {t('meta.titleSuffix')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
              {solution.tagline}
            </p>
          </Container>
        </section>

        <section>
          <Container className="py-16 lg:py-24">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
              <SectionHeading
                eyebrow={t('intro.eyebrow')}
                title={`${solution.name}${t('intro.titleSuffix')}`}
              />
              <div className="flex flex-col justify-center gap-4 border-l-2 border-primary pl-6">
                {solution.intro.map((p, i) => (
                  <p
                    key={i}
                    className={
                      i === 0 ? 'text-lg leading-relaxed text-neutral-900' : 'text-secondary-text'
                    }
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <section className="bg-neutral-100">
          <Container className="py-16 lg:py-24">
            <SectionHeading eyebrow={t('focus.eyebrow')} title={t('focus.title')} />
            <div className="mt-10">
              <FeatureGrid items={solution.focus} columns={4} />
            </div>
          </Container>
        </section>

        <section>
          <Container className="py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('recommended.eyebrow')}
              title={t('recommended.title')}
              description={t('recommended.description')}
            />
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {solution.recommended.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="group flex items-start justify-between gap-4 border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
                >
                  <div>
                    <h3 className="rb-h5 text-neutral-900 transition-colors group-hover:text-primary">
                      {r.label}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-secondary-text">{r.desc}</p>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-1.5" />
                </Link>
              ))}
            </div>
          </Container>
        </section>

        <section className="bg-neutral-100">
          <Container className="py-16 lg:py-24">
            <SectionHeading eyebrow={t('programs.eyebrow')} title={t('programs.title')} />
            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {solution.programs.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 border border-neutral-300 bg-white p-5"
                >
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm leading-relaxed text-neutral-900">{p}</span>
                </li>
              ))}
            </ul>
            {solution.caseHref ? (
              <div className="mt-8">
                <RbLink href={solution.caseHref}>{t('programs.caseLink')}</RbLink>
              </div>
            ) : null}
          </Container>
        </section>

        <StatBandI18n />

        <ProcessBandI18n />

        <section>
          <Container className="py-16 lg:py-24">
            <h2 className="rb-h3 mb-10 text-neutral-900">{t('others.title')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.slug}
                    href={`/solutions/${s.slug}`}
                    className="group flex items-center gap-4 border border-neutral-300 bg-white p-5 transition-colors hover:border-neutral-900"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </span>
                    <span className="font-display text-base font-bold text-neutral-900 transition-colors group-hover:text-primary">
                      {s.name}
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 text-primary transition-transform duration-300 group-hover:translate-x-1.5" />
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>

        <Container>
          <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
            <h2 className="rb-h3 text-neutral-900">
              {t('cta.titlePrefix')}
              {solution.name}
              {t('cta.titleSuffix')}
            </h2>
            <p className="max-w-xl text-secondary-text">{t('cta.description')}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <RbButton href="/contact">{tCta('bookConsult')}</RbButton>
              <RbLink href="/solutions">{t('cta.backLink')}</RbLink>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
