export declare const PRODUCT_LINE_COUNT = 13;
export type ProductFamilyId = 'towers' | 'burn' | 'specialized' | 'accessories';
export type ProductFamily = {
  id: ProductFamilyId;
  navKey: string;
  title: string;
  description: string;
};
export type ProductLine = {
  id: string;
  index: number;
  anchor: string;
  navKey: string;
  shortTitle: string;
  title: string;
  href: string;
  image: string;
  description: string;
  family: ProductFamilyId;
  subLinks?: {
    title: string;
    href: string;
    navKey?: string;
  }[];
};
export declare const PRODUCT_FAMILIES: ProductFamily[];
export declare const PRODUCT_LINES: ProductLine[];
export declare const PRODUCT_NAV_DIVIDER_BEFORE: readonly [4, 7, 12];
export declare function linesByFamily(familyId: ProductFamilyId): ProductLine[];
export declare function familyForLine(line: ProductLine): ProductFamily | undefined;
export declare const PRODUCT_LINES_BY_FAMILY: {
  family: ProductFamily;
  lines: ProductLine[];
}[];
//# sourceMappingURL=product-catalog.d.ts.map
