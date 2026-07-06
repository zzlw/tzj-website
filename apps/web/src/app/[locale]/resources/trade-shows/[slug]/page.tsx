import type { Metadata } from "next";
import { MediaImage as Image } from "@/components/MediaImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { generateSeo } from "@/lib/seo";
import { getTradeShow, getTradeShows } from "@/lib/api";
import { fetchBySlug } from "@/lib/content-detail";
import { formatContentDate, tradeShowTypeLabel } from "@/lib/content-labels";
import { pickCoverImage, pickSummary } from "@/lib/content-list";
import { breadcrumbJsonLd, eventJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { MarkdownBody } from "@/components/content/MarkdownBody";
import { Container, Eyebrow, RbButton, RbLink } from "@/components/ui";
import { getLocale, getTranslations } from "next-intl/server";

interface TradeShowPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TradeShowPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchBySlug(getTradeShow, slug);
  if (!item) return {};

  const summary = pickSummary(item.summary, item.content);

  return generateSeo({
    title: (item as { seoTitle?: string }).seoTitle || item.title,
    description: (item as { seoDesc?: string }).seoDesc || summary,
    path: `/resources/trade-shows/${slug}`,
    image: pickCoverImage(item.coverImage),
    type: "article",
  });
}

export default async function TradeShowDetailPage({ params }: TradeShowPageProps) {
  const { slug } = await params;
  const t = await getTranslations("content.detail");
  const tBread = await getTranslations("breadcrumbs");
  const tCta = await getTranslations("cta");
  const locale = await getLocale();

  const item = await fetchBySlug(getTradeShow, slug);
  if (!item) notFound();

  const summary = pickSummary(item.summary, item.content);
  const coverImage = pickCoverImage(item.coverImage);
  const dateLabel = formatContentDate(item.startDate, locale);

  let related: Awaited<ReturnType<typeof getTradeShows>>["data"] = [];
  try {
    const res = await getTradeShows({ limit: 4, page: 1, sortBy: "startDate", sortOrder: "desc" });
    related = (res.data ?? []).filter((n) => n.slug !== item.slug).slice(0, 3);
  } catch {
    /* 忽略相关推荐失败 */
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread("home"), path: "/" },
            { name: t("breadcrumbs.tradeShows"), path: "/resources/trade-shows" },
            { name: item.title, path: `/resources/trade-shows/${slug}` },
          ]),
          eventJsonLd({
            title: item.title,
            description: summary,
            path: `/resources/trade-shows/${slug}`,
            image: coverImage,
            startDate: item.startDate?.toString(),
            endDate: item.endDate?.toString(),
            location: item.location,
          }),
        ]}
      />

      <div className="pb-20">
        <section className="relative h-[360px] overflow-hidden bg-neutral-900 lg:h-[460px]">
          <Image src={coverImage} alt={item.title} fill priority quality={90} sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 rb-media-shade-strong" />
          <Container className="rb-on-media relative z-10 flex h-full flex-col justify-end pb-12 pt-24">
            <Eyebrow inverted>{tradeShowTypeLabel(item.eventType)}</Eyebrow>
            <h1 className="rb-h1 mt-4 max-w-4xl text-white">{item.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/75">
              {item.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {item.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-4 w-4" aria-hidden />
                {dateLabel}
              </span>
              {item.boothNumber ? (
                <span className="font-medium text-white">
                  {t("booth")}{item.boothNumber}
                </span>
              ) : null}
            </div>
          </Container>
        </section>

        <Container className="py-16 lg:py-24">
          <article className="mx-auto max-w-3xl">
            {summary ? (
              <p className="border-l-4 border-primary pl-5 text-lg leading-relaxed text-neutral-900">
                {summary}
              </p>
            ) : null}

            <MarkdownBody content={item.content} />

            <div className="mt-12 border border-neutral-300 bg-neutral-100 p-8 text-center">
              <h3 className="rb-h4 text-neutral-900">{t("ctaTitleTradeShow")}</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-secondary-text">
                {t("ctaDescriptionTradeShow")}
              </p>
              <div className="mt-6 flex justify-center">
                <RbButton href="/contact">{tCta("bookConsult")}</RbButton>
              </div>
            </div>
          </article>
        </Container>

        {related.length > 0 ? (
          <section className="bg-neutral-100">
            <Container className="py-16 lg:py-24">
              <h2 className="rb-h3 mb-10 text-neutral-900">{t("relatedTradeShows")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((n) => (
                  <Link
                    key={n.id}
                    href={`/resources/trade-shows/${n.slug}`}
                    className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-primary">
                      {tradeShowTypeLabel(n.eventType)}
                    </span>
                    <h3 className="rb-h5 mt-2 text-neutral-900 transition-colors group-hover:text-primary">
                      {n.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">
                      {pickSummary(n.summary, n.content)}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                      {t("viewDetail")}
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
            <RbLink href="/resources/trade-shows">{t("backToTradeShows")}</RbLink>
            <Link
              href="/contact"
              className="text-sm font-bold text-primary transition-colors hover:text-primary-hover"
            >
              {t("bookConsultArrow")}
            </Link>
          </div>
        </Container>
      </div>
    </>
  );
}
