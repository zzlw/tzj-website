import type { Metadata } from "next";
import { Award, Lightbulb, ShieldCheck, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";
import { Container, Eyebrow, VideoHero, SectionHeading, RbButton } from "@/components/ui";

const HERO_IMAGE = "/media/galvanized-stair.webp";
const HERO_VIDEO = "/media/why.mp4";
const PILLAR_ICONS = [Award, Lightbulb, ShieldCheck] as const;

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({ namespace: "pages.whyUs", path: "/why-us" });
}

export default async function WhyUsPage() {
  const t = await getTranslations("pages.whyUs");
  const tCta = await getTranslations("cta");
  const tBlocks = await getTranslations("blocks.relatedLinks");

  const pillars = t.raw("pillars") as Array<{ title: string; desc: string; points: string[] }>;
  const values = t.raw("values") as string[];
  const products = t.raw("products") as Array<{ title: string; desc: string; href: string }>;
  const explore = t.raw("explore") as Array<{ title: string; desc: string; href: string }>;

  return (
    <div className="pb-20">
      <VideoHero
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        description={t("hero.description")}
        video={HERO_VIDEO}
        poster={HERO_IMAGE}
      />

      <section className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <SectionHeading
            eyebrow={t("pillarsSection.eyebrow")}
            title={t("pillarsSection.title")}
            description={t("pillarsSection.description")}
          />
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i]!;
              return (
                <div key={p.title} className="border border-neutral-300 bg-white p-8">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="rb-h4 mb-3 text-neutral-900">{p.title}</h3>
                  <p className="mb-5 text-sm leading-relaxed text-secondary-text">{p.desc}</p>
                  <ul className="space-y-2">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm text-neutral-900">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            <div>
              <Eyebrow>{t("mission.eyebrow")}</Eyebrow>
              <p className="mt-4 text-base leading-relaxed text-neutral-900">{t("mission.body")}</p>
            </div>
            <div>
              <Eyebrow>{t("vision.eyebrow")}</Eyebrow>
              <p className="mt-4 text-base leading-relaxed text-neutral-900">{t("vision.body")}</p>
            </div>
            <div>
              <Eyebrow>{t("valuesSection.eyebrow")}</Eyebrow>
              <div className="mt-4 flex flex-wrap gap-2">
                {values.map((v) => (
                  <span key={v} className="bg-white px-4 py-2 text-sm font-bold text-neutral-900">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("productsSection.eyebrow")} title={t("productsSection.title")} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <a
                key={p.title}
                href={p.href}
                className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
              >
                <h3 className="rb-h5 text-neutral-900 transition-colors group-hover:text-primary">{p.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-secondary-text">{p.desc}</p>
                <span className="mt-4 text-sm font-bold text-primary">{tBlocks("learnMore")} →</span>
              </a>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-neutral-100">
        <Container className="py-16 lg:py-24">
          <SectionHeading eyebrow={t("exploreSection.eyebrow")} title={t("exploreSection.title")} />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {explore.map((e) => (
              <a
                key={e.title}
                href={e.href}
                className="group flex flex-col border border-neutral-300 bg-white p-6 transition-colors hover:border-neutral-900"
              >
                <h3 className="rb-h5 text-neutral-900 transition-colors group-hover:text-primary">{e.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-secondary-text">{e.desc}</p>
                <span className="mt-4 text-sm font-bold text-primary">{tBlocks("learnMore")} →</span>
              </a>
            ))}
          </div>
        </Container>
      </section>

      <Container className="pt-16 lg:pt-24">
        <div className="flex flex-col items-center gap-5 border border-neutral-300 bg-white p-10 text-center md:p-14">
          <h2 className="rb-h3 text-neutral-900">{t("cta.title")}</h2>
          <RbButton href="/contact">{tCta("bookConsult")}</RbButton>
        </div>
      </Container>
    </div>
  );
}
