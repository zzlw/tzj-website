/** 剥离 Markdown 语法，保留可读文本用于字数统计。 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[#>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 根据正文估算阅读时长（中文约 400 字/分钟，英文约 200 词/分钟）。
 * 返回与 C 端一致的「N 分钟」格式。
 */
export function estimateReadTime(
  content: string | null | undefined,
  excerpt?: string | null,
): string {
  const raw = stripMarkdown(
    [excerpt, content].filter((s) => s && String(s).trim()).join("\n"),
  );
  if (!raw) return "1 分钟";

  const cjk = (raw.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? [])
    .length;
  const latinWords = raw
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, " ")
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9]/.test(w)).length;

  const minutes = Math.max(1, Math.ceil(cjk / 400 + latinWords / 200));
  return `${minutes} 分钟`;
}
