import { getTranslations } from "next-intl/server";
import type { Solution, SolutionConfig, SolutionFocus } from "@/lib/solutions";
import { SOLUTION_META, solutionCasesHref, type SolutionMeta } from "@/lib/solutions";

type SolutionListItem = Pick<Solution, "slug" | "name" | "icon" | "image" | "tagline">;

async function buildSolution(meta: SolutionMeta): Promise<Solution> {
  const t = await getTranslations(`solutions.${meta.slug}`);
  const intro = t.raw("intro") as string[];
  const focusRaw = t.raw("focus") as Array<{ title: string; desc: string }>;
  const recommendedRaw = t.raw("recommended") as Array<{ label: string; desc: string }>;
  const programs = t.raw("programs") as string[];

  const focus: SolutionFocus[] = focusRaw.map((item, i) => ({
    icon: meta.focusIcons[i]!,
    title: item.title,
    desc: item.desc,
  }));

  const recommended: SolutionConfig[] = recommendedRaw.map((item, i) => ({
    label: item.label,
    href: meta.recommendedHrefs[i]!,
    desc: item.desc,
  }));

  return {
    slug: meta.slug,
    name: t("name"),
    icon: meta.icon,
    image: meta.image,
    tagline: t("tagline"),
    intro,
    focus,
    recommended,
    programs,
    caseHref: meta.caseType ? solutionCasesHref(meta.caseType) : undefined,
  };
}

export async function getLocalizedSolutions(): Promise<SolutionListItem[]> {
  const results: SolutionListItem[] = [];
  for (const meta of SOLUTION_META) {
    const t = await getTranslations(`solutions.${meta.slug}`);
    results.push({
      slug: meta.slug,
      name: t("name"),
      icon: meta.icon,
      image: meta.image,
      tagline: t("tagline"),
    });
  }
  return results;
}

export async function getLocalizedSolution(slug: string): Promise<Solution | undefined> {
  const meta = SOLUTION_META.find((s) => s.slug === slug);
  if (!meta) return undefined;
  return buildSolution(meta);
}

export async function getAllLocalizedSolutions(): Promise<Solution[]> {
  return Promise.all(SOLUTION_META.map((meta) => buildSolution(meta)));
}
