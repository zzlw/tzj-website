'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChatPresence } from '../ChatPresenceProvider';
import { useOpenChatRoom } from '../use-open-chat-room';
import type { AgentNotificationCounts } from '../useChatSocket';

type RoomCount = NonNullable<AgentNotificationCounts['roomCounts']>[number];

/** 安全截断上限（常态未读会话个位数，不做分页/加载更多） */
const MAX_ITEMS = 50;

/**
 * 通知弹层内容（Popover 打开才挂载）：
 * - 数据：挂载时主动拉一次全量计数，打开期间订阅两个 counts 事件实时刷新，卸载即退订
 * - 口径：与主徽标 actionableUnread 一致（未分配 或 分配给我），他人会话不进弹层
 * - 全部已读：逐房间 markRead（不带 messageIds = 整房间已读），列表随广播收敛清空
 */
export function NotificationPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { socket, agentEmail } = useChatPresence();
  const openRoom = useOpenChatRoom();

  // null = 首包未到（加载态/断连态），[] 起即为有效数据
  const [roomCounts, setRoomCounts] = useState<RoomCount[] | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    // 主动拉一次全量计数（网关已有 get-notification-counts handler）
    socket.requestNotificationCounts();
    // 打开期间实时刷新（两个事件负载形状一致）
    const handlePayload = (payload: AgentNotificationCounts) => {
      setRoomCounts(payload.roomCounts ?? []);
    };
    const offInitial = socket.on('notification-counts', handlePayload);
    const offUpdated = socket.on('notification-counts-updated', handlePayload);
    return () => {
      offInitial();
      offUpdated();
    };
  }, [socket]);

  // 口径过滤 + 排序：仅一条规则——待认领（未分配）置顶，其余保持服务端返回顺序
  const actionable = useMemo(() => {
    if (!roomCounts) return null;
    const filtered = roomCounts.filter(
      (r) => r.unreadCount > 0 && (!r.assignedAgentEmail || r.assignedAgentEmail === agentEmail),
    );
    return [
      ...filtered.filter((r) => !r.assignedAgentEmail),
      ...filtered.filter((r) => Boolean(r.assignedAgentEmail)),
    ].slice(0, MAX_ITEMS);
  }, [roomCounts, agentEmail]);

  const handleOpenRoom = useCallback(
    (roomId: string) => {
      openRoom(roomId);
      onNavigate?.();
    },
    [openRoom, onNavigate],
  );

  const handleMarkAllRead = useCallback(() => {
    if (!actionable?.length) return;
    setMarkingAll(true);
    // markRead 不带 messageIds = 整房间已读；不手动清空列表，随后续 counts 广播自然收敛
    for (const room of actionable) {
      socket.markRead(room.roomId);
    }
  }, [actionable, socket]);

  // 广播收敛清零后复位按钮态（防止下次出现未读时按钮仍 disabled）
  useEffect(() => {
    if (markingAll && actionable?.length === 0) {
      setMarkingAll(false);
    }
  }, [markingAll, actionable]);

  return (
    <div className="flex flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <p className="text-sm font-medium">消息通知</p>
        {actionable && actionable.length > 0 ? (
          <button
            type="button"
            disabled={markingAll}
            onClick={handleMarkAllRead}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            全部已读
          </button>
        ) : null}
      </div>
      {actionable === null ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {socket.connected ? '加载中…' : '连接已断开，请稍后重试'}
        </p>
      ) : actionable.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">暂无新消息</p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto">
          {actionable.map((room) => (
            <button
              key={room.roomId}
              type="button"
              onClick={() => handleOpenRoom(room.roomId)}
              className="flex w-full cursor-pointer items-start gap-3 border-b border-border p-3 text-left transition-colors last:border-0 hover:bg-accent"
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {room.clientEmail}
                  </span>
                  {!room.assignedAgentEmail && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      待认领
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {room.unreadCount} 条新消息
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
