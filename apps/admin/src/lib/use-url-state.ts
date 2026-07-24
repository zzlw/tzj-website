'use client';

import type { DataTableSort } from '@tzj/ui';
import { useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

/**
 * 单个 URL 字段的序列化规范：如何在 URL 字符串与内存值之间互转，以及默认值。
 * serialize 返回 null 表示「省略该参数」（用于默认值 / 空值，保持地址干净）。
 */
export interface UrlFieldSpec<V> {
  default: V;
  parse: (raw: string | null) => V;
  serialize: (value: V) => string | null;
}

type Specs<S> = { [K in keyof S]: UrlFieldSpec<S[K]> };

/**
 * 通用 URL-state Hook（全站后台表格筛选/搜索/分页/Tab 持久化）。
 *
 * 约定（与 DashboardShell / ChatMessenger / visitors 一致）：
 * - 挂载时从 useSearchParams() 读一次初始值，之后状态由内存维护。
 * - 写入用 window.history.replaceState：仅更新地址栏、不触发 RSC 请求
 *   （避免经 proxy 误判未登录），且不堆叠浏览器历史（后退不被污染）。
 * - 每次写入只重写「本 Hook 拥有的 key」，其余无关参数原样保留；
 *   值等于默认（或为空）时删除该 key —— 默认值不出现在 URL。
 * - 可选 prefix 用于同页多个独立表格隔离键名（如 visitors 的两个 lens）。
 */
export function useUrlState<S extends Record<string, unknown>>(
  specs: Specs<S>,
  opts?: { prefix?: string },
): [S, (patch: Partial<S>) => void] {
  const prefix = opts?.prefix ?? '';
  const searchParams = useSearchParams();

  const specsRef = useRef(specs);
  specsRef.current = specs;

  const [state, setStateRaw] = useState<S>(() => {
    const out = {} as S;
    for (const key in specs) {
      out[key] = specs[key].parse(searchParams.get(prefix + key));
    }
    return out;
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const set = useCallback(
    (patch: Partial<S>) => {
      const next = { ...stateRef.current, ...patch } as S;
      stateRef.current = next;
      setStateRaw(next);

      if (typeof window === 'undefined') return;
      const usp = new URLSearchParams(window.location.search);
      for (const key in specsRef.current) {
        const spec = specsRef.current[key];
        const serialized = spec.serialize(next[key]);
        const asDefault = spec.serialize(spec.default);
        if (serialized == null || serialized === '' || serialized === asDefault) {
          usp.delete(prefix + key);
        } else {
          usp.set(prefix + key, serialized);
        }
      }
      const qs = usp.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    },
    [prefix],
  );

  return [state, set];
}

/** 字符串字段：空串省略。 */
export function stringField(def = ''): UrlFieldSpec<string> {
  return {
    default: def,
    parse: (raw) => raw ?? def,
    serialize: (v) => (v ? v : null),
  };
}

/** 枚举字段：非法值回退默认，等于默认省略。 */
export function enumField<V extends string>(values: readonly V[], def: V): UrlFieldSpec<V> {
  return {
    default: def,
    parse: (raw) => (raw && (values as readonly string[]).includes(raw) ? (raw as V) : def),
    serialize: (v) => (v === def ? null : v),
  };
}

/** 整数字段：非法/越界回退默认，等于默认省略。 */
export function intField(def: number, opts?: { min?: number }): UrlFieldSpec<number> {
  const min = opts?.min;
  return {
    default: def,
    parse: (raw) => {
      if (raw == null) return def;
      const n = Number.parseInt(raw, 10);
      if (Number.isNaN(n)) return def;
      if (min != null && n < min) return def;
      return n;
    },
    serialize: (v) => (v === def ? null : String(v)),
  };
}

/** 布尔字段：'1' / 省略。 */
export function boolField(def = false): UrlFieldSpec<boolean> {
  return {
    default: def,
    parse: (raw) => (raw == null ? def : raw === '1'),
    serialize: (v) => (v === def ? null : v ? '1' : '0'),
  };
}

/** 排序字段：序列化为 `column:order`，解析回 DataTableSort | null。 */
export function sortField(def: DataTableSort | null): UrlFieldSpec<DataTableSort | null> {
  const ser = (v: DataTableSort | null): string | null => (v ? `${v.column}:${v.order}` : null);
  return {
    default: def,
    parse: (raw) => {
      if (!raw) return def;
      const idx = raw.lastIndexOf(':');
      if (idx <= 0) return def;
      const column = raw.slice(0, idx);
      const order = raw.slice(idx + 1);
      if (order !== 'asc' && order !== 'desc') return def;
      return { column, order };
    },
    serialize: ser,
  };
}
