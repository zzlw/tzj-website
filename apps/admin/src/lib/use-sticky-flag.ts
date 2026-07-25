import { useEffect, useRef } from 'react';

/**
 * 「粘滞」布尔标记：active 为 true 时立即置真；active 变为 false 后仍保持真值 holdMs 毫秒再置假。
 *
 * 用途：堆叠的 Radix 弹窗/抽屉是相互独立的层，上层关闭时其焦点回迁 / 外部交互会以
 * focusOutside/interactOutside 级联到下层，触发下层误关闭。下层在 onInteractOutside/
 * onEscapeKeyDown 中读取本 ref：只要上层「仍被覆盖」（含其关闭动画与焦点回迁窗口）就 preventDefault，
 * 从而吸收级联事件、保证 LIFO（仅最上层响应 Esc / 外部点击 / 关闭）。
 *
 * 返回 ref 而非 state：需在事件回调里同步读取最新值，且不应触发额外渲染。
 */
export function useStickyFlag(active: boolean, holdMs = 350) {
  const ref = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      ref.current = true;
      return;
    }
    if (!ref.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      ref.current = false;
      timerRef.current = null;
    }, holdMs);
  }, [active, holdMs]);

  // 卸载清理，避免对已卸载组件的定时器残留
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return ref;
}
