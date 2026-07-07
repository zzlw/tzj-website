"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  History,
  FolderInput,
  Pencil,
  Pin,
  RotateCcw,
  Lock,
  Send,
  Tag,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Separator,
  Skeleton,
  TagChip,
  cn,
} from "@tzj/ui";
import { Can } from "@/components/Can";
import { LastOperatorCell } from "@/components/LastOperatorCell";
import { MarkdownPreview } from "@/components/documents/MarkdownPreview";
import { buildDocListHref } from "@/features/documents";
import type { DocRevisionItem, InternalDocumentItem } from "@/features/types";
import { StatusBadge, formatDateTime } from "@/features/constants";

export function DocumentReadSkeleton() {
  return (
    <div className="-mx-4 space-y-6 px-4 pt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <Skeleton className="h-9 w-32" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-8 h-64 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </div>
    </div>
  );
}

export function DocumentReadView({
  doc,
  revisions,
  revisionsLoading,
  backHref = "/documents",
  restoreTarget,
  restorePending,
  onRestoreRequest,
  onRestoreCancel,
  onRestoreConfirm,
  tagFilterBase = "/documents",
  showPromote,
  onPromoteClick,
  onMoveClick,
  onPublishDraft,
  publishDraftPending = false,
}: {
  doc: InternalDocumentItem;
  revisions?: DocRevisionItem[];
  revisionsLoading: boolean;
  backHref?: string;
  restoreTarget: string | null;
  restorePending: boolean;
  onRestoreRequest: (revisionId: string) => void;
  onRestoreCancel: () => void;
  onRestoreConfirm: () => void;
  /** 标签筛选跳转基路径（如 /documents 或 /documents/mine） */
  tagFilterBase?: string;
  /** 个人文档：显示「发布到内部库」入口 */
  showPromote?: boolean;
  onPromoteClick?: () => void;
  onMoveClick?: () => void;
  onPublishDraft?: () => void;
  publishDraftPending?: boolean;
}) {
  const hasContent = Boolean(doc.content?.trim());
  const editHref = doc.ownerId
    ? `/documents/mine/${doc.id}/edit`
    : `/documents/${doc.id}/edit`;

  return (
    <>
      <div className="pb-10 -mx-4 sm:-mx-6 lg:-mx-8">
        {/* 顶栏：返回 + 上下文标题 + 操作 */}
        <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6 lg:px-8">
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href={backHref}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                返回
              </Link>
            </Button>
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
              {doc.title}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {onMoveClick ? (
                <Can anyPerm={["docs.edit"]}>
                  <Button variant="outline" size="sm" onClick={onMoveClick}>
                    <FolderInput className="mr-1.5 h-4 w-4" />
                    移动到…
                  </Button>
                </Can>
              ) : null}
              {showPromote && onPromoteClick ? (
                <Can anyPerm={["docs.publish", "docs.manage"]}>
                  <Button variant="outline" size="sm" onClick={onPromoteClick}>
                    <Lock className="mr-1.5 h-4 w-4" />
                    可见范围
                  </Button>
                </Can>
              ) : null}
              <Can anyPerm={["docs.edit"]}>
                <Button variant="default" size="sm" asChild>
                  <Link href={editHref}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    编辑
                  </Link>
                </Button>
              </Can>
            </div>
          </div>
        </div>

        <div className="grid w-full px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 lg:px-8 lg:pt-8">
          {/* 正文区 */}
          <article className="min-w-0">
            {doc.status === "draft" && !doc.ownerId ? (
              <Alert
                variant="warning"
                title="未发布 · 仅编辑者可见"
                className="mb-6"
              >
                <p className="text-muted-foreground">
                  仅有编辑权限的同事能看到此页。发布后，拥有「查看内部文档」权限的同事即可阅读。
                </p>
                {onPublishDraft ? (
                  <Can anyPerm={["docs.publish", "docs.manage"]}>
                    <Button
                      size="sm"
                      className="mt-3"
                      disabled={publishDraftPending}
                      onClick={onPublishDraft}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {publishDraftPending ? "发布中…" : "立即发布"}
                    </Button>
                  </Can>
                ) : null}
              </Alert>
            ) : null}

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={doc.status} />
              {doc.isPinned ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-200 bg-amber-50 text-amber-700"
                >
                  <Pin className="h-3 w-3" />
                  置顶
                </Badge>
              ) : null}
              {doc.folder ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <FolderOpen className="h-3 w-3 opacity-70" />
                  {doc.folder.name}
                </Badge>
              ) : null}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {doc.title}
            </h1>

            {doc.summary ? (
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                {doc.summary}
              </p>
            ) : null}

            {doc.tags?.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Tag className="mr-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {doc.tags.map((tag) => (
                  <TagChip
                    key={tag}
                    label={tag}
                    href={buildDocListHref(tagFilterBase, { tag })}
                  />
                ))}
              </div>
            ) : null}

            <Separator className="my-8" />

            {hasContent ? (
              <MarkdownPreview markdown={doc.content ?? ""} variant="article" />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">暂无正文内容</p>
                <Can anyPerm={["docs.edit"]}>
                  <Button variant="link" size="sm" asChild className="mt-2">
                    <Link href={editHref}>去编辑</Link>
                  </Button>
                </Can>
              </div>
            )}
          </article>

          {/* 侧栏元信息 */}
          <aside className="mt-8 space-y-5 lg:mt-0 lg:sticky lg:top-[4.25rem] lg:self-start">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">文档信息</CardTitle>
                <CardDescription className="text-xs">
                  阅读与发布统计
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-sm">
                <InfoRow
                  icon={Eye}
                  label="阅读次数"
                  value={String(doc.viewCount)}
                />
                <InfoRow
                  icon={Calendar}
                  label="发布时间"
                  value={formatDateTime(doc.publishedAt) || "—"}
                />
                <InfoRow
                  icon={Clock}
                  label="更新时间"
                  value={formatDateTime(doc.updatedAt)}
                />
                <Separator />
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">最后操作</span>
                  <LastOperatorCell
                    user={doc.lastOperatorUser}
                    fallback={doc.lastOperator}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <History className="h-4 w-4 text-muted-foreground" />
                  版本历史
                </CardTitle>
                <CardDescription className="text-xs">
                  保存前的内容快照
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-1">
                {revisionsLoading ? (
                  <div className="space-y-3 px-4 pb-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : !revisions?.length ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">
                    暂无历史版本
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto overscroll-y-contain px-2 pb-3">
                    <ul>
                      {revisions.map((rev, index) => (
                        <li key={rev.id} className="relative pl-4">
                          {index < revisions.length - 1 ? (
                            <span
                              className="absolute left-[7px] top-6 bottom-0 w-px bg-border"
                              aria-hidden
                            />
                          ) : null}
                          <span
                            className={cn(
                              "absolute left-1 top-2.5 h-2 w-2 rounded-full border-2 border-background",
                              index === 0 ? "bg-primary" : "bg-muted-foreground/40",
                            )}
                            aria-hidden
                          />
                          <div className="mb-1 rounded-md px-2 py-2 hover:bg-muted/60">
                            <p className="text-sm font-medium leading-snug break-words">
                              {rev.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDateTime(rev.createdAt)}
                              {rev.editor
                                ? ` · ${rev.editor.nickname?.trim() || rev.editor.username}`
                                : ""}
                            </p>
                            <Can anyPerm={["docs.edit"]}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 h-7 px-2 text-xs"
                                onClick={() => onRestoreRequest(rev.id)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                恢复此版本
                              </Button>
                            </Can>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && onRestoreCancel()}
        title="恢复历史版本"
        description="将把文档标题与正文恢复为所选版本，当前内容会先写入版本历史。确认继续？"
        confirmLabel="恢复"
        onConfirm={onRestoreConfirm}
        loading={restorePending}
      />
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
