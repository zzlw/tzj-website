import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContactSection } from "@/components/sections/ContactSection";
import { generateSeo } from "@/lib/seo";
import { PageHero } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact.page");
  const tCommon = await getTranslations("common");
  return generateSeo({
    title: t("title"),
    description: t("metaDescription"),
    path: "/contact",
    siteName: tCommon("brandName"),
  });
}

export default async function ContactPage() {
  const t = await getTranslations("contact.page");

  return (
    <div>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("heroDescription")}
      />
      <ContactSection />
    </div>
  );
}
