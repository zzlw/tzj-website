"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@tzj/ui";
import { DocumentMoveDialog } from "@/components/documents/DocumentMoveDialog";
import { DocumentVisibilityDialog } from "@/components/documents/DocumentVisibilityDialog";
import {
  DocumentReadSkeleton,
  DocumentReadView,
} from "@/components/documents/DocumentReadView";
import {
  useDocRevisions,
  useRestoreDocRevision,
} from "@/features/documents";
import { useProfile } from "@/features/account";
import { useOne, useUpdate } from "@/features/hooks";
import { useSession } from "@/components/session";
import type { InternalDocumentItem } from "@/features/types";
import { notifyError, notifySuccess } from "@/lib/notify";

export function DocumentReadPageContent({
  id,
  expectedScope,
}: {
  id: string;
  /** 与 URL 空间一致，用于纠正 /documents 与 /documents/mine 之间的跳转 */
  expectedScope?: "mine" | "shared";
}) {
  const router = useRouter();
  const { permissions } = useSession();
  const { data: profile } = useProfile();
  const { data: doc, isLoading, isError, error } = useOne<InternalDocumentItem>(
    "documents",
    id,
  );
  const { data: revisions, isLoading: revisionsLoading } = useDocRevisions(id);
  const restoreMut = useRestoreDocRevision(id);
  const publishMut = useUpdate<InternalDocumentItem>("documents");
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const isPersonal = Boolean(doc?.ownerId);

  useEffect(() => {
    if (!doc || !expectedScope) return;
    if (expectedScope === "mine" && !doc.ownerId) {
      router.replace(`/documents/${doc.id}`);
      return;
    }
    if (expectedScope === "shared" && doc.ownerId) {
      router.replace(`/documents/mine/${doc.id}`);
    }
  }, [doc, expectedScope, router]);

  const showPromote = useMemo(() => {
    if (!doc?.ownerId) return false;
    const canPromotePerm =
      permissions.includes("docs.publish") ||
      permissions.includes("docs.manage");
    if (!canPromotePerm) return false;
    if (permissions.includes("docs.manage")) return true;
    return profile?.id === doc.ownerId;
  }, [doc, permissions, profile?.id]);

  async function handlePublishDraft() {
    try {
      await publishMut.mutateAsync({ id: doc!.id, payload: { status: "published" } });
      notifySuccess("已发布，同事现在可以阅读");
    } catch (e) {
      notifyError(e, "发布失败");
    }
  }

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

  if (
    (expectedScope === "mine" && !isPersonal) ||
    (expectedScope === "shared" && isPersonal)
  ) {
    return <DocumentReadSkeleton />;
  }

  return (
    <>
      <DocumentReadView
        doc={doc}
        backHref={isPersonal ? "/documents/mine" : "/documents"}
        tagFilterBase={isPersonal ? "/documents/mine" : "/documents"}
        revisions={revisions}
        revisionsLoading={revisionsLoading}
        restoreTarget={restoreTarget}
        restorePending={restoreMut.isPending}
        onRestoreRequest={setRestoreTarget}
        onRestoreCancel={() => setRestoreTarget(null)}
        onRestoreConfirm={handleRestoreConfirm}
        showPromote={showPromote}
        onPromoteClick={() => setPromoteOpen(true)}
        onMoveClick={() => setMoveOpen(true)}
        onPublishDraft={
          !isPersonal && doc.status === "draft" ? handlePublishDraft : undefined
        }
        publishDraftPending={publishMut.isPending}
      />
      <DocumentMoveDialog
        documentId={doc.id}
        documentTitle={doc.title}
        currentFolderId={doc.folderId ?? doc.folder?.id}
        folderScope={isPersonal ? "mine" : "shared"}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />
      {showPromote ? (
        <DocumentVisibilityDialog
          documentId={doc.id}
          documentTitle={doc.title}
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
          onSuccess={() => {
            router.push(`/documents/${doc.id}`);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
