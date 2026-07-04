import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";
import { Container, PageHero, SectionHeading } from "@/components/ui";
import { RelatedLinks, CtaBand } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";

const RELATED_HREFS = ["/resources/warranty", "/resources/inspections", "/why-us/story"];

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.whyUsCertification", path: "/why-us/certification" });
}

export default async function CertificationPage() {
  const t = await getTranslations("pages.whyUsCertification");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const certs = t.raw("certs") as Array<{ title: string; desc: string }>;
  const value = t.raw("value") as Array<{ title: string; desc: string }>;
  const relatedLinks = t.raw("relatedLinks") as Array<{ label: string; desc: string }>;

  return (
    <div className="pb-20">
      <PageHero eyebrow={t("hero.eyebrow")} title={t("hero.title")} description={t("hero.description")} />
      <section>
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("certsSection.eyebrow")} title={t("certsSection.title")} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {certs.map((c) => (
              <div key={c.title} className="border border-neutral-300 bg-white p-6">
                <h3 className="rb-h5 text-neutral-900">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{c.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <StatBandI18n />
      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("valueSection.eyebrow")} title={t("valueSection.title")} />
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {value.map((v) => (
              <div key={v.title} className="border-t-2 border-primary bg-white p-6">
                <h3 className="rb-h5 text-neutral-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-text">{v.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <RelatedLinks title={tBlocks("titleDefault")} learnMore={tBlocks("learnMore")} eyebrow={tBlocks("eyebrow")} links={relatedLinks.map((l, i) => ({ ...l, href: RELATED_HREFS[i]! }))} />
      <CtaBand title={t("cta.title")} description={t("cta.description")} primaryLabel={tCta("bookConsult")} />
    </div>
  );
}
