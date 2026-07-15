'use client';

import { useEffect, useRef, useState } from 'react';

type Options = {
  /** 开始隐藏前至少滚动的距离 */
  minScroll?: number;
  /** 判定方向的滚动增量阈值 */
  delta?: number;
  /** 为 true 时强制显示（如菜单打开） */
  disabled?: boolean;
};

/**
 * Rosenbauer 式滚动行为：向下隐藏顶栏，向上显示，顶部区域始终可见。
 */
export function useScrollHeaderHide({ minScroll = 72, delta = 8, disabled = false }: Options = {}) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      setScrolled(y > 20);

      if (disabled || y <= minScroll) {
        setHidden(false);
      } else if (y - lastY.current > delta) {
        setHidden(true);
      } else if (lastY.current - y > delta) {
        setHidden(false);
      }

      lastY.current = y;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    lastY.current = window.scrollY;
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [disabled, minScroll, delta]);

  useEffect(() => {
    const root = document.documentElement;
    if (hidden && !disabled) {
      root.dataset.headerHidden = '';
    } else {
      delete root.dataset.headerHidden;
    }
    return () => {
      delete root.dataset.headerHidden;
    };
  }, [hidden, disabled]);

  return { hidden: hidden && !disabled, scrolled };
}
