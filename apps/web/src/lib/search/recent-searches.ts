const STORAGE_KEY = '_tzj_recent_searches';
const MAX_RECENT = 5;

function readAll(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function writeAll(queries: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries.slice(0, MAX_RECENT)));
  } catch {
    /* quota / private mode */
  }
}

/** 读取最近搜索词（最新在前，最多 5 条）。 */
export function getRecentSearches(): string[] {
  return readAll();
}

/** 记录一次搜索词，去重并置顶。 */
export function addRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  const next = [trimmed, ...readAll().filter((q) => q !== trimmed)].slice(0, MAX_RECENT);
  writeAll(next);
}

/** 清除全部最近搜索。 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
