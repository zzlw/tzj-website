import { locales, type AppLocale } from "@/i18n/routing";
import { pageContentIdFromPath, PAGE_IDS } from "./page-ids";

/** 各路由共享、体积较小的模块（cta 已含于 blocks.json）。 */
const ALWAYS_EXTRA = ["blocks", "error", "catalog"] as const;

const PRODUCT_PATH_PREFIXES = [
  "/fixed-tower",
  "/modular-tower",
  "/burn-rooms",
  "/accessories",
  "/specialized-training",
  "/education-center",
  "/towers",
] as const;

export interface MessageLoadPlan {
  extraModules: string[];
  pageIds: string[];
}

/** 去掉 locale 前缀，得到站内路径（如 /zh-TW/why-us → /why-us）。 */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && (locales as readonly string[]).includes(segments[0] as AppLocale)) {
    segments.shift();
  }
  const path = "/" + segments.join("/");
  return path === "/" ? "/" : path.replace(/\/$/, "") || "/";
}

function isHomePath(path: string): boolean {
  return path === "/";
}

function isProductPath(path: string): boolean {
  return PRODUCT_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isContentPath(path: string): boolean {
  return (
    path === "/cases" ||
    path.startsWith("/cases/") ||
    path === "/resources" ||
    path.startsWith("/resources/blog") ||
    path.startsWith("/resources/news") ||
    path.startsWith("/resources/trade-shows")
  );
}

function isSolutionsPath(path: string): boolean {
  return path === "/solutions" || path.startsWith("/solutions/");
}

/** 根据当前路径决定加载哪些 i18n 模块（按需，非全量 pages/*）。 */
export function resolveMessageLoadPlan(pathname: string): MessageLoadPlan {
  const path = stripLocalePrefix(pathname);
  const extraModules = new Set<string>(ALWAYS_EXTRA);
  const pageIds = new Set<string>();

  if (isHomePath(path)) {
    extraModules.add("home");
    extraModules.add("content");
    extraModules.add("solutions");
  }
  if (path === "/towers") {
    extraModules.add("content");
  }
  if (path === "/search") {
    extraModules.add("solutions");
  }
  if (isProductPath(path)) extraModules.add("catalog");
  if (isContentPath(path)) extraModules.add("content");
  if (isSolutionsPath(path)) extraModules.add("solutions");

  const staticId = pageContentIdFromPath(path);
  if ((PAGE_IDS as readonly string[]).includes(staticId)) {
    pageIds.add(staticId);
  }

  if (/^\/resources\/news\/[^/]+$/.test(path)) pageIds.add("resources-news");
  if (/^\/resources\/blog\/[^/]+$/.test(path)) pageIds.add("resources-blog");
  if (/^\/solutions\/[^/]+$/.test(path)) pageIds.add("solution-detail");

  return {
    extraModules: [...extraModules],
    pageIds: [...pageIds],
  };
}
