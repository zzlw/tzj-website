import type { useTranslations } from 'next-intl';

export type ContentOption = { label: string; value: string };

export const CASE_TYPE_VALUES = [
  'military',
  'fire',
  'police',
  'scenic',
  'school',
  'enterprise',
] as const;

export const NEWS_CATEGORY_VALUES = ['company', 'industry', 'knowledge', 'equipment'] as const;

export const BLOG_CATEGORY_VALUES = [
  'training_facility',
  'burn_room',
  'modular',
  'practice',
  'industry',
] as const;

export const TRADE_SHOW_TYPE_VALUES = ['exhibition', 'seminar', 'roadshow'] as const;

/** 后端 Prisma / API 使用的 slug 值（与 admin 一致） — 保留兼容导出 */
export const CASE_TYPE_OPTIONS: ContentOption[] = CASE_TYPE_VALUES.map((value) => ({
  value,
  label: value,
}));

export const NEWS_CATEGORY_OPTIONS: ContentOption[] = NEWS_CATEGORY_VALUES.map((value) => ({
  value,
  label: value,
}));

export const BLOG_CATEGORY_OPTIONS: ContentOption[] = BLOG_CATEGORY_VALUES.map((value) => ({
  value,
  label: value,
}));

export const TRADE_SHOW_TYPE_OPTIONS: ContentOption[] = TRADE_SHOW_TYPE_VALUES.map((value) => ({
  value,
  label: value,
}));

/** @deprecated 请使用 getCaseTypeFilter + i18n */
export const CASE_TYPE_FILTER = {
  key: 'type',
  label: 'all',
  options: CASE_TYPE_OPTIONS,
} as const;

/** @deprecated */
export const NEWS_CATEGORY_FILTER = {
  key: 'category',
  label: 'all',
  options: NEWS_CATEGORY_OPTIONS,
} as const;

/** @deprecated */
export const BLOG_CATEGORY_FILTER = {
  key: 'category',
  label: 'all',
  options: BLOG_CATEGORY_OPTIONS,
} as const;

/** @deprecated */
export const TRADE_SHOW_TYPE_FILTER = {
  key: 'eventType',
  label: 'all',
  options: TRADE_SHOW_TYPE_OPTIONS,
} as const;

type Translator = ReturnType<typeof useTranslations>;

const CASE_TYPE_ALIASES: Record<string, string> = {
  MILITARY: 'military',
  FIRE_DEPARTMENT: 'fire',
  POLICE: 'police',
  SCENIC_AREA: 'scenic',
  SCHOOL: 'school',
  ENTERPRISE: 'enterprise',
};

const NEWS_CATEGORY_ALIASES: Record<string, string> = {
  COMPANY: 'company',
  INDUSTRY: 'industry',
  TRAINING_KNOWLEDGE: 'knowledge',
  EQUIPMENT_KNOWLEDGE: 'equipment',
};

const BLOG_CATEGORY_ALIASES: Record<string, string> = {
  TRAINING_FACILITY: 'training_facility',
  BURN_ROOM: 'burn_room',
  MODULAR: 'modular',
  PRACTICE: 'practice',
  INDUSTRY: 'industry',
};

const TRADE_SHOW_TYPE_ALIASES: Record<string, string> = {
  EXHIBITION: 'exhibition',
  SEMINAR: 'seminar',
  ROADSHOW: 'roadshow',
};

function normalizeValue(value: string | null | undefined, aliases: Record<string, string>) {
  if (!value) return '';
  const trimmed = value.trim();
  return aliases[trimmed] ?? trimmed.toLowerCase();
}

export function labelOf(options: ContentOption[], value?: string | null): string {
  if (!value) return '—';
  const hit = options.find((o) => o.value === value || o.value === value.toLowerCase());
  return hit?.label ?? value;
}

function labelFromI18n(
  value: string | null | undefined,
  aliases: Record<string, string>,
  t: Translator,
  prefix: string,
): string {
  const slug = normalizeValue(value, aliases);
  if (!slug) return '—';
  try {
    return t(`${prefix}.${slug}`);
  } catch {
    return value ?? '—';
  }
}

export function caseTypeLabelI18n(value: string | null | undefined, t: Translator): string {
  return labelFromI18n(value, CASE_TYPE_ALIASES, t, 'types');
}

export function newsCategoryLabelI18n(value: string | null | undefined, t: Translator): string {
  return labelFromI18n(value, NEWS_CATEGORY_ALIASES, t, 'categories');
}

export function blogCategoryLabelI18n(value: string | null | undefined, t: Translator): string {
  return labelFromI18n(value, BLOG_CATEGORY_ALIASES, t, 'categories');
}

export function tradeShowTypeLabelI18n(value: string | null | undefined, t: Translator): string {
  return labelFromI18n(value, TRADE_SHOW_TYPE_ALIASES, t, 'types');
}

/** @deprecated 请使用 caseTypeLabelI18n */
export function caseTypeLabel(value?: string | null): string {
  if (!value) return '—';
  const slug = normalizeValue(value, CASE_TYPE_ALIASES);
  const hit = CASE_TYPE_OPTIONS.find((o) => o.value === slug);
  return hit?.label ?? value;
}

/** @deprecated */
export function newsCategoryLabel(value?: string | null): string {
  if (!value) return '—';
  const slug = normalizeValue(value, NEWS_CATEGORY_ALIASES);
  const hit = NEWS_CATEGORY_OPTIONS.find((o) => o.value === slug);
  return hit?.label ?? value;
}

/** @deprecated */
export function blogCategoryLabel(value?: string | null): string {
  if (!value) return '—';
  const slug = normalizeValue(value, BLOG_CATEGORY_ALIASES);
  const hit = BLOG_CATEGORY_OPTIONS.find((o) => o.value === slug);
  return hit?.label ?? value;
}

/** @deprecated */
export function tradeShowTypeLabel(value?: string | null): string {
  if (!value) return '—';
  const slug = normalizeValue(value, TRADE_SHOW_TYPE_ALIASES);
  const hit = TRADE_SHOW_TYPE_OPTIONS.find((o) => o.value === slug);
  return hit?.label ?? value;
}

export function formatContentDate(v?: string | Date | null, locale = 'zh-CN'): string {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
