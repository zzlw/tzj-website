import { SocialIcon } from "@/components/contact/SocialIcon";
import { SocialQrImage } from "@/components/contact/SocialQrImage";
import { cn } from "@/lib/utils";

type SocialConnectPanelProps = {
  channels: SocialConnectItem[];
  sectionTitle?: string;
  className?: string;
};

export type SocialConnectItem = {
  id: string;
  label: string;
  qr: string;
  platform: "wechat" | "douyin" | "weibo" | "xiaohongshu";
  scanHint: string;
};

/** 联系页社媒二维码 — 横向卡片，QR 左文案右 */
export function SocialConnectPanel({
  channels,
  sectionTitle,
  className,
}: SocialConnectPanelProps) {
  if (channels.length === 0) return null;

  return (
    <div className={cn("mt-10 border-t border-neutral-200 pt-8", className)}>
      {sectionTitle ? (
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
          {sectionTitle}
        </p>
      ) : null}

      <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:gap-8">
        {channels.map((channel) => (
          <article
            key={channel.id}
            className="flex min-w-[240px] flex-1 items-center gap-4 sm:max-w-[280px]"
          >
            <div className="shrink-0 border border-neutral-200 bg-white p-1.5">
              <SocialQrImage
                qr={channel.qr}
                platform={channel.platform}
                label={channel.label}
                className="h-[7.5rem] w-[7.5rem] object-contain sm:h-32 sm:w-32"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <SocialIcon id={channel.platform} className="h-3.5 w-3.5" />
                </span>
                <h3 className="font-display text-sm font-bold text-neutral-900">
                  {channel.label}
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-secondary-text">
                {channel.scanHint}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
