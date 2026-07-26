'use client';

import {
  collectDescendantIds,
  type FlatNode,
  type RenderItemArgs,
  SortableTree,
  type SortableTreeMoveEvent,
} from '@tzj/dnd';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  cn,
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
} from '@tzj/ui';
import {
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  type ButtonHTMLAttributes,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Can } from '@/components/Can';
import {
  useCreatePersonalFolder,
  useDocFolderTree,
  useFolderDocumentsBatch,
  useMoveDocument,
  useMoveFolder,
  useRemovePersonalFolder,
  useRenamePersonalFolder,
  useReorderDocuments,
  useReorderFolders,
} from '@/features/documents';
import { useRemove, useUpdate } from '@/features/hooks';
import type { DocFolderTreeNode, InternalDocumentItem } from '@/features/types';
import { notifyError, notifySuccess } from '@/lib/notify';

/** 每层缩进 px；超过 MAX_VISUAL_DEPTH 后不再增加（防止深层树挤爆侧栏） */
const INDENT_PX = 14;
const MAX_VISUAL_DEPTH = 6;

/** 「未分类」合成节点 id：与列表页 ?folder=__none__ 同口径，对应文档 folderId=null */
const UNCATEGORIZED_ID = '__none__';

function visualDepth(depth: number) {
  return Math.min(depth, MAX_VISUAL_DEPTH);
}

function collectAncestorIds(nodes: DocFolderTreeNode[], targetId: string): Set<string> {
  const result = new Set<string>();
  function walk(list: DocFolderTreeNode[], ancestors: string[]): boolean {
    for (const node of list) {
      if (node.id === targetId) {
        for (const id of ancestors) result.add(id);
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

/** 收集可见文件夹 id（根级恒可见；子级仅当父级展开时可见）——决定需预取文档的文件夹范围 */
function collectVisibleFolderIds(
  nodes: DocFolderTreeNode[],
  expandedIds: Set<string>,
  out: string[] = [],
): string[] {
  for (const node of nodes) {
    out.push(node.id);
    if (expandedIds.has(node.id)) {
      collectVisibleFolderIds(node.children, expandedIds, out);
    }
  }
  return out;
}

/** 收集全部文件夹 id → 节点映射，供 renderItem 反查 */
function indexFolders(
  nodes: DocFolderTreeNode[],
  map: Map<string, DocFolderTreeNode> = new Map(),
): Map<string, DocFolderTreeNode> {
  for (const node of nodes) {
    map.set(node.id, node);
    if (node.children.length > 0) indexFolders(node.children, map);
  }
  return map;
}

function FolderNavItem({
  href,
  label,
  active,
  icon: Icon,
  depth = 0,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: typeof Folder;
  depth?: number;
}) {
  return (
    <div className="flex-1 min-w-0" style={{ paddingLeft: 8 + visualDepth(depth) * INDENT_PX }}>
      <Link
        href={href}
        className={cn(
          'flex h-8 w-full items-center rounded-md pl-2 pr-2 text-sm transition-colors',
          active
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-70" />
        <span className="min-w-0 truncate pl-1.5" title={label}>
          {label}
        </span>
      </Link>
    </div>
  );
}

/** 「全部文档」行的 "+" 创建菜单：与文件夹行同款（根级创建的文章不选文件夹，自动落入「未分类」） */
function RootCreateMenu({
  basePath,
  onCreateFolder,
}: {
  basePath: string;
  onCreateFolder: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'absolute right-1 flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
            open ? 'opacity-100' : 'opacity-0 group-hover/all-docs:opacity-100',
          )}
          title="创建"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-36 p-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted"
          onClick={() => {
            setOpen(false);
            onCreateFolder();
          }}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          <span>创建文件夹</span>
        </button>
        <Link
          href={`${basePath}/new`}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          <FilePlus className="h-3.5 w-3.5" />
          <span>创建文章</span>
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/** 拖拽手柄（悬停显现，键盘可聚焦） */
function DragHandle({ handleProps }: { handleProps: RenderItemArgs['handleProps'] }) {
  return (
    <button
      type="button"
      aria-label="拖动排序"
      className="flex h-6 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-background/60 group-hover:opacity-60 focus-visible:opacity-100 active:cursor-grabbing"
      {...(handleProps as ButtonHTMLAttributes<HTMLButtonElement> & {
        ref?: Ref<HTMLButtonElement>;
      })}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
}

function SidebarFolderRow({
  folder,
  depth,
  active,
  basePath,
  manageable,
  expanded,
  expandable,
  isDragging,
  isOverlay,
  isDropTarget,
  handleProps,
  onToggle,
  onAddChild,
  onRename,
  onDelete,
}: {
  folder: DocFolderTreeNode;
  depth: number;
  active: boolean;
  basePath: string;
  manageable: boolean;
  expanded: boolean;
  expandable: boolean;
  isDragging: boolean;
  isOverlay: boolean;
  isDropTarget: boolean;
  handleProps: RenderItemArgs['handleProps'];
  onToggle: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
  onRename: (folder: DocFolderTreeNode) => void;
  onDelete: (folder: DocFolderTreeNode) => void;
}) {
  const Icon = active ? FolderOpen : Folder;
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const anyPopoverOpen = createOpen || moreOpen;

  return (
    <div
      className={cn(
        'group relative mb-0.5 rounded-md',
        isDragging && 'opacity-40',
        isOverlay && 'bg-background shadow-md ring-1 ring-border',
        isDropTarget && !isOverlay && 'ring-1 ring-primary/50',
        !active &&
          !isOverlay &&
          cn('hover:bg-muted group-focus-within:bg-muted', anyPopoverOpen && 'bg-muted'),
      )}
      style={{ paddingLeft: 8 + visualDepth(depth) * INDENT_PX }}
    >
      <div
        className={cn(
          'flex h-8 items-center pr-1',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        <DragHandle handleProps={handleProps} />
        <button
          type="button"
          aria-label={expanded ? '收起' : '展开'}
          className={cn(
            'flex h-6 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-background/60',
            !expandable && 'invisible',
          )}
          onClick={() => expandable && onToggle(folder.id)}
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')}
          />
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`${basePath}?folder=${folder.id}`}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 pr-12 text-sm',
                active && 'font-medium',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active || anyPopoverOpen ? 'opacity-100' : 'opacity-70 group-hover:opacity-100',
                )}
              />
              <span className="truncate">{folder.name}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{folder.name}</TooltipContent>
        </Tooltip>
      </div>

      {manageable && !isOverlay ? (
        <Can anyPerm={['docs.create']}>
          <div
            className={cn(
              'absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-muted/95 shadow-sm transition-opacity',
              anyPopoverOpen
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
            )}
          >
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
                  onClick={() => onAddChild(folder.id)}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>创建文件夹</span>
                </button>
                <Link
                  href={`${basePath}/new?folder=${folder.id}`}
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
                  onClick={() => onRename(folder)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>重命名</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(folder)}
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
  );
}

function SidebarDocRow({
  doc,
  depth,
  basePath,
  isDragging,
  isOverlay,
  handleProps,
  onRename,
  onDelete,
}: {
  doc: InternalDocumentItem;
  depth: number;
  basePath: string;
  isDragging: boolean;
  isOverlay: boolean;
  handleProps: RenderItemArgs['handleProps'];
  onRename: (doc: InternalDocumentItem) => void;
  onDelete: (doc: InternalDocumentItem) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div
      className={cn(
        'group relative mb-0.5 flex h-7 items-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        isDragging && 'opacity-40',
        isOverlay && 'bg-background text-foreground shadow-md ring-1 ring-border',
        moreOpen && 'bg-muted text-foreground',
      )}
      style={{ paddingLeft: 8 + visualDepth(depth) * INDENT_PX }}
    >
      <DragHandle handleProps={handleProps} />
      {/* 与文件夹行的 chevron 对齐占位，保证同层级文件与文件夹图标左对齐 */}
      <span className="w-5 shrink-0" aria-hidden />
      <Link href={`${basePath}/${doc.id}`} className="flex min-w-0 flex-1 items-center pr-8">
        <FileText className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate" title={doc.title}>
          {doc.title}
        </span>
      </Link>

      {!isOverlay ? (
        <Can anyPerm={['docs.edit', 'docs.delete']}>
          {/* "..." 管理菜单：与文件夹行同款交互（悬停显现，重命名 / 删除） */}
          <div
            className={cn(
              'absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center rounded-md bg-muted/95 shadow-sm transition-opacity',
              moreOpen
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
            )}
          >
            <Popover open={moreOpen} onOpenChange={setMoreOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                  title="更多操作"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-32 p-1">
                <Can anyPerm={['docs.edit']}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                    onClick={() => {
                      setMoreOpen(false);
                      onRename(doc);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>重命名</span>
                  </button>
                </Can>
                <Can perm="docs.delete">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setMoreOpen(false);
                      onDelete(doc);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>删除</span>
                  </button>
                </Can>
              </PopoverContent>
            </Popover>
          </div>
        </Can>
      ) : null}
    </div>
  );
}

/** 侧栏「未分类」合成节点行：并入 SortableTree 作为文档拖拽落点；自身不可拖拽、不可改名删除 */
function UncategorizedRow({
  basePath,
  active,
  expanded,
  expandable,
  isDropTarget,
  onToggle,
}: {
  basePath: string;
  active: boolean;
  expanded: boolean;
  expandable: boolean;
  isDropTarget: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-1 border-t border-border/60 pt-1">
      <div
        className={cn(
          'group relative mb-0.5 flex h-8 items-center rounded-md pl-2 pr-1',
          isDropTarget && 'ring-1 ring-primary/50',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {/* 与文件夹行的拖拽手柄等宽占位，保持图标左对齐 */}
        <span className="w-4 shrink-0" aria-hidden />
        <button
          type="button"
          aria-label={expanded ? '收起' : '展开'}
          className={cn(
            'flex h-6 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-background/60',
            !expandable && 'invisible',
          )}
          onClick={onToggle}
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')}
          />
        </button>
        <Link
          href={`${basePath}?folder=${UNCATEGORIZED_ID}`}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 text-sm',
            active && 'font-medium',
          )}
        >
          <Inbox
            className={cn(
              'h-4 w-4 shrink-0',
              active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100',
            )}
          />
          <span className="truncate">未分类</span>
        </Link>
      </div>
    </div>
  );
}

export function DocFolderSidebar({ basePath = '/documents' }: { basePath?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const folderParam = sp.get('folder');
  const { data: tree, isLoading } = useDocFolderTree();
  const createMut = useCreatePersonalFolder();
  const removeMut = useRemovePersonalFolder();
  const renameMut = useRenamePersonalFolder();
  const reorderFoldersMut = useReorderFolders();
  const moveFolderMut = useMoveFolder();
  const reorderDocsMut = useReorderDocuments();
  const moveDocMut = useMoveDocument();
  // 文档重命名 / 删除：复用通用资源 hooks（queryKey 前缀 ['documents'] 会连带失效侧栏树与列表）
  const updateDocMut = useUpdate<InternalDocumentItem>('documents');
  const removeDocMut = useRemove('documents');

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocFolderTreeNode | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocFolderTreeNode | null>(null);
  const [renameName, setRenameName] = useState('');
  const [docDeleteTarget, setDocDeleteTarget] = useState<InternalDocumentItem | null>(null);
  const [docRenameTarget, setDocRenameTarget] = useState<InternalDocumentItem | null>(null);
  const [docRenameTitle, setDocRenameTitle] = useState('');

  const activeId = folderParam && folderParam !== UNCATEGORIZED_ID ? folderParam : null;
  const isAll = !folderParam;
  const isUncategorized = folderParam === UNCATEGORIZED_ID;

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

  // 进入未分类视图时自动展开该节点（与选中文件夹自动展开祖先链同款体验）
  useEffect(() => {
    if (isUncategorized) {
      setExpandedIds((prev) => new Set([...prev, UNCATEGORIZED_ID]));
    }
  }, [isUncategorized]);

  // 预取所有可见文件夹（根级 + 已展开父级的子级）的文档：既决定 chevron 是否展示，也为拍平树提供数据。
  const visibleFolderIds = useMemo(
    () => [...collectVisibleFolderIds(tree ?? [], expandedIds), UNCATEGORIZED_ID],
    [tree, expandedIds],
  );
  const folderById = useMemo(() => indexFolders(tree ?? []), [tree]);
  const docsQueries = useFolderDocumentsBatch(visibleFolderIds);

  // 用可见文件夹及其文档 id+更新时间 组成的签名作为记忆依赖：id 覆盖增删/移动，updatedAt 覆盖重命名等内容变更，
  // 确保文档加载完成或更新后重新拍平树（仅用 id 会导致重命名后树上标题不刷新）。
  const docsSignature = visibleFolderIds
    .map(
      (fid, i) =>
        `${fid}:${(docsQueries[i]?.data?.data ?? []).map((d) => `${d.id}@${d.updatedAt}`).join(',')}`,
    )
    .join('|');

  // folderId -> 文档列表（按 sortOrder 升序，后端已排序）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 以 docsSignature（文档 id+updatedAt 序列）作为稳定依赖，替代每次渲染都变化的 docsQueries 引用
  const docsByFolder = useMemo(() => {
    const map = new Map<string, InternalDocumentItem[]>();
    visibleFolderIds.forEach((fid, i) => {
      map.set(fid, docsQueries[i]?.data?.data ?? []);
    });
    return map;
  }, [docsSignature]);

  const docById = useMemo(() => {
    const map = new Map<string, InternalDocumentItem>();
    for (const list of docsByFolder.values()) {
      for (const doc of list) map.set(doc.id, doc);
    }
    return map;
  }, [docsByFolder]);

  // 将文件夹树 + 各展开文件夹下文档拍平为 SortableTree 所需的扁平节点（按显示顺序：文件夹 → 子文件夹 → 文档）。
  const flatNodes = useMemo(() => {
    const flat: FlatNode[] = [];
    // 拖拽移动后新旧文件夹的文档缓存可能短暂同时包含同一文档（旧缓存尚未刷新），
    // 去重防止重复 key；以首次出现为准，刷新完成后自然收敛到真实位置
    const seenDocIds = new Set<string>();
    const pushDoc = (docId: string, parentId: string, depth: number) => {
      if (seenDocIds.has(docId)) return;
      seenDocIds.add(docId);
      flat.push({ id: docId, parentId, depth, droppable: false, type: 'document' });
    };
    const walk = (nodes: DocFolderTreeNode[], depth: number, parentId: string | null) => {
      for (const node of nodes) {
        flat.push({ id: node.id, parentId, depth, droppable: true, type: 'folder' });
        if (expandedIds.has(node.id)) {
          walk(node.children, depth + 1, node.id);
          for (const doc of docsByFolder.get(node.id) ?? []) {
            pushDoc(doc.id, node.id, depth + 1);
          }
        }
      }
    };
    walk(tree ?? [], 0, null);
    // 「未分类」合成节点固定挂在树末尾：可展开查看、可作为文档拖拽落点（folderId=null）
    flat.push({ id: UNCATEGORIZED_ID, parentId: null, depth: 0, droppable: true, type: 'folder' });
    if (expandedIds.has(UNCATEGORIZED_ID)) {
      for (const doc of docsByFolder.get(UNCATEGORIZED_ID) ?? []) {
        pushDoc(doc.id, UNCATEGORIZED_ID, 1);
      }
    }
    return flat;
  }, [tree, expandedIds, docsByFolder]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openCreate = useCallback((parentId: string | null = null) => {
    setCreateParentId(parentId);
    setCreateName('');
    setCreateOpen(true);
  }, []);

  async function handleCreateConfirm() {
    const name = createName.trim();
    if (!name) return;
    try {
      await createMut.mutateAsync({ name, parentId: createParentId });
      if (createParentId) {
        setExpandedIds((prev) => new Set([...prev, createParentId]));
      }
      setCreateOpen(false);
      setCreateName('');
      notifySuccess('文件夹已创建');
    } catch (e) {
      notifyError(e, '创建失败');
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
      notifySuccess('文件夹已删除');
    } catch (e) {
      notifyError(e, '删除失败');
    }
  }

  const openRename = useCallback((folder: DocFolderTreeNode) => {
    setRenameTarget(folder);
    setRenameName(folder.name);
  }, []);

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
      notifySuccess('文件夹已重命名');
    } catch (e) {
      notifyError(e, '重命名失败');
    }
  }

  const openDocRename = useCallback((doc: InternalDocumentItem) => {
    setDocRenameTarget(doc);
    setDocRenameTitle(doc.title);
  }, []);

  async function handleDocRenameConfirm() {
    if (!docRenameTarget) return;
    const title = docRenameTitle.trim();
    if (!title || title === docRenameTarget.title) {
      setDocRenameTarget(null);
      return;
    }
    try {
      await updateDocMut.mutateAsync({ id: docRenameTarget.id, payload: { title } });
      setDocRenameTarget(null);
      notifySuccess('文档已重命名');
    } catch (e) {
      notifyError(e, '重命名失败');
    }
  }

  async function handleDocDeleteConfirm() {
    if (!docDeleteTarget) return;
    try {
      await removeDocMut.mutateAsync(docDeleteTarget.id);
      setDocDeleteTarget(null);
      notifySuccess('文档已删除');
    } catch (e) {
      notifyError(e, '删除失败');
    }
  }

  // 客户端拖放约束：
  // - 「未分类」合成节点：自身不可拖拽，且只接收文档（文件夹不能挂进去）
  // - 文件夹：禁止拖入自身或其后代（与服务端双保险）
  // - 文档：允许拖到根级或「未分类」节点（两者同义 = folderId 置空）
  const canDrop = useCallback(
    (dragId: string, newParentId: string | null) => {
      if (dragId === UNCATEGORIZED_ID) return false;
      const node = flatNodes.find((n) => n.id === dragId);
      if (node?.type === 'document') return true;
      if (node?.type !== 'folder') return true;
      if (newParentId === UNCATEGORIZED_ID) return false;
      if (newParentId === dragId) return false;
      if (newParentId && collectDescendantIds(flatNodes, dragId).has(newParentId)) return false;
      return true;
    },
    [flatNodes],
  );

  // 拖拽结束：按被拖拽节点类型分派到文件夹 / 文档的 reorder / move 接口。
  // 「未分类」合成节点在接口层映射回 folderId=null（拖到根级空白处与拖入「未分类」同义）。
  const applyFolderMove = useCallback(
    async (evt: SortableTreeMoveEvent, changedParent: boolean) => {
      if (changedParent) {
        await moveFolderMut.mutateAsync({
          id: evt.activeId,
          parentId: evt.newParentId ?? null,
        });
      }
      // 根级同级列表含「未分类」合成节点，重排前剔除
      const orderedIds = evt.siblingIds.filter((sid) => sid !== UNCATEGORIZED_ID);
      if (orderedIds.length > 1) {
        await reorderFoldersMut.mutateAsync({
          parentId: evt.newParentId,
          orderedIds,
        });
      }
    },
    [moveFolderMut, reorderFoldersMut],
  );

  const applyDocMove = useCallback(
    async (evt: SortableTreeMoveEvent, newFolderId: string | null, changedParent: boolean) => {
      if (changedParent) {
        await moveDocMut.mutateAsync({
          id: evt.activeId,
          folderId: newFolderId,
          sortOrder: Math.max(0, evt.newIndex),
        });
        // 移入未分类后自动展开该节点，让落点可见
        if (newFolderId === null) {
          setExpandedIds((prev) => new Set([...prev, UNCATEGORIZED_ID]));
        }
      }
      if (evt.siblingIds.length > 1) {
        await reorderDocsMut.mutateAsync({
          folderId: newFolderId,
          orderedIds: evt.siblingIds,
        });
      }
    },
    [moveDocMut, reorderDocsMut],
  );

  const handleMove = useCallback(
    async (evt: SortableTreeMoveEvent) => {
      const newFolderId = evt.newParentId === UNCATEGORIZED_ID ? null : evt.newParentId;
      const oldFolderId = evt.oldParentId === UNCATEGORIZED_ID ? null : evt.oldParentId;
      const changedParent = newFolderId !== oldFolderId;
      try {
        if (evt.activeType === 'folder') {
          await applyFolderMove(evt, changedParent);
        } else {
          await applyDocMove(evt, newFolderId, changedParent);
        }
        // 展开目标父级，便于看到落点
        if (changedParent && evt.newParentId) {
          const target = evt.newParentId;
          setExpandedIds((prev) => new Set([...prev, target]));
        }
      } catch (e) {
        notifyError(e, '移动失败');
      }
    },
    [applyFolderMove, applyDocMove],
  );

  const renderRow = useCallback(
    (args: RenderItemArgs) => {
      const { node, depth, isDragging, isOverlay, isDropTarget, handleProps } = args;
      if (node.type === 'document') {
        const doc = docById.get(node.id);
        if (!doc) return null;
        return (
          <SidebarDocRow
            doc={doc}
            depth={depth}
            basePath={basePath}
            isDragging={isDragging}
            isOverlay={isOverlay}
            handleProps={handleProps}
            onRename={openDocRename}
            onDelete={setDocDeleteTarget}
          />
        );
      }
      const folder = folderById.get(node.id);
      if (!folder) {
        // 非真实文件夹的 folder 型节点只有「未分类」合成节点
        if (node.id !== UNCATEGORIZED_ID) return null;
        return (
          <UncategorizedRow
            basePath={basePath}
            active={isUncategorized}
            expanded={expandedIds.has(UNCATEGORIZED_ID)}
            expandable={(docsByFolder.get(UNCATEGORIZED_ID) ?? []).length > 0}
            isDropTarget={isDropTarget}
            onToggle={() => toggleExpanded(UNCATEGORIZED_ID)}
          />
        );
      }
      const hasDocs = (docsByFolder.get(folder.id) ?? []).length > 0;
      const expandable = folder.children.length > 0 || hasDocs;
      return (
        <SidebarFolderRow
          folder={folder}
          depth={depth}
          active={activeId === folder.id}
          basePath={basePath}
          manageable
          expanded={expandedIds.has(folder.id)}
          expandable={expandable}
          isDragging={isDragging}
          isOverlay={isOverlay}
          isDropTarget={isDropTarget}
          handleProps={handleProps}
          onToggle={toggleExpanded}
          onAddChild={openCreate}
          onRename={openRename}
          onDelete={setDeleteTarget}
        />
      );
    },
    [
      activeId,
      basePath,
      docById,
      docsByFolder,
      expandedIds,
      folderById,
      isUncategorized,
      openCreate,
      openDocRename,
      openRename,
      toggleExpanded,
    ],
  );

  return (
    <TooltipProvider delayDuration={400}>
      <Card className="w-60 shrink-0 self-start overflow-hidden border-border/80 py-0 shadow-sm">
        <CardHeader className="border-b border-border/60 px-3 py-3">
          <CardTitle className="text-sm font-medium">文件夹</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[min(70vh,560px)] space-y-0.5 overflow-y-auto overflow-x-hidden p-2">
          <div className="group/all-docs relative flex items-center">
            <FolderNavItem href={basePath} label="全部文档" active={isAll} icon={FolderOpen} />
            <Can anyPerm={['docs.create']}>
              <RootCreateMenu basePath={basePath} onCreateFolder={() => openCreate(null)} />
            </Can>
          </div>
          {isLoading ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">加载中…</p>
          ) : (
            <>
              {!tree?.length && (
                <p className="px-2.5 py-2 text-xs text-muted-foreground">
                  暂无个人文件夹，点击 + 创建
                </p>
              )}
              {/* flatNodes 恒含「未分类」合成节点，树为空时也需渲染 */}
              <SortableTree
                items={flatNodes}
                indentationWidth={INDENT_PX}
                renderItem={renderRow}
                onMove={handleMove}
                canDrop={canDrop}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createParentId ? '新建子文件夹' : '新建文件夹'}</DialogTitle>
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
                if (e.key === 'Enter') void handleCreateConfirm();
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
              {createMut.isPending ? '创建中…' : '创建'}
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
                if (e.key === 'Enter') void handleRenameConfirm();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => void handleRenameConfirm()}
              disabled={
                !renameName.trim() ||
                renameName.trim() === renameTarget?.name ||
                renameMut.isPending
              }
            >
              {renameMut.isPending ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={docRenameTarget !== null}
        onOpenChange={(open) => !open && setDocRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名文档</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-doc-title">标题</Label>
            <Input
              id="rename-doc-title"
              value={docRenameTitle}
              onChange={(e) => setDocRenameTitle(e.target.value)}
              placeholder="输入新标题"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleDocRenameConfirm();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocRenameTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => void handleDocRenameConfirm()}
              disabled={
                !docRenameTitle.trim() ||
                docRenameTitle.trim() === docRenameTarget?.title ||
                updateDocMut.isPending
              }
            >
              {updateDocMut.isPending ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={docDeleteTarget !== null}
        onOpenChange={(open) => !open && setDocDeleteTarget(null)}
        title="删除文档"
        description={
          docDeleteTarget ? `确认删除「${docDeleteTarget.title}」？此操作不可撤销。` : undefined
        }
        confirmLabel="删除"
        onConfirm={handleDocDeleteConfirm}
        loading={removeDocMut.isPending}
      />

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
