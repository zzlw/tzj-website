'use client';

import { useEffect, useState } from 'react';

/**
 * 防抖取值：输入 value 在 delay 内持续变化时不落地，停止变化后才更新返回值。
 * 用于搜索框等「击键即请求」场景，避免每次输入都打后端。
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
