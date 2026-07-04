import type { Option } from "@/components/crud/config";
import { Badge } from "@tzj/ui";

export const STATUS_OPTIONS: Option[] = [
  { label: "草稿", value: "draft" },
  { label: "已发布", value: "published" },
  { label: "已归档", value: "archived" },
];

const STATUS_MAP: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "草稿",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  published: {
    label: "已发布",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  archived: {
    label: "已归档",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? {
    label: status,
    className: "border-border bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

export const CASE_TYPE_OPTIONS: Option[] = [
  { label: "部队类", value: "military" },
  { label: "消防类", value: "fire" },
  { label: "公安类", value: "police" },
  { label: "景区类", value: "scenic" },
  { label: "学校类", value: "school" },
  { label: "企业类", value: "enterprise" },
];

export const NEWS_CATEGORY_OPTIONS: Option[] = [
  { label: "公司动态", value: "company" },
  { label: "行业资讯", value: "industry" },
  { label: "拓展知识", value: "knowledge" },
  { label: "器材知识", value: "equipment" },
];

export const BLOG_CATEGORY_OPTIONS: Option[] = [
  { label: "训练设施", value: "training_facility" },
  { label: "燃烧室技术", value: "burn_room" },
  { label: "模块化系统", value: "modular" },
  { label: "训练实践", value: "practice" },
  { label: "行业洞察", value: "industry" },
];

export const TRADE_SHOW_TYPE_OPTIONS: Option[] = [
  { label: "展览会", value: "exhibition" },
  { label: "研讨会", value: "seminar" },
  { label: "巡回活动", value: "roadshow" },
];

export function labelOf(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function joinArray(arr?: string[] | null): string {
  return (arr ?? []).join("\n");
}

export function formatDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("zh-CN");
}

export function formatDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN");
}

/** ISO 字符串 → `<input type="date">` 所需的本地日期字符串。 */
export function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 从标题生成 slug；纯中文等无拉丁字符时使用稳定短 hash。 */
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

/** ISO 字符串 → `<input type="datetime-local">` 所需的本地时间字符串。 */
export function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
