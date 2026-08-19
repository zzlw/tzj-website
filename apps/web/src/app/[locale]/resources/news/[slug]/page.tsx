import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { BookConsultLink } from '@/components/chat/BookConsultLink';
import { MarkdownBody } from '@/components/content/MarkdownBody';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { Container, Eyebrow, RbLink } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { getNewsItem, getNewsList } from '@/lib/api';
import { fetchBySlug, previewParams } from '@/lib/content-detail';
import { formatContentDate, newsCategoryLabelI18n } from '@/lib/content-labels';
import { pickCoverImage, pickSummary } from '@/lib/content-list';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { generateSeo } from '@/lib/seo';

interface NewsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ previewToken?: string }>;
}

export async function generateMetadata({ params, searchParams }: NewsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { previewToken } = await searchParams;
  const item = await fetchBySlug((s) => getNewsItem(s, previewParams(previewToken)), slug);
  if (!item) return {};

  const locale = await getLocale();
  const summary = pickSummary(item.summary, item.content);

  const seo = generateSeo({
    title: (item as { seoTitle?: string }).seoTitle || item.title,
    description: (item as { seoDesc?: string }).seoDesc || summary,
    locale,
    path: `/resources/news/${slug}`,
    image: pickCoverImage(item.coverImage),
    type: 'article',
  });
  // 草稿预览链接不应被搜索引擎收录
  return previewToken ? { ...seo, robots: { index: false, follow: false } } : seo;
}

export default async function NewsDetailPage({ params, searchParams }: NewsPageProps) {
  const { slug } = await params;
  const { previewToken } = await searchParams;
  const t = await getTranslations('content.detail');
  const tBread = await getTranslations('breadcrumbs');
  const tCta = await getTranslations('cta');
  const tNews = await getTranslations('content.categories.news');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();

  const item = await fetchBySlug((s) => getNewsItem(s, previewParams(previewToken)), slug);
  if (!item) notFound();

  const summary = pickSummary(item.summary, item.content);
  const coverImage = pickCoverImage(item.coverImage);
  // 详情页宽幅封面：优先使用独立设置，未设置时回退列表封面图
  const heroImage = pickCoverImage(
    (item as { detailCoverImage?: string | null }).detailCoverImage ?? item.coverImage,
  );
  const dateLabel = formatContentDate(item.publishedAt, locale);

  let related: Awaited<ReturnType<typeof getNewsList>>['data'] = [];
  try {
    const res = await getNewsList({ limit: 4, page: 1, sortBy: 'publishedAt', sortOrder: 'desc' });
    related = (res.data ?? []).filter((n) => n.slug !== item.slug).slice(0, 3);
  } catch {
    /* 忽略相关推荐失败 */
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('breadcrumbs.news'), path: '/resources/news' },
            { name: item.title, path: `/resources/news/${slug}` },
          ]),
          articleJsonLd({
            title: item.title,
            description: summary,
            path: `/resources/news/${slug}`,
            image: coverImage,
            datePublished: item.publishedAt?.toString(),
          }),
        ]}
      />

      <div className="pb-20">
        <section className="relative h-[360px] overflow-hidden bg-neutral-800 lg:h-[460px]">
          <Image
            src={heroImage}
            alt={item.title}
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
            <Eyebrow inverted>{newsCategoryLabelI18n(item.category, tNews)}</Eyebrow>
            <h1 className="rb-h1 mt-4 max-w-4xl text-white">{item.title}</h1>
            <div className="mt-4 text-sm text-white/75">{dateLabel}</div>
          </Container>
        </section>

        <Container className="py-16 lg:py-24">
          <article className="mx-auto max-w-3xl">
            {summary ? (
              <p className="border-l-4 border-primary pl-5 text-lg leading-relaxed text-neutral-900">
                {summary}
              </p>
            ) : null}

            <MarkdownBody content={item.content} className={summary ? 'mt-8' : ''} />

            <div className="mt-12 border border-neutral-300 bg-neutral-100 p-8 text-center">
              <h3 className="rb-h4 text-neutral-900">{t('ctaTitleNews')}</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-secondary-text">
                {t('ctaDescriptionNews')}
              </p>
              <div className="mt-6 flex justify-center">
                <BookConsultButton message={tCommon('bookConsultContent')}>
                  {tCta('bookConsult')}
                </BookConsultButton>
              </div>
            </div>
          </article>
        </Container>

        {related.length > 0 ? (
          <section className="bg-neutral-100">
            <Container className="py-16 lg:py-24">
              <h2 className="rb-h3 mb-10 text-neutral-900">{t('relatedNews')}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((n) => (
                  <Link
                    key={n.id}
                    href={`/resources/news/${n.slug}`}
                    className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-primary">
                      {newsCategoryLabelI18n(n.category, tNews)}
                    </span>
                    <h3 className="rb-h5 mt-2 text-neutral-900 transition-colors group-hover:text-primary">
                      {n.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">
                      {pickSummary(n.summary, n.content)}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                      {t('viewDetail')}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        <Container>
          <div className="flex items-center justify-between border-t border-neutral-300 pt-8">
            <RbLink href="/resources/news">{t('backToNews')}</RbLink>
            <BookConsultLink message={tCommon('bookConsultContent')}>
              {t('bookConsultArrow')}
            </BookConsultLink>
          </div>
        </Container>
      </div>
    </>
  );
}
