'use client';

import { ImagePreview, ImagePreviewProvider } from '@tzj/ui';
import { Maximize2 } from 'lucide-react';
import { MediaImage as Image } from '@/components/MediaImage';
import { Link } from '@/i18n/navigation';
import { resolveMediaUrl } from '@/lib/media-url';

export interface CertificationWallCardItem {
  key: string;
  image: string;
  title: string;
  subtitle: string;
}

type CertificationWallCardsProps = {
  certs: CertificationWallCardItem[];
  detailHref: string;
  viewLargeLabel: string;
};

/**
 * 体系认证墙卡片：图片区域点击打开灯箱预览（复用全站 ImagePreview 组件），
 * 标题区域保留跳转资质详情页的链接。
 */
export function CertificationWallCards({
  certs,
  detailHref,
  viewLargeLabel,
}: CertificationWallCardsProps) {
  return (
    <ImagePreviewProvider>
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {certs.map((c) => (
          <div
            key={c.key}
            className="group flex flex-col overflow-hidden border border-neutral-300 bg-white transition-colors hover:border-neutral-900"
          >
            <ImagePreview src={resolveMediaUrl(c.image)}>
              <button
                type="button"
                aria-label={`${viewLargeLabel}：${c.title}`}
                className="relative block aspect-[3/4] w-full cursor-pointer overflow-hidden bg-white p-0"
              >
                <Image
                  src={c.image}
                  alt={c.title}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/30 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-white/95 px-3 py-1.5 text-xs font-bold text-neutral-900 shadow-md">
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {viewLargeLabel}
                  </span>
                </span>
              </button>
            </ImagePreview>
            <Link href={detailHref} className="block border-t border-neutral-200 p-4 text-center">
              <h3 className="font-display text-sm font-bold text-neutral-900 transition-colors group-hover:text-primary">
                {c.title}
              </h3>
              <p className="mt-1 text-xs text-secondary-text">{c.subtitle}</p>
            </Link>
          </div>
        ))}
      </div>
    </ImagePreviewProvider>
  );
}
