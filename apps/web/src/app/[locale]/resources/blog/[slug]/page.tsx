import { ArrowRight, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { BookConsultButton } from '@/components/chat/BookConsultButton';
import { BookConsultLink } from '@/components/chat/BookConsultLink';
import { MarkdownBody } from '@/components/content/MarkdownBody';
import { JsonLd } from '@/components/JsonLd';
import { MediaImage as Image } from '@/components/MediaImage';
import { Container, Eyebrow, RbLink } from '@/components/ui';
import { getBlog, getBlogs } from '@/lib/api';
import { fetchBySlug, previewParams } from '@/lib/content-detail';
import { blogCategoryLabelI18n, formatContentDate } from '@/lib/content-labels';
import { pickCoverImage, pickSummary } from '@/lib/content-list';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { generateSeo } from '@/lib/seo';

interface BlogPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ previewToken?: string }>;
}

export async function generateMetadata({ params, searchParams }: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { previewToken } = await searchParams;
  const post = await fetchBySlug((s) => getBlog(s, previewParams(previewToken)), slug);
  if (!post) return {};

  const locale = await getLocale();
  const excerpt = pickSummary((post as { excerpt?: string }).excerpt, post.content);

  const seo = generateSeo({
    title: (post as { seoTitle?: string }).seoTitle || post.title,
    description: (post as { seoDesc?: string }).seoDesc || excerpt,
    locale,
    path: `/resources/blog/${slug}`,
    image: pickCoverImage(post.coverImage),
    type: 'article',
  });
  // 草稿预览链接不应被搜索引擎收录
  return previewToken ? { ...seo, robots: { index: false, follow: false } } : seo;
}

export default async function BlogDetailPage({ params, searchParams }: BlogPageProps) {
  const { slug } = await params;
  const { previewToken } = await searchParams;
  const t = await getTranslations('content.detail');
  const tBread = await getTranslations('breadcrumbs');
  const tCta = await getTranslations('cta');
  const tBlog = await getTranslations('content.categories.blog');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();

  const post = await fetchBySlug((s) => getBlog(s, previewParams(previewToken)), slug);
  if (!post) notFound();

  const excerpt = pickSummary((post as { excerpt?: string }).excerpt, post.content);
  const coverImage = pickCoverImage(post.coverImage);
  // 详情页宽幅封面：优先使用独立设置，未设置时回退列表封面图
  const heroImage = pickCoverImage(
    (post as { detailCoverImage?: string | null }).detailCoverImage ?? post.coverImage,
  );
  const dateLabel = formatContentDate(post.publishedAt, locale);
  const readTime = (post as { readTime?: string }).readTime;

  let related: Awaited<ReturnType<typeof getBlogs>>['data'] = [];
  try {
    const res = await getBlogs({ limit: 4, page: 1, sortBy: 'publishedAt', sortOrder: 'desc' });
    related = (res.data ?? []).filter((p) => p.slug !== post.slug).slice(0, 3);
  } catch {
    /* 忽略相关推荐失败 */
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread('home'), path: '/' },
            { name: t('breadcrumbs.blog'), path: '/resources/blog' },
            { name: post.title, path: `/resources/blog/${slug}` },
          ]),
          articleJsonLd({
            title: post.title,
            description: excerpt,
            path: `/resources/blog/${slug}`,
            image: coverImage,
            datePublished: post.publishedAt?.toString(),
          }),
        ]}
      />

      <div className="pb-20">
        <section className="relative h-[360px] overflow-hidden bg-neutral-800 lg:h-[460px]">
          <Image
            src={heroImage}
            alt={post.title}
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
            <Eyebrow inverted>{blogCategoryLabelI18n(post.category, tBlog)}</Eyebrow>
            <h1 className="rb-h1 mt-4 max-w-4xl text-white">{post.title}</h1>
            <div className="mt-4 flex items-center gap-2 text-sm text-white/75">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {readTime ? t('readTime', { minutes: readTime }) : ''}
              {dateLabel}
            </div>
          </Container>
        </section>

        <Container className="py-16 lg:py-24">
          <article className="mx-auto max-w-3xl">
            {excerpt ? (
              <p className="border-l-4 border-primary pl-5 text-lg leading-relaxed text-neutral-900">
                {excerpt}
              </p>
            ) : null}

            <MarkdownBody content={post.content} className={excerpt ? 'mt-8' : ''} />

            <div className="mt-12 border border-neutral-300 bg-neutral-100 p-8 text-center">
              <h3 className="rb-h4 text-neutral-900">{t('ctaTitle')}</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-secondary-text">
                {t('ctaDescription')}
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
              <h2 className="rb-h3 mb-10 text-neutral-900">{t('relatedArticles')}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <Link
                    key={p.id}
                    href={`/resources/blog/${p.slug}`}
                    className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-primary">
                      {blogCategoryLabelI18n(p.category, tBlog)}
                    </span>
                    <h3 className="rb-h5 mt-2 text-neutral-900 transition-colors group-hover:text-primary">
                      {p.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">
                      {pickSummary((p as { excerpt?: string }).excerpt, p.content)}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                      {t('readFull')}
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
            <RbLink href="/resources/blog">{t('backToBlog')}</RbLink>
            <BookConsultLink message={tCommon('bookConsultContent')}>
              {t('bookConsultArrow')}
            </BookConsultLink>
          </div>
        </Container>
      </div>
    </>
  );
}
