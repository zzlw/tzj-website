'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { cn } from '@/lib/utils';
import { SearchBar } from './SearchBar';

interface SearchOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Rosenbauer 风格全屏搜索入口：输入后跳转独立结果页 */
export function SearchOverlay({ open, onOpenChange }: SearchOverlayProps) {
  const t = useTranslations('search');
  const dialogId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[80] bg-neutral-900/45 backdrop-blur-md transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={close}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        inert={!open}
        className={cn(
          // w-screen 而非 inset-x-0：宽度不随滚动条出没变化，关闭渐隐期间面板不横跳
          'fixed left-0 top-0 z-[81] w-screen px-4 pt-[10vh] transition-all duration-300 md:pt-[14vh] md:px-6',
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0',
        )}
      >
        <p id={`${dialogId}-title`} className="sr-only">
          {t('title')}
        </p>

        <div ref={panelRef} className="mx-auto flex w-full max-w-3xl gap-3">
          {/* 移动端：纵向排列，关闭按钮在上 */}
          <div className="flex w-full flex-col items-end md:hidden">
            <button
              type="button"
              onClick={close}
              className="rb-control-icon shrink-0 mb-3"
              aria-label={t('close')}
            >
              <span className="rb-control-icon__icon">
                <X className="h-4 w-4" strokeWidth={2.25} />
              </span>
            </button>
            <SearchBar
              key={open ? 'open' : 'closed'}
              className="min-w-0 flex-1 self-stretch"
              size="large"
              onSubmitted={close}
              autoFocus
            />
          </div>

          {/* 桌面端：横向排列，关闭按钮在右 */}
          <div className="hidden w-full items-center gap-3 md:flex">
            <SearchBar
              key={open ? 'open' : 'closed'}
              className="min-w-0 flex-1"
              size="large"
              onSubmitted={close}
              autoFocus
            />
            <button
              type="button"
              onClick={close}
              className="rb-control-icon shrink-0"
              aria-label={t('close')}
            >
              <span className="rb-control-icon__icon">
                <X className="h-4 w-4" strokeWidth={2.25} />
              </span>
            </button>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-white/70">{t('hint')}</p>
      </div>
    </>
  );
}
