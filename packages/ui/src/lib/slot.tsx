import { mergeProps } from '@base-ui/react/merge-props';
import {
  Children,
  cloneElement,
  forwardRef,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

/**
 * asChild 兼容层（B1 迁移约束 #1，长期 API，不拆除）。
 *
 * Base UI 无 Radix 的 Slot/asChild 机制（改用 render prop）。为保证全仓 116 处
 * `asChild` 调用点零改造，@tzj/ui 包装层继续暴露 `asChild`，内部通过本模块转换：
 * - 自研组件（Button/BreadcrumbLink 等）：直接用 `<Slot>` 渲染子元素并合并 props；
 * - Base UI 组件包装层：用 `toRenderProps()` 把 `asChild + children` 转为 `render`。
 *
 * 实现刻意保持纯函数/纯组件（无 hook），保证 RSC 环境可用（Button 在 Server
 * Component 中有消费）。props 合并复用 Base UI 的 `mergeProps`（className 拼接、
 * 事件链式调用、右侧覆盖），与 Radix Slot 行为一致；ref 需自行合并。
 */

type AnyProps = Record<string, unknown>;

/** 纯函数合并 ref（不依赖 hook；每次渲染重建 callback ref，对本仓规模无感知）。 */
export function composeRefs<T>(...refs: (Ref<T> | undefined)[]): Ref<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref != null) {
        (ref as { current: T | null }).current = node;
      }
    }
  };
}

/** React 19：元素的 ref 挂在 props 上（ref-as-prop）。 */
function getChildRef(element: ReactElement): Ref<unknown> | undefined {
  return (element.props as AnyProps).ref as Ref<unknown> | undefined;
}

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

/** Radix Slot 等价物：把自身 props 合并进唯一子元素。 */
export const Slot = forwardRef<HTMLElement, SlotProps>(function Slot({ children, ...props }, ref) {
  if (!isValidElement(children)) {
    // 与 Radix 行为一致：多子元素/非元素直接报错暴露误用
    Children.only(children);
    return null;
  }
  const childProps = children.props as AnyProps;
  const merged = mergeProps(props as AnyProps, childProps) as AnyProps;
  // RSC 中 ref 恒为空；此时绝不能向子元素注入 ref（Server Component 传 ref 会直接报错）
  const childRef = getChildRef(children);
  if (ref != null || childRef != null) {
    merged.ref = composeRefs(ref, childRef);
  }
  return cloneElement(children, merged);
});

/**
 * 把 `asChild + children` 转为 Base UI 的 `render` prop 参数。
 * 用法：`<BasePrimitive.Trigger {...toRenderProps(asChild, children)} {...rest} />`
 */
export function toRenderProps(
  asChild: boolean | undefined,
  children: ReactNode,
): { render: ReactElement<Record<string, unknown>> } | { children: ReactNode } {
  if (asChild && isValidElement(children)) {
    return { render: children as ReactElement<Record<string, unknown>> };
  }
  return { children };
}
