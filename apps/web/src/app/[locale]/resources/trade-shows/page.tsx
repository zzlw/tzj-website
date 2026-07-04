import { CalendarDays, MapPin, Eye, MessagesSquare, Handshake } from "lucide-react";
import { getTradeShows } from "@/lib/api";
import { formatContentDate, tradeShowTypeLabel } from "@/lib/content-labels";
import { buildListQuery, normalizePagination, parseContentListState, pickSummary } from "@/lib/content-list";
import { getTradeShowTypeFilter } from "@/lib/i18n/content-filters";
import { getTradeShowSortOptions } from "@/lib/i18n/sort-options";
import { Container, PageHero, SectionHeading } from "@/components/ui";
import { FeatureGrid, RelatedLinks, CtaBand } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";
import { ContentListShell, ContentPaginationShell } from "@/components/content/ContentListShell";
import { ContentPagination } from "@/components/content/ContentPagination";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";

const FEATURE_ICONS = [Eye, MessagesSquare, Handshake] as const;
const RELATED_HREFS = ["/cases", "/resources/news", "/resources/design-center"];

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.resourcesTradeShows", path: "/resources/trade-shows" });
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TradeShowsPage({ searchParams }: PageProps) {
  const t = await getTranslations("pages.resourcesTradeShows");
  const tList = await getTranslations("content.list");
  const tContent = await getTranslations("content");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const typeFilter = await getTradeShowTypeFilter();
  const sortOptions = await getTradeShowSortOptions();

  const raw = await searchParams;
  const state = parseContentListState(raw, {
    limit: 8,
    sortBy: "startDate",
    sortOrder: "desc",
    filterKey: "eventType",
  });

  let items: Awaited<ReturnType<typeof getTradeShows>>["data"] = [];
  let pagination = normalizePagination(undefined, state.page, state.limit);

  try {
    const res = await getTradeShows(buildListQuery(state, "eventType"));
    items = res.data ?? [];
    pagination = normalizePagination(res.pagination, state.page, state.limit);
  } catch {
    /* empty */
  }

  const featuresRaw = t.raw("features") as Array<{ title: string; desc: string }>;
  const features = featuresRaw.map((item, i) => ({ ...item, icon: FEATURE_ICONS[i]! }));
  const relatedLinks = t.raw("relatedLinks") as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        description={t("hero.description")}
      />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("listSection.eyebrow")} title={t("listSection.title")} />

          <div className="mt-8">
            <ContentListShell
              toolbar={{
                filters: [typeFilter],
                sortOptions,
                defaultSort: sortOptions[0]!,
              }}
            >
              {items.length === 0 ? (
                <p className="mt-8 border border-dashed border-neutral-300 py-16 text-center text-sm text-secondary-text">
                  {tList("emptyTradeShows")}
                </p>
              ) : (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {items.map((e) => {
                    const cardInner = (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-primary">
                            {tradeShowTypeLabel(e.eventType)}
                          </span>
                          {e.isFeatured ? (
                            <span className="bg-neutral-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              {tContent("labels.featured")}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="rb-h5 mt-2 text-neutral-900">{e.title}</h3>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-secondary-text">
                          {e.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-primary" aria-hidden />
                              {e.location}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                            {e.eventDateLabel || formatContentDate(e.startDate)}
                          </span>
                        </div>
                        {e.boothNumber ? (
                          <p className="mt-2 text-xs font-medium text-neutral-900">
                            {tContent("labels.booth")}{e.boothNumber}
                          </p>
                        ) : null}
                        <p className="mt-3 text-sm leading-relaxed text-secondary-text">
                          {pickSummary(e.summary)}
                        </p>
                      </>
                    );

                    if (e.externalUrl?.trim()) {
                      return (
                        <a
                          key={e.id}
                          href={e.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
                        >
                          {cardInner}
                        </a>
                      );
                    }

                    return (
                      <div key={e.id} className="border border-neutral-300 bg-white p-6">
                        {cardInner}
                      </div>
                    );
                  })}
                </div>
              )}

              <ContentPaginationShell>
                <ContentPagination
                  pagination={pagination}
                  unit={tContent("pagination.units.events")}
                  pageSizeOptions={[8, 12, 24]}
                />
              </ContentPaginationShell>
            </ContentListShell>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("whyVisitSection.eyebrow")} title={t("whyVisitSection.title")} />
          <div className="mt-10">
            <FeatureGrid items={features} columns={3} />
          </div>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks("titleDefault")}
        learnMore={tBlocks("learnMore")}
        eyebrow={tBlocks("eyebrow")}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <CtaBand title={t("cta.title")} primaryLabel={tCta("bookConsult")} />
    </div>
  );
}
