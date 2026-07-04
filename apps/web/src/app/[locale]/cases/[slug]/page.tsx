import type { Metadata } from "next";
import { MediaImage as Image } from "@/components/MediaImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MapPin } from "lucide-react";
import { generateSeo } from "@/lib/seo";
import { getCase } from "@/lib/api";
import { fetchBySlug, parseCaseSpecs } from "@/lib/content-detail";
import { caseTypeLabelI18n, formatContentDate } from "@/lib/content-labels";
import { pickCoverImage } from "@/lib/content-list";
import { breadcrumbJsonLd, articleJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { MarkdownBody } from "@/components/content/MarkdownBody";
import { Container, Eyebrow, RbButton, RbLink } from "@/components/ui";
import { getLocale, getTranslations } from "next-intl/server";

interface CasePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = await fetchBySlug(getCase, slug);
  if (!caseStudy) return {};

  const summary =
    (caseStudy as { summary?: string }).summary ??
    (caseStudy as { description?: string }).description ??
    "";

  return generateSeo({
    title: (caseStudy as { seoTitle?: string }).seoTitle || caseStudy.title,
    description: (caseStudy as { seoDesc?: string }).seoDesc || summary,
    path: `/cases/${slug}`,
    image: pickCoverImage(caseStudy.coverImage),
    type: "article",
  });
}

export default async function CaseDetailPage({ params }: CasePageProps) {
  const { slug } = await params;
  const t = await getTranslations("content.detail");
  const tBread = await getTranslations("breadcrumbs");
  const tCta = await getTranslations("cta");
  const tCases = await getTranslations("content.categories.cases");
  const locale = await getLocale();

  const caseStudy = await fetchBySlug(getCase, slug);
  if (!caseStudy) notFound();

  const summary =
    (caseStudy as { summary?: string }).summary ??
    (caseStudy as { description?: string }).description ??
    "";
  const highlights = (caseStudy as { highlights?: string[] }).highlights ?? [];
  const specs = parseCaseSpecs((caseStudy as { specs?: unknown }).specs);
  const client =
    (caseStudy as { client?: string }).client ??
    (caseStudy as { clientName?: string }).clientName ??
    "";
  const description = (caseStudy as { description?: string }).description;
  const coverImage = pickCoverImage(caseStudy.coverImage);
  const completionLabel = formatContentDate(
    (caseStudy as { completionDate?: string | Date | null }).completionDate,
    locale,
  );

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: tBread("home"), path: "/" },
            { name: t("breadcrumbs.cases"), path: "/cases" },
            { name: caseStudy.title, path: `/cases/${slug}` },
          ]),
          articleJsonLd({
            title: caseStudy.title,
            description: summary,
            path: `/cases/${slug}`,
            image: coverImage,
            datePublished:
              (caseStudy as { completionDate?: string | Date | null }).completionDate?.toString() ??
              undefined,
          }),
        ]}
      />

      <div className="pb-20">
        <section className="relative h-[420px] overflow-hidden bg-neutral-900 lg:h-[520px]">
          <Image
            src={coverImage}
            alt={caseStudy.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 rb-media-shade-strong" />
          <Container className="rb-on-media relative z-10 flex h-full flex-col justify-end pb-12 pt-24">
            <Eyebrow inverted>{caseTypeLabelI18n(caseStudy.caseType, tCases)}</Eyebrow>
            <h1 className="rb-h1 mt-4 max-w-3xl text-white">{caseStudy.title}</h1>
            <div className="mt-4 flex items-center gap-2 text-sm text-white/75">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {caseStudy.location ?? "—"} · {completionLabel}
            </div>
          </Container>
        </section>

        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="rb-h3 text-neutral-900">{t("projectOverview")}</h2>
              {summary ? (
                <p className="mt-4 text-base leading-relaxed text-secondary-text">{summary}</p>
              ) : null}

              {highlights.length > 0 ? (
                <>
                  <h3 className="rb-h4 mt-10 text-neutral-900">{t("highlights")}</h3>
                  <ul className="mt-4 space-y-3">
                    {highlights.map((h) => (
                      <li key={h} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-sm leading-relaxed text-neutral-900">{h}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <MarkdownBody content={description} />
            </div>

            <aside className="border border-neutral-300 bg-neutral-100 p-6 lg:p-8">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-neutral-900">
                {t("projectInfo")}
              </h3>
              <dl className="mt-4 space-y-4">
                {specs.map((spec) => (
                  <div key={spec.label}>
                    <dt className="text-xs text-secondary-text">{spec.label}</dt>
                    <dd className="mt-0.5 font-display text-sm font-bold text-neutral-900">
                      {spec.value}
                    </dd>
                  </div>
                ))}
                {client ? (
                  <div>
                    <dt className="text-xs text-secondary-text">{t("client")}</dt>
                    <dd className="mt-0.5 font-display text-sm font-bold text-neutral-900">
                      {client}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-8">
                <RbButton href="/contact" className="w-full">
                  {t("consultSimilar")}
                </RbButton>
              </div>
            </aside>
          </div>
        </Container>

        <Container>
          <div className="flex items-center justify-between border-t border-neutral-300 pt-8">
            <RbLink href="/cases">{t("viewAllCases")}</RbLink>
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
