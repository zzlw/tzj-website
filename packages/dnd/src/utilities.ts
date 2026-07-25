import type { FlatNode } from './types';

/** 水平拖拽位移换算为相对缩进层级增量 */
function getDragDepth(offset: number, indentationWidth: number): number {
  return Math.round(offset / indentationWidth);
}

/**
 * 目标位置的最大可嵌套深度。
 * - 无前一节点：只能落在根级（0）
 * - 前一节点不可作为容器（droppable === false，如文档叶子）：只能与其同级
 * - 否则：可作为前一节点的子级（depth + 1）
 */
function getMaxDepth(previousItem: FlatNode | undefined): number {
  if (!previousItem) return 0;
  if (previousItem.droppable === false) return previousItem.depth;
  return previousItem.depth + 1;
}

/** 目标位置的最小深度：不得浅于后一节点（避免割裂其父子关系） */
function getMinDepth(nextItem: FlatNode | undefined): number {
  return nextItem ? nextItem.depth : 0;
}

export interface Projection {
  depth: number;
  maxDepth: number;
  minDepth: number;
  parentId: string | null;
}

/** 简单的数组移动（不依赖外部实现，保持包自足） */
export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const next = array.slice();
  const startIndex = to < 0 ? next.length + to : to;
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  if (item === undefined) return next;
  next.splice(startIndex, 0, item);
  return next;
}

/**
 * 依据当前拖拽的水平位移，计算投影后的深度与目标父级。
 * 参考 dnd-kit 官方 sortable-tree 示例，并按 droppable 约束收紧最大深度。
 */
export function getProjection(
  items: FlatNode[],
  activeId: string,
  overId: string,
  dragOffset: number,
  indentationWidth: number,
): Projection {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  const reordered = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = reordered[overItemIndex - 1];
  const nextItem = reordered[overItemIndex + 1];
  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = (activeItem?.depth ?? 0) + dragDepth;
  const maxDepth = getMaxDepth(previousItem);
  const minDepth = getMinDepth(nextItem);

  let depth = projectedDepth;
  if (projectedDepth >= maxDepth) depth = maxDepth;
  else if (projectedDepth < minDepth) depth = minDepth;

  return { depth, maxDepth, minDepth, parentId: getParentId() };

  function getParentId(): string | null {
    if (depth === 0 || !previousItem) return null;
    if (depth === previousItem.depth) return previousItem.parentId;
    if (depth > previousItem.depth) return previousItem.id;
    const newParent = reordered
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;
    return newParent ?? null;
  }
}

/** 收集某节点的全部后代 id（用于环路防护：禁止将节点拖入自身子树） */
export function collectDescendantIds(items: FlatNode[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const item of items) {
    if (item.parentId == null) continue;
    const list = childrenOf.get(item.parentId) ?? [];
    list.push(item.id);
    childrenOf.set(item.parentId, list);
  }
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const child of childrenOf.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }
  return result;
}

/**
 * 计算移动结果中，目标父级下与被拖拽节点「同类型」的有序子节点 id 列表。
 * 用于后端 reorder 接口（folders 与 documents 各自独立排序）。
 */
export function computeSiblingIds(
  items: FlatNode[],
  activeId: string,
  overId: string,
  newParentId: string | null,
): string[] {
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const reordered = arrayMove(items, activeItemIndex, overItemIndex);
  const active = items[activeItemIndex];
  return reordered
    // 注意：跨父级移动时被拖节点的 parentId 仍是旧值，需按 newParentId 视为已归属目标父级，
    // 否则它会被过滤掉，导致 newIndex 为 -1、排序序列缺失该节点。
    .filter(
      (item) =>
        item.type === active?.type &&
        (item.id === activeId ? true : item.parentId === newParentId),
    )
    .map((item) => item.id);
}
