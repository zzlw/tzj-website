import type { Metadata } from "next";
import { AppToaster } from "@/components/AppToaster";
import { getFaviconUrl } from "@/lib/site-settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const faviconUrl = await getFaviconUrl();
  return {
    title: "TZJ Admin | 拓之迹管理后台",
    description: "拓之迹企业管理后台",
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-background text-foreground antialiased">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
