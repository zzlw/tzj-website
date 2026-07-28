'use client';

/**
 * 访客档案抽屉（Intercom / Zendesk 访客 360° 模式）：
 * 从「访客会话」页点击访客弹出，展示该访客的全部聊天会话与消息记录（只读）。
 * 两级视图：会话列表 → 消息线程（顶部返回）。
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  cn,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from '@tzj/ui';
import { ArrowLeft, ArrowUpRight, MessagesSquare, Search, UserRoundPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { VisitorActivityTimeline } from '@/components/analytics/VisitorActivityTimeline';
import { CopyableText } from '@/components/CopyableText';
import { VisitorConvertToLeadDialog } from '@/components/visitor-drawer/VisitorConvertToLeadDialog';
import {
  type AnalyticsVisitorInquiry,
  useAnalyticsVisitorActivity,
  useVisitorInquiries,
  type VisitorIdentityBlock,
  type VisitorProfileIdentity,
} from '@/features/analytics';
import { useStickyFlag } from '@/lib/use-sticky-flag';
import { getChatRoom, getChatRooms } from '../api';
import type { ChatMessage, ChatRoom, ChatRoomStatusKey } from '../types';
import { ChatMessageBubble } from './ChatMessageBubble';
import { MatchedSnippet } from './message-search-highlight';

const statusMeta: Record<ChatRoomStatusKey, { label: string; dot: string }> = {
  waiting: { label: '等待中', dot: 'bg-info' },
  active: { label: '进行中', dot: 'bg-success' },
  closed: { label: '已关闭', dot: 'bg-zinc-400' },
  archived: { label: '已归档', dot: 'bg-zinc-300' },
};

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function previewOf(room: ChatRoom): string {
  const lm = room.lastMessage;
  if (!lm) return '暂无消息';
  const prefix = lm.sender === 'agent' ? '客服: ' : lm.sender === 'system' ? '' : '访客: ';
  const body = lm.content?.trim() || (lm.attachmentCount > 0 ? '[附件]' : '');
  return prefix + (body || '（空消息）');
}

/** 负责人轻量芯片（与列表 AssigneeChip 同一思路：纯 span、与文本等重） */
function AssigneeTag({ room }: { room: ChatRoom }) {
  if (!room.assignedAgentEmail) return null;
  const name =
    room.assignedAgentUser?.nickname?.trim() || room.assignedAgentEmail.split('@')[0] || '坐席';
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info-foreground"
      title={room.assignedAgentEmail}
    >
      {name}
    </span>
  );
}

interface Props {
  /** ID 驱动：仅凭 visitorId 取数即可渲染头部与各 tab */
  visitorId: string | null;
  /** 加载前的身份占位（姓名/邮箱等）；加载完成后由 activity.identity 覆盖 */
  seed?: Partial<VisitorProfileIdentity>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 作为二层抽屉叠在 IP 抽屉之上时提供：头部返回按钮弹回下层 */
  onBack?: () => void;
  /** 聊天 tab 只在具 chat.view 权限时可见（页面级已放宽到 analytics.view） */
  canViewChat: boolean;
  /** 询盘 tab 只在具 contacts.view 权限时可见 */
  canViewInquiry: boolean;
  /** 遮罩层自定义 class：作为二层抽屉叠在其它抽屉之上时传 bg-transparent，避免双层遮罩变黑 */
  overlayClassName?: string;
}

/**
 * 线程内命中消息的滚动定位 + 瞬时高亮（约 2s 淡出），返回当前应高亮的消息 id。
 * 抽成独立 hook：既复用「双 rAF 等布局完成再 scrollIntoView」的定位手法，
 * 也把这段带分支的副作用移出组件，避免抬高组件认知复杂度。
 */
function useThreadJumpHighlight(
  containerRef: RefObject<HTMLDivElement | null>,
  activeRoomId: string | null,
  highlightId: string | null,
  messages: ChatMessage[] | undefined,
): string | null {
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeRoomId || !highlightId) return;
    if (!(messages ?? []).some((m) => m.messageId === highlightId)) return;
    if (jumpedRef.current === highlightId) return;
    jumpedRef.current = highlightId;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(highlightId)}"]`,
        );
        el?.scrollIntoView({ block: 'center', behavior: 'auto' });
        setFlashId(highlightId);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashId(null), 2200);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [containerRef, activeRoomId, highlightId, messages]);

  // 返回列表/关闭（activeRoomId 归空）时复位，避免再次进入误触发旧跳转
  useEffect(() => {
    if (activeRoomId) return;
    jumpedRef.current = null;
    setFlashId(null);
  }, [activeRoomId]);

  // 卸载清理计时器，避免对已卸载组件 setState
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return flashId;
}

/** 消息线程面板：加载骨架 / 加载失败 / 空消息 / 消息气泡（命中瞬时高亮）。
    抽出以收敛主组件认知复杂度。 */
function ThreadPanel({
  scrollRef,
  isLoading,
  loadFailed,
  messages,
  flashId,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  loadFailed: boolean;
  messages: ChatMessage[] | undefined;
  flashId: string | null;
}) {
  const list = messages ?? [];
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={cn('h-14 w-3/4', i % 2 ? 'ml-auto' : '')} />
          ))}
        </div>
      ) : loadFailed ? (
        <p className="text-muted-foreground py-8 text-center text-sm">加载失败</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">暂无消息</p>
      ) : (
        <div className="space-y-3">
          {list.map((m) => (
            <ChatMessageBubble
              key={m.messageId}
              message={m}
              highlighted={m.messageId === flashId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 会话列表面板：加载骨架 / 空态（区分搜索无结果）/ 会话行（命中片段高亮）。
    抽出以收敛主组件认知复杂度。 */
function RoomListPanel({
  isLoading,
  rooms,
  query,
  onOpenRoom,
}: {
  isLoading: boolean;
  rooms: ChatRoom[];
  query: string;
  onOpenRoom: (roomId: string, messageId?: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (rooms.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <MessagesSquare className="text-muted-foreground/40 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            {query ? `未找到包含「${query}」的聊天记录` : '该访客暂无聊天记录'}
          </p>
          {!query && (
            <p className="text-muted-foreground/70 max-w-[280px] text-xs">
              仅展示身份打通后创建的会话（访客端新版本上线后生效）
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <ul className="divide-y">
        {rooms.map((room) => {
          const meta = statusMeta[room.status] ?? statusMeta.closed;
          return (
            <li key={room.roomId}>
              <button
                type="button"
                className="hover:bg-muted/50 flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors"
                onClick={() => onOpenRoom(room.roomId, room.matchedMessage?.messageId)}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', meta.dot)} />
                  <span className="text-xs font-medium">{meta.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(room.lastActivity)}
                  </span>
                  <span className="ml-auto" />
                  <AssigneeTag room={room} />
                </div>
                {query && room.matchedMessage ? (
                  <MatchedSnippet matched={room.matchedMessage} query={query} />
                ) : (
                  <p className="text-muted-foreground truncate text-xs">{previewOf(room)}</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 分段切换按钮：浏览行为 / 聊天记录 */
function SegmentTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

/** 浏览行为面板：按 visitorId 取数，渲染共享 VisitorActivityTimeline（时间线 UI 唯一实现来源）。 */
function VisitorActivityPanel({
  visitorId,
  active,
}: {
  visitorId: string | null;
  active: boolean;
}) {
  const { data, isLoading } = useAnalyticsVisitorActivity(active ? visitorId : null);
  return <VisitorActivityTimeline data={data} isLoading={isLoading} />;
}

/** 询盘状态徽章：待处理/已处理 + 已转线索标记。 */
function InquiryStatusBadges({ inquiry }: { inquiry: AnalyticsVisitorInquiry }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {inquiry.isHandled ? (
        <Badge
          variant="outline"
          className="border-success/30 bg-success-muted text-success-foreground"
        >
          已处理
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-warning/40 bg-warning-muted text-warning-foreground"
        >
          待处理
        </Badge>
      )}
      {inquiry.convertedCustomerId ? (
        <Badge variant="outline" className="border-info/30 bg-info-muted text-info-foreground">
          已转线索
        </Badge>
      ) : null}
    </div>
  );
}

/** 询盘 tab 面板：按 visitorId 归并的 Contact 列表（只读，时间倒序）。 */
function VisitorInquiryPanel({ visitorId, active }: { visitorId: string | null; active: boolean }) {
  const { data, isLoading } = useVisitorInquiries(active ? visitorId : null);
  const list = data?.data ?? [];
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <p className="text-muted-foreground py-16 text-center text-sm">该访客暂无询盘记录</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <ul className="divide-y">
        {list.map((it) => (
          <li key={it.id} className="space-y-1.5 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">{formatDateTime(it.createdAt)}</span>
              <span className="ml-auto" />
              <InquiryStatusBadges inquiry={it} />
            </div>
            {it.subject ? <p className="text-sm font-medium">{it.subject}</p> : null}
            <p className="text-muted-foreground whitespace-pre-wrap break-words text-sm">
              {it.message}
            </p>
            {it.email || it.phone ? (
              <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                {it.email ? <span>{it.email}</span> : null}
                {it.phone ? <span>{it.phone}</span> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 按 visitorId 查询 + 按 email 兜底合并（存量会话无 visitorId），按最后活跃倒序。抽出以收敛主组件复杂度。 */
async function fetchVisitorRooms(
  visitor: VisitorProfileIdentity,
  debouncedSearch: string,
): Promise<ChatRoom[]> {
  const common = { take: 100, ...(debouncedSearch ? { search: debouncedSearch } : {}) };
  const byVisitorId = visitor.visitorId
    ? await getChatRooms({ visitorId: visitor.visitorId, ...common })
    : { rooms: [] as ChatRoom[] };
  let rooms = byVisitorId.rooms;
  if (visitor.email) {
    const byEmail = await getChatRooms({ clientEmail: visitor.email, ...common });
    const seen = new Set(rooms.map((r) => r.roomId));
    rooms = [...rooms, ...byEmail.rooms.filter((r) => !seen.has(r.roomId))];
  }
  return [...rooms].sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
  );
}

/** 已识别 / 匿名 身份徐章 */
function VisitorStatusBadge({ identified }: { identified: boolean }) {
  return identified ? (
    <Badge variant="outline" className="border-success/30 bg-success-muted text-success-foreground">
      已识别
    </Badge>
  ) : (
    <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
      匿名
    </Badge>
  );
}

/** 抽屉头：返回按钮（聊天线程级）+ 身份标题徽章 + 联系行 + 转化入口。抽出以收敛主组件复杂度。 */
function VisitorSheetHeader({
  visitor,
  displayName,
  showBack,
  onBack,
  showConvert,
  convertedCustomerId,
  onConvertClick,
}: {
  visitor: VisitorProfileIdentity | null;
  displayName: string;
  showBack: boolean;
  onBack: () => void;
  /** 身份块加载完成后才展示转化入口（确保锚点/状态准确） */
  showConvert: boolean;
  /** 非空则该访客已转客户，头部显示链接而非按钮 */
  convertedCustomerId: string | null;
  onConvertClick: () => void;
}) {
  return (
    <SheetHeader className="border-b px-5 py-4">
      <div className="flex items-center gap-2">
        {showBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="返回会话列表"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <SheetTitle className="flex items-center gap-2 text-base">
          {displayName}
          {visitor ? <VisitorStatusBadge identified={visitor.identified} /> : null}
        </SheetTitle>
      </div>
      <SheetDescription className="flex flex-wrap items-center gap-x-2 text-xs">
        {visitor ? (
          <CopyableText
            value={visitor.visitorId}
            display={`#${visitor.visitorId.slice(0, 8)}`}
            className="[&>span]:text-xs [&>button]:text-xs"
          />
        ) : null}
        {visitor?.company ? <span>{visitor.company}</span> : null}
        {visitor?.email ? <span>{visitor.email}</span> : null}
        {visitor?.phone ? <span>{visitor.phone}</span> : null}
      </SheetDescription>
      {showConvert ? (
        <div className="mt-1">
          {convertedCustomerId ? (
            <Link
              href={`/customers/${convertedCustomerId}`}
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              已转客户 · 查看档案
            </Link>
          ) : (
            <Button type="button" variant="outline" size="xs" onClick={onConvertClick}>
              <UserRoundPlus className="mr-1.5 h-3.5 w-3.5" />
              转为客户线索
            </Button>
          )}
        </div>
      ) : null}
    </SheetHeader>
  );
}

/** 聊天记录 tab 主体：搜索框 + 会话列表/消息线程（各自已抽为面板组件）。抽出以收敛主组件复杂度。 */
function VisitorChatBody({
  search,
  onSearchChange,
  activeRoomId,
  threadScrollRef,
  threadLoading,
  threadFailed,
  messages,
  flashId,
  roomsLoading,
  rooms,
  query,
  onOpenRoom,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  activeRoomId: string | null;
  threadScrollRef: RefObject<HTMLDivElement | null>;
  threadLoading: boolean;
  threadFailed: boolean;
  messages: ChatMessage[] | undefined;
  flashId: string | null;
  roomsLoading: boolean;
  rooms: ChatRoom[];
  query: string;
  onOpenRoom: (roomId: string, messageId?: string) => void;
}) {
  return (
    <>
      {/* 该访客聊天历史检索（Intercom/Zendesk 360° 抽屉惯例）：仅列表级展示，命中会话过滤 + 片段高亮 */}
      {activeRoomId ? null : (
        <div className="border-b px-5 py-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索该访客的聊天记录"
              className="h-9 pl-8"
            />
          </div>
          {roomsLoading ? null : (
            <p className="text-muted-foreground/70 mt-2 text-xs">共 {rooms.length} 个聊天会话</p>
          )}
        </div>
      )}
      {activeRoomId ? (
        <ThreadPanel
          scrollRef={threadScrollRef}
          isLoading={threadLoading}
          loadFailed={threadFailed}
          messages={messages}
          flashId={flashId}
        />
      ) : (
        <RoomListPanel
          isLoading={roomsLoading}
          rooms={rooms}
          query={query}
          onOpenRoom={onOpenRoom}
        />
      )}
    </>
  );
}

type ProfileTab = 'activity' | 'inquiry' | 'chat';

/** 从 visitorId + 后端 identity + 打开前 seed 派生头部身份（identity 优先，seed 兑底）。 */
function buildVisitorProfile(
  visitorId: string | null,
  identity: VisitorProfileIdentity | undefined,
  seed: Partial<VisitorProfileIdentity> | undefined,
): VisitorProfileIdentity | null {
  if (!visitorId) return null;
  return {
    visitorId,
    name: identity?.name ?? seed?.name ?? null,
    email: identity?.email ?? seed?.email ?? null,
    phone: identity?.phone ?? seed?.phone ?? null,
    company: identity?.company ?? seed?.company ?? null,
    identified: identity?.identified ?? seed?.identified ?? false,
  };
}

/** 顶部分段切换条：浏览行为（默认）/ 询盘（contacts.view）/ 聊天记录（chat.view）。 */
function VisitorTabBar({
  effectiveTab,
  canViewChat,
  canViewInquiry,
  onSelect,
}: {
  effectiveTab: ProfileTab;
  canViewChat: boolean;
  canViewInquiry: boolean;
  onSelect: (t: ProfileTab) => void;
}) {
  if (!canViewChat && !canViewInquiry) return null;
  return (
    <div className="flex gap-2 border-b px-5 py-2">
      <SegmentTab
        active={effectiveTab === 'activity'}
        onClick={() => onSelect('activity')}
        label="浏览行为"
      />
      {canViewInquiry && (
        <SegmentTab
          active={effectiveTab === 'inquiry'}
          onClick={() => onSelect('inquiry')}
          label="询盘"
        />
      )}
      {canViewChat && (
        <SegmentTab
          active={effectiveTab === 'chat'}
          onClick={() => onSelect('chat')}
          label="聊天记录"
        />
      )}
    </div>
  );
}

/** tab 主体：浏览行为 / 询盘各自取数面板；聊天记录复用传入节点（非聊天 tab 时不执行聊天 hooks）。 */
function VisitorSheetBody({
  effectiveTab,
  visitorId,
  open,
  chat,
}: {
  effectiveTab: ProfileTab;
  visitorId: string | null;
  open: boolean;
  chat: ReactNode;
}) {
  if (effectiveTab === 'activity') {
    return <VisitorActivityPanel visitorId={visitorId} active={open} />;
  }
  if (effectiveTab === 'inquiry') {
    return <VisitorInquiryPanel visitorId={visitorId} active={open} />;
  }
  return <>{chat}</>;
}

/**
 * 转化入口状态收敛：身份块加载后暴露头部按钮 props + 对话框节点，
 * 抽出以避免抬高主组件（VisitorProfileSheet）的认知复杂度。
 * 未转显示「转为客户线索」按钮，已转显示「已转客户」链接（去重锚点取最近询盘 contactId）。
 */
function useVisitorConvert(
  visitorId: string | null,
  identityBlock: VisitorIdentityBlock | undefined,
  visitor: VisitorProfileIdentity | null,
  region: string | null,
) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  // 本抽屉是全局复用的（访客中心/询盘页也会拉起）：仅在聊天控制台打开时算「在线客服」获客
  const convertSource = pathname?.startsWith('/chat') ? 'chat' : 'website';
  const [convertOpen, setConvertOpen] = useState(false);
  const headerProps = {
    showConvert: !!visitor && !!identityBlock,
    convertedCustomerId: identityBlock?.convertedCustomerId ?? null,
    onConvertClick: () => setConvertOpen(true),
  };
  // 转化成功：关闭对话框 + 失效该访客的行为/询盘缓存，头部据此刷新为「已转客户」链接
  function handleConverted() {
    setConvertOpen(false);
    if (!visitorId) return;
    queryClient.invalidateQueries({ queryKey: ['analytics', 'visitor-activity', visitorId] });
    queryClient.invalidateQueries({ queryKey: ['analytics', 'visitor-inquiries', visitorId] });
  }
  const dialog =
    visitorId && identityBlock ? (
      <VisitorConvertToLeadDialog
        source={convertSource}
        seed={{
          visitorId,
          name: visitor?.name ?? null,
          email: visitor?.email ?? null,
          phone: visitor?.phone ?? null,
          company: visitor?.company ?? null,
          contactId: identityBlock.latestContactId ?? null,
          region,
        }}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={handleConverted}
      />
    ) : null;
  return { headerProps, dialog, open: convertOpen, closeConvert: () => setConvertOpen(false) };
}

export function VisitorProfileSheet({
  visitorId,
  seed,
  open,
  onOpenChange,
  onBack,
  canViewChat,
  canViewInquiry,
  overlayClassName,
}: Props) {
  // 顶部分段：浏览行为（默认）/ 询盘（contacts.view）/ 聊天记录（chat.view）
  const [tab, setTab] = useState<ProfileTab>('activity');
  const tabAllowed = (t: ProfileTab) =>
    t === 'activity' || (t === 'inquiry' && canViewInquiry) || (t === 'chat' && canViewChat);
  const effectiveTab = tabAllowed(tab) ? tab : 'activity';
  // ID 驱动：仅凭 visitorId 取身份，头部优先用后端 identity，回退打开前透传的 seed。
  const activityQuery = useAnalyticsVisitorActivity(open ? visitorId : null);
  const visitor = buildVisitorProfile(visitorId, activityQuery.data?.identity, seed);
  // 转化入口（未转显示按钮 / 已转显示链接）收敛到 hook，避免抬高主组件复杂度
  const convert = useVisitorConvert(
    visitorId,
    activityQuery.data?.identity,
    visitor,
    activityQuery.data?.techInfo.region ?? null,
  );
  // 转化弹窗「粘滞」标记：弹窗打开期间为真，关闭后再保持短暂窗口（覆盖其卸载/焦点回迁）。
  // 本抽屉据此在 onInteractOutside/onEscapeKeyDown 拦截关闭弹窗时级联到抽屉的误关闭，保证 LIFO。
  const convertSticky = useStickyFlag(convert.open);
  // 当前查看的会话 roomId；null = 会话列表级
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  // 该访客聊天历史搜索：正文命中经后端 pg_trgm 检索，返回 matchedMessage 片段
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // 点击命中会话后要在其线程内定位/高亮的消息 id
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);

  // 输入防抖：避免每次击键都打后端检索
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // 会话列表：按 visitorId 查询 + 按 email 兜底合并（存量会话无 visitorId，已识别访客经邮箱找回）；
  // 有搜索词时透传 search，后端按「该访客范围 AND 正文命中」返回并回填 matchedMessage 片段
  const roomsQuery = useQuery({
    queryKey: ['visitor-rooms', visitor?.visitorId, visitor?.email, debouncedSearch],
    queryFn: () => (visitor ? fetchVisitorRooms(visitor, debouncedSearch) : []),
    enabled: open && !!visitor,
  });

  // 消息线程：打开具体会话时拉取完整消息
  const threadQuery = useQuery({
    queryKey: ['visitor-room-detail', activeRoomId],
    queryFn: () => getChatRoom(activeRoomId as string),
    enabled: open && !!activeRoomId,
  });

  const displayName = visitor?.name || visitor?.email || visitor?.phone || '匿名访客';

  // 命中跳转 + 瞬时高亮（滚动定位、约 2s 淡出）收敛到 hook，避免抬高组件复杂度
  const flashId = useThreadJumpHighlight(
    threadScrollRef,
    activeRoomId,
    highlightId,
    threadQuery.data?.messages,
  );

  // 返回会话列表级：清空命中态（flash/jumped 复位由 hook 依 activeRoomId 归空处理）
  function backToList() {
    setActiveRoomId(null);
    setHighlightId(null);
  }

  function handleClose() {
    onOpenChange(false);
    // 关闭后重置到列表级 + 切回默认浏览行为 tab + 清空搜索/命中态，下次打开从头开始
    setActiveRoomId(null);
    setTab('activity');
    setSearch('');
    setDebouncedSearch('');
    setHighlightId(null);
    convert.closeConvert();
  }

  // 头部返回：聊天线程内优先返回列表；否则（存在下层栈）弹回下层抽屉
  const threadBack = effectiveTab === 'chat' && !!activeRoomId;
  const showBack = threadBack || !!onBack;
  function handleHeaderBack() {
    if (threadBack) {
      backToList();
      return;
    }
    onBack?.();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (v) {
            onOpenChange(true);
            return;
          }
          // LIFO：转化弹窗在上层时，抽屉忽略自身关闭请求（ESC/点遮罩/X 先关最上层弹窗），避免整栈坍塌
          if (convert.open) return;
          handleClose();
        }}
      >
        <SheetContent
          side="right"
          overlayClassName={overlayClassName}
          className="flex w-[520px] max-w-[90vw] flex-col p-0 sm:max-w-[520px]"
          onEscapeKeyDown={(e) => {
            if (convertSticky.current) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (convertSticky.current) e.preventDefault();
          }}
        >
          <VisitorSheetHeader
            visitor={visitor}
            displayName={displayName}
            showBack={showBack}
            onBack={handleHeaderBack}
            showConvert={convert.headerProps.showConvert}
            convertedCustomerId={convert.headerProps.convertedCustomerId}
            onConvertClick={convert.headerProps.onConvertClick}
          />

          <VisitorTabBar
            effectiveTab={effectiveTab}
            canViewChat={canViewChat}
            canViewInquiry={canViewInquiry}
            onSelect={setTab}
          />

          <VisitorSheetBody
            effectiveTab={effectiveTab}
            visitorId={visitor?.visitorId ?? null}
            open={open}
            chat={
              <VisitorChatBody
                search={search}
                onSearchChange={setSearch}
                activeRoomId={activeRoomId}
                threadScrollRef={threadScrollRef}
                threadLoading={threadQuery.isLoading}
                threadFailed={!threadQuery.isLoading && !threadQuery.data}
                messages={threadQuery.data?.messages}
                flashId={flashId}
                roomsLoading={roomsQuery.isLoading}
                rooms={roomsQuery.data ?? []}
                query={debouncedSearch}
                onOpenRoom={(roomId, messageId) => {
                  setActiveRoomId(roomId);
                  setHighlightId(messageId ?? null);
                }}
              />
            }
          />
        </SheetContent>
      </Sheet>
      {convert.dialog}
    </>
  );
}
