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

        <div className="mt-8 flex flex-wrap gap-3">
          {FAMILY_KEYS.map((key, i) => (
            <div
              key={key}
              className="flex items-center gap-2 border border-neutral-300 bg-neutral-100 px-4 py-2"
            >
              <span className="font-display text-lg font-extrabold text-primary">{FAMILY_COUNTS[i]}</span>
              <span className="text-sm font-bold text-neutral-900">{t(key)}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 border border-neutral-900 bg-neutral-900 px-4 py-2">
            <span className="font-display text-lg font-extrabold text-white">{PRODUCT_LINE_COUNT}</span>
            <span className="text-sm font-bold text-white">{t("total")}</span>
          </div>
        </div>

        <ProductLinesGrid showFamilyHeaders headerVariant="compact" className="mt-10" />
      </Container>
    </section>
  );
}
