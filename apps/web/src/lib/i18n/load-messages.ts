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
 * 按需模块。import 路径必须在调用点写死模板字面量，
 * 不能经函数参数透传，否则 bundler 无法建立 context。
 */
async function loadModule(
  locale: AppLocale,
  name: string,
): Promise<Record<string, unknown> | null> {
  try {
    const mod = await import(`@/messages/${locale}/${name}.json`);
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
