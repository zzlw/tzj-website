'use client';

import type { BusinessHours } from '@tzj/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAgentAvailability } from '@/features/chat/api';
import { isWithinBusinessHours } from '@/features/chat/business-hours';
import { type AgentPresenceStatus, resolveVisitorPresence } from '@/features/chat/presence';

export interface UseAgentPresenceOptions {
  /** socket 是否已连接（用于防抖判定：仅连接态下的 offline/away 才可信） */
  connected: boolean;
  /** 当前在线坐席数；-1 表示尚未收到服务端信号 */
  agentsOnline: number;
  /** 当前离开（away）坐席数 */
  agentsAway: number;
  /** REST 兜底时回写坐席在线数（useVisitorChat 提供） */
  setAgentsOnline: (n: number) => void;
  /** REST 兜底时回写坐席离开数（useVisitorChat 提供） */
  setAgentsAway: (n: number) => void;
  /** 站点配置的客服工作时间（缺省用 DEFAULT_BUSINESS_HOURS） */
  businessHours?: BusinessHours;
}

export interface UseAgentPresenceResult {
  /** 访客可见的最终档位：瞬时 away 仍呈现为 online，持续 away 才为 away */
  displayPresence: AgentPresenceStatus;
  /** 可用性档位（决定圆点颜色）：green=在线；amber=离开/营业中无人；gray=离线 */
  availability: AgentPresenceStatus;
  /** 是否「无人值守」（offline 稳定 5s 后成立） */
  noAgentOnline: boolean;
  /** 当前是否处于非工作时间（按站点配置时区） */
  outsideHours: boolean;
  /** socket presence-changed 信号入口：由 ChatWidget 的事件注册 effect 调用 */
  applyPresenceSignal: (status: AgentPresenceStatus) => void;
}

/**
 * 聚合坐席 presence 展示态（从 ChatWidget 拆出，行为不变）：
 * socket 计数（权威）+ presence-changed 明细 + REST 自愈轮询 + 营业时间兜底，
 * 再经 5s（offline）/ 90s（away）双防抖得出访客可见档位与圆点颜色。
 */
export function useAgentPresence({
  connected,
  agentsOnline,
  agentsAway,
  setAgentsOnline,
  setAgentsAway,
  businessHours,
}: UseAgentPresenceOptions): UseAgentPresenceResult {
  // 服务端推送的客服在线状态（默认 online，由 presence-changed 事件更新）
  const [agentPresence, setAgentPresence] = useState<AgentPresenceStatus>('online');
  // 是否已收到真实 presence 信号（用于区分「真实在线」与「乐观默认在线」）
  const [hasRealPresence, setHasRealPresence] = useState(false);

  // presence-changed：关注对方（agent）的状态（socket 事件回调入口）
  const applyPresenceSignal = useCallback((status: AgentPresenceStatus) => {
    setAgentPresence(status);
    setHasRealPresence(true);
  }, []);

  // 兜底 + 自愈：通过 REST 获取坐席可用性快照，并同步在线/离开计数与聚合态。
  //  - mount 时立即拉取，避免 socket 尚未连接时显示错误的离线状态；
  //  - 之后作为「自愈安全网」在窗口聚焦 / 定时触发（见下方 effect）：即便某次 socket
  //    presence 推送丢失，也能在数秒内自动纠正，杜绝「有客服上线但访客侧不变、需刷新」。
  const syncAvailability = useCallback(() => {
    return fetchAgentAvailability()
      .then((avail) => {
        setAgentsOnline(avail.online);
        setAgentsAway(avail.away);
        setAgentPresence(avail.online > 0 ? 'online' : avail.away > 0 ? 'away' : 'offline');
        setHasRealPresence(true);
      })
      .catch(() => {});
  }, [setAgentsOnline, setAgentsAway]);

  useEffect(() => {
    let cancelled = false;
    void syncAvailability();
    // 自愈安全网：窗口重新聚焦 / 标签页恢复可见时立即再同步（用户回到页面第一时间看到正确状态），
    // 并每 25s 轮询一次兜底（业内最佳实践：实时推送为主 + 轻量对账轮询，防止漏事件导致状态僵死）。
    const onFocus = () => {
      if (!cancelled && !document.hidden) void syncAvailability();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const timer = setInterval(() => {
      if (!document.hidden) void syncAvailability();
    }, 25_000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(timer);
    };
  }, [syncAvailability]);

  // 工作时间兜底：后端未推送离线时，非工作时间（按站点配置时区）前端自动判定离线
  const [outsideHours, setOutsideHours] = useState(false);
  useEffect(() => {
    setOutsideHours(!isWithinBusinessHours(businessHours));
  }, [businessHours]);

  // 实际展示状态：
  //  - 已收到真实 presence 信号 → 始终信任真实信号（工作时间不再硬覆盖，
  //    避免「非工作时间但真人在线」被误判为离线，把真实在线的客服藏起来）。
  //  - 未收到信号（乐观兜底）→ 工作时间默认在线、非工作时间离线。
  const effectivePresence: AgentPresenceStatus = useMemo(() => {
    // 团队可用性以 agents-online 计数为权威：该事件在 socket 建立时即无条件挂载，
    // 由服务端按「持有存活 socket 的坐席」实时统计，是坐席上/下线最可靠的依据；
    // REST 自愈轮询也写同一组计数。以此为主可杜绝「有客服上线但仅 presence-changed
    // 事件未应用、访客侧不变、需刷新」。
    //  - online>0 → 在线（坐席上线即时点亮，无需等 presence-changed 或刷新）；
    //  - 已收到计数且 online=0 → away>0 视为离开、否则离线；
    //  - 计数未知（-1，尚未收到任何信号）→ 回退到 presence-changed 明细 / 营业时间兜底。
    if (agentsOnline > 0) return 'online';
    if (agentsOnline === 0) return agentsAway > 0 ? 'away' : 'offline';
    if (hasRealPresence) return agentPresence;
    return outsideHours ? 'offline' : 'online';
  }, [agentsOnline, agentsAway, hasRealPresence, agentPresence, outsideHours]);

  // D：全站坐席可用性（是否「无人值守」）。
  // 以团队聚合态为准：坐席断线时网关即时广播真实可用性快照（按存活 socket 统计），
  // 访客立即看到「已离线」；再稳定 5s 才切换为「暂无坐席在线 · 留言」提示，
  // 防御极短抖动（如坐席刷新页面 1-2s 内重连即恢复在线，不会看到无人值守提示）。
  const [stableNoAgentOffline, setStableNoAgentOffline] = useState(false);
  const offlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (offlineDebounceRef.current) {
      clearTimeout(offlineDebounceRef.current);
      offlineDebounceRef.current = null;
    }
    const isOffline = connected && effectivePresence === 'offline';
    if (!isOffline) {
      setStableNoAgentOffline(false);
      return;
    }
    offlineDebounceRef.current = setTimeout(() => setStableNoAgentOffline(true), 5000);
    return () => {
      if (offlineDebounceRef.current) clearTimeout(offlineDebounceRef.current);
    };
  }, [connected, effectivePresence]);
  const noAgentOnline = stableNoAgentOffline;

  // E：对「离开中」也做显示防抖。坐席切桌面 / 切标签页会经 user-idle 瞬时置为 away，
  // 但这是瞬时缺口，不应让访客立即看到「离开中 · 留言后我们会尽快回复」。
  // 仅当 away 持续超过 AWAY_DISPLAY_GRACE_MS 才在访客侧降级为「离开中」，
  // 与网关断线宽限（乐观保持在线）同一思路。
  const AWAY_DISPLAY_GRACE_MS = 90_000;
  const [stableAway, setStableAway] = useState(false);
  const awayDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (awayDebounceRef.current) {
      clearTimeout(awayDebounceRef.current);
      awayDebounceRef.current = null;
    }
    const isAway = connected && effectivePresence === 'away';
    if (!isAway) {
      setStableAway(false);
      return;
    }
    awayDebounceRef.current = setTimeout(() => setStableAway(true), AWAY_DISPLAY_GRACE_MS);
    return () => {
      if (awayDebounceRef.current) clearTimeout(awayDebounceRef.current);
    };
  }, [connected, effectivePresence]);

  // 访客可见的最终档位：瞬时 away 仍呈现为 online，持续 away 才为 away。
  const displayPresence: AgentPresenceStatus = resolveVisitorPresence({
    status: effectivePresence,
    stableAway,
  });

  // 可用性档位（决定圆点颜色）：green=真人在线可即时响应；amber=离开或
  // 「营业中但无坐席」（open but unmanned）；gray=真正离线/非工作时间无人。
  // 这样「营业中无人值守」与「已下班」被清晰区分，不会让用户误以为门店关闭。
  const availability: AgentPresenceStatus = useMemo(() => {
    if (displayPresence === 'online') {
      return noAgentOnline ? 'away' : 'online';
    }
    if (displayPresence === 'away') return 'away';
    // offline：营业中但无坐席（无人在岗）→ amber；真正下班无人 → gray
    return noAgentOnline && !outsideHours ? 'away' : 'offline';
  }, [displayPresence, noAgentOnline, outsideHours]);

  return { displayPresence, availability, noAgentOnline, outsideHours, applyPresenceSignal };
}
