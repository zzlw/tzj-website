"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { DocFolderTreeNode, DocRevisionItem, InternalDocumentItem } from "@/features/types";

export type DocFolderScope = "shared" | "mine";

export type DocListStatusFilter = "published" | "draft" | "all";

/** 是否可查看组织文档草稿（与 API canSeeDrafts 一致） */
export function canSeeDocDrafts(permissions: readonly string[]): boolean {
  return (
    permissions.includes("docs.edit") ||
    permissions.includes("docs.create") ||
    permissions.includes("docs.manage")
  );
}

function folderTreeKey(scope: DocFolderScope) {
  return ["documents", "folders", "tree", scope] as const;
}

export function useDocFolderTree(scope: DocFolderScope = "shared") {
  return useQuery<DocFolderTreeNode[]>({
    queryKey: folderTreeKey(scope),
    queryFn: () =>
      api.query<DocFolderTreeNode[]>("documents/folders/tree", { scope }),
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
export function useDocFolderOptions(scope: DocFolderScope = "shared") {
  const { data: tree, ...rest } = useDocFolderTree(scope);
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

function tagsQueryKey(scope: DocFolderScope) {
  return ["documents", "tags", scope] as const;
}

function tagsMineParam(scope: DocFolderScope) {
  return scope === "mine" ? { mine: "1" } : undefined;
}

/** 当前文档库范围内的标签统计 */
export function useDocTags(scope: DocFolderScope = "shared") {
  return useQuery<DocTagStat[]>({
    queryKey: tagsQueryKey(scope),
    queryFn: () =>
      api.query<DocTagStat[]>("documents/tags", tagsMineParam(scope)),
  });
}

export function useCreateDocTag(scope: DocFolderScope = "shared") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post("documents/tags", { name }, tagsMineParam(scope)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "tags"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useRenameDocTag(scope: DocFolderScope = "shared") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { from: string; to: string }) =>
      api.put("documents/tags/rename", payload, tagsMineParam(scope)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "tags"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useMergeDocTags(scope: DocFolderScope = "shared") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { from: string; to: string }) =>
      api.post("documents/tags/merge", payload, tagsMineParam(scope)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "tags"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocTag(scope: DocFolderScope = "shared") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.remove("documents/tags", encodeURIComponent(name), {
        query: tagsMineParam(scope)
          ? { mine: "1", name }
          : { name },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", "tags"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** 文档列表页 URL（文件夹 + 标签 + 状态筛选） */
export function buildDocListHref(
  basePath: string,
  params?: { folder?: string; tag?: string; status?: DocListStatusFilter },
) {
  const sp = new URLSearchParams();
  if (params?.folder) sp.set("folder", params.folder);
  if (params?.tag) sp.set("tag", params.tag);
  if (params?.status && params.status !== "published") {
    sp.set("status", params.status);
  }
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

export function usePromoteDocument(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { folderId?: string | null; publish?: boolean }) =>
      api.post<InternalDocumentItem>(`documents/${documentId}/promote`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
