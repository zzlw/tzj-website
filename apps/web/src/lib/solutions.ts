import type { LucideIcon } from "lucide-react";
import {
  Flame,
  Building2,
  Shield,
  Mountain,
  GraduationCap,
  Factory,
  Target,
  Beaker,
  Brain,
  Dumbbell,
  Trophy,
  ClipboardCheck,
  Users,
  Layers,
} from "lucide-react";
import { CASE_TYPE_VALUES } from "./content-labels";

export type SolutionCaseType = (typeof CASE_TYPE_VALUES)[number];

/** 解决方案 → 工程案例列表（按分类筛选）。 */
export function solutionCasesHref(caseType: SolutionCaseType): string {
  return `/cases?type=${caseType}`;
}

export interface SolutionFocus {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export interface SolutionConfig {
  label: string;
  href: string;
  desc: string;
}

export interface Solution {
  slug: string;
  name: string;
  icon: LucideIcon;
  image: string;
  tagline: string;
  intro: string[];
  focus: SolutionFocus[];
  recommended: SolutionConfig[];
  programs: string[];
  caseHref?: string;
}

export type SolutionMeta = {
  slug: string;
  icon: LucideIcon;
  image: string;
  /** 对应工程案例分类（`/cases?type=…`） */
  caseType?: SolutionCaseType;
  focusIcons: LucideIcon[];
  recommendedHrefs: string[];
};

export const SOLUTION_META: SolutionMeta[] = [
  {
    slug: "fire-rescue",
    icon: Flame,
    image: "/media/tower-wylie.jpg",
    caseType: "fire",
    focusIcons: [Flame, Building2, Beaker, ClipboardCheck],
    recommendedHrefs: ["/fixed-tower", "/burn-rooms", "/burn-rooms/cfbt", "/accessories/hazmat"],
  },
  {
    slug: "police",
    icon: Shield,
    image: "/media/tower-hamilton.jpg",
    caseType: "police",
    focusIcons: [Building2, Target, Shield, Users],
    recommendedHrefs: [
      "/fixed-tower/climbing-tower",
      "/accessories/tactical",
      "/fixed-tower/custom",
      "/accessories/fitness-equipment",
    ],
  },
  {
    slug: "military",
    icon: Target,
    image: "/media/tower-titusville.jpg",
    caseType: "military",
    focusIcons: [Dumbbell, Brain, Mountain, Layers],
    recommendedHrefs: [
      "/fixed-tower",
      "/specialized-training/psychological",
      "/specialized-training/rope-rescue",
      "/accessories/fitness-equipment",
    ],
  },
  {
    slug: "mine-rescue",
    icon: Mountain,
    image: "/media/tower-eastside.jpg",
    caseType: "enterprise",
    focusIcons: [Layers, Flame, Mountain, ClipboardCheck],
    recommendedHrefs: [
      "/modular-tower",
      "/specialized-training/rope-rescue",
      "/burn-rooms",
      "/accessories/hazmat",
    ],
  },
  {
    slug: "education",
    icon: GraduationCap,
    image: "/media/tower-macon.jpg",
    caseType: "school",
    focusIcons: [GraduationCap, Building2, Users, ClipboardCheck],
    recommendedHrefs: [
      "/education-center",
      "/fixed-tower/series",
      "/modular-tower",
      "/burn-rooms/fire-simulation",
    ],
  },
  {
    slug: "enterprise",
    icon: Factory,
    image: "/media/tower-chino.jpg",
    caseType: "enterprise",
    focusIcons: [Beaker, Flame, Trophy, ClipboardCheck],
    recommendedHrefs: [
      "/accessories/hazmat",
      "/burn-rooms/fire-simulation",
      "/accessories/competition",
      "/modular-tower",
    ],
  },
];

/** @deprecated 请使用 getLocalizedSolutions */
export const solutions: Solution[] = [];

export function getAllSolutionSlugs(): string[] {
  return SOLUTION_META.map((s) => s.slug);
}

/** @deprecated 请使用 getLocalizedSolution */
export function getSolutionBySlug(_slug: string): Solution | undefined {
  return undefined;
}
