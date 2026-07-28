'use client';

import { Button } from '@tzj/ui';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { flushSync } from 'react-dom';

/**
 * 明暗模式切换：View Transition 圆形揭示波纹（从点击位置扩散），
 * 能力检测降级——不支持 startViewTransition 或用户偏好减弱动效时直接切换。
 */
export function ThemeModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof document.startViewTransition !== 'function' || prefersReducedMotion) {
      setTheme(nextTheme);
      return;
    }

    // 波纹圆心 = 点击坐标（globals.css 的 theme-reveal 关键帧读取）
    document.documentElement.style.setProperty('--theme-x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--theme-y', `${event.clientY}px`);
    document.startViewTransition(() => {
      // flushSync 让 next-themes 的类切换在过渡快照回调内同步完成
      flushSync(() => setTheme(nextTheme));
    });
  };

  return (
    <Button variant="ghost" size="icon" aria-label="切换明暗模式" onClick={handleToggle}>
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
