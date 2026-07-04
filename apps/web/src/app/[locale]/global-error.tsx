"use client";

import { routing, type AppLocale } from "@/i18n/routing";

const MESSAGES: Record<
  AppLocale,
  { title: string; description: string; refresh: string }
> = {
  "zh-CN": {
    title: "系统错误",
    description: "应用遇到了严重错误，请刷新页面重试。",
    refresh: "刷新页面",
  },
  "zh-TW": {
    title: "系統錯誤",
    description: "應用遇到了嚴重錯誤，請刷新頁面重試。",
    refresh: "刷新頁面",
  },
  en: {
    title: "System Error",
    description: "The application encountered a critical error. Please refresh and try again.",
    refresh: "Refresh Page",
  },
};

function detectLocale(): AppLocale {
  if (typeof window === "undefined") return routing.defaultLocale;
  const seg = window.location.pathname.split("/").filter(Boolean)[0];
  if (seg && routing.locales.includes(seg as AppLocale)) return seg as AppLocale;
  return routing.defaultLocale;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = detectLocale();
  const t = MESSAGES[locale];
  const htmlLang = locale === "en" ? "en" : locale;

  return (
    <html lang={htmlLang}>
      <body className="flex min-h-screen items-center justify-center bg-white font-sans text-neutral-900">
        <div className="max-w-md px-6 text-center">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="mt-3 text-sm text-neutral-600">{t.description}</p>
          <button
            type="button"
            onClick={() => {
              console.error(error);
              reset();
            }}
            className="mt-6 bg-[#e3000f] px-6 py-3 text-sm font-bold text-white"
          >
            {t.refresh}
          </button>
        </div>
      </body>
    </html>
  );
}
