import type { MarkdownComponents } from '@tzj/ui';
import { markdownBaseComponents } from '@tzj/ui';
import { MediaImage as Image } from '@/components/MediaImage';

/** 带 next/image 优化的 Markdown 图片组件（用于需要 fill/cover 的场景）。
 *  在 @tzj/ui 的 markdownBaseComponents 基础上仅覆盖 img，
 *  其余元素（标题/列表/表格/链接…）复用 ui 的统一映射。 */
export const markdownImageComponents: MarkdownComponents = {
  ...markdownBaseComponents,
  img: ({ src, alt }) => {
    if (!src || typeof src !== 'string') return null;
    return (
      <span className="rb-img-shimmer relative my-8 block aspect-[16/9] overflow-hidden bg-neutral-200">
        <Image
          src={src}
          alt={alt ?? '正文配图'}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      </span>
    );
  },
};
