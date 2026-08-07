'use client';

import type { SocialHrefAction } from '@tzj/types';
import { toast } from '@tzj/ui';
import { useCallback } from 'react';
import { SocialIcon } from '@/components/contact/SocialIcon';
import { SocialQrImage } from '@/components/contact/SocialQrImage';
import { cn } from '@/lib/utils';

type SocialConnectPanelProps = {
  channels: SocialConnectItem[];
  sectionTitle?: string;
  className?: string;
};

export type SocialConnectItem = {
  id: string;
  label: string;
  qr: string;
  platform: 'wechat' | 'douyin' | 'weibo' | 'xiaohongshu';
  scanHint: string;
  href?: string;
  hrefAction?: SocialHrefAction;
  /** 复制模式点击后的提示语，留空使用默认「链接已复制」 */
  copyHint?: string;
};

/** 联系页社媒二维码 — 二维码在上，文案在下；有外链时支持复制/跳转 */
export function SocialConnectPanel({ channels, sectionTitle, className }: SocialConnectPanelProps) {
  const handleCopy = useCallback(async (href: string, copyHint?: string) => {
    try {
      await navigator.clipboard.writeText(href);
      toast.success(copyHint?.trim() || '链接已复制');
    } catch {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  if (channels.length === 0) return null;

  return (
    <div className={cn('mt-10 border-t border-neutral-200 pt-8', className)}>
      <div className="flex flex-wrap gap-x-8 gap-y-6">
        {channels.map((channel) => {
          const content = (
            <>
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
                <h3 className="font-display text-sm font-bold text-neutral-900">{channel.label}</h3>
              </div>

              {/* 说明文字 */}
              <p className="mt-1 text-xs leading-relaxed text-secondary-text">{channel.scanHint}</p>
            </>
          );

          // 有外链时根据 hrefAction 决定点击行为
          if (channel.href && channel.hrefAction === 'copy') {
            return (
              <article key={channel.id} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleCopy(channel.href!, channel.copyHint)}
                  className="flex cursor-pointer flex-col items-center transition-opacity hover:opacity-80"
                  aria-label={`复制${channel.label}链接`}
                >
                  {content}
                </button>
              </article>
            );
          }

          if (channel.href) {
            return (
              <article key={channel.id} className="flex flex-col items-center">
                <a
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center transition-opacity hover:opacity-80"
                  aria-label={channel.label}
                >
                  {content}
                </a>
              </article>
            );
          }

          // 无外链：纯展示二维码
          return (
            <article key={channel.id} className="flex flex-col items-center">
              {content}
            </article>
          );
        })}
      </div>
    </div>
  );
}
