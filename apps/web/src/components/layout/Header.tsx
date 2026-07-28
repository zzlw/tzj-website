'use client';

import { ScrollArea } from '@tzj/ui';
import { ChevronLeft, ChevronRight, Globe, Menu, Search, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SocialChannelItem } from '@/components/contact/SocialChannelBar';
import { useLanguageSelector } from '@/components/i18n/LanguageSelector';
import { ProductMegaMenu, ProductMobileAccordion } from '@/components/layout/ProductMegaMenu';
import { TopBar } from '@/components/layout/TopBar';
import { useSearch } from '@/components/search/SearchProvider';
import { Container } from '@/components/ui';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useScrollHeaderHide } from '@/hooks/useScrollHeaderHide';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { buildNavItems, type NavItem, UTILITY_LINK_KEYS } from '@/lib/navigation';
import { PRODUCTS_HREF } from '@/lib/navigation-products';
import { cn } from '@/lib/utils';

// SSR 下退化为 useEffect，避免 useLayoutEffect 的服务端告警
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type NavItemLocal = NavItem;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const hasChildren = (item: NavItemLocal) => !!item.children && item.children.length > 0;

// 收集某一级项自身及其所有后代的 href，用于判定当前路由归属哪个一级栏目
const collectHrefs = (item: NavItemLocal): string[] => [
  item.href,
  ...(item.children?.flatMap(collectHrefs) ?? []),
];

const isProductsNav = (item: NavItemLocal | null | undefined) => item?.href === PRODUCTS_HREF;

export function Header({
  topBarPhone,
  topBarEmail,
  topBarSocialChannels,
  topBarScanHint,
}: {
  topBarPhone: string;
  topBarEmail: string;
  topBarSocialChannels: SocialChannelItem[];
  topBarScanHint: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const tNav = useTranslations('nav');
  const tHeader = useTranslations('header');
  const tCommon = useTranslations('common');
  const { open: openLanguageSelector } = useLanguageSelector();
  const { open: openSearch } = useSearch();

  const navLabel = useCallback((key: string) => tNav(key as Parameters<typeof tNav>[0]), [tNav]);

  const NAV_ITEMS = useMemo(() => buildNavItems(navLabel), [navLabel]);
  const UTILITY_LINKS = useMemo(
    () =>
      UTILITY_LINK_KEYS.map((item) => ({
        label: tNav(item.key as Parameters<typeof tNav>[0]),
        href: item.href,
      })),
    [tNav],
  );

  // 当前所在栏目：取与 pathname 匹配（相等或前缀）且 href 最长的一级项，避免 /resources 与 /resources/blog 冲突
  const activeTopLabel = useMemo(() => {
    if (!pathname) return null;
    let best: string | null = null;
    let bestLen = -1;
    for (const item of NAV_ITEMS) {
      for (const href of collectHrefs(item)) {
        if (href === '/') continue;
        const base = href.split('#')[0]!;
        if ((pathname === base || pathname.startsWith(`${base}/`)) && base.length > bestLen) {
          bestLen = base.length;
          best = item.label;
        }
      }
    }
    return best;
  }, [pathname, NAV_ITEMS]);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrolled } = useScrollHeaderHide({ disabled: menuOpen });
  // 移动端抽屉钻取栈：空 = 根菜单；每深入一层 push 一个 NavItem
  const [path, setPath] = useState<NavItemLocal[]>([]);
  // 大屏双列 mega：右列展示的左列项（悬停/聚焦切换）
  const [activeSub, setActiveSub] = useState<NavItemLocal | null>(null);
  const current = path.length > 0 ? path[path.length - 1]! : null;

  const showProductMega =
    menuOpen && (isProductsNav(path[0]) || (path.length === 0 && isProductsNav(activeSub)));

  const leftList = path.length > 0 ? (path[0]!.children ?? []) : NAV_ITEMS;
  const leftTitle = path.length > 0 ? path[0]!.label : tHeader('allMenu');
  const rightOpen = !showProductMega && !!activeSub && hasChildren(activeSub);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // ── 自适应导航（priority+）：按实际可用宽度决定横向显示几个一级项，放不下的收进汉堡 ──
  const navAreaRef = useRef<HTMLDivElement>(null);
  const navMeasureRef = useRef<HTMLDivElement>(null);
  // 初始为 0：测量前 / JS 未就绪 / 移动端时，先只显示汉堡，保证导航始终可达
  const [visibleCount, setVisibleCount] = useState(0);
  const overflow = visibleCount < NAV_ITEMS.length;

  useIsomorphicLayoutEffect(() => {
    const area = navAreaRef.current;
    const measure = navMeasureRef.current;
    if (!area || !measure) return;

    const compute = () => {
      const available = area.clientWidth;
      if (available <= 0) {
        setVisibleCount(0);
        return;
      }
      const items = Array.from(measure.children) as HTMLElement[];
      let count = 0;
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (!el) break;
        // offsetLeft/offsetWidth 相对测量容器，天然包含真实 gap
        const right = el.offsetLeft + el.offsetWidth;
        if (right <= available) count = i + 1;
        else break;
      }
      setVisibleCount(count);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(area);
    // 字体加载完成后宽度会变，需重新测量
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(compute).catch(() => {});
    }
    return () => ro.disconnect();
  }, []);

  useBodyScrollLock(menuOpen);

  const openRoot = () => {
    triggerRef.current = menuButtonRef.current;
    setPath([]);
    setActiveSub(null);
    setMenuOpen(true);
  };

  // 桌面横向一级项：有子级则打开面板（初始收起右列），否则直接跳转
  const openTop = (item: NavItemLocal, el: HTMLElement) => {
    if (hasChildren(item)) {
      triggerRef.current = el;
      setPath([item]);
      setActiveSub(isProductsNav(item) ? item : null);
      setMenuOpen(true);
    } else {
      router.push(item.href);
    }
  };

  const drillInto = (item: NavItemLocal) => setPath((p) => [...p, item]);
  const back = () => setPath((p) => p.slice(0, -1));

  const close = useCallback(() => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  // Esc 关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, close]);

  // Focus trap
  useEffect(() => {
    if (!menuOpen || !asideRef.current) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !asideRef.current) return;
      const focusable = Array.from(
        asideRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const backLabel = path.length >= 2 ? path[path.length - 2]!.label : '菜单';
  const productMenuTitle = isProductsNav(path[0]) ? path[0]!.label : navLabel('products');

  return (
    <>
      <header
        className={cn(
          'site-header fixed inset-x-0 top-0 z-50 bg-white',
          scrolled && 'shadow-[0_1px_0_rgba(0,0,0,0.08),0_8px_24px_-12px_rgba(0,0,0,0.18)]',
        )}
      >
        <TopBar
          phone={topBarPhone}
          email={topBarEmail}
          socialChannels={topBarSocialChannels}
          scanHint={topBarScanHint}
        />
        <Container>
          <div className="flex h-16 items-center justify-between gap-6 lg:h-20">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center bg-primary font-display text-xl font-extrabold text-white">
                TZ
              </span>
              <span className="font-display text-xl font-extrabold tracking-tight text-neutral-900">
                {tCommon('brandName')}
              </span>
            </Link>

            <div ref={navAreaRef} className="relative hidden min-w-0 flex-1 md:block">
              <nav
                className="flex items-center justify-center gap-5 xl:gap-6"
                aria-label={tHeader('mainNav')}
              >
                {NAV_ITEMS.slice(0, visibleCount).map((item) => {
                  const isActive = item.label === activeTopLabel;
                  return (
                    <button
                      type="button"
                      key={item.label}
                      onClick={(e) => openTop(item, e.currentTarget)}
                      aria-current={isActive ? 'page' : undefined}
                      className="group relative whitespace-nowrap font-display text-[15px] font-bold text-neutral-900 transition-colors hover:text-primary"
                      aria-expanded={menuOpen && path[0]?.label === item.label}
                      aria-haspopup={hasChildren(item) ? 'true' : undefined}
                    >
                      {item.label}
                      <span
                        className={`absolute -bottom-1.5 left-0 right-0 h-0.5 origin-left bg-primary transition-transform duration-300 ${
                          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        }`}
                      />
                    </button>
                  );
                })}
              </nav>

              {/* 测量层：始终渲染全部项用于计算可用宽度，视觉隐藏、不参与布局与交互 */}
              <div
                ref={navMeasureRef}
                aria-hidden="true"
                className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-5 xl:gap-6"
              >
                {NAV_ITEMS.map((item) => (
                  <span
                    key={item.label}
                    className="whitespace-nowrap font-display text-[15px] font-bold"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openSearch}
                className="hidden w-44 items-center border border-neutral-300 px-3 py-2 text-left transition-colors hover:border-neutral-900 focus-visible:border-neutral-900 focus-visible:outline-none md:flex xl:w-56"
                aria-label={tHeader('searchAria')}
              >
                <Search className="mr-2 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
                <span className="w-full truncate text-sm text-neutral-500">
                  {tHeader('searchPlaceholder')}
                </span>
              </button>

              <button
                type="button"
                onClick={openSearch}
                className="flex h-10 w-10 items-center justify-center text-neutral-900 transition-colors hover:text-primary md:hidden"
                aria-label={tHeader('searchAria')}
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                ref={menuButtonRef}
                onClick={openRoot}
                className={`h-10 w-10 items-center justify-center text-neutral-900 transition-colors hover:text-primary ${
                  overflow ? 'flex' : 'hidden'
                }`}
                aria-label={tHeader('openMenu')}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </Container>
      </header>

      <div
        className={`fixed inset-0 z-[55] bg-neutral-900/30 backdrop-blur-md transition-opacity duration-300 ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={close}
        aria-hidden="true"
      />

      <aside
        ref={asideRef}
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label={current ? current.label : tHeader('navMenu')}
        className={cn(
          'fixed inset-y-0 left-0 z-[60] flex w-full transform flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(.75,0,.35,1)] lg:inset-y-5 lg:left-5',
          showProductMega ? 'lg:w-[min(92vw,72rem)]' : 'lg:w-auto',
          !showProductMega && rightOpen
            ? 'lg:rounded-none lg:[clip-path:polygon(0_0,calc(100%_-_2.75rem)_0,100%_2.75rem,100%_100%,0_100%)]'
            : 'lg:rounded-[14px]',
          menuOpen ? 'translate-x-0' : '-translate-x-[120%]',
        )}
      >
        {/* 移动端头部：仅承载返回按钮（大屏为双列 mega，无需返回，整行隐藏） */}
        <div className="flex h-16 shrink-0 items-center px-5 lg:hidden">
          {path.length > 0 ? (
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-neutral-700 transition-colors hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {tHeader('back')}
              {backLabel}
            </button>
          ) : null}
        </div>

        {/* 关闭按钮：移动端右上角；大屏恒定悬浮在一级面板（左列）右上角 */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={close}
          className={cn(
            'rb-control-icon absolute z-20 right-4 top-4 lg:top-6',
            showProductMega
              ? 'lg:right-6 lg:left-auto lg:translate-x-0'
              : 'lg:right-auto lg:left-[30rem] lg:-translate-x-[calc(100%+0.75rem)]',
          )}
          aria-label={tHeader('closeMenu')}
        >
          <span className="rb-control-icon__icon" aria-hidden="true">
            <X className="h-4 w-4" strokeWidth={2.25} />
          </span>
        </button>

        {/* ── 大屏：产品中心四列 Mega / 其他栏目双列 ── */}
        <div className="hidden min-h-0 flex-1 overflow-hidden lg:flex">
          {showProductMega ? (
            <ProductMegaMenu
              title={productMenuTitle}
              browseAllLabel={navLabel('productBrowseAll')}
              label={navLabel}
              onNavigate={close}
            />
          ) : (
            <>
              <ScrollArea className="min-h-0 w-[30rem] shrink-0 overscroll-contain px-8 pb-10 pt-6 lg:px-12 lg:pt-24">
                <h2 className="mb-5 font-display text-2xl font-extrabold text-neutral-900">
                  {leftTitle}
                </h2>
                <ul className="flex flex-col">
                  {leftList.map((item) => {
                    const expandable = hasChildren(item);
                    const active = activeSub?.label === item.label;
                    const rowClass = `flex w-full items-center justify-between py-5 text-left font-display text-[17px] font-bold transition-colors hover:text-primary ${
                      active ? 'text-primary' : 'text-neutral-900'
                    }`;
                    return (
                      <li
                        key={item.label}
                        className="border-b border-neutral-200"
                        onMouseEnter={() => {
                          if (isProductsNav(item)) {
                            setActiveSub(item);
                          } else {
                            setActiveSub(expandable ? item : null);
                          }
                        }}
                      >
                        {expandable ? (
                          <button
                            type="button"
                            onClick={() => setActiveSub(item)}
                            onFocus={() => setActiveSub(item)}
                            aria-expanded={active}
                            className={rowClass}
                          >
                            {item.label}
                            <ChevronRight
                              className={`h-4 w-4 transition-colors ${active ? 'text-primary' : 'text-neutral-400'}`}
                              aria-hidden="true"
                            />
                          </button>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={close}
                            onFocus={() => setActiveSub(null)}
                            className={rowClass}
                          >
                            {item.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>

              <div
                className={`min-h-0 shrink-0 overflow-hidden bg-neutral-50 transition-[width] duration-300 ease-[cubic-bezier(.75,0,.35,1)] ${
                  rightOpen ? 'w-[30rem]' : 'w-0'
                }`}
                aria-hidden={!rightOpen}
              >
                <ScrollArea
                  className={`h-full w-[30rem] overscroll-contain px-8 pb-10 pt-6 transition-[transform,opacity] duration-300 ease-[cubic-bezier(.75,0,.35,1)] lg:px-12 lg:pt-24 ${
                    rightOpen ? 'translate-x-0 opacity-100' : '-translate-x-6 opacity-0'
                  }`}
                >
                  {activeSub && hasChildren(activeSub) ? (
                    <>
                      <h3 className="mb-5 font-display text-2xl font-extrabold text-neutral-900">
                        {activeSub.label}
                      </h3>
                      <ul className="flex flex-col">
                        {activeSub.children!.map((child) => (
                          <li key={child.label} className="border-b border-neutral-200">
                            <Link
                              href={child.href}
                              onClick={close}
                              className="block py-5 font-display text-[17px] font-bold text-neutral-900 transition-colors hover:text-primary"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        {/* ── 移动端：单列钻取（带返回） ── */}
        <ScrollArea className="flex-1 lg:hidden">
          {current && isProductsNav(current) ? (
            <ProductMobileAccordion
              title={current.label}
              browseAllLabel={navLabel('productBrowseAll')}
              label={navLabel}
              onNavigate={close}
            />
          ) : current ? (
            <nav className="flex flex-col px-6 py-4" aria-label="子导航">
              {/* 当前层级标题 */}
              <h2 className="py-6 font-display text-2xl font-extrabold text-neutral-900 border-b-0">
                {current.label}
              </h2>

              {/* 子菜单项列表 */}
              {current.children?.map((child, idx) => {
                const isLastChild = idx === (current.children?.length ?? 0) - 1;
                return hasChildren(child) ? (
                  <button
                    type="button"
                    key={child.label}
                    onClick={() => drillInto(child)}
                    className={`flex items-center justify-between py-5 text-left transition-colors hover:text-primary ${
                      !isLastChild ? 'border-b border-neutral-200' : ''
                    }`}
                  >
                    <span className="font-display text-base font-medium text-neutral-800">
                      {child.label}
                    </span>
                    <ChevronRight className="h-5 w-5 text-neutral-400" aria-hidden="true" />
                  </button>
                ) : (
                  <Link
                    key={child.label}
                    href={child.href}
                    onClick={close}
                    className={`py-5 font-display text-base font-medium text-neutral-800 transition-colors hover:text-primary ${
                      !isLastChild ? 'border-b border-neutral-200' : ''
                    }`}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <div className="py-2">
              <nav aria-label={tHeader('mainNav')}>
                {NAV_ITEMS.map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    onClick={() => (hasChildren(item) ? drillInto(item) : go(item.href))}
                    className="pointer group flex w-full items-center justify-between border-b border-neutral-300 px-6 py-5 text-left transition-colors hover:text-primary"
                  >
                    <span className="font-display text-2xl font-bold text-neutral-900 group-hover:text-primary">
                      {item.label}
                    </span>
                    {hasChildren(item) && (
                      <ChevronRight
                        className="h-5 w-5 text-neutral-900 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </nav>

              <div className="flex flex-col gap-3 px-6 py-7">
                {UTILITY_LINKS.map((u) => (
                  <Link
                    key={u.label}
                    href={u.href}
                    onClick={close}
                    className="text-sm text-secondary-text transition-colors hover:text-primary"
                  >
                    {u.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={openLanguageSelector}
                  className="inline-flex w-fit items-center gap-1.5 text-sm text-secondary-text transition-colors hover:text-primary"
                >
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  {tHeader('mobileLanguage')}
                </button>
              </div>
            </div>
          )}
        </ScrollArea>
      </aside>
    </>
  );
}
