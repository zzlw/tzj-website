import { MediaImage as Image } from "@/components/MediaImage";
import { Shield, Link2, CloudRain, Recycle, Check, X } from "lucide-react";
import { Container, VideoHero, SectionHeading, RbButton, RbLink } from "@/components/ui";
import { FeatureGrid, RelatedLinks } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.fixedTowerSeries", path: "/fixed-tower/series" });
}

const DURABILITY_ICONS = [Shield, Link2, CloudRain, Recycle] as const;
const RELATED_HREFS = ["/fixed-tower/custom", "/burn-rooms", "/resources/design-center"];

type CmpRow = { feature: string; standard: boolean | string; custom: boolean | string };

export default async function FixedTowerSeriesPage() {
  const t = await getTranslations("pages.fixedTowerSeries");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const durabilityRaw = t.raw("durability") as Array<{ title: string; desc: string }>;
  const durability = durabilityRaw.map((item, i) => ({ ...item, icon: DURABILITY_ICONS[i]! }));
  const series = t.raw("series") as Array<{ name: string; variants: string; desc: string; image: string }>;
  const moreSeries = t.raw("moreSeries") as Array<{ name: string; variants: string; desc: string }>;
  const compare = t.raw("compare") as {
    headers: { feature: string; standard: string; custom: string };
    ariaSupported: string;
    ariaNotSupported: string;
    rows: CmpRow[];
  };
  const relatedLinks = t.raw("relatedLinks") as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <VideoHero
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        description={t("hero.description")}
        video="/media/fixed-series.mp4"
        poster="/media/fixed-tower-hero.jpg"
      />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("complianceSection.eyebrow")}
            title={t("complianceSection.title")}
            description={t("complianceSection.description")}
          />
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("durabilitySection.eyebrow")}
            title={t("durabilitySection.title")}
            description={t("durabilitySection.description")}
          />
          <div className="mt-10">
            <FeatureGrid items={durability} columns={4} />
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-secondary-text">
            {t("durabilitySection.note")}
          </p>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <h2 className="rb-h2 mb-10 text-neutral-900">{t("seriesSectionTitle")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {series.map((s) => (
              <div key={s.name} className="flex flex-col border border-neutral-300 bg-white">
                <div className="relative aspect-[16/10] overflow-hidden border-b border-neutral-300 bg-white">
                  <Image src={s.image} alt={s.name} fill quality={80} sizes="(max-width: 640px) 100vw, 50vw" className="object-contain p-4" />
                </div>
                <div className="p-6">
                  <h3 className="rb-h5 text-neutral-900">{s.name}</h3>
                  <span className="mt-1 block text-xs font-bold text-primary">{s.variants}</span>
                  <p className="mt-3 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {moreSeries.map((s) => (
              <div key={s.name} className="flex flex-col border border-neutral-300 bg-white p-6">
                <h3 className="rb-h5 text-neutral-900">{s.name}</h3>
                <span className="mt-1 text-xs font-bold text-primary">{s.variants}</span>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("compareSection.eyebrow")}
            title={t("compareSection.title")}
            description={t("compareSection.description")}
          />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-neutral-900">
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                    {compare.headers.feature}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                    {compare.headers.standard}
                  </th>
                  <th className="p-4 text-sm font-bold uppercase tracking-wide text-primary">
                    {compare.headers.custom}
                  </th>
                </tr>
              </thead>
              <tbody>
                {compare.rows.map((r) => (
                  <tr key={r.feature} className="border-b border-neutral-300 align-middle">
                    <td className="p-4 text-sm font-bold text-neutral-900">{r.feature}</td>
                    {[r.standard, r.custom].map((v, i) => (
                      <td key={i} className="p-4 text-sm text-secondary-text">
                        {v === true ? (
                          <Check className="h-5 w-5 text-primary" aria-label={compare.ariaSupported} />
                        ) : v === false ? (
                          <X className="h-5 w-5 text-neutral-300" aria-label={compare.ariaNotSupported} />
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <ProcessBandI18n />

      <RelatedLinks
        title={tBlocks("titleDefault")}
        learnMore={tBlocks("learnMore")}
        eyebrow={tBlocks("eyebrow")}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <Container className="pt-16 lg:pt-24">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t("cta.title")}</h2>
          <p className="text-secondary-text">{t("cta.description")}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <RbButton href="/contact">{tCta("bookConsult")}</RbButton>
            <RbLink href="/fixed-tower/custom">{t("cta.customLink")}</RbLink>
            <RbLink href="/docs/fixed-tower-specs.pdf">{tCta("downloadPdf")}</RbLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
