/** 站点导航树 — href 固定，label 由 i18n messages 的 nav.{key} 提供 */

import { buildProductNavNodes, PRODUCTS_HREF } from './navigation-products';

export type NavNode = {
  key: string;
  href: string;
  children?: NavNode[];
};

export const NAV_TREE: NavNode[] = [
  {
    key: 'whyUs',
    href: '/why-us',
    children: [
      { key: 'whyUsStory', href: '/why-us/story' },
      { key: 'whyUsTeam', href: '/why-us/team' },
      { key: 'whyUsCertification', href: '/why-us/certification' },
      { key: 'whyUsGlobal', href: '/why-us/global' },
    ],
  },
  {
    key: 'solutions',
    href: '/solutions',
    children: [
      { key: 'solutionsFireRescue', href: '/solutions/fire-rescue' },
      { key: 'solutionsPolice', href: '/solutions/police' },
      { key: 'solutionsMilitary', href: '/solutions/military' },
      { key: 'solutionsMineRescue', href: '/solutions/mine-rescue' },
      { key: 'solutionsEducation', href: '/solutions/education' },
      { key: 'solutionsEnterprise', href: '/solutions/enterprise' },
    ],
  },
  {
    key: 'products',
    href: PRODUCTS_HREF,
    children: buildProductNavNodes(),
  },
  { key: 'cases', href: '/cases' },
  {
    key: 'resources',
    href: '/resources',
    children: [
      { key: 'resourcesHowToBuy', href: '/resources/how-to-buy' },
      { key: 'resourcesDesignCenter', href: '/resources/design-center' },
      { key: 'resourcesInspections', href: '/resources/inspections' },
      { key: 'resourcesFaqs', href: '/resources/faqs' },
      { key: 'resourcesWarranty', href: '/resources/warranty' },
    ],
  },
  {
    key: 'insights',
    href: '/resources/blog',
    children: [
      { key: 'insightsBlog', href: '/resources/blog' },
      { key: 'insightsNews', href: '/resources/news' },
      { key: 'insightsTradeShows', href: '/resources/trade-shows' },
    ],
  },
  { key: 'contact', href: '/contact' },
];

export const UTILITY_LINK_KEYS = [
  { key: 'utilityBookConsult', href: '/contact' },
  { key: 'utilityHowToBuy', href: '/resources/how-to-buy' },
  { key: 'utilityContact', href: '/contact' },
] as const;

export const FOOTER_BLOCKS = [
  {
    titleKey: 'blockProducts',
    links: [
      { key: 'productFamilyTowers', href: '/towers#family-towers' },
      { key: 'productFamilyBurn', href: '/towers#family-burn' },
      { key: 'productFamilySpecialized', href: '/towers#family-specialized' },
      { key: 'productFamilyAccessories', href: '/towers#family-accessories' },
      { key: 'productBrowseAll', href: '/towers' },
    ],
  },
  {
    titleKey: 'blockSolutions',
    links: [
      { key: 'solutionsFireRescue', href: '/solutions/fire-rescue' },
      { key: 'solutionsPolice', href: '/solutions/police' },
      { key: 'solutionsMilitary', href: '/solutions/military' },
      { key: 'solutionsMineRescue', href: '/solutions/mine-rescue' },
      { key: 'solutionsEducation', href: '/solutions/education' },
      { key: 'solutionsEnterprise', href: '/solutions/enterprise' },
    ],
  },
  {
    titleKey: 'blockResources',
    links: [
      { key: 'resourcesHowToBuy', href: '/resources/how-to-buy' },
      { key: 'resourcesDesignCenter', href: '/resources/design-center' },
      { key: 'resourcesInspections', href: '/resources/inspections' },
      { key: 'resourcesFaqs', href: '/resources/faqs' },
      { key: 'resourcesWarranty', href: '/resources/warranty' },
    ],
  },
  {
    titleKey: 'blockAbout',
    links: [
      { key: 'whyUs', href: '/why-us' },
      { key: 'cases', href: '/cases' },
      { key: 'insightsBlog', href: '/resources/blog' },
      { key: 'insightsNews', href: '/resources/news' },
      { key: 'insightsTradeShows', href: '/resources/trade-shows' },
      { key: 'contact', href: '/contact' },
    ],
  },
] as const;

export type NavItem = {
  label: string;
  href: string;
  children?: NavItem[];
};

export function buildNavItems(
  labelFor: (key: string) => string,
  nodes: NavNode[] = NAV_TREE,
): NavItem[] {
  return nodes.map((node) => ({
    label: labelFor(node.key),
    href: node.href,
    children: node.children ? buildNavItems(labelFor, node.children) : undefined,
  }));
}
