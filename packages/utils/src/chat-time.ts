/**
 * 聊天时间显示工具（C 端挂件与 Admin 客服工作台共用）。
 *
 * 业内通行做法（WhatsApp / WeChat / Slack / Intercom / Zendesk）：
 * - 气泡内只显示 HH:mm，日期由「日期分隔线」承载，避免逐条重复年月；
 * - 今天 / 昨天用相对文案，今年内显示「M月D日」，跨年必须带年份；
 * - 会话列表按「今天 → 时间 / 昨天 → 昨天 / 今年 → 月日 / 跨年 → 年月日」自适应。
 */

export type ChatTimeInput = string | number | Date;

export interface ChatDayLabelOptions {
  /** 消息时间（ISO 字符串 / 毫秒时间戳 / Date） */
  ts: ChatTimeInput;
  /** 参照「当前」时间；缺省 new Date()（测试可注入） */
  now?: Date;
  /** BCP 47 locale；缺省 zh-CN */
  locale?: string;
  /** 业务时区（IANA）；缺省为运行环境本地时区 */
  timeZone?: string;
  /** 「今天」文案；缺省「今天」 */
  todayLabel?: string;
  /** 「昨天」文案；缺省「昨天」 */
  yesterdayLabel?: string;
}

export interface ChatListTimeOptions {
  /** 会话活动时间（ISO 字符串 / 毫秒时间戳 / Date） */
  ts: ChatTimeInput;
  /** 参照「当前」时间；缺省 new Date()（测试可注入） */
  now?: Date;
  /** BCP 47 locale；缺省 zh-CN */
  locale?: string;
  /** 业务时区（IANA）；缺省为运行环境本地时区 */
  timeZone?: string;
  /** 「昨天」文案；缺省「昨天」 */
  yesterdayLabel?: string;
}

function toDate(input: ChatTimeInput): Date | null {
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function partsOf(
  input: ChatTimeInput,
  timeZone?: string,
): { year: number; month: number; day: number } | null {
  const d = toDate(input);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    ...(timeZone ? { timeZone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: 'year' | 'month' | 'day') => Number(parts.find((p) => p.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

/** 把时间在指定时区（缺省本地时区）下归一为「日序号」（UTC 天数），用于同/昨/跨日比较 */
function dayNumber(input: ChatTimeInput, timeZone?: string): number | null {
  const p = partsOf(input, timeZone);
  if (!p) return null;
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

function yearOf(input: ChatTimeInput, timeZone?: string): number | null {
  return partsOf(input, timeZone)?.year ?? null;
}

/** 气泡 / 分隔线用 HH:mm */
export function formatChatTime(input: ChatTimeInput, locale = 'zh-CN', timeZone?: string): string {
  const d = toDate(input);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** 日期分隔线：今天 HH:mm / 昨天 HH:mm / 今年 M月D日 HH:mm / 跨年 YYYY年M月D日 HH:mm */
export function formatChatDayLabel({
  ts,
  now = new Date(),
  locale = 'zh-CN',
  timeZone,
  todayLabel = '今天',
  yesterdayLabel = '昨天',
}: ChatDayLabelOptions): string {
  const d = toDate(ts);
  if (!d) return '';
  const day = dayNumber(d, timeZone);
  const nowDay = dayNumber(now, timeZone);
  if (day == null || nowDay == null) return '';
  const time = formatChatTime(d, locale, timeZone);
  if (day === nowDay) return `${todayLabel} ${time}`;
  if (day === nowDay - 1) return `${yesterdayLabel} ${time}`;
  const sameYear = yearOf(d, timeZone) === yearOf(now, timeZone);
  return new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}),
    ...(sameYear ? {} : { year: 'numeric' }),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** 会话列表时间：今天 HH:mm / 昨天 / 今年 M月D日 / 跨年 YYYY/M/D */
export function formatChatListTime({
  ts,
  now = new Date(),
  locale = 'zh-CN',
  timeZone,
  yesterdayLabel = '昨天',
}: ChatListTimeOptions): string {
  const d = toDate(ts);
  if (!d) return '';
  const day = dayNumber(d, timeZone);
  const nowDay = dayNumber(now, timeZone);
  if (day == null || nowDay == null) return '';
  if (day === nowDay) return formatChatTime(d, locale, timeZone);
  if (day === nowDay - 1) return yesterdayLabel;
  const sameYear = yearOf(d, timeZone) === yearOf(now, timeZone);
  return new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}),
    // 今年内用「7月1日」；跨年用紧凑「2025/7/1」，避免窄侧栏被长日期挤占
    ...(sameYear
      ? { month: 'short' as const, day: 'numeric' as const }
      : { year: 'numeric' as const, month: 'numeric' as const, day: 'numeric' as const }),
  }).format(d);
}

/** 两条消息是否属于同一自然日（用于消息列表插入日期分隔线） */
export function isSameChatDay(a: ChatTimeInput, b: ChatTimeInput, timeZone?: string): boolean {
  const da = dayNumber(a, timeZone);
  const db = dayNumber(b, timeZone);
  return da != null && da === db;
}
