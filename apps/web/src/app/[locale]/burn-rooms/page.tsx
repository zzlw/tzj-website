import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";
import { Container, VideoHero, SectionHeading, RbButton, RbLink } from "@/components/ui";
import { RelatedLinks } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.burnRooms", path: "/burn-rooms" });
}

const HERO_IMAGE = "/media/galvanized-stair.webp";
const HERO_VIDEO = "/media/burn-room.mp4";
const RELATED_HREFS = ["/burn-rooms/liner", "/burn-rooms/comparison", "/resources/inspections"];

export default async function BurnRoomsPage() {
  const t = await getTranslations("pages.burnRooms");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const specs = t.raw("specs") as Array<{ prop: string; value: string; why: string }>;
  const linerFeatures = t.raw("linerFeatures") as string[];
  const comparisonSteps = t.raw("comparison.steps") as string[];
  const relatedLinks = t.raw("relatedLinks") as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <VideoHero
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        description={t("hero.description")}
        video={HERO_VIDEO}
        poster={HERO_IMAGE}
      >
        <RbButton href="/contact" variant="light">
          {tCta("bookConsult")}
        </RbButton>
      </VideoHero>

      <section className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t("overview.eyebrow")}
              title={t("overview.title")}
              description={t("overview.description")}
            />
            <div className="flex flex-col justify-center gap-4 border-l-2 border-primary pl-6">
              <p className="text-lg leading-relaxed text-neutral-900">{t("overview.lead")}</p>
              <p className="text-secondary-text">{t("overview.body")}</p>
            </div>
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section id="liner" className="scroll-mt-24 bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("liner.eyebrow")}
            title={t("liner.title")}
            description={t("liner.description")}
          />

          <div className="mt-10 overflow-hidden border border-neutral-300">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-neutral-900 text-white">
                  <th className="p-4 text-sm font-bold">{t("liner.tableHeaders.prop")}</th>
                  <th className="p-4 text-sm font-bold text-primary">{t("liner.tableHeaders.value")}</th>
                  <th className="p-4 text-sm font-bold">{t("liner.tableHeaders.why")}</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((s, i) => (
                  <tr key={s.prop} className={i % 2 ? "bg-neutral-100" : "bg-white"}>
                    <td className="p-4 align-top text-sm font-bold text-neutral-900">{s.prop}</td>
                    <td className="p-4 align-top text-sm font-bold text-primary">{s.value}</td>
                    <td className="p-4 align-top text-sm leading-relaxed text-secondary-text">{s.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {linerFeatures.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm leading-relaxed text-neutral-900">{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <RbLink href="/burn-rooms/liner">{t("liner.linkText")}</RbLink>
          </div>
        </Container>
      </section>

      <section id="comparison" className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <SectionHeading
                eyebrow={t("comparison.eyebrow")}
                title={t("comparison.title")}
                description={t("comparison.description")}
              />
              <RbLink href="/burn-rooms/comparison">{t("comparison.linkText")}</RbLink>
            </div>
            <ol className="flex flex-col justify-center gap-5">
              {comparisonSteps.map((step, i) => (
                <li key={step} className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-1 text-base leading-relaxed text-neutral-900">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <RelatedLinks
        title={tBlocks("titleDefault")}
        learnMore={tBlocks("learnMore")}
        eyebrow={tBlocks("eyebrow")}
        links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))}
      />

      <Container>
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t("cta.title")}</h2>
          <p className="text-secondary-text">{t("cta.description")}</p>
          <RbButton href="/contact">{tCta("bookConsult")}</RbButton>
        </div>
      </Container>
    </div>
  );
}
