'use client';

import { ImagePreview, ImagePreviewProvider } from '@tzj/ui';
import { Maximize2 } from 'lucide-react';
import { MediaImage as Image } from '@/components/MediaImage';
import { resolveMediaUrl } from '@/lib/media-url';

export interface CertificationItem {
  image: string;
  title: string;
  issuer: string;
  number: string;
  desc: string;
}

type CertificationGridProps = {
  certs: CertificationItem[];
  viewLargeLabel: string;
  certNumberLabel: string;
};

/** 资质证书卡片墙：图片灯箱预览 + 横向信息布局（移动端上下堆叠）。 */
export function CertificationGrid({
  certs,
  viewLargeLabel,
  certNumberLabel,
}: CertificationGridProps) {
  return (
    <ImagePreviewProvider>
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {certs.map((c) => (
          <div
            key={c.title}
            className="group flex flex-col items-center gap-5 border border-neutral-300 bg-white p-5 transition-colors hover:border-neutral-900 sm:p-6 lg:flex-row lg:items-start lg:gap-6"
          >
            <ImagePreview src={resolveMediaUrl(c.image)}>
              <button
                type="button"
                className="block w-40 shrink-0 cursor-pointer bg-transparent p-0 text-left sm:w-44"
                aria-label={`${viewLargeLabel}：${c.title}`}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-white">
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    sizes="176px"
                    className="object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/30 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-sm bg-white/95 px-3 py-1.5 text-xs font-bold text-neutral-900 shadow-md">
                      <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {viewLargeLabel}
                    </span>
                  </span>
                </div>
              </button>
            </ImagePreview>
            <div className="min-w-0 flex-1 text-center lg:text-left">
              <h3 className="rb-h5 text-neutral-900">{c.title}</h3>
              <p className="mt-1 text-xs text-secondary-text">{c.issuer}</p>
              <p className="mt-2 text-xs text-neutral-900">
                <span className="text-secondary-text">{certNumberLabel}</span>
                {c.number}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-secondary-text">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </ImagePreviewProvider>
  );
}
