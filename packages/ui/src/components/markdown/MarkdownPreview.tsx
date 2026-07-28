'use client';

/// <reference types="node" />
import { useEffect, useRef, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { PhotoSlider } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { cn } from '../../lib/utils';

function vditorCdn(): string {
  // 统一使用本地资源（public/vditor-assets，由 copy-vditor-assets 脚本从
  // node_modules/vditor/dist 拷贝；Vditor 内部会自动追加 /dist/js/lute/lute.min.js）
  return '/vditor-assets';
}

export type MarkdownPreviewVariant = 'default' | 'article' | 'chat';

/**
 * 统一的 Markdown 预览组件（基于 Vditor.preview）。
 *
 * - admin 文档阅读页用 default / article 变体；
 * - 聊天气泡（B 端客服 / C 端访客）用 chat 变体，样式收敛在各自 globals.css 的 `.chat-md-reset`。
 *
 * 与编辑器（Vditor）同源，保证「客服发出的内容」在两端渲染完全一致。
 * Vditor 与样式均随 @tzj/ui 本地打包，运行时资源（lute 等）走本地 /vditor-assets。
 *
 * imagePreview：点击渲染出的图片，复用项目统一的 react-photo-view 灯箱
 * （与媒体库、聊天附件预览同一套组件、同一套样式），支持左右切换多图。
 */
export function MarkdownPreview({
  markdown,
  className,
  variant = 'default',
  imagePreview = true,
}: {
  markdown: string;
  className?: string;
  variant?: MarkdownPreviewVariant;
  imagePreview?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<{ src: string; key: string | number }[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    void (async () => {
      if (cancelled || !ref.current) return;

      ref.current.innerHTML = '';
      Vditor.preview(ref.current, markdown || '', {
        cdn: vditorCdn(),
        mode: 'light',
        theme: { current: 'light' },
        // 阅读页（article）开启代码行号，聊天/普通预览保持轻量
        hljs: { lineNumber: variant === 'article' },
      });
    })();

    return () => {
      cancelled = true;
      if (ref.current) ref.current.innerHTML = '';
    };
  }, [markdown, variant]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imagePreview) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG') return;
    const root = ref.current;
    if (!root) return;
    const src = target.getAttribute('src');
    if (!src) return;
    // 收集当前消息内所有图片，复用 PhotoSlider 的多图切换能力
    const imgs = Array.from(root.querySelectorAll('img'));
    const images = imgs
      .map((im, i) => ({ src: im.getAttribute('src') || '', key: i }))
      .filter((it) => it.src);
    const index = imgs.indexOf(target as HTMLImageElement);
    setPreviewImages(images);
    setPreviewIndex(index >= 0 ? index : 0);
    setPreviewVisible(true);
  };

  const variantCls =
    variant === 'article'
      ? 'markdown-preview-article min-h-[8rem] text-[15px] leading-relaxed'
      : variant === 'chat'
        ? 'chat-md-reset'
        : 'min-h-[120px] rounded-md border border-border/80 bg-background p-4 text-sm';

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: 图片点击放大是鼠标增强操作，渲染容器本身非交互控件 */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 同上，事件委托容器 */}
      <div
        ref={ref}
        onClick={handleClick}
        className={cn('vditor-reset markdown-preview', variantCls, className)}
      />
      {imagePreview && (
        <PhotoSlider
          visible={previewVisible}
          onClose={() => setPreviewVisible(false)}
          images={previewImages}
          index={previewIndex}
        />
      )}
    </>
  );
}
