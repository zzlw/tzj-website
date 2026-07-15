'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@tzj/ui';
import { useState } from 'react';
import { SocialIcon } from '@/components/contact/SocialIcon';
import { resolveSocialQrUrl } from '@/lib/media-url';
import type { SocialChannelId } from '@/lib/social-channels';
import { cn } from '@/lib/utils';

export type SocialChannelItem = {
  /** CMS 渠道唯一 ID */
  key: string;
  platform: SocialChannelId;
  label: string;
  qr?: string;
  href?: string;
};

type SocialChannelBarProps = {
  sectionLabel: string;
  scanHint: string;
  channels: SocialChannelItem[];
  className?: string;
  /** 是否只显示图标（不显示二维码弹窗） */
  iconOnly?: boolean;
};

const BTN_CLASS =
  'flex h-9 w-9 items-center justify-center border border-neutral-300 bg-white text-neutral-700 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** 社媒/联系图标栏 — 扫码 Popover，外链新窗口打开 */
export function SocialChannelBar({
  sectionLabel,
  scanHint,
  channels,
  className,
  iconOnly = false,
}: SocialChannelBarProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (channels.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
        {sectionLabel}
      </span>
      <ul className="flex items-center gap-2" aria-label={sectionLabel}>
        {channels.map((channel) => {
          // 外链直接跳转
          if (channel.href) {
            return (
              <li key={channel.key}>
                <a
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={BTN_CLASS}
                  aria-label={channel.label}
                  title={channel.label}
                >
                  <SocialIcon id={channel.platform} />
                </a>
              </li>
            );
          }

          // iconOnly 模式：只显示图标，不弹二维码
          if (iconOnly) {
            return (
              <li key={channel.key}>
                <button
                  type="button"
                  className={BTN_CLASS}
                  aria-label={channel.label}
                  title={channel.label}
                >
                  <SocialIcon id={channel.platform} />
                </button>
              </li>
            );
          }

          // 默认模式：有二维码则弹出
          if (!channel.qr) return null;

          const isOpen = openKey === channel.key;

          return (
            <li key={channel.key}>
              <Popover
                open={isOpen}
                onOpenChange={(open) => setOpenKey(open ? channel.key : null)}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(BTN_CLASS, isOpen && 'border-primary bg-primary/5 text-primary')}
                    aria-label={channel.label}
                    aria-expanded={isOpen}
                  >
                    <SocialIcon id={channel.platform} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  sideOffset={8}
                  className="w-auto border-neutral-300 p-4 shadow-lg"
                >
                  <figure className="flex flex-col items-center">
                    <div className="relative h-36 w-36 border border-neutral-200 bg-white p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveSocialQrUrl(channel.qr!)}
                        alt={channel.label}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <figcaption className="mt-3 text-sm font-bold text-neutral-900">
                      {channel.label}
                    </figcaption>
                    <p className="mt-1 text-xs text-secondary-text">{scanHint}</p>
                  </figure>
                </PopoverContent>
              </Popover>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
