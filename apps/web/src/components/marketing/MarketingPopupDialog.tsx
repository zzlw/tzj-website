'use client';

import { Dialog, DialogContent, DialogTitle, ScrollArea, Sheet, SheetContent } from '@tzj/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { MarkdownBody } from '@/components/content/MarkdownBody';
import { MediaImage } from '@/components/MediaImage';
import { Eyebrow, RbButton } from '@/components/ui';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { tradeShowTypeLabelI18n } from '@/lib/content-labels';
import { sendPopupEvent } from './events';
import type { MarketingActivity } from './types';

/**
 * 营销弹窗渲染体（经 next/dynamic 懒加载，勿在薄壳外直接 import）。
 * view 上报放在本组件挂载 effect：懒加载 chunk 就绪且真正渲染后才计曝光。
 *
 * 视觉规格见 docs/marketing-popup-visual-redesign.md：
 * - 三段式 grid（头图/深色 banner → 滚动正文 → 常驻 CTA 区），长文时 X 与 CTA 不随滚动消失；
 *   有图时头图放在滚动区内随正文一起滚动（X 自带暗色底片，不依赖头图 scrim）；
 * - Rosenbauer 工业风归队：Eyebrow 眉标 + rb-h3 标题 + RbButton 主 CTA + rounded-[2px] 锐角；
 * - 双形态：桌面居中 Dialog / 移动端（<640px）底部抽屉 Sheet，挂载时一次性判定
 *   （薄壳保证本组件仅在客户端触发时机渲染，window 必然可用）。
 */

/** 有图头图区：通栏矮幅（移动 5:2 / 桌面 2:1），位于滚动区顶部随正文一起滚动 */
function CoverBanner({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative aspect-[5/2] w-full sm:aspect-[2/1]">
      <MediaImage
        src={src}
        alt={title}
        fill
        sizes="(max-width: 640px) 100vw, 512px"
        className="object-cover"
        preload
      />
    </div>
  );
}

export function MarketingPopupDialog({
  open,
  activity,
  onCta,
  onOpenChange,
}: {
  open: boolean;
  activity: MarketingActivity;
  onCta: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const tCommon = useTranslations('common');
  const tTradeShows = useTranslations('content.categories.tradeShows');
  const closeRef = useRef<HTMLButtonElement>(null);
  // 形态一次性判定：sm 断点以下走底部抽屉；resize 不追随（弹窗生命周期短，避免形态跳变）
  const [isSheet] = useState(() => window.matchMedia('(max-width: 639px)').matches);

  // 弹窗期间锁定背景滚动：modal=false 让 Base UI 不接管滚动锁（见下方 modal 注释），
  // 否则滑轮/触摸落在遮罩上会直接滚动页面；复用全站统一的 useBodyScrollLock
  // （含滚动条宽度回补，与搜索/语言抽屉同一套机制）
  useBodyScrollLock(open);

  useEffect(() => {
    sendPopupEvent(activity.id, 'view');
    // 初始焦点落在次要「关闭」链接：避免营销 CTA 抢焦点，键盘用户一键即可退出
    closeRef.current?.focus();
  }, [activity.id]);

  const eyebrowLabel = tradeShowTypeLabelI18n(activity.eventType, tTradeShows);
  // 弹窗图与详情页封面图区分运营：专用 popupImage 优先，留空回退 coverImage（兼容存量活动）
  const bannerImage = activity.popupImage?.trim() || activity.coverImage?.trim() || '';
  const hasImage = Boolean(bannerImage);
  // 弹窗文案与详情正文区分运营：专用 popupContent 优先，留空回退 content（兼容存量活动）
  const bodyContent = activity.popupContent?.trim() || activity.content;

  const body = (
    <>
      {/* 段 1：无图时的深色品牌 banner（Hero 语言：深空灰 + 白字 + 红眉标 + 红色底条）；
          有图时此段置空，头图移入段 2 随正文一起滚动 */}
      {!hasImage && (
        <div className="bg-neutral-900">
          <div className="px-6 pb-5 pr-12 pt-6 sm:px-8 sm:pr-12">
            <Eyebrow inverted>{eyebrowLabel}</Eyebrow>
            <DialogTitle className="rb-h3 mt-3 text-white">{activity.title}</DialogTitle>
          </div>
          <div className="h-1 w-full bg-primary" />
        </div>
      )}

      {/* 段 2：唯一滚动区（含头图）——统一公共 ScrollArea，可滚动时滚动条常显 */}
      <ScrollArea
        type="always"
        className="min-h-0 [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
      >
        {hasImage && <CoverBanner src={bannerImage} title={activity.title} />}
        <div className="px-6 pb-4 pt-5 sm:px-8">
          {hasImage && (
            <>
              <Eyebrow>{eyebrowLabel}</Eyebrow>
              <DialogTitle className="rb-h3 mt-3 text-neutral-900">{activity.title}</DialogTitle>
            </>
          )}
          <MarkdownBody
            content={bodyContent}
            className={`text-sm leading-relaxed text-secondary-text ${hasImage ? 'mt-4' : ''}`}
          />
        </div>
      </ScrollArea>

      {/* 段 3：常驻 CTA 区——主 CTA 是唯一强视觉按钮，「关闭」为描边次级按钮 */}
      <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-5">
        <RbButton onClick={onCta} className="w-full justify-between sm:w-auto">
          {activity.ctaText}
        </RbButton>
        <button
          ref={closeRef}
          type="button"
          onClick={() => onOpenChange(false)}
          className="inline-flex h-11 w-full items-center justify-center rounded-[2px] border border-border px-6 text-sm font-medium text-secondary-text transition-colors hover:border-neutral-400 hover:text-text sm:w-auto"
        >
          {tCommon('close')}
        </button>
      </div>
    </>
  );

  // X 自带半透明暗色底片：头图会随正文滚走，X 可能落在图片/白底/深色 banner 上，
  // 底片保证任意背景下可见；ring-offset-0 避免深色上出白圈
  const closeClassName =
    'rounded-full bg-black/35 p-1.5 text-white opacity-100 hover:bg-black/55 focus:ring-offset-0';
  // 层级：web 站内 z 刻度 Header 50 → 抽屉/ChatWidget 60 → 语言抽屉 70 → 搜索 80；
  // 营销弹窗作为模态居 90/91，压过客服挂件但仍低于 Toast/Tooltip（100）；
  // 百度商桥第三方挂件已在 globals.css 被圈进堆叠上下文，不会再盖住本层
  const overlayClassName = 'z-[90]';
  // 行模板随形态切换：有图时头图在滚动区内，只剩「滚动区/CTA」两个 grid 子项；
  // 若仍用三行模板，滚动区会落进 auto 行随内容无限撑高，CTA 区被 overflow-hidden 裁切
  const layoutClassName = `z-[91] grid ${
    hasImage ? 'grid-rows-[minmax(0,1fr)_auto]' : 'grid-rows-[auto_minmax(0,1fr)_auto]'
  } gap-0 overflow-hidden p-0 motion-reduce:animate-none`;

  // 弹窗可能在首页下半屏懒加载 section 尚未水合时就打开，而 Base UI 只要
  // modal !== false 就会给弹窗外整棵 DOM 打 aria-hidden（'trap-focus' 也不例外，
  // 见 DialogPopup 的 modal: modal !== false → markOthers ariaHidden），导致后续
  // 水合属性 mismatch；只有 modal=false 完全跳过 inert 化。营销弹窗本就是非阻断
  // 浮层，放弃焦点圈定可接受（ESC/遮罩点击关闭、初始焦点管理均不受影响）
  const modal = false;

  if (isSheet) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} modal={modal}>
        <SheetContent
          side="bottom"
          overlayClassName={overlayClassName}
          closeClassName={closeClassName}
          className={`max-h-[60vh] rounded-t-[2px] ${layoutClassName}`}
        >
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogContent
        overlayClassName={overlayClassName}
        closeClassName={closeClassName}
        className={`max-h-[70vh] w-[calc(100%-2rem)] ${hasImage ? 'max-w-lg' : 'max-w-md'} rounded-[2px] sm:rounded-[2px] ${layoutClassName}`}
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}
