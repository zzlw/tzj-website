import type { NavNode } from './navigation';
import {
  linesByFamily,
  PRODUCT_FAMILIES,
  PRODUCT_LINE_COUNT,
  PRODUCT_LINES_BY_FAMILY,
} from './product-catalog';

export const PRODUCTS_HREF = '/towers';

/** 从 product-catalog 生成产品中心导航树（四大板块 → 十三大产品线） */
export function buildProductNavNodes(): NavNode[] {
  return PRODUCT_FAMILIES.map((family) => ({
    key: family.navKey,
    href: `${PRODUCTS_HREF}#family-${family.id}`,
    children: linesByFamily(family.id).map((line) => ({
      key: line.navKey,
      href: line.href,
    })),
  }));
}

/** Mega Menu / 手风琴直接使用的分组数据 */
export const PRODUCT_NAV_GROUPS = PRODUCT_LINES_BY_FAMILY.map(({ family, lines }, groupIndex) => ({
  family,
  lines,
  groupIndex,
  familyHref: `${PRODUCTS_HREF}#family-${family.id}`,
}));

export { PRODUCT_LINE_COUNT };
