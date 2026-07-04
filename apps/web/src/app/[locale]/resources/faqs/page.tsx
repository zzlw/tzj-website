import { Plus } from "lucide-react";
import { Container, PageHero, RbButton } from "@/components/ui";
import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata() {
  return createPageMetadata({ namespace: "pages.resourcesFaqs", path: "/resources/faqs" });
}

export default async function FaqsPage() {
  const t = await getTranslations("pages.resourcesFaqs");
  const tCta = await getTranslations("cta");

  const groups = t.raw("groups") as Array<{ title: string; items: Array<{ q: string; a: string }> }>;

  return (
    <div className="pb-20">
      <PageHero
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        description={t("hero.description")}
      />

      <section>
        <Container className="py-16 lg:py-24">
          <div className="flex flex-col gap-12">
            {groups.map((g) => (
              <div key={g.title}>
                <h2 className="rb-h4 mb-6 text-neutral-900">{g.title}</h2>
                <div className="flex flex-col divide-y divide-neutral-300 border-y border-neutral-300">
                  {g.items.map((it) => (
                    <details key={it.q} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5">
                        <span className="rb-h5 text-neutral-900">{it.q}</span>
                        <Plus className="h-5 w-5 shrink-0 text-primary transition-transform duration-300 group-open:rotate-45" />
                      </summary>
                      <p className="pb-5 text-base leading-relaxed text-secondary-text">{it.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

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
