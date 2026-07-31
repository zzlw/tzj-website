import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alreadyShown, markShown, pruneEntries } from '../frequency';

/**
 * 弹窗频次判定回归（docs/activity-system-design.md §5）：
 * vitest 为 node 环境，无 Web Storage，用内存实现 stub 到 globalThis；
 * 覆盖 session/daily/once 三策略、存储不可用降级、条目上限清理。
 */

/** 最小内存版 Web Storage（仅实现 frequency.ts 用到的接口） */
class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }

  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }

  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }

  removeItem(k: string): void {
    this.map.delete(k);
  }
}

/** getItem/setItem 一律抛错，模拟隐私模式等存储不可用 */
const brokenStorage = {
  length: 0,
  key: () => null,
  getItem: () => {
    throw new Error('storage disabled');
  },
  setItem: () => {
    throw new Error('storage disabled');
  },
  removeItem: () => {},
};

let session: MemoryStorage;
let local: MemoryStorage;

beforeEach(() => {
  session = new MemoryStorage();
  local = new MemoryStorage();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', local);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const act = (frequency: 'session' | 'daily' | 'once', id = 'a1') => ({ id, frequency });

describe('alreadyShown / markShown', () => {
  it('session：markShown 前 false，之后同会话 true，且不写 localStorage', () => {
    const a = act('session');
    expect(alreadyShown(a)).toBe(false);
    markShown(a);
    expect(alreadyShown(a)).toBe(true);
    expect(local.length).toBe(0);
  });

  it('once：一经展示永久 true（跨天仍 true）', () => {
    const a = act('once');
    markShown(a);
    expect(alreadyShown(a)).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 3 * 86_400_000);
    expect(alreadyShown(a)).toBe(true);
  });

  it('daily：同一自然日 true，次日 false', () => {
    const a = act('daily');
    markShown(a);
    expect(alreadyShown(a)).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 86_400_000);
    expect(alreadyShown(a)).toBe(false);
  });

  it('不同活动 id 频次互不影响', () => {
    markShown(act('once', 'a1'));
    expect(alreadyShown(act('once', 'a2'))).toBe(false);
  });

  it('daily 遇到非 JSON 历史值视为未弹过（不抛错）', () => {
    local.setItem('tzj_popup_a1', 'legacy');
    expect(alreadyShown(act('daily'))).toBe(false);
  });

  it('存储不可用：alreadyShown 降级 false、markShown 静默不抛', () => {
    vi.stubGlobal('sessionStorage', brokenStorage);
    vi.stubGlobal('localStorage', brokenStorage);
    expect(alreadyShown(act('session'))).toBe(false);
    expect(alreadyShown(act('daily'))).toBe(false);
    expect(() => markShown(act('session'))).not.toThrow();
    expect(() => markShown(act('daily'))).not.toThrow();
  });
});

describe('pruneEntries', () => {
  it('超过 50 条时按 lastShownAt 删最旧，且不动非弹窗键', () => {
    local.setItem('other_key', 'keep');
    for (let i = 0; i < 55; i++) {
      // i 越小时间越早（补零保证字典序 == 时间序）
      const day = String(i + 1).padStart(2, '0');
      local.setItem(
        `tzj_popup_p${i}`,
        JSON.stringify({ lastShownAt: `2026-06-${day}T00:00:00.000Z` }),
      );
    }
    pruneEntries();
    expect(local.getItem('other_key')).toBe('keep');
    // 55 条弹窗记录 → 删最旧 5 条（p0~p4），保留 p5~p54
    for (let i = 0; i < 5; i++) expect(local.getItem(`tzj_popup_p${i}`)).toBeNull();
    for (let i = 5; i < 55; i++) expect(local.getItem(`tzj_popup_p${i}`)).not.toBeNull();
  });

  it('非 JSON 历史值视为最旧优先清理', () => {
    local.setItem('tzj_popup_legacy', 'not-json');
    for (let i = 0; i < 50; i++) {
      local.setItem(`tzj_popup_p${i}`, JSON.stringify({ lastShownAt: '2026-06-15T00:00:00.000Z' }));
    }
    pruneEntries();
    expect(local.getItem('tzj_popup_legacy')).toBeNull();
    expect(local.length).toBe(50);
  });

  it('未超上限时不做任何删除', () => {
    for (let i = 0; i < 10; i++) local.setItem(`tzj_popup_p${i}`, '{}');
    pruneEntries();
    expect(local.length).toBe(10);
  });
});
