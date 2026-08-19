import { ArrowRight, Check } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { FeatureGrid } from '@/components/sections/blocks';
import { ProcessBandI18n, StatBandI18n } from '@/components/sections/blocks-i18n';
import { Container, Eyebrow, RbLink, SectionHeading } from '@/components/ui';
import { Link as I18nLink } from '@/i18n/navigation';
import { getCases } from '@/lib/api';
import { getLocalizedSolution, getLocalizedSolutions } from '@/lib/i18n/solutions';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { generateSeo } from '@/lib/seo';
import { getAllSolutionSlugs, type SolutionCaseType } from '@/lib/solutions';

interface SolutionPageProps {
  params: Promise<{ slug: string }>;
}

interface SolutionCaseCard {
  slug: string;
  title: string;
  location: string;
  summary: string;
  image: string;
}

/** 按案例分类拉取已发布案例（内嵌真实案例卡）；接口异常时降级为空。 */
async function fetchSolutionCases(
  caseType: SolutionCaseType,
  limit = 3,
): Promise<SolutionCaseCard[]> {
  try {
    const res = await getCases({
      type: caseType,
      limit,
      sortBy: 'completionDate',
      sortOrder: 'desc',
    });
    return (res.data ?? [])
      .filter((c) => c.coverImage)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        location: c.location ?? '',
        // API 列表含 summary；共享 Case 类型尚未收录该字段
        summary: ((c as unknown as { summary?: string }).summary ?? c.description) || '',
        image: c.coverImage,
      }));
  } catch {
    return [];
  }
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
    image: solution.ogImage,
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
  const tCommon = await getTranslations('common');
  const others = (await getLocalizedSolutions()).filter((s) => s.slug !== solution.slug);
  const featuredCases = await (solution.caseType
    ? fetchSolutionCases(solution.caseType)
    : Promise.resolve([]));

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
        <section className="relative h-[420px] overflow-hidden bg-neutral-800 lg:h-[500px]">
          <Image
            src={solution.heroImage}
            alt={solution.name}
            fill
            preload
            loading="eager"
            fetchPriority="high"
            quality={90}
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
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {solution.detailImages.map((src, i) => (
                <div
                  key={src}
                  className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200"
                >
                  <Image
                    src={src}
                    alt={solution.sceneImageAlts[i] ?? solution.name}
                    fill
                    quality={75}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ))}
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
                <I18nLink
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
                </I18nLink>
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

        {featuredCases.length > 0 ? (
          <section>
            <Container className="py-16 lg:py-24">
              <SectionHeading
                eyebrow={t('cases.eyebrow')}
                title={t('cases.title')}
                description={t('cases.description')}
              />
              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                {featuredCases.map((item) => (
                  <I18nLink
                    key={item.slug}
                    href={`/cases/${item.slug}`}
                    className="group flex flex-col border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
                  >
                    <div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                    <div className="p-5">
                      {item.location ? (
                        <p className="text-xs font-bold tracking-wide text-primary">
                          {item.location}
                        </p>
                      ) : null}
                      <h3 className="rb-h5 mt-2 text-neutral-900">{item.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-secondary-text">
                        {item.summary}
                      </p>
                    </div>
                  </I18nLink>
                ))}
              </div>
              {solution.caseHref ? (
                <div className="mt-8">
                  <RbLink href={solution.caseHref}>{t('cases.linkText')}</RbLink>
                </div>
              ) : null}
            </Container>
          </section>
        ) : null}

        <StatBandI18n />

        <ProcessBandI18n />

        <section>
          <Container className="py-16 lg:py-24">
            <h2 className="rb-h3 mb-10 text-neutral-900">{t('others.title')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((s) => {
                const Icon = s.icon;
                return (
                  <I18nLink
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
                  </I18nLink>
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
            {/* CTA 仅保留单一「预约咨询」按钮（拨号/询盘入口已全局移除） */}
            <BookConsultButton message={tCommon('bookConsultSolution')}>
              {tCta('bookConsult')}
            </BookConsultButton>
            <div className="mt-4">
              <RbLink href="/solutions">{t('cta.backLink')}</RbLink>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
