"use client";

import { useMemo, useState } from "react";
import type { SocialPlatformId } from "@tzj/types";
import { SocialQrPlaceholder } from "@/components/contact/SocialQrPlaceholder";
import {
  defaultSocialQrPath,
  resolveMediaUrl,
} from "@/lib/media-url";

type SocialQrImageProps = {
  qr?: string;
  platform: SocialPlatformId;
  label: string;
  className?: string;
};

/** 社媒二维码 — MinIO 优先，加载失败时内联 SVG 兜底 */
export function SocialQrImage({ qr, platform, label, className }: SocialQrImageProps) {
  const candidates = useMemo(() => {
    const list: string[] = [];
    const primary = resolveMediaUrl(qr);
    const fallbackPath = defaultSocialQrPath(platform);
    const fallback = fallbackPath ? resolveMediaUrl(fallbackPath) : "";
    if (primary) list.push(primary);
    if (fallback && fallback !== primary) list.push(fallback);
    return list;
  }, [qr, platform]);

  const [index, setIndex] = useState(0);
  const src = candidates[index];
  const showPlaceholder = !src || index >= candidates.length;

  return (
    <div className={className} aria-label={label}>
      {showPlaceholder ? (
        <SocialQrPlaceholder platform={platform} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          width={160}
          height={160}
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          onError={() => {
            setIndex((i) => i + 1);
          }}
        />
      )}
    </div>
  );
}
