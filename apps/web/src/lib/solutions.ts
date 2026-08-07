import type { LucideIcon } from 'lucide-react';
import {
  Beaker,
  Brain,
  Building2,
  ClipboardCheck,
  Dumbbell,
  Factory,
  Flame,
  GraduationCap,
  Layers,
  Mountain,
  Shield,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import type { CASE_TYPE_VALUES } from './content-labels';

export type SolutionCaseType = (typeof CASE_TYPE_VALUES)[number];

/** 解决方案 → 工程案例列表（按分类筛选）。 */
export function solutionCasesHref(caseType: SolutionCaseType): string {
  return `/cases?type=${caseType}`;
}

/** /solutions hub 页专属 OG（训练基地全景） */
export const SOLUTIONS_HUB_OG = '/media/solution/hub-og.webp';

function solutionMedia(slug: string) {
  return {
    /** hub 卡片图（16:10） */
    image: `/media/solution/${slug}-card.webp`,
    heroImage: `/media/solution/${slug}-hero.webp`,
    ogImage: `/media/solution/${slug}-og.webp`,
    detailImages: [
      `/media/solution/${slug}-detail-1.webp`,
      `/media/solution/${slug}-detail-2.webp`,
    ],
  };
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
  /** hub 卡片图（16:10） */
  image: string;
  /** 详情 hero（16:9） */
  heroImage: string;
  /** 社交分享 OG（1200×630） */
  ogImage: string;
  /** 详情页场景/结构配图（4:3） */
  detailImages: string[];
  tagline: string;
  intro: string[];
  focus: SolutionFocus[];
  recommended: SolutionConfig[];
  programs: string[];
  caseType?: SolutionCaseType;
  caseHref?: string;
}

export type SolutionMeta = {
  slug: string;
  icon: LucideIcon;
  /** hub 卡片图（16:10） */
  image: string;
  /** 详情 hero（16:9） */
  heroImage: string;
  /** 社交分享 OG（1200×630） */
  ogImage: string;
  /** 详情页场景/结构配图（4:3） */
  detailImages: string[];
  /** 对应工程案例分类（`/cases?type=…`） */
  caseType?: SolutionCaseType;
  focusIcons: LucideIcon[];
  recommendedHrefs: string[];
};

export const SOLUTION_META: SolutionMeta[] = [
  {
    slug: 'fire-rescue',
    icon: Flame,
    ...solutionMedia('fire-rescue'),
    caseType: 'fire',
    focusIcons: [Flame, Building2, Beaker, ClipboardCheck],
    recommendedHrefs: ['/fixed-tower', '/burn-rooms', '/burn-rooms/cfbt', '/accessories/hazmat'],
  },
  {
    slug: 'police',
    icon: Shield,
    ...solutionMedia('police'),
    caseType: 'police',
    focusIcons: [Building2, Target, Shield, Users],
    recommendedHrefs: [
      '/fixed-tower/climbing-tower',
      '/accessories/tactical',
      '/fixed-tower/custom',
      '/accessories/fitness-equipment',
    ],
  },
  {
    slug: 'military',
    icon: Target,
    ...solutionMedia('military'),
    caseType: 'military',
    focusIcons: [Dumbbell, Brain, Mountain, Layers],
    recommendedHrefs: [
      '/fixed-tower',
      '/specialized-training/psychological',
      '/specialized-training/rope-rescue',
      '/accessories/fitness-equipment',
    ],
  },
  {
    slug: 'mine-rescue',
    icon: Mountain,
    ...solutionMedia('mine-rescue'),
    caseType: 'enterprise',
    focusIcons: [Layers, Flame, Mountain, ClipboardCheck],
    recommendedHrefs: [
      '/modular-tower',
      '/specialized-training/rope-rescue',
      '/burn-rooms',
      '/accessories/hazmat',
    ],
  },
  {
    slug: 'education',
    icon: GraduationCap,
    ...solutionMedia('education'),
    caseType: 'school',
    focusIcons: [GraduationCap, Building2, Users, ClipboardCheck],
    recommendedHrefs: [
      '/education-center',
      '/fixed-tower/series',
      '/modular-tower',
      '/burn-rooms/fire-simulation',
    ],
  },
  {
    slug: 'enterprise',
    icon: Factory,
    ...solutionMedia('enterprise'),
    caseType: 'enterprise',
    focusIcons: [Beaker, Flame, Trophy, ClipboardCheck],
    recommendedHrefs: [
      '/accessories/hazmat',
      '/burn-rooms/fire-simulation',
      '/accessories/competition',
      '/modular-tower',
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
