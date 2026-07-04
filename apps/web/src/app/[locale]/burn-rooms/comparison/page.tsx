import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";
import { Container, PageHero, SectionHeading } from "@/components/ui";
import { RelatedLinks, CtaBand } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";

const RELATED_HREFS = ["/burn-rooms/liner", "/burn-rooms", "/resources/inspections"];

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.burnRoomsComparison", path: "/burn-rooms/comparison" });
}

export default async function ComparisonPage() {
  const t = await getTranslations("pages.burnRoomsComparison");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const rows = t.raw("rows") as Array<{ feature: string; interlock: string; traditional: string }>;
  const steps = t.raw("steps") as Array<{ step: string; title: string; desc: string }>;
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
          <SectionHeading
            eyebrow={t("compareSection.eyebrow")}
            title={t("compareSection.title")}
          />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-neutral-900">
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                    {t("tableHeaders.feature")}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-primary">
                    {t("tableHeaders.interlock")}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-secondary-text">
                    {t("tableHeaders.traditional")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-b border-neutral-300 align-top">
                    <td className="p-4 text-sm font-bold text-neutral-900">{r.feature}</td>
                    <td className="p-4 text-sm leading-relaxed text-neutral-900">{r.interlock}</td>
                    <td className="p-4 text-sm leading-relaxed text-secondary-text">{r.traditional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("retrofitSection.eyebrow")}
            title={t("retrofitSection.title")}
            description={t("retrofitSection.description")}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s) => (
              <div key={s.step} className="border-t-2 border-primary bg-white p-5">
                <span className="font-display text-2xl font-bold text-primary">{s.step}</span>
                <h3 className="rb-h5 mt-2 text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks("titleDefault")}
        learnMore={tBlocks("learnMore")}
        eyebrow={tBlocks("eyebrow")}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <CtaBand
        title={t("cta.title")}
        primaryLabel={tCta("bookConsult")}
        secondaryLabel={t("cta.secondaryLabel")}
        secondaryHref="/burn-rooms/liner"
      />
    </div>
  );
}
