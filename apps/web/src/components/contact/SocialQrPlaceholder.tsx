import type { SocialPlatformId } from "@tzj/types";

type Platform = SocialPlatformId;

/** 内联 SVG 占位 — 不依赖网络，图片加载失败时兜底 */
export function SocialQrPlaceholder({ platform }: { platform: Platform }) {
  if (platform === "wechat") {
    return (
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        role="img"
        aria-label="微信二维码"
      >
        <rect width="200" height="200" fill="#fff" />
        <rect x="16" y="16" width="168" height="168" fill="none" stroke="#e5e7eb" strokeWidth="2" />
        <rect x="28" y="28" width="36" height="36" fill="#111827" />
        <rect x="34" y="34" width="24" height="24" fill="#fff" />
        <rect x="40" y="40" width="12" height="12" fill="#111827" />
        <rect x="136" y="28" width="36" height="36" fill="#111827" />
        <rect x="142" y="34" width="24" height="24" fill="#fff" />
        <rect x="148" y="40" width="12" height="12" fill="#111827" />
        <rect x="28" y="136" width="36" height="36" fill="#111827" />
        <rect x="34" y="142" width="24" height="24" fill="#fff" />
        <rect x="40" y="148" width="12" height="12" fill="#111827" />
        <g fill="#6b7280">
          {[
            [72, 40], [88, 40], [104, 56], [72, 72], [96, 72], [120, 88],
            [72, 104], [88, 120], [104, 136], [120, 152], [88, 152], [104, 168],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" />
          ))}
        </g>
        <circle cx="100" cy="100" r="22" fill="#07c160" />
        <path
          fill="#fff"
          d="M92 92c-4 0-7 3-7 6 0 2 1 4 3 5l-1 2 2-1c1 0 2 1 3 1 4 0 7-3 7-6s-3-7-7-7zm-4 6a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2zm8-2c-4 0-7 3-7 6 0 2 2 4 3 5l-1 2 2-1c1 0 1 0 3 0 4 0 7-3 7-6s-3-6-7-6zm-4 6a.8.8 0 110-1.6.8.8 0 010 1.6zm4 0a.8.8 0 110-1.6.8.8 0 010 1.6z"
        />
      </svg>
    );
  }

  if (platform === "douyin") {
    return (
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        role="img"
        aria-label="抖音二维码"
      >
        <rect width="200" height="200" fill="#fff" />
        <rect x="16" y="16" width="168" height="168" fill="none" stroke="#e5e7eb" strokeWidth="2" />
        <rect x="28" y="28" width="36" height="36" fill="#111827" />
        <rect x="34" y="34" width="24" height="24" fill="#fff" />
        <rect x="40" y="40" width="12" height="12" fill="#111827" />
        <rect x="136" y="28" width="36" height="36" fill="#111827" />
        <rect x="142" y="34" width="24" height="24" fill="#fff" />
        <rect x="148" y="40" width="12" height="12" fill="#111827" />
        <rect x="28" y="136" width="36" height="36" fill="#111827" />
        <rect x="34" y="142" width="24" height="24" fill="#fff" />
        <rect x="40" y="148" width="12" height="12" fill="#111827" />
        <g fill="#6b7280">
          {[
            [76, 44], [92, 44], [108, 60], [76, 76], [100, 76], [124, 92],
            [76, 108], [92, 124], [108, 140], [124, 156], [92, 156], [108, 172],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" />
          ))}
        </g>
        <circle cx="100" cy="100" r="22" fill="#111827" />
        <path
          fill="#fff"
          d="M108 84c0-1-.8-1.8-1.8-1.8h-12.4c-1 0-1.8.8-1.8 1.8v24c0 1 .8 1.8 1.8 1.8h12.4c1 0 1.8-.8 1.8-1.8v-24zm-2 2v6h-8v-6h8zm-8 8h8v6h-8v-6zm10 0h8v14h-8v-14z"
        />
        <path fill="#fe2c55" d="M116 88v12c0 4-3 7-7 7h-1v-4c2 0 3-1 3-3V88h5z" />
      </svg>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-xs text-neutral-400">
      QR
    </div>
  );
}
