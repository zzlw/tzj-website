'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * 明暗模式 Provider（next-themes）：在 <html> 上切换 .dark 类，
 * 内联脚本先于水合执行，避免刷新闪烁；配色预设由 ActiveThemeProvider 单独管理。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      {children}
    </NextThemesProvider>
  );
}
