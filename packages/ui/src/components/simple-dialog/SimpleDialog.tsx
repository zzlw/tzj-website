"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { cn } from "../../lib/utils";

export interface SimpleDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 覆盖在弹窗内容之上的内联层（如嵌套确认），避免再开独立 Radix 弹窗 */
  overlay?: ReactNode;
  wide?: boolean;
  /** 超大弹窗（媒体库等资源选择器，约 96vw / 最大 72rem） */
  xl?: boolean;
  bodyClassName?: string;
  /** 为 true 时忽略 ESC / 点击遮罩关闭（嵌套预览层打开时使用） */
  dismissBlocked?: boolean;
  /** 为 false 时不锁定外部层（嵌套 PhotoView 等第三方预览时需要） */
  modal?: boolean;
}

function isNestedOverlayTarget(
  target: EventTarget | null,
  dialogContent: EventTarget | null,
) {
  if (!(target instanceof HTMLElement) || !dialogContent) return false;
  if (target.closest(".PhotoView-Portal")) return true;
  const nestedLayer = target.closest('[role="dialog"], [role="alertdialog"]');
  return Boolean(nestedLayer && nestedLayer !== dialogContent);
}

/** 带标题/内容/页脚的简易对话框，适用于管理后台表单弹层。 */
export function SimpleDialog({
  open,
  onClose,
  title,
  children,
  footer,
  overlay,
  wide,
  xl,
  bodyClassName,
  dismissBlocked = false,
  modal = true,
}: SimpleDialogProps) {
  function handleOpenChange(next: boolean) {
    if (!next && !dismissBlocked) onClose();
  }

  const widthClass = xl
    ? "w-[min(96vw,72rem)] max-w-6xl"
    : wide
      ? "sm:max-w-2xl"
      : "sm:max-w-lg";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={modal}>
      {open ? (
        <DialogContent
          className={cn("max-h-[90vh] overflow-hidden p-0", widthClass)}
          onPointerDownOutside={(e) => {
            if (!dismissBlocked) return;
            if (isNestedOverlayTarget(e.target, e.currentTarget)) return;
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!dismissBlocked) return;
            if (document.querySelector(".PhotoView-Portal")) return;
            e.preventDefault();
          }}
        >
          <div className="relative flex min-h-0 flex-1 flex-col">
            {overlay}
            <DialogHeader className="border-b border-border px-6 py-4">
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div
              className={cn(
                "max-h-[60vh] overflow-y-auto px-6 py-5",
                xl && "max-h-[min(calc(90vh-12rem),720px)]",
                bodyClassName,
              )}
            >
              {children}
            </div>
            {footer && (
              <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">
                {footer}
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
