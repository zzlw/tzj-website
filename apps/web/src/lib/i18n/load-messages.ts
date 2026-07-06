import type { AppLocale } from "@/i18n/routing";
import { kebabToCamelCase } from "./page-ids";
import { resolveMessageLoadPlan } from "./message-modules";

/** 核心 messages（layout / header / nav 等全局命名空间）。 */
async function loadCore(
  locale: AppLocale,
): Promise<Record<string, unknown>> {
  switch (locale) {
    case "zh-CN":
      return (await import("@/messages/zh-CN.json")).default;
    case "zh-TW":
      return (await import("@/messages/zh-TW.json")).default;
    case "en":
      return (await import("@/messages/en.json")).default;
  }
}

/**
 * 按需模块。显式枚举路径确保 bundler 可靠解析（Turbopack 对动态 import 支持有限）。
 */
async function loadModule(
  locale: AppLocale,
  name: string,
): Promise<Record<string, unknown> | null> {
  try {
    let mod;
    const key = `${locale}/${name}`;
    switch (key) {
      case "zh-CN/blocks": mod = await import("@/messages/zh-CN/blocks.json"); break;
      case "zh-CN/content": mod = await import("@/messages/zh-CN/content.json"); break;
      case "zh-CN/error": mod = await import("@/messages/zh-CN/error.json"); break;
      case "zh-CN/catalog": mod = await import("@/messages/zh-CN/catalog.json"); break;
      case "zh-CN/home": mod = await import("@/messages/zh-CN/home.json"); break;
      case "zh-CN/solutions": mod = await import("@/messages/zh-CN/solutions.json"); break;
      case "zh-TW/blocks": mod = await import("@/messages/zh-TW/blocks.json"); break;
      case "zh-TW/content": mod = await import("@/messages/zh-TW/content.json"); break;
      case "zh-TW/error": mod = await import("@/messages/zh-TW/error.json"); break;
      case "zh-TW/catalog": mod = await import("@/messages/zh-TW/catalog.json"); break;
      case "zh-TW/home": mod = await import("@/messages/zh-TW/home.json"); break;
      case "zh-TW/solutions": mod = await import("@/messages/zh-TW/solutions.json"); break;
      case "en/blocks": mod = await import("@/messages/en/blocks.json"); break;
      case "en/content": mod = await import("@/messages/en/content.json"); break;
      case "en/error": mod = await import("@/messages/en/error.json"); break;
      case "en/catalog": mod = await import("@/messages/en/catalog.json"); break;
      case "en/home": mod = await import("@/messages/en/home.json"); break;
      case "en/solutions": mod = await import("@/messages/en/solutions.json"); break;
      default: return null;
    }
    return mod.default as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function loadPageFile(
  locale: AppLocale,
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const mod = await import(`@/messages/${locale}/pages/${id}.json`);
    return mod.default as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 合并核心 messages 与当前路由所需的模块（按需加载）。 */
export async function loadMessages(
  locale: AppLocale,
  pathname = "/",
): Promise<Record<string, unknown>> {
  const core = await loadCore(locale);
  const { extraModules, pageIds } = resolveMessageLoadPlan(pathname);

  const extras = await Promise.all(
    extraModules.map((name) => loadModule(locale, name)),
  );

  const pages: Record<string, unknown> = {};
  await Promise.all(
    pageIds.map(async (id) => {
      const data = await loadPageFile(locale, id);
      if (data) pages[kebabToCamelCase(id)] = data;
    }),
  );

  return Object.assign({}, core, ...extras.filter(Boolean), { pages });
}
