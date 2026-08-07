'use client';

import { isDialableMobile } from '@tzj/device';
import { isUsableExternalUrl } from '@tzj/utils';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { fetchAgentAvailability } from '@/features/chat/api';
import { openChat } from '@/features/chat/open-chat';
import { usePathname, useRouter } from '@/i18n/navigation';
import { env } from '@/lib/env';
import { sendPopupEvent } from './events';
import { alreadyShown, markShown } from './frequency';
import type { MarketingActivity } from './types';

/**
 * 营销弹窗薄壳：fetch + 频次/路径/设备过滤 + 触发时机，零重依赖。
 * 渲染体（Dialog + MarkdownBody + Image）经 next/dynamic 懒加载——组件挂全站
 * layout，直接 import 会把 react-markdown/rehype 链拖进每个页面的客户端公共
 * bundle；无活动路径零额外 JS。
 */
const MarketingPopupDialog = dynamic(
  () => import('./MarketingPopupDialog').then((m) => ({ default: m.MarketingPopupDialog })),
  { ssr: false },
);

/** 双侧归一尾斜杠：运营填 /products/ 也能匹配 */
function normalizePath(s: string): string {
  return s.replace(/\/+$/, '') || '/';
}

/** 频次 / 排除路径 / 设备过滤（路径仅在落地页评估：落地排除页则本次会话不弹） */
function isEligible(a: MarketingActivity, pathname: string): boolean {
  if (alreadyShown(a)) return false;
  const path = normalizePath(pathname);
  const excluded = a.excludePages.some((p) => {
    const ex = normalizePath(p);
    return path === ex || path.startsWith(`${ex}/`);
  });
  if (excluded) return false;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (a.targetDevice === 'mobile' && !isMobile) return false;
  if (a.targetDevice === 'desktop' && isMobile) return false;
  return true;
}

/** 按触发时机调度 show，返回清理函数（delay/scroll 短页回退/immediate） */
function scheduleTrigger(a: MarketingActivity, show: () => void): () => void {
  if (a.triggerMode === 'delay') {
    const timer = setTimeout(show, Math.min(Math.max(a.delaySeconds, 1), 60) * 1000);
    return () => clearTimeout(timer);
  }
  if (a.triggerMode === 'scroll') {
    if (document.documentElement.scrollHeight <= window.innerHeight) {
      // 内容不足一屏的短页面自动回退 3 秒延时，避免永不触发
      const timer = setTimeout(show, 3000);
      return () => clearTimeout(timer);
    }
    const onScroll = () => {
      const half = (document.documentElement.scrollHeight - window.innerHeight) / 2;
      if (window.scrollY >= half) {
        window.removeEventListener('scroll', onScroll);
        show();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }
  show();
  return () => {};
}

export function MarketingPopup({ phone }: { phone?: string }) {
  const pathname = usePathname(); // 已剥离 locale 前缀，可直接与 excludePages 匹配
  const router = useRouter();
  const tCommon = useTranslations('common');
  const [activity, setActivity] = useState<MarketingActivity | null>(null);
  const [open, setOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅首次挂载执行——SPA 内路由切换不重复弹（频次语义按「访问」而非「页面」），excludePages 仅在落地页评估
  useEffect(() => {
    let cancelled = false;
    let cleanupTrigger: (() => void) | undefined;
    (async () => {
      const res = await fetch(`${env.apiUrl}/trade-shows/marketing/active`).catch(() => null);
      if (!res?.ok || cancelled) return;
      // API 全局 TransformInterceptor 包装为 { success, data, ... }，须取 .data
      const json = (await res.json()) as { data?: MarketingActivity[] };
      if (cancelled) return; // json 解析同为悬挂点，防清理后仍注册定时器/监听
      const [a] = json.data ?? [];
      if (!a || !isEligible(a, pathname)) return;

      // 通过全部过滤后预热渲染体 chunk：delay/scroll 等待期间并行完成，
      // 到达展示时机零网络等待；immediate 也仅多一次并行请求
      void import('./MarketingPopupDialog');

      cleanupTrigger = scheduleTrigger(a, () => {
        if (cancelled) return;
        setActivity(a);
        setOpen(true);
        markShown(a);
        // view 上报不在此发出：渲染体是懒加载 chunk，弱网下可能未就绪甚至失败；
        // 由 MarketingPopupDialog 挂载后的 effect 上报，保证「计了曝光 = 真看到了」
      });
    })().catch(() => {
      /* 兜底捕获，不外泄未处理 rejection */
    });
    return () => {
      // 挂在 layout 几乎不卸载，但按规范清理定时器与监听
      cancelled = true;
      cleanupTrigger?.();
    };
  }, []);

  // 不能用 open 卸载——Dialog 是受控组件（data-closed 出场动画 + 焦点还原），
  // open=false 时立即卸载会跳过出场动画、遮罩瞬闪且焦点无还原落点
  if (!activity) return null;

  // CTA 三级智能路由（在线判定在点击瞬间实时请求，不预取，保证实时性）：
  //  1. 有客服可接待（online + away 都算，away 坐席仍可接消息不算无人，
  //     与 ChatWidget.tryDialInstead / useAgentPresence 同口径）
  //     → 打开客服面板并自动发送「我想了解『活动标题』」；
  //  2. 无坐席连接（online + away 都为 0）且为可拨号移动设备（且配了电话）
  //     → 直接唤起拨号；
  //  3. 兜底（真正无人）→ 官网外链新标签页 / 站内活动详情页。
  const onCta = async () => {
    sendPopupEvent(activity.id, 'click');
    const avail = await fetchAgentAvailability().catch(() => null);
    if (avail && avail.online + avail.away > 0) {
      setOpen(false);
      openChat({ message: tCommon('marketingInterest', { title: activity.title }) });
      return;
    }
    if (avail && avail.online + avail.away === 0 && phone?.trim() && isDialableMobile()) {
      // 拨号不关弹窗：唤起系统拨号界面后返回页面，用户还能继续看活动内容
      window.location.href = `tel:${phone.replace(/-/g, '')}`;
      return;
    }
    if (isUsableExternalUrl(activity.externalUrl)) {
      window.open(activity.externalUrl, '_blank', 'noopener');
    } else {
      // 未填官网链接时默认去该活动详情页（站内导航，保留 locale 前缀）
      router.push(`/resources/trade-shows/${activity.slug}`);
    }
    setOpen(false);
  };

  return (
    <MarketingPopupDialog open={open} activity={activity} onCta={onCta} onOpenChange={setOpen} />
  );
}
