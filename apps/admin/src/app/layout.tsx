import type { Metadata } from "next";
import { AppToaster } from "@/components/AppToaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "TZJ Admin | 拓之迹管理后台",
  description: "拓之迹企业管理后台",
};

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
