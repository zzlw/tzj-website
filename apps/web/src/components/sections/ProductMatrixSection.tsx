import { getTranslations } from "next-intl/server";
import { Container, SectionHeading, RbLink } from "@/components/ui";
import { ProductLinesGrid } from "@/components/products/ProductLinesGrid";
import { PRODUCT_LINE_COUNT } from "@/lib/product-catalog";

const FAMILY_KEYS = ["familyTowers", "familyBurn", "familySpecialized", "familyAccessories"] as const;
const FAMILY_COUNTS = [4, 3, 5, 1] as const;

export async function ProductMatrixSection() {
  const t = await getTranslations("home.products");

  return (
    <section id="products" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow={t("eyebrow", { count: PRODUCT_LINE_COUNT })}
            title={t("title")}
            description={t("description", { count: PRODUCT_LINE_COUNT })}
          />
          <div className="shrink-0">
            <RbLink href="/towers">{t("browseAll")}</RbLink>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {FAMILY_KEYS.map((key, i) => (
            <span key={key} className="text-secondary-text">
              <span className="font-display font-bold text-primary">{FAMILY_COUNTS[i]}</span>
              <span className="ml-1">{t(key)}</span>
            </span>
          ))}
          <span className="text-neutral-400">·</span>
          <span className="text-neutral-900">
            <span className="font-display font-bold text-primary">{PRODUCT_LINE_COUNT}</span>
            <span className="ml-1">{t("total")}</span>
          </span>
        </div>

        <ProductLinesGrid showFamilyHeaders headerVariant="compact" className="mt-10" />
      </Container>
    </section>
  );
}
