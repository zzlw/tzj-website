import type { MarketingActivity } from './types';

/**
 * 弹窗频次判定与写回（localStorage/sessionStorage，零额外基础设施）。
 * 独立模块以便单测：非纯函数（读写 storage），web vitest 为 node 环境，
 * 测试中需 stub globalThis.sessionStorage / globalThis.localStorage。
 */

const KEY_PREFIX = 'tzj_popup_';
/** localStorage 中 tzj_popup_* 条目上限，超出删最旧 */
const MAX_ENTRIES = 50;

type FrequencyInput = Pick<MarketingActivity, 'id' | 'frequency'>;

/** 按频次策略判断是否已弹过；存储不可用视作未弹过（与 markShown 静默降级同口径） */
export function alreadyShown(a: FrequencyInput): boolean {
  const key = `${KEY_PREFIX}${a.id}`;
  try {
    if (a.frequency === 'session') return sessionStorage.getItem(key) === '1';
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    if (a.frequency === 'once') return true;
    const { lastShownAt } = JSON.parse(raw) as { lastShownAt?: string };
    // daily：同一自然日内已弹过
    return new Date(lastShownAt ?? 0).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

/** 展示时写回频次标记；隐私模式等存储不可用时静默降级（弹窗仍显示） */
export function markShown(a: FrequencyInput): void {
  const key = `${KEY_PREFIX}${a.id}`;
  try {
    if (a.frequency === 'session') {
      // sessionStorage 随会话销毁，无需清理
      sessionStorage.setItem(key, '1');
    } else {
      localStorage.setItem(key, JSON.stringify({ lastShownAt: new Date().toISOString() }));
      pruneEntries();
    }
  } catch {
    /* 静默降级 */
  }
}

/** localStorage 的 tzj_popup_* 条目按 lastShownAt 删最旧，防长期堆积 */
export function pruneEntries(): void {
  try {
    const entries: { key: string; lastShownAt: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      let lastShownAt = '';
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? '') as { lastShownAt?: string };
        lastShownAt = parsed.lastShownAt ?? '';
      } catch {
        /* 非 JSON 的历史值视为最旧 */
      }
      entries.push({ key, lastShownAt });
    }
    if (entries.length <= MAX_ENTRIES) return;
    const excess = entries
      .sort((x, y) => x.lastShownAt.localeCompare(y.lastShownAt))
      .slice(0, entries.length - MAX_ENTRIES);
    for (const e of excess) localStorage.removeItem(e.key);
  } catch {
    /* 存储不可用则跳过 */
  }
}
