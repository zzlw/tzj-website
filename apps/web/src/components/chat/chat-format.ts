import {
  formatChatDayLabel as sharedFormatChatDayLabel,
  formatChatTime as sharedFormatChatTime,
} from '@tzj/utils';
import { CHAT_I18N, type ChatI18n, type ChatLocaleKey } from './chat-i18n';

// normalizeMessage 已下沉到领域层（供 hooks 共用），此处 re-export 保持既有引用不变
export { normalizeMessage } from '@/features/chat/message-utils';

/** 把时间戳格式化为「刚刚 / N 分钟前 / N 小时前 / N 天前」（按当前 locale） */
export function formatRelativeTime(ts: number, locale: string): string {
  const t = CHAT_I18N[locale as ChatLocaleKey] ?? CHAT_I18N['zh-CN'];
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minutesAgo.replace('{n}', String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t.hoursAgo.replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  return t.daysAgo.replace('{n}', String(days));
}

function chatLocale(locale: string): string {
  return locale.startsWith('zh') ? 'zh-CN' : 'en';
}

export function formatTime(iso: string, locale: string): string {
  return sharedFormatChatTime(iso, chatLocale(locale));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${Number((bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1))} ${units[i]}`;
}

/** 扩展名 → MIME，与后端 ALLOWED_ATTACHMENT_TYPES 对齐。 */
const EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
};

/**
 * 解析上传文件的 MIME。浏览器对 .zip 等二进制常把 File.type 报成
 * "" 或 application/octet-stream，直接发给后端会被白名单拒绝；
 * 此时回退到扩展名推断，保证类型可信且被服务端允许。
 */
export function resolveContentType(file: File): string {
  const fromType = file.type && file.type !== 'application/octet-stream' ? file.type : '';
  if (fromType) return fromType;
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

/** "今天 HH:mm" / "昨天 HH:mm" / 今年内 "M月D日 HH:mm" / 跨年带年份 */
export function formatDayLabel(iso: string, locale: string, t: ChatI18n): string {
  return sharedFormatChatDayLabel({
    ts: iso,
    locale: chatLocale(locale),
    todayLabel: t.today,
    yesterdayLabel: t.yesterday,
  });
}

/** 气泡用相对时间："刚刚" / "X 分钟前" / "X 小时前" / "X 天前" */
export function formatRelative(iso: string | number | undefined, t: ChatI18n): string {
  if (iso == null) return t.justNow;
  const time = typeof iso === 'number' ? iso : new Date(iso).getTime();
  if (Number.isNaN(time)) return t.justNow;
  const diff = Date.now() - time;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t.justNow;
  if (min < 60) return t.minutesAgo.replace('{n}', String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return t.hoursAgo.replace('{n}', String(hr));
  return t.daysAgo.replace('{n}', String(Math.floor(hr / 24)));
}

/* 判断整条消息是否仅由 emoji 组成（用于放大渲染，最多 3 个字形） */
export function isEmojiOnlyMessage(text: string, max = 3): boolean {
  const t = text.trim();
  if (!t) return false;
  if (typeof Intl.Segmenter === 'undefined') return false;
  const clusters = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t),
    (x) => x.segment,
  );
  if (clusters.length === 0 || clusters.length > max) return false;
  return clusters.every((c) => /\p{Extended_Pictographic}/u.test(c) && !/\p{L}|\p{N}/u.test(c));
}
