import type { Metadata } from 'next';
import { AppToaster } from '@/components/AppToaster';
import { getFaviconUrl } from '@/lib/site-settings';
import '@/components/media/photo-view-overrides.css';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const faviconUrl = await getFaviconUrl();
  return {
    title: 'TZJ Admin | 拓之迹管理后台',
    description: '拓之迹企业管理后台',
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        {/* 提前拉取 Vditor 的 lute 解析引擎，避免编辑器初始化时的网络等待 */}
        <link rel="preload" as="script" href="/vditor-assets/dist/js/lute/lute.min.js" />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
