'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SiteMediaSettings, WatermarkLayout, WatermarkPosition } from '@tzj/types';
import { api } from '@/lib/apiClient';

export const WATERMARK_LAYOUT_LABELS: Record<WatermarkLayout, string> = {
  corner: '角标（品牌标识）',
  tile: '平铺斜纹（防盗图）',
  center: '居中样片',
};

export const WATERMARK_POSITION_LABELS: Record<WatermarkPosition, string> = {
  'top-left': '左上',
  'top-right': '右上',
  'bottom-left': '左下',
  'bottom-right': '右下',
  center: '居中',
};

export function useSiteMediaSettings() {
  return useQuery({
    queryKey: ['settings', 'site', 'media'],
    queryFn: () => api.query<SiteMediaSettings>('settings/site/media'),
  });
}

export function useUpdateSiteMediaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SiteMediaSettings) =>
      api.put<SiteMediaSettings>('settings/site/media', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'site', 'media'] }),
  });
}

/** MediaPicker URL → 存储 key（与 API normalizeWatermarkImageKey 对齐）
 *  兼容不同环境的 bucket 名（tzj-uploads-dev / tzj-static 等） */
export function watermarkImageKeyFromUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  let s = url.trim();
  const base =
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN?.replace(/\/$/, '') ??
    'http://localhost:9000/tzj-uploads-dev';
  if (s.startsWith(`${base}/`)) {
    s = s.slice(base.length + 1);
  } else if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname.replace(/^\/+/, '');
      // Strip any bucket name (first path segment) if key not at root
      if (!/^(uploads|cms)\//.test(s)) {
        const slashIdx = s.indexOf('/');
        if (slashIdx > 0) s = s.slice(slashIdx + 1);
      }
    } catch {
      return undefined;
    }
  }
  s = s.replace(/^\/+/, '');
  return /^(uploads|cms)\//.test(s) ? s : undefined;
}

export function watermarkImageUrlFromKey(key: string | undefined): string {
  if (!key?.trim()) return '';
  const base =
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN?.replace(/\/$/, '') ??
    'http://localhost:9000/tzj-uploads-dev';
  return `${base}/${key.replace(/^\/+/, '')}`;
}
