import { Check, Ruler, Puzzle, Blocks, Maximize } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";
import { Container, PageHero, SectionHeading } from "@/components/ui";
import { FeatureGrid, RelatedLinks, CtaBand } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";

const CAPABILITY_ICONS = [Ruler, Puzzle, Blocks, Maximize] as const;
const RELATED_HREFS = ["/fixed-tower/series", "/burn-rooms", "/cases"];

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.fixedTowerCustom", path: "/fixed-tower/custom" });
}

export default async function FixedTowerCustomPage() {
  const t = await getTranslations("pages.fixedTowerCustom");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const features = t.raw("features") as string[];
  const capabilitiesRaw = t.raw("capabilities") as Array<{ title: string; desc: string }>;
  const capabilities = capabilitiesRaw.map((item, i) => ({ ...item, icon: CAPABILITY_ICONS[i]! }));
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
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t("customSection.eyebrow")}
              title={t("customSection.title")}
              description={t("customSection.description")}
            />
            <ul className="flex flex-col justify-center gap-4">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-base text-neutral-900">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("capabilitiesSection.eyebrow")}
            title={t("capabilitiesSection.title")}
            description={t("capabilitiesSection.description")}
          />
          <div className="mt-10">
            <FeatureGrid items={capabilities} columns={4} />
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

      <CtaBand
        title={t("cta.title")}
        description={t("cta.description")}
        primaryLabel={tCta("bookConsult")}
        secondaryLabel={t("cta.secondaryLabel")}
        secondaryHref="/fixed-tower/series"
      />
    </div>
  );
}
