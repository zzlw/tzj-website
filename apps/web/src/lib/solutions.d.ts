import type { LucideIcon } from "lucide-react";
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
    caseHref?: string;
    focusIcons: LucideIcon[];
    recommendedHrefs: string[];
};
export declare const SOLUTION_META: SolutionMeta[];
export declare const solutions: Solution[];
export declare function getAllSolutionSlugs(): string[];
export declare function getSolutionBySlug(_slug: string): Solution | undefined;
//# sourceMappingURL=solutions.d.ts.map