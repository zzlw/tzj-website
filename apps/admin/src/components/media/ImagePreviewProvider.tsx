"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { PhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import "./photo-view-overrides.css";

/** 与媒体库一致的图片灯箱 Provider，供编辑页封面图等复用。 */
export function ImagePreviewProvider({
  children,
  onVisibleChange,
}: {
  children: ReactNode;
  onVisibleChange?: (visible: boolean, index: number) => void;
}) {
  return (
    <PhotoProvider
      maskOpacity={0.85}
      onVisibleChange={onVisibleChange}
      toolbarRender={({ onScale, scale, rotate, onRotate, onClose }) => (
        <div className="flex items-center gap-1 text-white">
          <button
            type="button"
            className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-white/10"
            onClick={() => onScale(scale + 0.5)}
          >
            放大
          </button>
          <button
            type="button"
            className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-white/10"
            onClick={() => onScale(Math.max(0.5, scale - 0.5))}
          >
            缩小
          </button>
          <button
            type="button"
            className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-white/10"
            onClick={() => onRotate(rotate + 90)}
          >
            旋转
          </button>
          <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm hover:bg-white/10"
            onClick={() => onClose()}
            aria-label="关闭预览"
          >
            <X className="h-4 w-4" />
            关闭
          </button>
        </div>
      )}
    >
      {children}
    </PhotoProvider>
  );
}
