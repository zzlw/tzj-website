import {
  ClipboardList,
  PencilRuler,
  Factory,
  Truck,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProcessBand, StatBand, type ProcessStep, type Stat } from "@/components/sections/blocks";
import { PRODUCT_LINE_COUNT } from "@/lib/product-catalog";

const PROCESS_ICONS = [
  ClipboardList,
  PencilRuler,
  Factory,
  Truck,
  GraduationCap,
  ShieldCheck,
] as const;

const PROCESS_KEYS = ["survey", "design", "manufacture", "install", "training", "service"] as const;

export async function StatBandI18n({ className }: { className?: string }) {
  const t = await getTranslations("blocks.statBand");
  const stats: Stat[] = [
    { value: "16", label: t("years") },
    { value: "1000+", label: t("projects") },
    { value: String(PRODUCT_LINE_COUNT), label: t("productLines") },
    { value: "6", label: t("domains") },
  ];
  return <StatBand stats={stats} className={className} />;
}

export async function ProcessBandI18n() {
  const t = await getTranslations("blocks.processBand");
  const steps: ProcessStep[] = PROCESS_KEYS.map((key, i) => ({
    icon: PROCESS_ICONS[i]!,
    title: t(`steps.${key}.title`),
    desc: t(`steps.${key}.desc`),
  }));
  return (
    <ProcessBand
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      steps={steps}
    />
  );
}
