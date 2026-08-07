'use client';

import { Popover, PopoverContent, PopoverTrigger, toast } from '@tzj/ui';
import { Globe, Mail, Phone } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { SocialChannelItem } from '@/components/contact/SocialChannelBar';
import { SocialIcon } from '@/components/contact/SocialIcon';
import { useLanguageSelector } from '@/components/i18n/LanguageSelector';
import { Container } from '@/components/ui';
import { LOCALE_SHORT } from '@/lib/locale-config';
import { resolveSocialQrUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

type TopBarProps = {
  /** 联系电话列表（主电话在前，备用电话在后，至少一个） */
  phones: string[];
  email: string;
  socialChannels: SocialChannelItem[];
  scanHint: string;
};

const ICON_CLASS =
  'inline-flex shrink-0 items-center gap-1.5 text-secondary-text transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * 顶部工具栏（Utility Bar）
 * 固定在页面最顶部，展示联系方式、社媒入口与语言切换。
 * 仅桌面端（lg+）显示，与 --site-topbar-height 变量的计入断点（1024px）严格对齐；
 * 高度锁定为变量值，避免实际渲染高度与吸顶导航的 top 偏移不一致产生透明缝隙。
 */
export function TopBar({ phones, email, socialChannels, scanHint }: TopBarProps) {
  const locale = useLocale();
  const tHeader = useTranslations('header');
  const tContact = useTranslations('contact');
  const { open: openLanguageSelector } = useLanguageSelector();
  const [openQrKey, setOpenQrKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = useCallback(async (key: string, href: string, copyHint?: string) => {
    try {
      await navigator.clipboard.writeText(href);
      setCopiedKey(key);
      toast.success(copyHint?.trim() || '链接已复制');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const localeShort = LOCALE_SHORT[locale as keyof typeof LOCALE_SHORT];

  return (
    <div className="top-bar hidden bg-white lg:block">
      <Container className="flex h-[var(--site-topbar-height)] items-center justify-end gap-6 text-xs">
        {/* ── 社媒 + 联系方式 + 语言切换（全部右对齐） ── */}
        <div className="flex items-center gap-4">
          {socialChannels.length > 0 ? (
            <>
              <ul className="flex items-center gap-1" aria-label={tContact('followUs')}>
                {socialChannels.map((channel) => {
                  if (channel.href) {
                    if (channel.hrefAction === 'copy') {
                      const isCopied = copiedKey === channel.key;
                      const isOpen = openQrKey === channel.key;

                      // 复制模式 + 有二维码：点击后复制链接并弹出扫码卡片
                      if (channel.qr) {
                        return (
                          <li key={channel.key}>
                            <Popover
                              open={isOpen}
                              onOpenChange={(open) => {
                                setOpenQrKey(open ? channel.key : null);
                                if (open) handleCopy(channel.key, channel.href!, channel.copyHint);
                              }}
                              modal={false}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(
                                    ICON_CLASS,
                                    'px-2',
                                    (isOpen || isCopied) && 'text-primary',
                                  )}
                                  aria-label={channel.label}
                                  aria-expanded={isOpen}
                                >
                                  <SocialIcon id={channel.platform} />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                side="bottom"
                                align="center"
                                sideOffset={8}
                                className="w-auto border-neutral-200 p-4 shadow-lg"
                              >
                                <figure className="flex flex-col items-center">
                                  <div className="relative h-36 w-36 border border-neutral-200 bg-white p-1.5">
                                    <img
                                      src={resolveSocialQrUrl(channel.qr!)}
                                      alt={channel.label}
                                      width={144}
                                      height={144}
                                      loading="lazy"
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                  <figcaption className="mt-3 text-sm font-bold text-neutral-900">
                                    {channel.label}
                                  </figcaption>
                                  <p className="mt-1 text-xs text-neutral-500">{scanHint}</p>
                                </figure>
                              </PopoverContent>
                            </Popover>
                          </li>
                        );
                      }

                      // 复制模式 + 无二维码：仅复制链接
                      return (
                        <li key={channel.key}>
                          <button
                            type="button"
                            onClick={() => handleCopy(channel.key, channel.href!, channel.copyHint)}
                            className={cn(ICON_CLASS, 'px-2', isCopied && 'text-primary')}
                            aria-label={channel.label}
                            title={isCopied ? '已复制' : channel.label}
                          >
                            <SocialIcon id={channel.platform} />
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li key={channel.key}>
                        <a
                          href={channel.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(ICON_CLASS, 'px-2')}
                          aria-label={channel.label}
                          title={channel.label}
                        >
                          <SocialIcon id={channel.platform} />
                        </a>
                      </li>
                    );
                  }
                  if (!channel.qr) return null;
                  const isOpen = openQrKey === channel.key;
                  return (
                    <li key={channel.key}>
                      <Popover
                        open={isOpen}
                        onOpenChange={(open) => setOpenQrKey(open ? channel.key : null)}
                        modal={false}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(ICON_CLASS, 'px-2', isOpen && 'text-primary')}
                            aria-label={channel.label}
                            aria-expanded={isOpen}
                          >
                            <SocialIcon id={channel.platform} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side="bottom"
                          align="center"
                          sideOffset={8}
                          className="w-auto border-neutral-200 p-4 shadow-lg"
                        >
                          <figure className="flex flex-col items-center">
                            <div className="relative h-36 w-36 border border-neutral-200 bg-white p-1.5">
                              {/* 豁免 next/image：弹层内二维码（按需展示、非 LCP），固定容器尺寸无 CLS */}
                              <img
                                src={resolveSocialQrUrl(channel.qr!)}
                                alt={channel.label}
                                width={144}
                                height={144}
                                loading="lazy"
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <figcaption className="mt-3 text-sm font-bold text-neutral-900">
                              {channel.label}
                            </figcaption>
                            <p className="mt-1 text-xs text-neutral-500">{scanHint}</p>
                          </figure>
                        </PopoverContent>
                      </Popover>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {phones.map((phone) => (
            <a key={phone} href={`tel:${phone.replace(/-/g, '')}`} className={ICON_CLASS}>
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{phone}</span>
            </a>
          ))}

          <a href={`mailto:${email}`} className={ICON_CLASS}>
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{email}</span>
          </a>

          <button
            type="button"
            onClick={openLanguageSelector}
            className={ICON_CLASS}
            aria-label={tHeader('languageSwitch')}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{localeShort}</span>
          </button>
        </div>
      </Container>
    </div>
  );
}
