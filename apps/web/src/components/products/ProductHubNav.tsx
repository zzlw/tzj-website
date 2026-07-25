'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PRODUCT_LINES, PRODUCT_NAV_DIVIDER_BEFORE } from '@/lib/product-catalog';
import { cn } from '@/lib/utils';

const OVERVIEW_ID = 'overview';

/**
 * 实测固定 Header 当前可见高度（bottom）：隐藏态被 translate 上移后 bottom ≤ 0 归 0，
 * 过渡中取部分值。不再解析 CSS 变量（--site-header-height 为 calc()，parseFloat 会得 NaN）。
 */
function getHeaderOffsetPx(): number {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return 0;
  return Math.max(0, header.getBoundingClientRect().bottom);
}

/** Header 完整高度（与是否隐藏无关，transform 不改变 rect.height） */
function getHeaderHeightPx(): number {
  const header = document.querySelector<HTMLElement>('.site-header');
  return header?.getBoundingClientRect().height ?? 0;
}

function hubLinkClass(active: boolean) {
  return cn(
    'inline-flex shrink-0 items-center font-bold transition-colors',
    'border border-neutral-300 bg-white text-secondary-text',
    'hover:border-neutral-900 hover:text-neutral-900',
    '2xl:h-full 2xl:border-0 2xl:border-b-2 2xl:bg-transparent',
    active
      ? 'border-primary text-neutral-900 2xl:border-primary 2xl:text-primary'
      : '2xl:border-transparent 2xl:hover:border-primary',
  );
}

export function ProductHubNav() {
  const navRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState(OVERVIEW_ID);

  const getScrollAnchorOffset = useCallback(() => {
    return getHeaderOffsetPx() + (navRef.current?.offsetHeight ?? 0) + 12;
  }, []);

  const updateActiveFromScroll = useCallback(() => {
    const marker = getScrollAnchorOffset();
    let current = OVERVIEW_ID;

    for (const line of PRODUCT_LINES) {
      const el = document.getElementById(line.anchor);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= marker) {
        current = line.anchor;
      }
    }

    setActiveId(current);
  }, [getScrollAnchorOffset]);

  useEffect(() => {
    updateActiveFromScroll();

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateActiveFromScroll();
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    const observer = new MutationObserver(onScroll);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-header-hidden'],
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      observer.disconnect();
    };
  }, [updateActiveFromScroll]);

  const scrollToSection = useCallback((id: string) => {
    setActiveId(id);
    const target = document.getElementById(id);
    if (!target) return;

    const navHeight = navRef.current?.offsetHeight ?? 0;
    const rectTop = target.getBoundingClientRect().top;
    // 预判滚动方向对应的终态（Rosenbauer 式顶栏：下滑隐藏 / 上滑重现）：
    // 向上滚 Header 会重新出现，需预留完整高度，否则定位后卡片被遮挡；向下滚 Header 隐藏，不预留
    const willScrollUp = rectTop < navHeight + getHeaderOffsetPx();
    const headerOffset = willScrollUp ? getHeaderHeightPx() : 0;
    const top = rectTop + window.scrollY - headerOffset - navHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const dividerSet = new Set<number>(PRODUCT_NAV_DIVIDER_BEFORE);

  return (
    <nav
      ref={navRef}
      aria-label="十三大产品线导航"
      className={cn(
        'product-hub-nav sticky z-40 border-b border-neutral-300 bg-white',
        'shadow-[0_1px_0_rgba(0,0,0,0.06)]',
      )}
    >
      <div className="mx-auto w-full max-w-[1680px] px-4 py-3 2xl:px-8 2xl:py-0 lg:px-12 xl:px-16">
        <div
          className={cn(
            'flex flex-wrap gap-1.5',
            '2xl:rb-scroll-x 2xl:h-[var(--product-hub-nav-height)] 2xl:flex-nowrap 2xl:gap-0.5 2xl:overflow-x-auto',
          )}
        >
          <a
            href={`#${OVERVIEW_ID}`}
            onClick={(event) => {
              event.preventDefault();
              scrollToSection(OVERVIEW_ID);
            }}
            aria-current={activeId === OVERVIEW_ID ? 'location' : undefined}
            className={cn(hubLinkClass(activeId === OVERVIEW_ID), 'h-9 px-3 text-sm')}
          >
            全部
          </a>
          {PRODUCT_LINES.map((line, index) => {
            const active = activeId === line.anchor;
            return (
              <span key={line.id} className="flex shrink-0 items-stretch">
                {dividerSet.has(index) ? (
                  <span
                    className="mx-1 hidden w-px self-center bg-neutral-300 2xl:block 2xl:h-5"
                    aria-hidden="true"
                  />
                ) : null}
                <a
                  href={`#${line.anchor}`}
                  onClick={(event) => {
                    event.preventDefault();
                    scrollToSection(line.anchor);
                  }}
                  title={line.title}
                  aria-current={active ? 'location' : undefined}
                  className={cn(
                    hubLinkClass(active),
                    'h-9 gap-1 px-2.5 text-xs sm:gap-1.5 sm:px-3 sm:text-sm',
                  )}
                >
                  <span className="font-display text-primary">
                    {String(line.index).padStart(2, '0')}
                  </span>
                  <span className="hidden whitespace-nowrap sm:inline">{line.shortTitle}</span>
                </a>
              </span>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
