"use client";

import { useMemo } from "react";
import { ResourceEditor } from "@/components/crud/ResourceEditor";
import { useDocFolderOptions, useDocTags } from "@/features/documents";
import type { DocumentsResourceConfig } from "@/features/resources/documents";

export function DocumentEditorPage({
  config,
  id,
}: {
  config: DocumentsResourceConfig;
  id?: string;
}) {
  const { options } = useDocFolderOptions(config.folderScope);
  const { data: tagStats } = useDocTags(config.folderScope);
  const tagSuggestions = useMemo(
    () => tagStats?.map((t) => t.tag) ?? [],
    [tagStats],
  );

  return (
    <ResourceEditor
      config={config}
      id={id}
      dynamicOptions={{ folders: options }}
      tagSuggestions={tagSuggestions}
    />
  );
}
