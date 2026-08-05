'use client';

import { useCallback } from 'react';
import { useAgentPhone } from '@/features/chat/AgentPhoneContext';
import { fetchAgentAvailability } from '@/features/chat/api';
import { openChat } from '@/features/chat/open-chat';
import { isDialableMobile } from '@tzj/device';

interface BookConsultOptions {
  /** 场景化开场消息（覆盖默认） */
  message?: string;
  /** 兜底跳转路径（默认 /contact） */
  fallbackHref?: string;
}

/**
 * 「预约咨询」三级智能分流 Hook——与营销弹窗 CTA / ChatWidget 启动器同一策略：
 *  1. 有坐席在线（online + away > 0）→ 打开聊天面板并自动发送场景化消息
 *  2. 无坐席 + 可拨号移动设备 → 直接唤起系统拨号
 *  3. 兜底（真正无人 / 桌面设备 / 接口失败）→ 降级到联系表单页
 *
 * 口径与 MarketingPopup.onCta / ChatWidget.tryDialInstead 完全一致：
 * online + away 都为 0 才算无人——away 坐席仍持有存活连接可接消息。
 */
export function useBookConsultChat(options: BookConsultOptions = {}) {
  const { message, fallbackHref = '/contact' } = options;
  const phone = useAgentPhone();

  const handleClick = useCallback(async () => {
    // 1. 实时查询坐席可用性（点击瞬间请求，不预取，保证实时性）
    const avail = await fetchAgentAvailability().catch(() => null);

    // 2. 有坐席在线 → 打开聊天面板 + 自动发送场景化消息
    if (avail && avail.online + avail.away > 0) {
      openChat({ message: message?.trim() || undefined });
      return;
    }

    // 3. 无坐席 + 可拨号手机 → 直接拨号（与 ChatWidget.tryDialInstead 同口径）
    if (avail && avail.online + avail.away === 0 && phone?.trim() && isDialableMobile()) {
      window.location.href = `tel:${phone.replace(/-/g, '')}`;
      return;
    }

    // 4. 兜底 → 降级到联系表单
    window.location.href = fallbackHref;
  }, [message, fallbackHref, phone]);

  return { handleClick };
}
