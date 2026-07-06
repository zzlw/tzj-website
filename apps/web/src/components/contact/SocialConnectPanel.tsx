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

/** 联系页社媒二维码 — 二维码在上，文案在下 */
export function SocialConnectPanel({
  channels,
  sectionTitle,
  className,
}: SocialConnectPanelProps) {
  if (channels.length === 0) return null;

  return (
    <div className={cn("mt-10 border-t border-neutral-200 pt-8", className)}>
      <div className="flex flex-wrap gap-x-8 gap-y-6">
        {channels.map((channel) => (
          <article
            key={channel.id}
            className="flex flex-col items-center"
          >
            {/* 二维码图片 */}
            <div className="shrink-0 border border-neutral-200 bg-white p-1.5">
              <SocialQrImage
                qr={channel.qr}
                platform={channel.platform}
                label={channel.label}
                className="h-[7.5rem] w-[7.5rem] object-contain sm:h-26 sm:w-26"
              />
            </div>

            {/* 图标 + 标题 */}
            <div className="mt-3 flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary/10 text-primary">
                <SocialIcon id={channel.platform} className="h-3.5 w-3.5" />
              </span>
              <h3 className="font-display text-sm font-bold text-neutral-900">
                {channel.label}
              </h3>
            </div>

            {/* 说明文字 */}
            <p className="mt-1 text-xs leading-relaxed text-secondary-text">
              {channel.scanHint}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
