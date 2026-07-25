import { getPage } from './api';

export type LegalPageKey = 'privacy' | 'terms';

/** 法务页 CMS 内容（后台「法务页面」按 `{key}-{locale}` slug 维护）。
 *  注：@tzj/types 的 Page.status 枚举与 API 实际存储（小写）不一致，此处用运行时形状。 */
interface LegalPageDto {
  title?: string;
  content?: string | null;
  status?: string;
  updatedAt?: string;
}

export interface LegalPageContent {
  content: string;
  updatedAt: string | null;
}

/**
 * 读取后台维护的法务页正文（Markdown）。
 * slug 约定：`privacy-zh-CN` / `terms-en` 等，每语言一条记录。
 * 未维护、未发布或接口异常时返回 null，页面回退到内置 i18n 静态文案，
 * 保证 C 端在后台无数据/API 不可用时依然可用。
 */
export async function getLegalPage(
  key: LegalPageKey,
  locale: string,
): Promise<LegalPageContent | null> {
  try {
    const res = await getPage(`${key}-${locale}`);
    const page = res.data as LegalPageDto | null;
    const content = page?.content?.trim();
    if (!content || page?.status !== 'published') return null;
    return { content, updatedAt: page.updatedAt ?? null };
  } catch {
    return null;
  }
}
