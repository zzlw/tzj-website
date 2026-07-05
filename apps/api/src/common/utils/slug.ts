import type { PrismaService } from "../../prisma/prisma.service";

/** 从标题生成 URL slug；纯中文等无拉丁字符时使用稳定短 hash。 */
export function slugifyTitle(title: string): string {
  const latin = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (latin) return latin;
  const trimmed = title.trim();
  if (!trimmed) return "";
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return `item-${hash.toString(36)}`;
}

/** 在 internal_documents 表内确保 slug 唯一（冲突时追加 -2、-3…）。 */
export async function ensureUniqueDocumentSlug(
  prisma: PrismaService,
  base: string,
  excludeId?: string,
): Promise<string> {
  const normalized = base.trim() || `doc-${Date.now().toString(36)}`;
  let candidate = normalized.slice(0, 200);
  let suffix = 1;

  for (;;) {
    const existing = await prisma.internalDocument.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    const tail = `-${suffix}`;
    candidate = `${normalized.slice(0, Math.max(1, 200 - tail.length))}${tail}`;
  }
}
