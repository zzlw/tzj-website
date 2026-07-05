import Image from "next/image";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media-url";

export type SocialQrCardItem = {
  id: string;
  label: string;
  qr: string;
};

type SocialQrCardsProps = {
  channels: SocialQrCardItem[];
  sectionLabel?: string;
  scanHint?: string;
  size?: "default" | "compact";
  className?: string;
};

const SIZE = {
  default: { box: "h-28 w-28", image: 112 },
  compact: { box: "h-[4.5rem] w-[4.5rem]", image: 72 },
} as const;

/** 联系页二维码网格 — 由 SOCIAL_CHANNELS 驱动，仅展示有 qr 的渠道 */
export function SocialQrCards({
  channels,
  sectionLabel,
  scanHint,
  size = "default",
  className,
}: SocialQrCardsProps) {
  const { box, image } = SIZE[size];

  if (channels.length === 0) return null;

  return (
    <div className={cn(className)}>
      {sectionLabel ? (
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{sectionLabel}</p>
      ) : null}
      <ul
        className={cn("flex flex-wrap gap-5", sectionLabel ? "mt-3" : undefined)}
        aria-label={sectionLabel}
      >
        {channels.map(({ id, label, qr }) => (
          <li key={id}>
            <figure className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "relative shrink-0 border border-neutral-300 bg-white p-1.5",
                  box,
                )}
              >
                <Image
                  src={resolveMediaUrl(qr)}
                  alt={label}
                  width={image}
                  height={image}
                  className="h-full w-full object-contain"
                />
              </div>
              <figcaption className="text-center text-xs font-medium text-neutral-700">
                {label}
              </figcaption>
              {scanHint ? (
                <p className="text-center text-[11px] text-secondary-text">{scanHint}</p>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
