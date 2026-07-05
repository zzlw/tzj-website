"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentListView } from "@/components/documents/DocumentListView";
import { DocFolderSidebar } from "@/components/documents/DocFolderSidebar";
import type { DocumentsResourceConfig } from "@/features/resources/documents";

export function DocumentsHub({
  config,
  staticListParams,
  loadingLabel = "加载文档库…",
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
  const isMine = config.folderScope === "mine";

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <DocFolderSidebar
        basePath={config.basePath}
        folderScope={config.folderScope}
        manageable={isMine}
      />
      <div className="min-w-0 flex-1">
        <DocumentListView
          config={config}
          extraListParams={{ ...staticListParams, folderId, tag }}
          defaultPageSize={20}
        />
      </div>
    </div>
  );
}
