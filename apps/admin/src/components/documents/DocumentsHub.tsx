"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentListView } from "@/components/documents/DocumentListView";
import { DocFolderSidebar } from "@/components/documents/DocFolderSidebar";
import { useDocFolderTree } from "@/features/documents";
import type { DocFolderTreeNode } from "@/features/types";
import type { DocumentsResourceConfig } from "@/features/resources/documents";

function findNodeById(
  nodes: DocFolderTreeNode[],
  id: string,
): DocFolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function DocumentsHub({
  config,
  staticListParams,
  loadingLabel = "加载文档…",
}: {
  config: DocumentsResourceConfig;
  /** 固定列表参数（如 mine=1） */
  staticListParams?: Record<string, string>;
  loadingLabel?: string;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">{loadingLabel}</div>}>
      <DocumentsHubContent config={config} staticListParams={staticListParams} />
    </Suspense>
  );
}

function DocumentsHubContent({
  config,
  staticListParams,
}: {
  config: DocumentsResourceConfig;
  staticListParams?: Record<string, string>;
}) {
  const sp = useSearchParams();
  const folderId = sp.get("folder") ?? undefined;
  const tag = sp.get("tag") ?? undefined;

  const { data: tree } = useDocFolderTree();
  const subFolders = useMemo(() => {
    if (!tree || !folderId || folderId === "__none__") return [];
    const node = findNodeById(tree, folderId);
    return node?.children ?? [];
  }, [tree, folderId]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <DocFolderSidebar basePath={config.basePath} />
      <div className="min-w-0 flex-1">
        <DocumentListView
          config={config}
          extraListParams={{ ...staticListParams, folderId, tag }}
          defaultPageSize={20}
          subFolders={subFolders}
        />
      </div>
    </div>
  );
}
