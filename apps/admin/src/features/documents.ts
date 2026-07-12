"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { DocFolderTreeNode, DocRevisionItem, InternalDocumentItem } from "@/features/types";

function folderTreeKey() {
  return ["documents", "folders", "tree", "mine"] as const;
}

export function useDocFolderTree() {
  return useQuery<DocFolderTreeNode[]>({
    queryKey: folderTreeKey(),
    queryFn: () =>
      api.query<DocFolderTreeNode[]>("documents/folders/tree", { scope: "mine" }),
  });
}

function flattenFolders(
  nodes: DocFolderTreeNode[],
  depth = 0,
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const node of nodes) {
    const prefix = depth > 0 ? `${"　".repeat(depth)}└ ` : "";
    out.push({ value: node.id, label: `${prefix}${node.name}` });
    if (node.children.length) {
      out.push(...flattenFolders(node.children, depth + 1));
    }
  }
  return out;
}

/** 表单 select 用：首项为「未分类」 */
export function useDocFolderOptions() {
  const { data: tree, ...rest } = useDocFolderTree();
  const options = useMemo(
    () => [{ label: "未分类", value: "" }, ...flattenFolders(tree ?? [])],
    [tree],
  );
  return { options, tree: tree ?? [], ...rest };
}

export interface DocTagStat {
  id?: string;
  tag: string;
  slug?: string;
  count: number;
}

function tagsQueryKey() {
  return ["documents", "tags", "mine"] as const;
}

/** 当前文档库范围内的标签统计 */
export function useDocTags() {
  return useQuery<DocTagStat[]>({
    queryKey: tagsQueryKey(),
    queryFn: () =>
      api.query<DocTagStat[]>("documents/tags", { mine: "1" }),
  });
}

export function useCreateDocTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post("documents/tags", { name }, { mine: "1" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "tags"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useRenameDocTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { from: string; to: string }) =>
      api.put("documents/tags/rename", payload, { mine: "1" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "tags"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useMergeDocTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { from: string; to: string }) =>
      api.post("documents/tags/merge", payload, { mine: "1" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "tags"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.remove("documents/tags", encodeURIComponent(name), {
        query: { mine: "1", name },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "tags"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** 文档列表页 URL（文件夹 + 标签筛选） */
export function buildDocListHref(
  basePath: string,
  params?: { folder?: string; tag?: string },
) {
  const sp = new URLSearchParams();
  if (params?.folder) sp.set("folder", params.folder);
  if (params?.tag) sp.set("tag", params.tag);
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function useCreatePersonalFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; parentId?: string | null }) =>
      api.post("documents/folders/personal", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "folders", "tree"] });
    },
  });
}

export function useRemovePersonalFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove("documents/folders/personal", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "folders", "tree"] });
    },
  });
}

export function useRenamePersonalFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`documents/folders/personal/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "folders", "tree"] });
    },
  });
}

export function useDocRevisions(documentId: string | undefined) {
  return useQuery<DocRevisionItem[]>({
    queryKey: ["documents", documentId, "revisions"],
    queryFn: () =>
      api.query<DocRevisionItem[]>(`documents/${documentId}/revisions`),
    enabled: Boolean(documentId),
  });
}

export function useRestoreDocRevision(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: string) =>
      api.post(`documents/${documentId}/revisions/${revisionId}/restore`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
