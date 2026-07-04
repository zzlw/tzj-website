import { getTranslations } from "next-intl/server";
import type { ProductFamily, ProductLine } from "@/lib/product-catalog";

export async function getLocalizedFamily(family: ProductFamily) {
  const t = await getTranslations("catalog.families");
  return {
    ...family,
    title: t(`${family.id}.title`),
    description: t(`${family.id}.description`),
  };
}

export async function getLocalizedLine(line: ProductLine) {
  const t = await getTranslations("catalog.lines");
  return {
    ...line,
    title: t(`${line.id}.title`),
    shortTitle: t(`${line.id}.shortTitle`),
    description: t(`${line.id}.description`),
  };
}

export async function getLocalizedLines(lines: ProductLine[]) {
  const t = await getTranslations("catalog.lines");
  return lines.map((line) => ({
    ...line,
    title: t(`${line.id}.title`),
    shortTitle: t(`${line.id}.shortTitle`),
    description: t(`${line.id}.description`),
  }));
}
