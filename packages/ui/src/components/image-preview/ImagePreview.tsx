'use client';

import type { ReactElement } from 'react';
import { PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

/**
 * 图片灯箱触发器（封装 react-photo-view 的 PhotoView）。
 * 必须置于 <ImagePreviewProvider> 内部才生效；children 即点击放大的缩略图触发器。
 */
export function ImagePreview({ src, children }: { src: string; children: ReactElement }) {
  return <PhotoView src={src}>{children}</PhotoView>;
}
