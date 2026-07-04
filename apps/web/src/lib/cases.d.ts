export interface CaseStudy {
    slug: string;
    title: string;
    location: string;
    category: string;
    image: string;
    client: string;
    completionDate: string;
    summary: string;
    highlights: string[];
    specs: {
        label: string;
        value: string;
    }[];
}
export declare const caseStudies: CaseStudy[];
export declare function getCaseBySlug(slug: string): CaseStudy | undefined;
export declare function getAllCaseSlugs(): string[];
//# sourceMappingURL=cases.d.ts.map