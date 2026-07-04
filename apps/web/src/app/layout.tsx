import type { ReactNode } from "react";

/** 根 layout：html/body 由 [locale]/layout 提供 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
