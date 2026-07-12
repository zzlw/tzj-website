"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@tzj/ui";
import { Can } from "@/components/Can";
import {
  useCreatePersonalFolder,
  useDocFolderTree,
  useFolderDocuments,
  useRemovePersonalFolder,
  useRenamePersonalFolder,
} from "@/features/documents";
import type { DocFolderTreeNode, InternalDocumentItem } from "@/features/types";
import { notifyError, notifySuccess } from "@/lib/notify";

/** 每层缩进 px；超过 MAX_VISUAL_DEPTH 后不再增加（防止深层树挤爆侧栏） */
const INDENT_PX = 14;
const MAX_VISUAL_DEPTH = 6;

function visualDepth(depth: number) {
  return Math.min(depth, MAX_VISUAL_DEPTH);
}

function collectAncestorIds(
  nodes: DocFolderTreeNode[],
  targetId: string,
): Set<string> {
  const result = new Set<string>();
  function walk(list: DocFolderTreeNode[], ancestors: string[]): boolean {
    for (const node of list) {
      if (node.id === targetId) {
        ancestors.forEach((id) => result.add(id));
        return true;
      }
      if (node.children.length > 0 && walk(node.children, [...ancestors, node.id])) {
        return true;
      }
    }
    return false;
  }
  walk(nodes, []);
  return result;
}

function FolderNavItem({
  href,
  label,
  active,
  icon: Icon,
  depth = 0,
  /** 与文件夹树行对齐（预留 chevron 占位） */
  alignWithTree = false,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: typeof Folder;
  depth?: number;
  alignWithTree?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0" style={{ paddingLeft: 8 + visualDepth(depth) * INDENT_PX }}>
      <Link
        href={href}
        className={cn(
          "flex h-8 w-full items-center rounded-md pr-2 text-sm transition-colors",
          active
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {alignWithTree ? (
          <span className="w-5 shrink-0" aria-hidden />
        ) : null}
        <Icon className="h-4 w-4 shrink-0 opacity-70" />
        <span className="min-w-0 truncate pl-1.5" title={label}>
          {label}
        </span>
      </Link>
    </div>
  );
}

function FolderTreeNode({
  node,
  depth,
  activeId,
  basePath,
  manageable,
  expandedIds,
  onToggle,
  onAddChild,
  onRename,
  onDelete,
}: {
  node: DocFolderTreeNode;
  depth: number;
  activeId: string | null;
  basePath: string;
  manageable: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onRename: (folder: DocFolderTreeNode) => void;
  onDelete: (folder: DocFolderTreeNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const active = activeId === node.id;
  const Icon = active ? FolderOpen : Folder;

  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const anyPopoverOpen = createOpen || moreOpen;

  const { data: docsData } = useFolderDocuments(node.id);
  const folderDocs = docsData?.data ?? [];
  const hasDocs = folderDocs.length > 0;
  const expandable = hasChildren || hasDocs;
  const showChildren = expanded && expandable;

  return (
    <li>
      <div
        className={cn(
          "group relative rounded-md",
          !active && cn(
            "hover:bg-muted group-focus-within:bg-muted",
            anyPopoverOpen && "bg-muted",
          ),
        )}
        style={{ paddingLeft: 8 + visualDepth(depth) * INDENT_PX }}
      >
        <div
          className={cn(
            "flex h-8 items-center pr-1",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          <button
            type="button"
            aria-label={expanded ? "收起" : "展开"}
            className={cn(
              "flex h-6 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-background/60",
              !expandable && "invisible",
            )}
            onClick={() => expandable && onToggle(node.id)}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`${basePath}?folder=${node.id}`}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-1.5 pr-12 text-sm",
                  active && "font-medium",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", (active || anyPopoverOpen) ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
                <span className="truncate">{node.name}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{node.name}</TooltipContent>
          </Tooltip>
        </div>

        {manageable ? (
          <Can anyPerm={["docs.create"]}>
            <div className={cn(
              "absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-muted/95 shadow-sm transition-opacity",
              anyPopoverOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            )}>
              {/* "+" 创建菜单 */}
              <Popover open={createOpen} onOpenChange={setCreateOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                    title="创建"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-36 p-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                    onClick={() => onAddChild(node.id)}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span>创建文件夹</span>
                  </button>
                  <Link
                    href={`${basePath}/new?folder=${node.id}`}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                  >
                    <FilePlus className="h-3.5 w-3.5" />
                    <span>创建文章</span>
                  </Link>
                </PopoverContent>
              </Popover>

              {/* "..." 管理菜单 */}
              <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                    title="更多操作"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-32 p-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                    onClick={() => onRename(node)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>重命名</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(node)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>删除</span>
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </Can>
        ) : null}
      </div>

      {showChildren ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              basePath={basePath}
              manageable={manageable}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
          {folderDocs.map((doc: InternalDocumentItem) => (
            <li key={doc.id}>
              <Link
                href={`${basePath}/${doc.id}`}
                className="flex h-7 items-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                style={{ paddingLeft: 8 + visualDepth(depth + 1) * INDENT_PX }}
              >
                <span className="w-5 shrink-0" aria-hidden />
                <FileText className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{doc.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function FolderTree({
  nodes,
  activeId,
  basePath,
  manageable,
  expandedIds,
  onToggle,
  onAddChild,
  onRename,
  onDelete,
}: {
  nodes: DocFolderTreeNode[];
  activeId: string | null;
  basePath: string;
  manageable: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onRename: (folder: DocFolderTreeNode) => void;
  onDelete: (folder: DocFolderTreeNode) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <FolderTreeNode
          key={node.id}
          node={node}
          depth={0}
          activeId={activeId}
          basePath={basePath}
          manageable={manageable}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onAddChild={onAddChild}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

export function DocFolderSidebar({
  basePath = "/documents",
}: {
  basePath?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const folderParam = sp.get("folder");
  const { data: tree, isLoading } = useDocFolderTree();
  const createMut = useCreatePersonalFolder();
  const removeMut = useRemovePersonalFolder();
  const renameMut = useRenamePersonalFolder();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocFolderTreeNode | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocFolderTreeNode | null>(null);
  const [renameName, setRenameName] = useState("");

  const activeId =
    folderParam && folderParam !== "__none__" ? folderParam : null;
  const isAll = !folderParam;
  const isUncategorized = folderParam === "__none__";

  const ancestorIds = useMemo(
    () => (activeId && tree ? collectAncestorIds(tree, activeId) : new Set<string>()),
    [activeId, tree],
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (ancestorIds.size > 0) {
      setExpandedIds((prev) => new Set([...prev, ...ancestorIds]));
    }
  }, [ancestorIds]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate(parentId: string | null = null) {
    setCreateParentId(parentId);
    setCreateName("");
    setCreateOpen(true);
  }

  async function handleCreateConfirm() {
    const name = createName.trim();
    if (!name) return;
    try {
      await createMut.mutateAsync({ name, parentId: createParentId });
      if (createParentId) {
        setExpandedIds((prev) => new Set([...prev, createParentId]));
      }
      setCreateOpen(false);
      setCreateName("");
      notifySuccess("文件夹已创建");
    } catch (e) {
      notifyError(e, "创建失败");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await removeMut.mutateAsync(deleteTarget.id);
      if (activeId === deleteTarget.id) {
        router.replace(basePath);
      }
      setDeleteTarget(null);
      notifySuccess("文件夹已删除");
    } catch (e) {
      notifyError(e, "删除失败");
    }
  }

  function openRename(folder: DocFolderTreeNode) {
    setRenameTarget(folder);
    setRenameName(folder.name);
  }

  async function handleRenameConfirm() {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    try {
      await renameMut.mutateAsync({ id: renameTarget.id, name });
      setRenameTarget(null);
      notifySuccess("文件夹已重命名");
    } catch (e) {
      notifyError(e, "重命名失败");
    }
  }

  return (
    <TooltipProvider delayDuration={400}>
      <Card className="w-60 shrink-0 self-start overflow-hidden border-border/80 py-0 shadow-sm">
        <CardHeader className="border-b border-border/60 px-3 py-3">
          <CardTitle className="text-sm font-medium">文件夹</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[min(70vh,560px)] space-y-0.5 overflow-y-auto overflow-x-hidden p-2">
          <div className="group/all-docs relative flex items-center">
            <FolderNavItem
              href={basePath}
              label="全部文档"
              active={isAll}
              icon={FolderOpen}
            />
            <Can anyPerm={["docs.create"]}>
              <button
                type="button"
                className="absolute right-1 flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/all-docs:opacity-100"
                title="新建文件夹"
                onClick={() => openCreate(null)}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </Can>
          </div>
          {isLoading ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">加载中…</p>
          ) : tree?.length ? (
            <FolderTree
              nodes={tree}
              activeId={activeId}
              basePath={basePath}
              manageable
              expandedIds={expandedIds}
              onToggle={toggleExpanded}
              onAddChild={(parentId) => openCreate(parentId)}
              onRename={openRename}
              onDelete={setDeleteTarget}
            />
          ) : (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              暂无个人文件夹，点击 + 创建
            </p>
          )}
          <div className="my-1 border-t border-border/60 pt-1">
            <FolderNavItem
              href={`${basePath}?folder=__none__`}
              label="未分类"
              active={isUncategorized}
              icon={Inbox}
              alignWithTree
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createParentId ? "新建子文件夹" : "新建文件夹"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="folder-name">名称</Label>
            <Input
              id="folder-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="输入文件夹名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateConfirm();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => void handleCreateConfirm()}
              disabled={!createName.trim() || createMut.isPending}
            >
              {createMut.isPending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名文件夹</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-folder-name">名称</Label>
            <Input
              id="rename-folder-name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="输入新名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRenameConfirm();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => void handleRenameConfirm()}
              disabled={!renameName.trim() || renameName.trim() === renameTarget?.name || renameMut.isPending}
            >
              {renameMut.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除文件夹"
        description={
          deleteTarget
            ? `确认删除「${deleteTarget.name}」？子文件夹将一并删除，其中的文档将移至未分类。`
            : undefined
        }
        confirmLabel="删除"
        onConfirm={handleDeleteConfirm}
        loading={removeMut.isPending}
      />
    </TooltipProvider>
  );
}
