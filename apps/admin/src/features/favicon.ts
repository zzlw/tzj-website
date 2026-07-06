"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { BASE_PATH } from "@/lib/config";

interface FaviconResult {
  key: string;
  url: string;
  size: number;
}

/** 查询当前 favicon URL（通过 BFF 代理到 Nest 公开接口） */
export function useFavicon() {
  return useQuery<{ url: string | null }>({
    queryKey: ["settings", "favicon"],
    queryFn: async () => {
      const res = await fetch(`${BASE_PATH}/api/bff/site-settings/favicon`);
      const body = await res.json().catch(() => null);
      return body?.data ?? { url: null };
    },
  });
}

/** 上传 favicon（走专用 BFF，multipart） */
export async function uploadFavicon(file: File): Promise<FaviconResult> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${BASE_PATH}/api/site-settings/favicon`, {
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
  return body.data as FaviconResult;
}

export function useUploadFavicon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFavicon(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "favicon"] }),
  });
}

/** 删除 favicon */
export function useDeleteFavicon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE_PATH}/api/site-settings/favicon`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.success === false) {
          throw new ApiError(
            body?.error?.message ?? "删除失败",
            res.status,
          );
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "favicon"] }),
  });
}
