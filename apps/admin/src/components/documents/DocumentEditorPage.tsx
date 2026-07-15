'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { ResourceEditor } from '@/components/crud/ResourceEditor';
import { useDocFolderOptions, useDocTags } from '@/features/documents';
import type { DocumentsResourceConfig } from '@/features/resources/documents';

export function DocumentEditorPage({
  config,
  id,
}: {
  config: DocumentsResourceConfig;
  id?: string;
}) {
  const sp = useSearchParams();
  const folderFromUrl = sp.get('folder');
  const { options } = useDocFolderOptions();
  const { data: tagStats } = useDocTags();
  const tagSuggestions = useMemo(() => tagStats?.map((t) => t.tag) ?? [], [tagStats]);
  const defaultOverrides = useMemo(
    () => (!id && folderFromUrl ? { folderId: folderFromUrl } : undefined),
    [id, folderFromUrl],
  );

  return (
    <ResourceEditor
      config={config}
      id={id}
      dynamicOptions={{ folders: options }}
      tagSuggestions={tagSuggestions}
      defaultOverrides={defaultOverrides}
    />
  );
}
