import type { Metadata } from "next";
import { MediaImage as Image } from "@/components/MediaImage";
import {
  Biohazard,
  Droplets,
  Container as ContainerIcon,
  Activity,
  AlertTriangle,
  Cpu,
  Truck,
  Building2,
} from "lucide-react";
import { Container, PageHero, SectionHeading } from "@/components/ui";
import { RelatedLinks, CtaBand } from "@/components/sections/blocks";
import { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({ namespace: "pages.accessoriesHazmat", path: "/accessories/hazmat" });
}

const PROP_ICONS = [AlertTriangle, Droplets, ContainerIcon, Activity, Biohazard, Cpu] as const;
const RELATED_HREFS = ["/accessories", "/fixed-tower", "/cases"];

export default async function HazmatPage() {
  const t = await getTranslations("pages.accessoriesHazmat");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const propsRaw = t.raw("props") as Array<{ title: string; desc: string }>;
  const props = propsRaw.map((item, i) => ({ ...item, icon: PROP_ICONS[i]! }));
  const trailerFeatures = t.raw("trailer.features") as string[];
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
            eyebrow={t("propsSection.eyebrow")}
            title={t("propsSection.title")}
            description={t("propsSection.description")}
          />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="border border-neutral-300 bg-white p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="rb-h5 text-neutral-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary-text">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <StatBandI18n />

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
              <Image
                src="/media/hazmat-trailer.webp"
                alt={t("trailer.imageAlt")}
                fill
                quality={80}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div>
              <SectionHeading
                eyebrow={t("trailer.eyebrow")}
                title={t("trailer.title")}
                description={t("trailer.description")}
              />
              <ul className="mt-8 grid grid-cols-1 gap-3">
                {trailerFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900"
                  >
                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading
              eyebrow={t("facility.eyebrow")}
              title={t("facility.title")}
              description={t("facility.description")}
            />
            <div className="flex flex-col justify-center gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <p className="text-base leading-relaxed text-neutral-900">{t("facility.point1")}</p>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-primary/10">
                  <Cpu className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <p className="text-base leading-relaxed text-secondary-text">{t("facility.point2")}</p>
              </div>
            </div>
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
        secondaryHref="/specialized-training"
      />
    </div>
  );
}
