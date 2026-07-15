'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

interface VirtualListProps<T> {
  items: T[];
  /** 固定行高（px），用于窗口化计算 */
  rowHeight: number;
  /** 额外缓冲行数，避免快速滚动白屏 */
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
  className?: string;
  /** 列表为空时的占位 */
  empty?: ReactNode;
}

/**
 * 极简窗口化列表（固定行高）：仅渲染可视区域 + overscan 行，
 * 万级条目也不产生大量 DOM（P3 性能项）。无第三方依赖。
 */
export function VirtualList<T>({
  items,
  rowHeight,
  overscan = 6,
  renderRow,
  className,
  empty,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewport(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = items.length;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewport / rowHeight) + overscan * 2;
  const end = Math.min(total, start + visibleCount);
  const offsetY = start * rowHeight;
  const slice = items.slice(start, end);

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={className}
      style={{ overflowY: 'auto', position: 'relative', minHeight: 0 }}
    >
      {total === 0 ? (
        empty
      ) : (
        <div style={{ height: total * rowHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {slice.map((item, i) => (
              <div
                key={(item as { roomId?: string })?.roomId ?? start + i}
                style={{ height: rowHeight }}
              >
                {renderRow(item, start + i)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
