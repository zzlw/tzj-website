import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/features/chat/types';
import {
  formatBytes,
  formatDayLabel,
  formatRelative,
  formatRelativeTime,
  formatTime,
  isEmojiOnlyMessage,
  normalizeMessage,
  resolveContentType,
} from '../chat-format';
import { resolveChatI18n } from '../chat-i18n';

const NOW = new Date('2026-07-29T12:00:00Z');

describe('chat-format', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeTime', () => {
    it('小于 1 分钟显示「刚刚」', () => {
      expect(formatRelativeTime(NOW.getTime() - 30_000, 'zh-CN')).toBe('刚刚');
    });

    it('分钟 / 小时 / 天梯度', () => {
      expect(formatRelativeTime(NOW.getTime() - 5 * 60_000, 'zh-CN')).toBe('5 分钟前');
      expect(formatRelativeTime(NOW.getTime() - 3 * 3_600_000, 'zh-CN')).toBe('3 小时前');
      expect(formatRelativeTime(NOW.getTime() - 2 * 86_400_000, 'zh-CN')).toBe('2 天前');
    });

    it('英文 locale 使用英文文案', () => {
      expect(formatRelativeTime(NOW.getTime() - 5 * 60_000, 'en')).toBe('5m ago');
    });

    it('未知 locale 回退简体中文（保留原有行为）', () => {
      expect(formatRelativeTime(NOW.getTime() - 5 * 60_000, 'fr')).toBe('5 分钟前');
    });
  });

  describe('formatTime', () => {
    it('输出 HH:mm 时间', () => {
      expect(formatTime('2026-07-29T08:30:00Z', 'en')).toMatch(/\d{1,2}:\d{2}/);
    });

    it('非法时间返回空字符串', () => {
      expect(formatTime('not-a-date', 'en')).toBe('');
    });
  });

  describe('formatBytes', () => {
    it('0 / 负数 / 非数值兜底为 0 B', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(-1)).toBe('0 B');
      expect(formatBytes(Number.NaN)).toBe('0 B');
    });

    it('按 1024 进制换算并保留一位小数', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    });
  });

  describe('resolveContentType', () => {
    it('浏览器已给出可信 MIME 时直接使用', () => {
      const file = new File([''], 'a.png', { type: 'image/png' });
      expect(resolveContentType(file)).toBe('image/png');
    });

    it('octet-stream 回退到扩展名推断', () => {
      const file = new File([''], 'archive.ZIP', { type: 'application/octet-stream' });
      expect(resolveContentType(file)).toBe('application/zip');
    });

    it('未知扩展名兜底 octet-stream', () => {
      const file = new File([''], 'blob.unknown', { type: '' });
      expect(resolveContentType(file)).toBe('application/octet-stream');
    });
  });

  describe('formatDayLabel', () => {
    const t = resolveChatI18n('en');

    it('今天 / 昨天使用相对文案', () => {
      expect(formatDayLabel('2026-07-29T08:00:00Z', 'en', t)).toMatch(/^Today /);
      expect(formatDayLabel('2026-07-28T08:00:00Z', 'en', t)).toMatch(/^Yesterday /);
    });

    it('更早日期使用「月 日 + 时间」', () => {
      expect(formatDayLabel('2026-07-01T08:00:00Z', 'en', t)).toContain('Jul');
    });

    it('非法时间返回空字符串', () => {
      expect(formatDayLabel('oops', 'en', t)).toBe('');
    });
  });

  describe('formatRelative', () => {
    const t = resolveChatI18n('en');

    it('空值 / 非法时间兜底「刚刚」', () => {
      expect(formatRelative(undefined, t)).toBe(t.justNow);
      expect(formatRelative('not-a-date', t)).toBe(t.justNow);
    });

    it('支持 ISO 字符串与毫秒时间戳', () => {
      expect(formatRelative(NOW.getTime() - 10 * 60_000, t)).toBe('10m ago');
      expect(formatRelative(new Date(NOW.getTime() - 2 * 3_600_000).toISOString(), t)).toBe(
        '2h ago',
      );
    });
  });

  describe('normalizeMessage', () => {
    it('数值时间戳归一化为 ISO 字符串', () => {
      const raw = { messageId: 'm1', timestamp: NOW.getTime() } as unknown as ChatMessage;
      expect(normalizeMessage(raw).timestamp).toBe(NOW.toISOString());
    });

    it('字符串时间戳保持不变', () => {
      const iso = '2026-07-29T08:00:00.000Z';
      const raw = { messageId: 'm2', timestamp: iso } as unknown as ChatMessage;
      expect(normalizeMessage(raw).timestamp).toBe(iso);
    });
  });

  describe('isEmojiOnlyMessage', () => {
    it('1~3 个 emoji 判定为纯 emoji', () => {
      expect(isEmojiOnlyMessage('😀')).toBe(true);
      expect(isEmojiOnlyMessage('😀👍🎉')).toBe(true);
    });

    it('超过上限 / 混合文本 / 空串不放大', () => {
      expect(isEmojiOnlyMessage('😀😀😀😀')).toBe(false);
      expect(isEmojiOnlyMessage('hi 😀')).toBe(false);
      expect(isEmojiOnlyMessage('   ')).toBe(false);
    });
  });
});
