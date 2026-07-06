import type { SiteMediaSettings } from "@tzj/types";

export const SITE_MEDIA_SETTING_KEY = "site.media";

export const DEFAULT_SITE_MEDIA_SETTINGS: SiteMediaSettings = {
  watermark: {
    enabled: false,
    layout: "tile",
    mode: "text",
    text: "河南拓之迹",
    imageKey: undefined,
    opacity: 0.14,
    position: "bottom-right",
    scale: 0.22,
    tileSpacing: 1.5,
    tileAngle: -25,
    minWidth: 480,
    minHeight: 320,
    applyToImages: true,
    applyToVideos: false,
    applyToFolders: ["uploads", "cms"],
  },
};

export function mergeSiteMediaSettings(
  partial?: Partial<SiteMediaSettings> | null,
): SiteMediaSettings {
  if (!partial?.watermark) return DEFAULT_SITE_MEDIA_SETTINGS;
  const w = partial.watermark;
  return {
    watermark: {
      ...DEFAULT_SITE_MEDIA_SETTINGS.watermark,
      ...w,
      text: w.text?.trim() || DEFAULT_SITE_MEDIA_SETTINGS.watermark.text,
      imageKey: w.imageKey?.trim() || undefined,
      layout: w.layout ?? DEFAULT_SITE_MEDIA_SETTINGS.watermark.layout,
      tileSpacing: w.tileSpacing ?? DEFAULT_SITE_MEDIA_SETTINGS.watermark.tileSpacing,
      tileAngle: w.tileAngle ?? DEFAULT_SITE_MEDIA_SETTINGS.watermark.tileAngle,
      applyToFolders:
        w.applyToFolders?.length ? w.applyToFolders : DEFAULT_SITE_MEDIA_SETTINGS.watermark.applyToFolders,
    },
  };
}

/** 将 MediaPicker 返回的 URL 或相对路径规范为 S3 对象 key */
export function normalizeWatermarkImageKey(
  raw: string | undefined,
  publicDomain: string,
): string | undefined {
  if (!raw?.trim()) return undefined;
  let s = raw.trim();
  const base = publicDomain.replace(/\/$/, "");
  if (s.startsWith(`${base}/`)) {
    s = s.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname.replace(/^\/+/, "");
      // Strip any bucket name (first path segment) if key not at root
      if (!/^(uploads|cms)\//.test(s)) {
        const slashIdx = s.indexOf("/");
        if (slashIdx > 0) s = s.slice(slashIdx + 1);
      }
    } catch {
      return undefined;
    }
  }
  s = s.replace(/^\/+/, "");
  if (!/^(uploads|cms)\//.test(s)) return undefined;
  return s;
}
