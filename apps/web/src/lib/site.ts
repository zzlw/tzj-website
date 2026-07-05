/**
 * 站点级常量 — 联系方式、公司信息等单一来源
 * 可通过环境变量覆盖，便于不同环境部署。
 */
import { PRODUCT_LINE_COUNT } from "./product-catalog";

export const siteConfig = {
  name: "拓之迹",
  legalName: "河南拓之迹实业有限公司",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.tzjii.com",
  description:
    `河南拓之迹实业有限公司 — 16年深耕应急救援训练装备，1000+训练基地案例，${PRODUCT_LINE_COUNT}大产品线，为消防、部队、公安、矿山、院校、景区提供专业训练设施解决方案。`,
  keywords: [
    "应急救援",
    "训练装备",
    "消防训练",
    "训练塔",
    "绳索救援",
    "CFBT",
    "拓展训练",
  ],
  contact: {
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "0371-58691119",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "REDACTED-EMAIL",
    address:
      process.env.NEXT_PUBLIC_CONTACT_ADDRESS ||
      "河南省郑州市高新技术开发区科学大道",
  },
  beian: process.env.NEXT_PUBLIC_BEIAN || "豫ICP备XXXXXXXX号",
  social: {
    logo: "/og-default.jpg",
  },
} as const;

export type SiteConfig = typeof siteConfig;
