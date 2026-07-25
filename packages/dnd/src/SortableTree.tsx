'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type CSSProperties, type ReactNode, type Ref, useMemo, useState } from 'react';
import type { FlatNode, RenderItemArgs, SortableTreeProps } from './types';
import { computeSiblingIds, getProjection } from './utilities';

interface SortableRowProps {
  node: FlatNode;
  depth: number;
  isDropTarget: boolean;
  renderItem: (args: RenderItemArgs) => ReactNode;
}

function SortableRow({ node, depth, isDropTarget, renderItem }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleProps = {
    ref: setActivatorNodeRef as Ref<HTMLElement>,
    ...attributes,
    ...listeners,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem({ node, depth, isDragging, isOverlay: false, isDropTarget, handleProps })}
    </div>
  );
}

/**
 * Headless 可排序树：消费方提供扁平化节点数组与 renderItem，包内负责
 * 拖拽感知、按水平位移投影目标层级/父级，并在结束时回调 onMove。
 * 样式与行内容完全由消费方通过 render prop 决定，保证通用可复用。
 */
export function SortableTree({
  items,
  indentationWidth = 24,
  renderItem,
  onMove,
  canDrop,
}: SortableTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const projected =
    activeId && overId
      ? getProjection(items, activeId, overId, offsetLeft, indentationWidth)
      : null;

  const sortedIds = useMemo(() => items.map((item) => item.id), [items]);
  const activeItem = activeId ? (items.find((item) => item.id === activeId) ?? null) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function resetState() {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
    if (typeof document !== 'undefined') {
      document.body.style.setProperty('cursor', '');
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    setActiveId(id);
    setOverId(id);
    if (typeof document !== 'undefined') {
      document.body.style.setProperty('cursor', 'grabbing');
    }
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over ? String(over.id) : null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const currentProjection = projected;
    resetState();
    if (!currentProjection || !over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const newParentId = currentProjection.parentId;

    const current = items.find((item) => item.id === activeIdStr);
    if (!current) return;
    if (canDrop && !canDrop(activeIdStr, newParentId)) return;

    const siblingIds = computeSiblingIds(items, activeIdStr, overIdStr, newParentId);
    const newIndex = siblingIds.indexOf(activeIdStr);

    // 位置与父级都没变化时无需回调
    if (newParentId === current.parentId && overIdStr === activeIdStr) return;

    onMove({
      activeId: activeIdStr,
      activeType: current.type,
      overId: overIdStr,
      oldParentId: current.parentId,
      newParentId,
      newIndex,
      siblingIds,
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetState}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        {items.map((node) => {
          const depth = node.id === activeId && projected ? projected.depth : node.depth;
          const isDropTarget = Boolean(projected && projected.parentId === node.id);
          return (
            <SortableRow
              key={node.id}
              node={node}
              depth={depth}
              isDropTarget={isDropTarget}
              renderItem={renderItem}
            />
          );
        })}
      </SortableContext>
      <DragOverlay>
        {activeItem
          ? renderItem({
              node: activeItem,
              depth: activeItem.depth,
              isDragging: false,
              isOverlay: true,
              isDropTarget: false,
              handleProps: {},
            })
          : null}
      </DragOverlay>
    </DndContext>
  );
}
