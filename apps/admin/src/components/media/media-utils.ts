import type { MediaAsset } from '@/features/types';

export type MediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'file';

export function getMediaKind(mimeType: string, filename?: string): MediaKind {
  const lower = filename?.toLowerCase() ?? '';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  return 'file';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** 下载媒体；跨域失败时回退为新标签页打开。 */
export async function downloadMediaAsset(asset: MediaAsset) {
  try {
    const res = await fetch(asset.url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = asset.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    openInNewTab(asset.url);
  }
}

export function previewMediaAsset(
  asset: MediaAsset,
  handlers: {
    onDialog: (asset: MediaAsset) => void;
  },
) {
  const kind = getMediaKind(asset.mimeType, asset.filename);
  if (kind === 'pdf') {
    openInNewTab(asset.url);
    return;
  }
  if (kind === 'image') {
    // 由 react-photo-view 处理
    return;
  }
  handlers.onDialog(asset);
}
