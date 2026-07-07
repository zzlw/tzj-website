"use client";

import { useState } from "react";
import { Alert } from "@tzj/ui";
import { DocumentMoveDialog } from "@/components/documents/DocumentMoveDialog";
import {
  DocumentReadSkeleton,
  DocumentReadView,
} from "@/components/documents/DocumentReadView";
import {
  useDocRevisions,
  useRestoreDocRevision,
} from "@/features/documents";
import { useOne } from "@/features/hooks";
import type { InternalDocumentItem } from "@/features/types";
import { notifyError, notifySuccess } from "@/lib/notify";

export function DocumentReadPageContent({
  id,
}: {
  id: string;
}) {
  const { data: doc, isLoading, isError, error } = useOne<InternalDocumentItem>(
    "documents",
    id,
  );
  const { data: revisions, isLoading: revisionsLoading } = useDocRevisions(id);
  const restoreMut = useRestoreDocRevision(id);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  async function handleRestoreConfirm() {
    if (!restoreTarget) return;
    try {
      await restoreMut.mutateAsync(restoreTarget);
      setRestoreTarget(null);
      notifySuccess("已恢复到所选版本");
    } catch (e) {
      notifyError(e, "恢复失败");
    }
  }

  if (isLoading) {
    return <DocumentReadSkeleton />;
  }

  if (isError || !doc) {
    return (
      <Alert variant="destructive" icon="error">
        加载失败：{error instanceof Error ? error.message : "文档不存在"}
      </Alert>
    );
  }

  return (
    <>
      <DocumentReadView
        doc={doc}
        backHref="/documents/mine"
        tagFilterBase="/documents/mine"
        revisions={revisions}
        revisionsLoading={revisionsLoading}
        restoreTarget={restoreTarget}
        restorePending={restoreMut.isPending}
        onRestoreRequest={setRestoreTarget}
        onRestoreCancel={() => setRestoreTarget(null)}
        onRestoreConfirm={handleRestoreConfirm}
        onMoveClick={() => setMoveOpen(true)}
      />
      <DocumentMoveDialog
        documentId={doc.id}
        documentTitle={doc.title}
        currentFolderId={doc.folderId ?? doc.folder?.id}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />
    </>
  );
}
