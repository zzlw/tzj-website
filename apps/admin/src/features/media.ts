"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type ListResult } from "@/lib/apiClient";
import { BASE_PATH } from "@/lib/config";
import type { MediaAsset } from "./types";

type Params = Record<string, string | number | boolean | undefined>;

export function useMediaList(params?: Params) {
  return useQuery<ListResult<MediaAsset>>({
    queryKey: ["media", "list", params ?? {}],
    queryFn: () => api.list<MediaAsset>("media", params),
    placeholderData: (prev) => prev,
  });
}

/** 上传单个文件到媒体库（走媒体专用 BFF，multipart）。 */
export async function uploadMedia(
  file: File,
  folder = "uploads",
): Promise<MediaAsset> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);

  const res = await fetch(`${BASE_PATH}/api/media/upload`, {
    method: "POST",
    body: fd,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.success === false) {
    const raw = body?.error?.message ?? body?.message ?? `上传失败 (${res.status})`;
    throw new ApiError(
      Array.isArray(raw) ? raw[0] : raw,
      res.status,
      body?.error?.code,
      body?.error?.details,
    );
  }
  return body.data as MediaAsset;
}

export function useUploadMedia(folder = "uploads") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadMedia(file, folder),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

/** 软删除：移入回收站。 */
export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove("media", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useRestoreMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<MediaAsset>(`media/${id}/restore`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

/** 永久删除（需 media.purge）。 */
export function usePurgeMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove("media", id, { purge: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

/** 替换站点静态资源（固定 key 覆盖，需 media.replaceSite）。 */
export async function replaceSiteMedia(
  id: string,
  file: File,
): Promise<MediaAsset & { backupKey?: string }> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${BASE_PATH}/api/media/replace-site/${id}`, {
    method: "POST",
    body: fd,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.success === false) {
    const raw = body?.error?.message ?? body?.message ?? `替换失败 (${res.status})`;
    throw new ApiError(
      Array.isArray(raw) ? raw[0] : raw,
      res.status,
      body?.error?.code,
      body?.error?.details,
    );
  }
  return body.data as MediaAsset & { backupKey?: string };
}

export function useReplaceSiteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      replaceSiteMedia(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

interface MediaDeleteErrorDetails {
  usageCount?: number;
  references?: { type: string; title: string; field: string }[];
  isSiteResource?: boolean;
}

export function formatMediaDeleteError(error: unknown): string {
  if (!(error instanceof ApiError)) return "操作失败";
  if (error.code === "MEDIA_PROTECTED") {
    return "该素材为站点静态资源，无法删除";
  }
  if (error.code === "MEDIA_IN_USE") {
    const details = error.details as MediaDeleteErrorDetails | undefined;
    const count = details?.usageCount;
    if (count && count > 0) {
      return `该素材正在被 ${count} 处内容引用，请先解除引用后再删除`;
    }
    return error.message;
  }
  return error.message;
}

export function isMediaDeletable(asset: MediaAsset): boolean {
  return !asset.isProtected;
}
