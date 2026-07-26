'use client';

import {
  Avatar,
  AvatarFallback,
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import { ArrowLeftRight, Check, Eye, MoreVertical, UserCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { LastOperatorCell } from '@/components/LastOperatorCell';
import type { ChatRoom, ChatRoomStatusKey, PresenceStatus } from '../types';
import type { OnlineAgent } from '../useChatSocket';
import { ConvertLeadButton } from './ConvertLeadButton';
import { VisitorInfoButton } from './VisitorInfoButton';

const statusMeta: Record<ChatRoomStatusKey, { label: string; dot: string }> = {
  waiting: { label: '等待中', dot: 'bg-sky-500' },
  active: { label: '进行中', dot: 'bg-emerald-500' },
  closed: { label: '已关闭', dot: 'bg-zinc-400' },
  archived: { label: '已归档', dot: 'bg-zinc-300' },
};

const presenceMeta: Record<PresenceStatus, { label: string; dot: string }> = {
  online: { label: '在线', dot: 'bg-emerald-500' },
  away: { label: '离开', dot: 'bg-amber-500' },
  offline: { label: '离线', dot: 'bg-zinc-400' },
};

function initials(name?: string, email?: string) {
  const base = (name ?? email ?? '?').trim();
  return base.slice(0, 1).toUpperCase() || '?';
}

/**
 * 转接弹层（P1 H3）：选择其他在线坐席将会话重新分配，含备注 + 二次确认。
 * 从 ChatHeader 抽离为模块级子组件：内聚两步确认状态，降低头部认知复杂度。
 */
function TransferPopover({
  ended,
  tip,
  candidates,
  onTransfer,
}: {
  /** 会话已结束（已关闭/已归档）时禁用转接 */
  ended: boolean;
  tip: string;
  candidates: OnlineAgent[];
  onTransfer?: (email: string, note?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // 转接两步确认：先选择坐席，再填写备注 + 确认（防误触）
  const [target, setTarget] = useState<OnlineAgent | null>(null);
  const [note, setNote] = useState('');

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTarget(null);
          setNote('');
        }
      }}
    >
      {/* Tooltip 在外、PopoverTrigger 直接包按钮：保证弹层锚点落在 DOM 上；
          禁用态用 span 包裹，保证 Tooltip 仍可触发 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="转接会话"
                disabled={ended}
                className="border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 sm:size-10"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 p-0">
        {!target ? (
          /* 第一步：选择目标坐席 */
          <div className="p-1.5">
            <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">转接给</p>
            {candidates.length === 0 ? (
              <p className="text-muted-foreground px-2 py-2 text-xs">当前没有其他在线坐席</p>
            ) : (
              candidates.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => setTarget(a)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition hover:bg-muted"
                >
                  <span
                    className={cn(
                      'inline-block h-2 w-2 shrink-0 rounded-full',
                      presenceMeta[a.status].dot,
                    )}
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-medium">{a.name || a.email}</span>
                    {a.name && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {a.email}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {a.activeRoomCount ?? 0} 个会话
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          /* 第二步：填写备注 + 确认转接 */
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-block h-2 w-2 shrink-0 rounded-full',
                  presenceMeta[target.status].dot,
                )}
              />
              <span className="text-sm font-medium">{target.name || target.email}</span>
              <span className="text-muted-foreground text-xs">
                {target.activeRoomCount ?? 0} 个会话
              </span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="转接备注（可选，让接手坐席了解上下文）"
              rows={2}
              className="border-border bg-background placeholder:text-muted-foreground focus-visible:ring-primary/40 w-full resize-none rounded-md border px-2.5 py-2 text-sm outline-none focus-visible:ring-2"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTarget(null)}
                className="text-muted-foreground h-7 px-2.5 text-xs"
              >
                返回
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onTransfer?.(target.email, note.trim() || undefined);
                  setOpen(false);
                  setTarget(null);
                  setNote('');
                }}
                className="h-7 gap-1 px-2.5 text-xs"
              >
                <Check className="h-3 w-3" />
                确认转接
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ChatHeader({
  room,
  onClose,
  onlineAgents = [],
  currentAgentEmail,
  onTransfer,
}: {
  room: ChatRoom;
  onClose: () => void;
  onlineAgents?: OnlineAgent[];
  currentAgentEmail?: string;
  onTransfer?: (email: string, note?: string) => void;
}) {
  const meta = statusMeta[room.status];
  const presence = presenceMeta[room.clientPresence ?? 'offline'];
  const name = room.clientName || room.clientEmail;
  // 转接候选：在线坐席中排除「操作者自己」与「当前已负责该会话的坐席」——
  // 转给已负责的坐席是无操作（多余），业内最佳实践（Zendesk/Intercom）直接从目标列表剔除，
  // 从源头杜绝误触；服务端 transfer-room 另有兜底校验。
  const transferCandidates = onlineAgents.filter(
    (a) => a.email !== currentAgentEmail && a.email !== room.assignedAgentEmail,
  );
  // 提炼重复判断/取名逻辑为变量，降低渲染层认知复杂度
  const ended = room.status === 'closed' || room.status === 'archived';
  const transferTip = ended ? '会话已结束，不可转接' : '转接给其他坐席';
  const assignedAgentName =
    room.assignedAgentUser?.nickname?.trim() ||
    room.assignedAgentUser?.username ||
    room.assignedAgentEmail;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="relative shrink-0">
          <Avatar className="border-border/40 h-10 w-10 rounded-2xl border sm:h-12 sm:w-12 sm:rounded-3xl">
            <AvatarFallback className="bg-primary/15 text-primary rounded-2xl text-sm font-semibold sm:rounded-3xl sm:text-base">
              {initials(room.clientName, room.clientEmail)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'border-background absolute right-0 bottom-0 inline-flex h-3 w-3 rounded-full border-2 sm:h-3.5 sm:w-3.5',
              presence.dot,
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold sm:text-base">{name}</p>
          <div className="text-muted-foreground flex items-center gap-1 truncate text-xs sm:text-sm">
            {room.clientEmail} · {meta.label} · {presence.label}
            {room.assignedAgentEmail && (
              <>
                <span className="text-muted-foreground/80">· 负责人:</span>
                {/* hover 弹出账号资料卡（复用项目封装的 LastOperatorCell） */}
                <LastOperatorCell
                  user={room.assignedAgentUser}
                  fallback={
                    room.assignedAgentEmail === currentAgentEmail ? '我' : room.assignedAgentEmail
                  }
                />
              </>
            )}
            {!room.assignedAgentEmail && room.status === 'waiting' && (
              <span className="text-amber-500">· 未分配</span>
            )}
            {room.clientPanelOpen && room.clientPresence === 'online' && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-emerald-600">
                <Eye className="h-2.5 w-2.5" />
                正在查看对话
              </span>
            )}
          </div>
        </div>
      </div>
      {/* 头部操作区：图标按钮统一 hover 提示（与访客中心/询盘操作列同款 Tooltip） */}
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <VisitorInfoButton room={room} />
          {/* 转为客户线索（已转则直达客户档案）：与访客中心/人物抽屉同源入口 */}
          <ConvertLeadButton room={room} />
          {/* 显式接管（业内最佳实践 Intercom/Zendesk）：查看别人的会话是只读浏览，
            要接手必须点「接管」——防止点一下就把同事的会话抢走 */}
          {!ended && room.assignedAgentEmail && room.assignedAgentEmail !== currentAgentEmail && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="接管会话"
                  onClick={() => currentAgentEmail && onTransfer?.(currentAgentEmail)}
                  className="border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10"
                >
                  <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>当前负责人：{assignedAgentName}，点击接管</TooltipContent>
            </Tooltip>
          )}
          {/* 转接（P1 H3）：选择其他在线坐席将会话重新分配，含备注 + 二次确认 */}
          <TransferPopover
            ended={ended}
            tip={transferTip}
            candidates={transferCandidates}
            onTransfer={onTransfer}
          />
          {!ended ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="结束会话"
                  onClick={onClose}
                  className="border-border/40 bg-background/60 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10"
                >
                  <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>结束会话</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="更多操作"
                  className="border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10"
                >
                  <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>更多操作</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </header>
  );
}
