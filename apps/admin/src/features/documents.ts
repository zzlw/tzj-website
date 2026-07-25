'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DocFolderTreeNode, DocRevisionItem, InternalDocumentItem } from '@/features/types';
import type { ListResult } from '@/lib/apiClient';
import { api } from '@/lib/apiClient';

function folderTreeKey() {
  return ['documents', 'folders', 'tree', 'mine'] as const;
}

export function useDocFolderTree() {
  return useQuery<DocFolderTreeNode[]>({
    queryKey: folderTreeKey(),
    queryFn: () => api.query<DocFolderTreeNode[]>('documents/folders/tree', { scope: 'mine' }),
  });
}

function flattenFolders(nodes: DocFolderTreeNode[], depth = 0): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const node of nodes) {
    const prefix = depth > 0 ? `${'　'.repeat(depth)}└ ` : '';
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
    () => [{ label: '未分类', value: '' }, ...flattenFolders(tree ?? [])],
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
  return ['documents', 'tags', 'mine'] as const;
}

/** 当前文档库范围内的标签统计 */
export function useDocTags() {
  return useQuery<DocTagStat[]>({
    queryKey: tagsQueryKey(),
    queryFn: () => api.query<DocTagStat[]>('documents/tags', { mine: '1' }),
  });
}

export function useCreateDocTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post('documents/tags', { name }, { mine: '1' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'tags'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useRenameDocTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { from: string; to: string }) =>
      api.put('documents/tags/rename', payload, { mine: '1' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'tags'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useMergeDocTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { from: string; to: string }) =>
      api.post('documents/tags/merge', payload, { mine: '1' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'tags'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.remove('documents/tags', encodeURIComponent(name), {
        query: { mine: '1', name },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'tags'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

/** 文档列表页 URL（文件夹 + 标签筛选） */
export function buildDocListHref(basePath: string, params?: { folder?: string; tag?: string }) {
  const sp = new URLSearchParams();
  if (params?.folder) sp.set('folder', params.folder);
  if (params?.tag) sp.set('tag', params.tag);
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function useCreatePersonalFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; parentId?: string | null }) =>
      api.post('documents/folders/personal', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'folders', 'tree'] });
    },
  });
}

export function useRemovePersonalFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove('documents/folders/personal', id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'folders', 'tree'] });
    },
  });
}

export function useRenamePersonalFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`documents/folders/personal/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'folders', 'tree'] });
    },
  });
}

/** 拖拽：重排同一父级下的个人文件夹顺序 */
export function useReorderFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { parentId?: string | null; orderedIds: string[] }) =>
      api.patch('documents/folders/personal/reorder', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'folders', 'tree'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

/** 拖拽：移动个人文件夹到新父级 */
export function useMoveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId?: string | null }) =>
      api.patch(`documents/folders/personal/${id}/move`, { parentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'folders', 'tree'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

/** 拖拽：重排某文件夹内个人文档顺序 */
export function useReorderDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { folderId?: string | null; orderedIds: string[] }) =>
      api.patch('documents/reorder', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

/** 拖拽：移动个人文档到目标文件夹并落到指定序位 */
export function useMoveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      folderId,
      sortOrder,
    }: {
      id: string;
      folderId?: string | null;
      sortOrder?: number;
    }) => api.patch(`documents/${id}/move`, { folderId, sortOrder }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'folders', 'tree'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDocRevisions(documentId: string | undefined) {
  return useQuery<DocRevisionItem[]>({
    queryKey: ['documents', documentId, 'revisions'],
    queryFn: () => api.query<DocRevisionItem[]>(`documents/${documentId}/revisions`),
    enabled: Boolean(documentId),
  });
}

/** 单个文件夹文档查询配置（与批量版共用缓存键，保证拖拽后失效一致） */
function folderDocsQueryOptions(folderId: string) {
  return {
    queryKey: ['documents', 'folderDocs', { folderId }] as const,
    queryFn: () =>
      api.list<InternalDocumentItem>('documents', {
        folderId,
        mine: '1',
        limit: 50,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
      }),
  };
}

/** 获取指定文件夹下的文档列表 */
export function useFolderDocuments(folderId: string | null) {
  return useQuery<ListResult<InternalDocumentItem>>({
    queryKey: ['documents', 'folderDocs', { folderId: folderId ?? '' }],
    queryFn: () =>
      api.list<InternalDocumentItem>('documents', {
        folderId: folderId!,
        mine: '1',
        limit: 50,
        sortBy: 'sortOrder',
        sortOrder: 'asc',
      }),
    enabled: Boolean(folderId),
  });
}

/**
 * 拖拽侧栏用：一次性获取多个可见文件夹下的文档（每个文件夹一条查询，
 * 与 useFolderDocuments 共享缓存键）。React Hook 不能在循环中调用，故用 useQueries。
 */
export function useFolderDocumentsBatch(folderIds: string[]) {
  return useQueries({
    queries: folderIds.map((folderId) => folderDocsQueryOptions(folderId)),
  });
}

export function useRestoreDocRevision(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: string) =>
      api.post(`documents/${documentId}/revisions/${revisionId}/restore`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
