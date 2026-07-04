import {
  DoorClosed,
  Boxes,
  Building,
  Layers,
  Wrench,
  FileText,
  ShieldCheck,
  Clock,
  PencilRuler,
  Factory,
  Truck,
} from "lucide-react";
import { Container, PageHero, SectionHeading } from "@/components/ui";
import { FeatureGrid, RelatedLinks, CtaBand } from "@/components/sections/blocks";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.resourcesInspections", path: "/resources/inspections" });
}

const CATEGORY_ICONS = [DoorClosed, Building, Boxes, Layers, Wrench, FileText] as const;
const WHY_ICONS = [ShieldCheck, Clock, FileText] as const;
const RELATED_HREFS = ["/resources/warranty", "/burn-rooms/liner", "/burn-rooms/comparison"];

export default async function InspectionsPage() {
  const t = await getTranslations("pages.resourcesInspections");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const reviewItems = t.raw("reviewItems") as string[];
  const categoriesRaw = t.raw("categories") as Array<{ title: string; desc: string }>;
  const categories = categoriesRaw.map((item, i) => ({ ...item, icon: CATEGORY_ICONS[i]! }));
  const whyRaw = t.raw("why") as Array<{ title: string; desc: string }>;
  const why = whyRaw.map((item, i) => ({ ...item, icon: WHY_ICONS[i]! }));
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
              eyebrow={t("scheduleSection.eyebrow")}
              title={t("scheduleSection.title")}
              description={t("scheduleSection.description")}
            />
            <div className="flex flex-col justify-center gap-4">
              <div className="flex items-center justify-between gap-4 border border-neutral-300 bg-white px-6 py-5">
                <div>
                  <div className="rb-h5 text-neutral-900">{t("scheduleSection.classA.title")}</div>
                  <div className="mt-1 text-sm text-secondary-text">{t("scheduleSection.classA.subtitle")}</div>
                </div>
                <div className="text-right font-display text-lg font-bold text-primary">
                  {t("scheduleSection.classA.interval")}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border border-neutral-300 bg-white px-6 py-5">
                <div>
                  <div className="rb-h5 text-neutral-900">{t("scheduleSection.classB.title")}</div>
                  <div className="mt-1 text-sm text-secondary-text">{t("scheduleSection.classB.subtitle")}</div>
                </div>
                <div className="text-right font-display text-lg font-bold text-primary">
                  {t("scheduleSection.classB.interval")}
                </div>
              </div>
              <p className="text-xs leading-relaxed text-secondary-text">{t("scheduleSection.footnote")}</p>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("reviewSection.eyebrow")}
            title={t("reviewSection.title")}
            description={t("reviewSection.description")}
          />
          <div className="mt-10 flex flex-wrap gap-3">
            {reviewItems.map((i) => (
              <span
                key={i}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-900"
              >
                {i}
              </span>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("categoriesSection.eyebrow")} title={t("categoriesSection.title")} />
          <div className="mt-10">
            <FeatureGrid items={categories} columns={3} />
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("whySection.eyebrow")} title={t("whySection.title")} />
          <div className="mt-10">
            <FeatureGrid items={why} columns={3} />
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
        description={t("cta.description")}
        primaryLabel={tCta("bookConsult")}
        secondaryLabel={t("cta.secondaryLabel")}
        secondaryHref="/resources/warranty"
      />
    </div>
  );
}
