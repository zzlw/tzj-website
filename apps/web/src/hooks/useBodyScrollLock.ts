'use client';

import { useEffect } from 'react';

/**
 * 锁定 body 滚动（浮层/抽屉打开期间），并处理滚动条消失导致的宽度闪动：
 * - `scrollbar-gutter: stable`（globals.css）只能稳住文档流内容；
 * - position:fixed 元素（站点头部等）不受 gutter 约束，滚动条消失瞬间仍会加宽 ~15px。
 * 因此锁定前先测量滚动条宽度写入 `--scroll-lock-gap`，并给 html 打上
 * `data-scroll-lock` 标记，由 globals.css 中的规则对 fixed 元素定向回补。
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    // 必须在隐藏滚动条之前测量（隐藏后 innerWidth 与 clientWidth 差值恒为 0）
    const gap = window.innerWidth - root.clientWidth;
    const prevOverflow = document.body.style.overflow;
    root.style.setProperty('--scroll-lock-gap', `${gap}px`);
    root.setAttribute('data-scroll-lock', '');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      root.removeAttribute('data-scroll-lock');
      root.style.removeProperty('--scroll-lock-gap');
    };
  }, [locked]);
}
