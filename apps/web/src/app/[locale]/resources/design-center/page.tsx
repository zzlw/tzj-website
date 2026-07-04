import { FileText, Ruler, Boxes, FileBox } from "lucide-react";
import { Container, PageHero, SectionHeading, RbLink } from "@/components/ui";
import { RelatedLinks, CtaBand } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.resourcesDesignCenter", path: "/resources/design-center" });
}

const DOWNLOAD_ICONS = [FileText, Ruler, Boxes, FileBox] as const;
const RELATED_HREFS = ["/resources/how-to-buy", "/fixed-tower/series", "/resources/faqs"];

export default async function DesignCenterPage() {
  const t = await getTranslations("pages.resourcesDesignCenter");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const catalog = t.raw("catalog") as Array<{ title: string; desc: string; href: string }>;
  const resources = t.raw("resources") as string[];
  const downloadsRaw = t.raw("downloads") as Array<{ title: string; desc: string }>;
  const downloads = downloadsRaw.map((item, i) => ({ ...item, icon: DOWNLOAD_ICONS[i]! }));
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
          <SectionHeading eyebrow={t("catalogSection.eyebrow")} title={t("catalogSection.title")} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {catalog.map((c) => (
              <div key={c.title} className="flex flex-col border border-neutral-300 bg-white p-6">
                <h3 className="rb-h5 text-neutral-900">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary-text">{c.desc}</p>
                <div className="mt-4">
                  <RbLink href={c.href}>{t("catalogSection.viewDetails")}</RbLink>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("resourcesSection.eyebrow")} title={t("resourcesSection.title")} />
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {resources.map((r) => (
              <li key={r} className="border-l-2 border-primary bg-white p-5 text-base text-neutral-900">
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-secondary-text">{t("resourcesSection.note")}</p>
        </Container>
      </section>

      <StatBandI18n />

      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("downloadsSection.eyebrow")}
            title={t("downloadsSection.title")}
            description={t("downloadsSection.description")}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {downloads.map((d) => {
              const Icon = d.icon;
              return (
                <div key={d.title} className="border border-neutral-300 bg-white p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="rb-h5 text-neutral-900">{d.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary-text">{d.desc}</p>
                </div>
              );
            })}
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
        primaryLabel={tCta("bookConsult")}
        secondaryLabel={t("cta.secondaryLabel")}
        secondaryHref="/resources/how-to-buy"
      />
    </div>
  );
}
