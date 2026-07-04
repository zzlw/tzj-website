import type { NavNode } from "@/lib/navigation";
import { NAV_TREE } from "@/lib/navigation";
import { buildProductNavNodes } from "@/lib/navigation-products";
import { SOLUTION_META } from "@/lib/solutions";
import type { SearchResult, SearchResultGroup } from "./types";

type StaticEntry = {
  href: string;
  label: string;
  group: SearchResultGroup;
};

function solutionHref(slug: string): string {
  return `/solutions/${slug}`;
}

function groupForHref(href: string): SearchResultGroup {
  const base = href.split("#")[0]!;
  if (SOLUTION_META.some((s) => solutionHref(s.slug) === base)) {
    return "solution";
  }
  return "page";
}

function walkNav(
  nodes: NavNode[],
  labelFor: (key: string) => string,
  out: StaticEntry[],
  seen: Set<string>,
) {
  for (const node of nodes) {
    const href = node.href.split("#")[0] || node.href;
    const label = labelFor(node.key);
    if (!seen.has(href)) {
      seen.add(href);
      out.push({ href, label, group: groupForHref(href) });
    }
    if (node.children?.length) {
      walkNav(node.children, labelFor, out, seen);
    }
  }
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function matchesQuery(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

/** 从已加载的 messages 构建可搜索的静态页面索引。 */
export function buildStaticSearchEntries(
  labelFor: (key: string) => string,
  solutionNameFor: (slug: string) => string,
): StaticEntry[] {
  const seen = new Set<string>();
  const out: StaticEntry[] = [];

  walkNav(NAV_TREE, labelFor, out, seen);
  walkNav(buildProductNavNodes(), labelFor, out, seen);

  for (const meta of SOLUTION_META) {
    const href = solutionHref(meta.slug);
    if (!seen.has(href)) {
      seen.add(href);
      out.push({
        href,
        label: solutionNameFor(meta.slug),
        group: "solution",
      });
    }
  }

  return out;
}

export function searchStaticEntries(
  entries: StaticEntry[],
  query: string,
  options?: { limit?: number; minLength?: number },
): SearchResult[] {
  const q = normalizeQuery(query);
  const minLength = options?.minLength ?? 2;
  if (q.length < minLength) return [];

  const filtered = entries
    .filter((e) => matchesQuery(e.label, q) || matchesQuery(e.href, q))
    .sort((a, b) => matchRank(a.label, q) - matchRank(b.label, q) || a.label.localeCompare(b.label));

  const slice =
    options?.limit != null ? filtered.slice(0, options.limit) : filtered;
  return slice.map(toResult);
}

function matchRank(text: string, q: string): number {
  const lower = text.toLowerCase();
  if (lower.startsWith(q)) return 0;
  if (lower.includes(q)) return 1;
  return 2;
}

function toResult(e: StaticEntry): SearchResult {
  return {
    id: `static:${e.href}`,
    title: e.label,
    href: e.href,
    group: e.group,
  };
}
