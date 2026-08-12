import { describe, expect, it } from 'vitest';
import {
  formatChatDayLabel,
  formatChatListTime,
  formatChatTime,
  isSameChatDay,
} from '../chat-time.js';

const NOW = new Date('2026-07-29T12:00:00Z');

describe('formatChatTime', () => {
  it('输出 HH:mm', () => {
    expect(formatChatTime('2026-07-29T08:30:00Z', 'zh-CN', 'UTC')).toBe('08:30');
  });

  it('非法时间返回空字符串', () => {
    expect(formatChatTime('not-a-date', 'zh-CN', 'UTC')).toBe('');
  });
});

describe('formatChatDayLabel', () => {
  it('今天 / 昨天使用相对文案', () => {
    expect(formatChatDayLabel({ ts: '2026-07-29T08:00:00Z', now: NOW, timeZone: 'UTC' })).toBe(
      '今天 08:00',
    );
    expect(formatChatDayLabel({ ts: '2026-07-28T08:00:00Z', now: NOW, timeZone: 'UTC' })).toBe(
      '昨天 08:00',
    );
  });

  it('今年内更早日期显示「月日 + 时间」，不重复年份', () => {
    expect(formatChatDayLabel({ ts: '2026-07-01T08:00:00Z', now: NOW, timeZone: 'UTC' })).toBe(
      '7月1日 08:00',
    );
  });

  it('跨年消息必须带年份', () => {
    expect(formatChatDayLabel({ ts: '2025-07-01T08:00:00Z', now: NOW, timeZone: 'UTC' })).toBe(
      '2025年7月1日 08:00',
    );
    expect(
      formatChatDayLabel({
        ts: '2025-07-01T08:00:00Z',
        now: NOW,
        locale: 'en',
        timeZone: 'UTC',
      }),
    ).toContain('2025');
  });

  it('非法时间返回空字符串', () => {
    expect(formatChatDayLabel({ ts: 'oops', now: NOW, timeZone: 'UTC' })).toBe('');
  });
});

describe('formatChatListTime', () => {
  it('今天显示时间，昨天显示相对文案', () => {
    expect(formatChatListTime({ ts: '2026-07-29T08:00:00Z', now: NOW, timeZone: 'UTC' })).toBe(
      '08:00',
    );
    expect(formatChatListTime({ ts: '2026-07-28T08:00:00Z', now: NOW, timeZone: 'UTC' })).toBe(
      '昨天',
    );
  });

  it('今年内显示月日，跨年显示完整日期', () => {
    expect(formatChatListTime({ ts: '2026-07-01T08:00:00Z', now: NOW, timeZone: 'UTC' })).toBe(
      '7月1日',
    );
    expect(formatChatListTime({ ts: '2025-07-01T08:00:00Z', now: NOW, timeZone: 'UTC' })).toBe(
      '2025/7/1',
    );
  });

  it('非法时间返回空字符串', () => {
    expect(formatChatListTime({ ts: 'oops', now: NOW, timeZone: 'UTC' })).toBe('');
  });
});

describe('isSameChatDay', () => {
  it('同日为 true，跨日为 false', () => {
    expect(isSameChatDay('2026-07-29T00:30:00Z', '2026-07-29T23:30:00Z', 'UTC')).toBe(true);
    expect(isSameChatDay('2026-07-29T23:30:00Z', '2026-07-30T00:30:00Z', 'UTC')).toBe(false);
  });

  it('非法输入为 false', () => {
    expect(isSameChatDay('oops', '2026-07-29T08:00:00Z', 'UTC')).toBe(false);
  });
});
