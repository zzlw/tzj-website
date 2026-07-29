'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/** 配色预设定义（与 theme-presets.css 的 .theme-* 类一一对应；default 为 :root 默认值，无类名） */
export const THEME_PRESETS = [
  { value: 'default', label: '默认' },
  { value: 'brand', label: '品牌红' },
  { value: 'blue', label: '蓝' },
  { value: 'green', label: '绿' },
  { value: 'amber', label: '琥珀' },
  { value: 'violet', label: '紫罗兰' },
  { value: 'rose', label: '玫红' },
  { value: 'teal', label: '青' },
  { value: 'orange', label: '橙' },
  { value: 'mono', label: '单色' },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number]['value'];

const COOKIE_NAME = 'active_theme';
// 默认品牌红：无 cookie（首次访问/清除后）落到 theme-brand；用户仍可显式切回「默认」（zinc）
const DEFAULT_THEME: ThemePreset = 'brand';

function isThemePreset(value: string): value is ThemePreset {
  return THEME_PRESETS.some((preset) => preset.value === value);
}

function setThemeCookie(theme: ThemePreset) {
  if (typeof window === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

interface ActiveThemeContextValue {
  activeTheme: ThemePreset;
  setActiveTheme: (theme: ThemePreset) => void;
}

const ActiveThemeContext = createContext<ActiveThemeContextValue | undefined>(undefined);

/**
 * 配色预设 Provider：预设经 cookie 持久化（active_theme），
 * 服务端在根 layout 读取 cookie 并预置 <body> 类名，客户端切换时同步 body 类与 cookie。
 */
export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: string;
}) {
  const [activeTheme, setActiveTheme] = useState<ThemePreset>(() =>
    initialTheme && isThemePreset(initialTheme) ? initialTheme : DEFAULT_THEME,
  );

  useEffect(() => {
    setThemeCookie(activeTheme);
    for (const className of Array.from(document.body.classList)) {
      if (className.startsWith('theme-')) document.body.classList.remove(className);
    }
    if (activeTheme !== 'default') document.body.classList.add(`theme-${activeTheme}`);
  }, [activeTheme]);

  return (
    <ActiveThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      {children}
    </ActiveThemeContext.Provider>
  );
}

export function useActiveTheme() {
  const context = useContext(ActiveThemeContext);
  if (!context) throw new Error('useActiveTheme 必须在 ActiveThemeProvider 内使用');
  return context;
}
