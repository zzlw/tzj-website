import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import NextTopLoader from 'nextjs-toploader';
import { AppToaster } from '@/components/AppToaster';
import { ActiveThemeProvider } from '@/components/theme/ActiveThemeProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { getFaviconUrl } from '@/lib/site-settings';
import '@/components/media/photo-view-overrides.css';
import './globals.css';
import './theme-presets.css';

// 拉丁字符真实加载 Inter（此前令牌声明了 Inter 但从未加载，实际渲染为系统回退字体）；
// 中文回退保持现状（--font-sans 中的 Noto Sans SC / 系统黑体）
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-latin',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const faviconUrl = await getFaviconUrl();
  return {
    title: 'TZJ Admin | 拓之迹管理后台',
    description: '拓之迹企业管理后台',
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 配色预设服务端预置：首屏直接带 theme-* 类渲染，避免水合后闪变；
  // 无 cookie 时回退品牌红（与 ActiveThemeProvider 的 DEFAULT_THEME 保持一致）；
  // 明暗模式由 next-themes 的内联脚本处理（suppressHydrationWarning 配套）
  const activeTheme = (await cookies()).get('active_theme')?.value ?? 'brand';
  return (
    <html lang="zh-CN" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* 提前拉取 Vditor 的 lute 解析引擎，避免编辑器初始化时的网络等待 */}
        <link rel="preload" as="script" href="/vditor-assets/dist/js/lute/lute.min.js" />
      </head>
      <body
        className={`bg-background text-foreground antialiased${
          activeTheme && activeTheme !== 'default' ? ` theme-${activeTheme}` : ''
        }`}
      >
        <ThemeProvider>
          <ActiveThemeProvider initialTheme={activeTheme}>
            {/* 路由切换即时反馈：顶部主题主色进度条（不显示 spinner） */}
            <NextTopLoader color="var(--primary)" showSpinner={false} height={2} />
            {children}
            <AppToaster />
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
