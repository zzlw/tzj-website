import { Badge } from '@tzj/ui';
import type { Option } from '@/components/crud/config';

export const STATUS_OPTIONS: Option[] = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
];

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: {
    label: '草稿',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  published: {
    label: '已发布',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  archived: {
    label: '已归档',
    className: 'border-border bg-muted text-muted-foreground',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? {
    label: status,
    className: 'border-border bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

export const CASE_TYPE_OPTIONS: Option[] = [
  { label: '部队类', value: 'military' },
  { label: '消防类', value: 'fire' },
  { label: '公安类', value: 'police' },
  { label: '景区类', value: 'scenic' },
  { label: '学校类', value: 'school' },
  { label: '企业类', value: 'enterprise' },
];

export const NEWS_CATEGORY_OPTIONS: Option[] = [
  { label: '公司动态', value: 'company' },
  { label: '行业资讯', value: 'industry' },
  { label: '拓展知识', value: 'knowledge' },
  { label: '器材知识', value: 'equipment' },
];

export const BLOG_CATEGORY_OPTIONS: Option[] = [
  { label: '训练设施', value: 'training_facility' },
  { label: '燃烧室技术', value: 'burn_room' },
  { label: '模块化系统', value: 'modular' },
  { label: '训练实践', value: 'practice' },
  { label: '行业洞察', value: 'industry' },
];

export const TRADE_SHOW_TYPE_OPTIONS: Option[] = [
  { label: '展览会', value: 'exhibition' },
  { label: '研讨会', value: 'seminar' },
  { label: '巡回活动', value: 'roadshow' },
];

// ═══════════════════════════════════════════
// 客户管理（私海 / 公海）
// ═══════════════════════════════════════════
export const CUSTOMER_TYPE_OPTIONS: Option[] = [
  { label: '消防', value: 'fire' },
  { label: '武警', value: 'armed-police' },
  { label: '军队', value: 'military' },
  { label: '景区', value: 'scenic' },
  { label: '学校', value: 'school' },
  { label: '企业', value: 'enterprise' },
  { label: '政府', value: 'government' },
  { label: '其他', value: 'other' },
];

export const CUSTOMER_SOURCE_OPTIONS: Option[] = [
  { label: '官网询盘', value: 'website' },
  // 在线客服获客：聊天控制台「转为客户线索」入口默认带此值，与表单询盘区分获客效果
  { label: '在线客服', value: 'chat' },
  { label: '展会', value: 'exhibition' },
  { label: '转介绍', value: 'referral' },
  { label: '电话开发', value: 'cold-call' },
  { label: '老客户', value: 'existing' },
  { label: '其他', value: 'other' },
];

export const CUSTOMER_LEVEL_OPTIONS: Option[] = [
  { label: 'A（重点）', value: 'A' },
  { label: 'B（普通）', value: 'B' },
  { label: 'C（潜在）', value: 'C' },
];

export const CUSTOMER_STAGE_OPTIONS: Option[] = [
  { label: '新线索', value: 'new' },
  { label: '跟进中', value: 'following' },
  { label: '有意向', value: 'intent' },
  { label: '已成交', value: 'deal' },
  { label: '已流失', value: 'lost' },
];

const STAGE_MAP: Record<string, { label: string; className: string }> = {
  new: { label: '新线索', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  following: {
    label: '跟进中',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  intent: {
    label: '有意向',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  deal: {
    label: '已成交',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  lost: { label: '已流失', className: 'border-border bg-muted text-muted-foreground' },
};

/** 跟进阶段徽章 */
export function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_MAP[stage] ?? {
    label: stage,
    className: 'border-border bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

const LEVEL_MAP: Record<string, { label: string; className: string }> = {
  A: { label: 'A', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  B: { label: 'B', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  C: { label: 'C', className: 'border-border bg-muted text-muted-foreground' },
};

/** 客户等级徽章 */
export function LevelBadge({ level }: { level: string }) {
  const s = LEVEL_MAP[level] ?? {
    label: level,
    className: 'border-border bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

export function labelOf(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function joinArray(arr?: string[] | null): string {
  return (arr ?? []).join('\n');
}

export function formatDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('zh-CN');
}

export function formatDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN');
}

/** ISO 字符串 → `<input type="date">` 所需的本地日期字符串。 */
export function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 从标题生成 slug；纯中文等无拉丁字符时使用稳定短 hash。 */
export function slugifyTitle(title: string): string {
  const latin = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (latin) return latin;
  const trimmed = title.trim();
  if (!trimmed) return '';
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return `item-${hash.toString(36)}`;
}

/** ISO 字符串 → `<input type="datetime-local">` 所需的本地时间字符串。 */
export function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
