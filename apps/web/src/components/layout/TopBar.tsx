"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Phone, Mail, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@tzj/ui";
import { Container } from "@/components/ui";
import { SocialIcon } from "@/components/contact/SocialIcon";
import type { SocialChannelItem } from "@/components/contact/SocialChannelBar";
import { resolveSocialQrUrl } from "@/lib/media-url";
import { LOCALE_SHORT } from "@/lib/locale-config";
import { useLanguageSelector } from "@/components/i18n/LanguageSelector";
import { cn } from "@/lib/utils";

type TopBarProps = {
  phone: string;
  email: string;
  socialChannels: SocialChannelItem[];
  scanHint: string;
};

const ICON_CLASS =
  "flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 顶部工具栏（Utility Bar）
 * 固定在页面最顶部，展示联系方式、社媒入口与语言切换。
 * 仅桌面端（md+）显示，移动端隐藏。
 */
export function TopBar({ phone, email, socialChannels, scanHint }: TopBarProps) {
  const locale = useLocale();
  const tHeader = useTranslations("header");
  const tContact = useTranslations("contact");
  const { open: openLanguageSelector } = useLanguageSelector();
  const [openQrKey, setOpenQrKey] = useState<string | null>(null);

  const localeShort = LOCALE_SHORT[locale as keyof typeof LOCALE_SHORT];

  return (
    <div className="top-bar hidden h-9 border-b border-neutral-200 bg-white lg:block">
      <Container className="flex h-full items-center justify-end gap-6 text-xs">
        {/* ── 社媒 + 联系方式 + 语言切换（全部右对齐） ── */}
        <div className="flex items-center gap-4">
          {socialChannels.length > 0 ? (
            <>
              <ul className="flex items-center gap-1" aria-label={tContact("followUs")}>
                {socialChannels.map((channel) => {
                  if (channel.href) {
                    return (
                      <li key={channel.key}>
                        <a
                          href={channel.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={ICON_CLASS}
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
                            className={cn(ICON_CLASS, isOpen && "text-primary")}
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
                            <p className="mt-1 text-xs text-neutral-500">{scanHint}</p>
                          </figure>
                        </PopoverContent>
                      </Popover>
                    </li>
                  );
                })}
              </ul>
              <span className="h-4 w-px bg-neutral-300" aria-hidden="true" />
            </>
          ) : null}

          <a
            href={`tel:${phone.replace(/-/g, "")}`}
            className="inline-flex items-center gap-1.5 text-secondary-text transition-colors hover:text-primary"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{phone}</span>
          </a>

          <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-1.5 text-secondary-text transition-colors hover:text-primary"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{email}</span>
          </a>

          <span className="h-4 w-px bg-neutral-300" aria-hidden="true" />

          <button
            type="button"
            onClick={openLanguageSelector}
            className="inline-flex items-center gap-1.5 font-medium text-secondary-text transition-colors hover:text-primary"
            aria-label={tHeader("languageSwitch")}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{localeShort}</span>
          </button>
        </div>
      </Container>
    </div>
  );
}
