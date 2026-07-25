import type React from 'react';

/**
 * 扁平化的树节点（由消费方按显示顺序提供）。
 * SortableTree 不关心业务语义，仅依据 parentId/depth/droppable 计算拖放投影。
 */
export interface FlatNode {
  /** 唯一标识 */
  id: string;
  /** 父节点 id（根级为 null） */
  parentId: string | null;
  /** 层级深度（根级为 0） */
  depth: number;
  /** 是否可作为容器接收子节点（如文件夹为 true，文档叶子为 false）。默认 true */
  droppable?: boolean;
  /** 业务类型，消费方自定义（如 'folder' | 'document'）；用于区分同类同级排序 */
  type?: string;
}

/** 拖拽结束后回调给消费方的移动信息 */
export interface SortableTreeMoveEvent {
  /** 被拖拽的节点 id */
  activeId: string;
  /** 被拖拽节点的业务类型 */
  activeType?: string;
  /** 悬停目标节点 id */
  overId: string | null;
  /** 拖拽前的父级 id */
  oldParentId: string | null;
  /** 投影后的目标父级 id（根级为 null） */
  newParentId: string | null;
  /** 在目标父级「同类型」子节点中的插入下标 */
  newIndex: number;
  /** 目标父级下与被拖拽节点同类型的有序子节点 id 列表（含被拖拽节点） */
  siblingIds: string[];
}

/** 传给 renderItem 的渲染参数 */
export interface RenderItemArgs {
  /** 当前节点 */
  node: FlatNode;
  /** 展示用深度：拖拽中为投影深度，否则为 node.depth */
  depth: number;
  /** 是否为原位置正在被拖拽的占位项 */
  isDragging: boolean;
  /** 是否为 DragOverlay 中的克隆项 */
  isOverlay: boolean;
  /** 是否为当前投影的落点父级（可用于高亮容器） */
  isDropTarget: boolean;
  /** 绑定到拖拽手柄的属性（展开到手柄元素上即可触发拖拽） */
  handleProps: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> };
}

export interface SortableTreeProps {
  /** 扁平化节点数组，按显示顺序排列 */
  items: FlatNode[];
  /** 每一层的缩进像素，默认 24 */
  indentationWidth?: number;
  /** 渲染单个节点行 */
  renderItem: (args: RenderItemArgs) => React.ReactNode;
  /** 拖拽结束回调 */
  onMove: (event: SortableTreeMoveEvent) => void;
  /**
   * 可选：判断某节点能否落入指定父级（返回 false 时放弃该次移动，不触发 onMove）。
   * 消费方可在此实现环路防护等业务约束。
   */
  canDrop?: (activeId: string, newParentId: string | null) => boolean;
}
