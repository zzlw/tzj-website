'use client';

import type { AgentProfile, BusinessHours } from '@tzj/types';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  ImagePreview,
  ImagePreviewProvider,
  ScrollArea,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import {
  ArrowDown,
  ArrowUp,
  File as FileIcon,
  Loader2,
  Maximize2,
  MessageCircle,
  Mic,
  Minimize2,
  Paperclip,
  Smile,
  SquarePen,
  X,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  collectVisitorContext,
  createRoom,
  fetchAgentAvailability,
  fetchVisitorToken,
  getRoom,
  presignChatAttachment,
  sendMessageHTTP,
} from '@/features/chat/api';
import type { ChatAttachment, ChatMessage, ChatRoom } from '@/features/chat/types';
import { useVisitorChat } from '@/features/chat/useVisitorChat';
import { resolveVisitorPresence } from '@/features/chat/presence';
import { resolveMediaUrl } from '@/lib/media-url';
import { ChatMarkdown } from './ChatMarkdown';
import { EmojiPicker } from './EmojiPicker';

const STORAGE_KEY = 'tzj_chat_visitor';
// 会话级标记：避免刷新/重渲染重复主动打扰（Intercom 默认「每会话一次」）
const BUBBLE_DISMISSED_KEY = 'tzj_chat_bubble_dismissed'; // 用户主动关闭
const BUBBLE_SHOWN_KEY = 'tzj_chat_bubble_shown'; // 已自动展示过欢迎

const I18N = {
  'zh-CN': {
    brand: '拓之迹客服',
    close: '关闭',
    expand: '放大聊天框',
    minimize: '还原聊天框',
    subtitle: '在线客服 · 通常几分钟内回复',
    // 多坐席 / SLA 提示（头像点旁）
    onlineAgent: '在线客服',
    multiAgent: '{n} 位客服在线',
    slaMins: '通常 {x} 分钟内回复',
    slaFew: '通常几分钟内回复',
    lastOnline: '最后在线：',
    presenceAway: '离开中 · 留言后我们会尽快回复',
    presenceOffline: '已离线 · 留言后将在工作时间回复',
    presenceOutsideOnline: '客服在线（非工作时间）· 回复可能稍慢',
    offlineHint: '我们已下班，留言后会在工作时间尽快回复。',
    presenceNoAgent: '暂无坐席在线 · 留言后我们会尽快回复',
    noAgentHint: '当前没有客服在线，留言后我们会尽快通过邮件或电话回复。',
    noAgentInvite: '👋 您好！我们暂时不在线，留言后我们会尽快回复。',
    welcome: '您好 👋\n\n请描述您的问题，我会尽快为您解答。',
    send: '发送',
    inputPlaceholder: '发消息…',
    closed: '本次会话已结束',
    closedHint: '如需进一步帮助，请重新发起咨询或拨打我们的电话。',
    closedReopenHint: '本次会话已结束，回复即可重开',
    newChat: '开始新对话',
    today: '今天',
    yesterday: '昨天',
    failed: '连接聊天服务失败，请稍后再试。',
    agentName: '客服小拓',
    agentRole: '在线客服',
    aiGreeting: '您好 👋\n\n我是拓之迹客服小拓，请描述您的问题，我会尽快为您解答。',
    launcherInvite: '👋 您好！有什么可以帮您的吗？',
    launcherInviteOffline: '👋 您好！我们暂时不在线，留言后我们会尽快回复。',
    justNow: '刚刚',
    minutesAgo: '{n} 分钟前',
    hoursAgo: '{n} 小时前',
    daysAgo: '{n} 天前',
    attach: '附件',
    emoji: '表情',
    moreMenu: '更多',
    downloadTranscript: '下载对话记录',
    comingSoon: '敬请期待',
    typing: '对方正在输入…',
    uploadFailed: '文件上传失败，请重试',
    newMessages: '{n} 条新消息',
  },
  'zh-TW': {
    brand: '拓之跡客服',
    close: '關閉',
    expand: '放大聊天框',
    minimize: '還原聊天框',
    subtitle: '在線客服 · 通常幾分鐘內回覆',
    // 多坐席 / SLA 提示（頭像點旁）
    onlineAgent: '在線客服',
    multiAgent: '{n} 位客服在線',
    slaMins: '通常 {x} 分鐘內回覆',
    slaFew: '通常幾分鐘內回覆',
    lastOnline: '最後在線：',
    presenceAway: '離開中 · 留言後我們會盡快回覆',
    presenceOffline: '已離線 · 留言後將於工作時間回覆',
    presenceOutsideOnline: '客服在線（非工作時間）· 回覆可能稍慢',
    offlineHint: '我們已下班，留言後會於工作時間盡快回覆。',
    presenceNoAgent: '暫無坐席在線 · 留言後我們會盡快回覆',
    noAgentHint: '目前沒有客服在線，留言後我們會盡快透過郵件或電話回覆。',
    noAgentInvite: '👋 您好！我們暫時不在線，留言後我們會盡快回覆。',
    welcome: '您好 👋\n\n請描述您的問題，我會盡快為您解答。',
    send: '傳送',
    inputPlaceholder: '發訊息…',
    closed: '本次會話已結束',
    closedHint: '如需進一步協助，請重新發起諮詢或撥打我們的電話。',
    closedReopenHint: '本次會話已結束，回覆即可重開',
    newChat: '開始新對話',
    today: '今天',
    yesterday: '昨天',
    failed: '連線聊天服務失敗，請稍後再試。',
    agentName: '客服小拓',
    agentRole: '在線客服',
    aiGreeting: '您好 👋\n\n我是拓之跡客服小拓，請描述您的問題，我會盡快為您解答。',
    launcherInvite: '👋 您好！有什麼可以幫您的嗎？',
    launcherInviteOffline: '👋 您好！我們暫時不在線，留言後我們會盡快回覆。',
    justNow: '剛剛',
    minutesAgo: '{n} 分鐘前',
    hoursAgo: '{n} 小時前',
    daysAgo: '{n} 天前',
    attach: '附件',
    emoji: '表情',
    moreMenu: '更多',
    downloadTranscript: '下載對話記錄',
    comingSoon: '敬請期待',
    typing: '對方正在輸入…',
    uploadFailed: '檔案上傳失敗，請重試',
    newMessages: '{n} 則新訊息',
  },
  en: {
    brand: 'TZJ Support',
    close: 'Close',
    expand: 'Expand chat',
    minimize: 'Minimize chat',
    subtitle: 'Support agent · Typically replies in minutes',
    // 多坐席 / SLA 提示（头像点旁）
    onlineAgent: 'Support agent',
    multiAgent: '{n} agents online',
    slaMins: 'Typically replies within {x} min',
    slaFew: 'Typically replies within minutes',
    lastOnline: 'Last online: ',
    presenceAway: "Away · We'll reply as soon as we can",
    presenceOffline: "Offline · We'll reply during business hours",
    presenceOutsideOnline: 'Agent online (outside business hours) · replies may be slower',
    offlineHint: "We're offline right now. We'll reply during business hours.",
    presenceNoAgent: "No agents online · We'll reply as soon as we can",
    noAgentHint:
      "No agents are online right now. Leave a message and we'll get back to you by email or phone.",
    noAgentInvite:
      "👋 Hi there! We're currently offline. Leave a message and we'll get back to you soon.",
    welcome: "Hi there 👋\n\nTell us what you need and we'll get back to you shortly.",
    send: 'Send',
    inputPlaceholder: 'Send a message…',
    closed: 'This conversation is closed',
    closedHint: 'Need more help? Start a new chat or give us a call.',
    closedReopenHint: 'This conversation is closed — just reply to reopen it',
    newChat: 'Start new chat',
    today: 'Today',
    yesterday: 'Yesterday',
    failed: 'Failed to reach the chat service. Please try again later.',
    agentName: 'Support Team',
    agentRole: 'Support Agent',
    aiGreeting:
      "Hi there 👋\n\nI'm Tuo, the support agent for TZJ. Tell me what you need and I'll do my best to help.",
    launcherInvite: '👋 Hi there! How can we help you today?',
    launcherInviteOffline:
      "👋 Hi there! We're currently offline. Leave a message and we'll get back to you soon.",
    justNow: 'Just now',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
    daysAgo: '{n}d ago',
    attach: 'Attachment',
    emoji: 'Emoji',
    moreMenu: 'More',
    downloadTranscript: 'Download transcript',
    comingSoon: 'Coming soon',
    typing: 'typing…',
    uploadFailed: 'File upload failed, please try again',
    newMessages: '{n} new messages',
  },
} as const;

type LocaleKey = keyof typeof I18N;
type TI18N = (typeof I18N)[LocaleKey];
type AgentPresence = 'online' | 'away' | 'offline';

/** 把时间戳格式化为「刚刚 / N 分钟前 / N 小时前 / N 天前」（按当前 locale） */
function formatRelativeTime(ts: number, locale: string): string {
  const t = I18N[locale as LocaleKey] ?? I18N['zh-CN'];
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minutesAgo.replace('{n}', String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t.hoursAgo.replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  return t.daysAgo.replace('{n}', String(days));
}

// 客服工作时间兜底默认值（后端未下发 businessHours 时使用）
const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  enabled: true,
  timezone: 'Asia/Shanghai',
  weekdays: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 18,
  holidays: [],
};

// 依据站点设置的工作时间，判断当前是否处于客服在线时段（按业务时区）。
// 作为 presence 兜底层：后端未推送离线时，非工作时间前端自动判定离线。
//  - enabled=false → 不判定，始终视为在线
//  - 命中节假日（MM-DD）或非工作日 → 视为非工作时间（离线）
function isWithinBusinessHours(
  cfg: BusinessHours = DEFAULT_BUSINESS_HOURS,
  now: Date = new Date(),
): boolean {
  if (!cfg.enabled) return true;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: cfg.timezone,
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = dayMap[get('weekday')] ?? 0;
  if (!cfg.weekdays.includes(day)) return false;
  const mmdd = `${get('month')}-${get('day')}`;
  if (cfg.holidays.includes(mmdd)) return false;
  const hour = Number(get('hour').replace(/\D/g, '')) || 0;
  return hour >= cfg.startHour && hour < cfg.endHour;
}

function formatTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale.startsWith('zh') ? 'zh-CN' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${Number((bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1))} ${units[i]}`;
}

/** 扩展名 → MIME，与后端 ALLOWED_ATTACHMENT_TYPES 对齐。 */
const EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
};

/**
 * 解析上传文件的 MIME。浏览器对 .zip 等二进制常把 File.type 报成
 * "" 或 application/octet-stream，直接发给后端会被白名单拒绝；
 * 此时回退到扩展名推断，保证类型可信且被服务端允许。
 */
function resolveContentType(file: File): string {
  const fromType = file.type && file.type !== 'application/octet-stream' ? file.type : '';
  if (fromType) return fromType;
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

/** "今天 HH:mm" / "昨天 HH:mm" / 否则日期+时间 */
function formatDayLabel(iso: string, locale: string, t: TI18N): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = new Intl.DateTimeFormat(locale.startsWith('zh') ? 'zh-CN' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  if (sameDay) return `${t.today} ${time}`;
  if (isYest) return `${t.yesterday} ${time}`;
  return new Intl.DateTimeFormat(locale.startsWith('zh') ? 'zh-CN' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** 气泡用相对时间："刚刚" / "X 分钟前" / "X 小时前" / "X 天前" */
function formatRelative(iso: string | number | undefined, t: TI18N): string {
  if (iso == null) return t.justNow;
  const time = typeof iso === 'number' ? iso : new Date(iso).getTime();
  if (Number.isNaN(time)) return t.justNow;
  const diff = Date.now() - time;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t.justNow;
  if (min < 60) return t.minutesAgo.replace('{n}', String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return t.hoursAgo.replace('{n}', String(hr));
  return t.daysAgo.replace('{n}', String(Math.floor(hr / 24)));
}

function normalizeMessage(m: ChatMessage): ChatMessage {
  return {
    ...m,
    timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp).toISOString(),
  };
}

export function ChatWidget({
  businessHours,
  agentProfile,
}: {
  businessHours?: BusinessHours;
  agentProfile?: AgentProfile;
}) {
  const locale = useLocale() as string;
  const t = I18N[(locale as LocaleKey) in I18N ? (locale as LocaleKey) : 'en'];

  // 在线客服资料：优先用站点设置配置，缺失字段回退到本地 i18n 默认
  const agentName = agentProfile?.name?.trim() || t.agentName;
  const agentTitle = agentProfile?.title?.trim() || t.agentRole;
  const agentAvatarRaw = agentProfile?.avatar?.trim() || '';
  const agentAvatarUrl = agentAvatarRaw ? resolveMediaUrl(agentAvatarRaw) : '';
  const greetingText = agentProfile?.greeting?.trim() || t.aiGreeting;

  const [token, setToken] = useState<string | null>(null);

  const {
    connected,
    agentsOnline,
    agentsAway,
    agentLastOnlineAt,
    on,
    off,
    joinRoom,
    leaveRoom,
    sendMessage,
    markRead,
    sendTyping,
    sendStopTyping,
    reportPanelState,
    setAgentsOnline,
    setAgentsAway,
  } = useVisitorChat(token);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // 服务端未读聚合（P2 M1）：独立于本地 unreadCount（本地仅驱动气泡），
  // 由 notification-counts(-updated) 驱动，刷新/重连后仍准确。
  const [serverUnread, setServerUnread] = useState(0);
  // 对方（坐席）正在输入指示（P1 H2）
  const [agentTyping, setAgentTyping] = useState(false);
  // 转接通知（业内最佳实践：访客看到“正在为您转接至 XXX”）
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const transferNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 「↓ 新消息」浮动按钮计数（业内最佳实践 WhatsApp/Intercom/Telegram）：
  // 用户翻历史时收到新消息 → 显示浮动按钮；点击或滚回底部 → 消失
  const [newMsgCount, setNewMsgCount] = useState(0);
  // 访客自身输入节流（P1 H2）：前沿 1.2s 一次 + 尾沿 800ms 确保最终文本必达
  const typingEmitRef = useRef(0);
  const typingTrailRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 失焦延迟发送 stop-typing，避免点击表情/文件按钮时气泡闪烁
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 交互标记：点击表情/文件按钮时置 true，阻止 blur 发送 stop-typing
  const interactingRef = useRef(false);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [staged, setStaged] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  const bubbleDismissedRef = useRef(bubbleDismissed);
  const bubbleShownRef = useRef(false);

  // 服务端推送的客服在线状态（默认 online，由 presence-changed 事件更新）
  const [agentPresence, setAgentPresence] = useState<AgentPresence>('online');
  // 是否已收到真实 presence 信号（用于区分「真实在线」与「乐观默认在线」）
  const [hasRealPresence, setHasRealPresence] = useState(false);

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
  const effectivePresence: AgentPresence = useMemo(() => {
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
  const displayPresence: AgentPresence = resolveVisitorPresence({
    status: effectivePresence,
    stableAway,
  });

  // SLA 提示：在线时给出「通常 X 分钟内回复」（X 来自站点设置 agentProfile.responseMinutes，
  // 缺省兜底为「通常几分钟内回复」）；离开/离线时给出「最后在线时间」。
  const agentResponseMinutes = agentProfile?.responseMinutes;
  const slaOnline = agentResponseMinutes
    ? t.slaMins.replace('{x}', String(agentResponseMinutes))
    : t.slaFew;

  const lastOnlineText = useMemo(() => {
    if (agentLastOnlineAt == null) return '';
    return formatRelativeTime(agentLastOnlineAt, locale);
  }, [agentLastOnlineAt, locale]);

  const roomIdRef = useRef<string | null>(null);
  const clientEmailRef = useRef<string | null>(null);
  // 最近一次经 socket 发出但尚未确认的消息：若服务端回 ROOM_ARCHIVED（归档冷存终态），
  // 据此把该消息承接到「新会话」，杜绝访客消息静默丢失（业内最佳实践 Zendesk/Intercom）。
  const pendingOutgoingRef = useRef<{ content: string; attachments: ChatAttachment[] } | null>(null);
  // restartWithMessage 在下方定义，用 ref 供 socket 事件回调运行时调用，避免闭包过期。
  const restartWithMessageRef = useRef<
    ((content: string, attachments: ChatAttachment[]) => void) | null
  >(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 同步 open → ref，供事件回调读取
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // 面板开关 → 仅作为 engagement 信号上报（B 端显示「正在查看对话」）。
  // 按业内最佳实践，访客的在线/离开态不再随面板开关翻转，而只由「socket 连接 +
  // 标签页可见 + 是否长时间无操作」决定（见 useVisitorChat 的 visibilitychange 处理）。
  useEffect(() => {
    reportPanelState(open);
  }, [open, reportPanelState]);

  const isClosed = room?.status === 'closed';

  const enterChat = useCallback(
    (r: ChatRoom, chatToken?: string) => {
      setRoom(r);
      setMessages((r.messages ?? []).map(normalizeMessage));
      roomIdRef.current = r.roomId;
      clientEmailRef.current = r.clientEmail;
      if (chatToken) {
        setToken(chatToken);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ email: r.clientEmail, roomId: r.roomId, token: chatToken }),
          );
        } catch {}
      }
      // 已关闭会话也加入房间：访客回复「重开」时需实时收到自己的消息回声与
      // room-status-changed（状态切回进行中）；同时关闭事件也能即时触达。
      if (r.status === 'active' || r.status === 'waiting' || r.status === 'closed') {
        joinRoom(r.roomId);
      }
    },
    [joinRoom],
  );

  // 重连后自动重新加入当前房间（token 鉴权场景下确保实时收发不丢）
  useEffect(() => {
    if (connected && roomIdRef.current && token) {
      joinRoom(roomIdRef.current);
    }
  }, [connected, token, joinRoom]);

  // 恢复（从本地存储取 roomId + token；缺 token 则凭 roomId+email 重新换取）
  useEffect(() => {
    let active = true;
    (async () => {
      let stored: { email?: string; roomId?: string; token?: string } | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch {}
      if (!stored?.roomId || !stored?.email) return;
      try {
        const r = await getRoom(stored.roomId, stored.email);
        if (!active || !r) return;
        // 归档会话是冷存终态（业内最佳实践 Zendesk/LiveChat）：访客回来时不恢复归档会话，
        // 清空本地存储，让访客自然进入「开始新对话」状态；服务端亦拒绝向归档会话发消息。
        if (r.status === 'archived') {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {}
          return;
        }
        if (stored.token) {
          enterChat(r, stored.token);
        } else if (stored.email) {
          const t = await fetchVisitorToken(stored.roomId, stored.email);
          enterChat(r, t.token);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [enterChat]);

  // 注册 socket 业务事件
  useEffect(() => {
    const handleNewMessage = (data: { message?: ChatMessage; room?: { roomId: string } }) => {
      const msg = data?.message;
      const rid = data?.room?.roomId;
      if (!msg || rid !== roomIdRef.current) return;
      // 自己的消息成功回声 → 落库确认，清除待重发标记（避免后续无关错误误触发重发）。
      if (msg.sender === 'client') pendingOutgoingRef.current = null;
      setMessages((prev) =>
        prev.some((m) => m.messageId === msg.messageId) ? prev : [...prev, normalizeMessage(msg)],
      );
      // 面板未打开 + 收到客服消息 → 累加未读数，并弹出预览气泡
      if (!openRef.current && msg.sender === 'agent') {
        setUnreadCount((n) => n + 1);
        if (!bubbleDismissedRef.current) setShowBubble(true);
      }
      // 面板已打开 + 页面可见 + 收到客服消息 → 实时上报「已读」，驱动 B 端已读回执刷新
      // 切换桌面/标签页时 document.hidden=true，不标记已读（防止"假已读"）
      if (openRef.current && msg.sender === 'agent' && clientEmailRef.current && !document.hidden) {
        markRead(rid);
        setUnreadCount(0);
      }
    };

    const handleMessagesRead = (data: {
      userType?: string;
      roomId?: string;
      userEmail?: string;
      messageIds?: string[];
    }) => {
      if (data.userType !== 'agent' || data.roomId !== roomIdRef.current) return;
      const idSet = Array.isArray(data.messageIds) ? new Set(data.messageIds) : null;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.sender !== 'client') return m;
          if (idSet && !idSet.has(m.messageId)) return m;
          const hasAgent = (m.readBy ?? []).some((r) => r.userType === 'agent');
          if (hasAgent) return m;
          return {
            ...m,
            readBy: [
              ...(m.readBy ?? []),
              {
                userEmail: data.userEmail ?? '',
                userType: 'agent' as const,
                readAt: new Date().toISOString(),
              },
            ],
          };
        }),
      );
    };

    // presence-changed：关注对方（agent）的状态
    const handlePresence = (data: {
      userEmail?: string;
      userType?: string;
      status?: AgentPresence;
    }) => {
      if (data.userType === 'agent' && data.status) {
        setAgentPresence(data.status);
        setHasRealPresence(true);
      }
    };

    // 房间状态变更（坐席关闭 / 归档等）：实时同步到访客端，
    // 使「本次会话已结束」面板即时出现（含禁用输入框 + 重新发起咨询入口），
    // 而非要等刷新才看到关闭态 —— 否则客户会在已关闭会话里继续发消息却石沉大海。
    const handleRoomStatusChanged = (data: { roomId?: string; status?: string }) => {
      if (data.roomId !== roomIdRef.current) return;
      if (data.status) {
        setRoom((prev) => (prev ? { ...prev, status: data.status as ChatRoom['status'] } : prev));
      }
    };

    // 发送失败：
    //  - ROOM_ARCHIVED（会话已归档冷存）：把刚才那条消息承接到「新会话」发出，
    //    B 端队列据此重开新对话，杜绝访客消息石沉大海（业内最佳实践 Zendesk/Intercom）。
    //  - 其它错误（如会话已关闭，后端拒绝落库）：重新拉取房间，让前端状态与服务端一致
    //    （已关闭则展示结束面板），避免消息无声丢失。
    const handleError = (data?: { message?: string; code?: string; roomId?: string }) => {
      const rid = roomIdRef.current;
      const email = clientEmailRef.current;
      if (!data || typeof data !== 'object') return;
      if (data.code === 'ROOM_ARCHIVED') {
        const pending = pendingOutgoingRef.current;
        pendingOutgoingRef.current = null;
        if (pending) {
          restartWithMessageRef.current?.(pending.content, pending.attachments);
        } else if (rid && email) {
          // 无待发内容（如附件已入库）：同步房间状态，让前端进入归档→新对话引导态。
          getRoom(rid, email)
            .then((r) => {
              if (r && r.roomId === roomIdRef.current) setRoom(r);
            })
            .catch(() => {});
        }
        return;
      }
      if (!rid || !email || !('message' in data)) return;
      getRoom(rid, email)
        .then((r) => {
          if (r && r.roomId === roomIdRef.current) setRoom(r);
        })
        .catch(() => {});
    };

    // 对方（坐席）正在输入（P1 H2）：显示「对方正在输入…」，4s 无新信号自动消失
    const handleTyping = (data: { roomId?: string; userType?: string }) => {
      if (data.userType !== 'agent' || data.roomId !== roomIdRef.current) return;
      setAgentTyping(true);
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
      agentTypingTimer.current = setTimeout(() => setAgentTyping(false), 4000);
    };
    const handleStopTyping = (data: { roomId?: string; userType?: string }) => {
      if (data.userType !== 'agent' || data.roomId !== roomIdRef.current) return;
      setAgentTyping(false);
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
    };

    // 未读聚合计数（P2 M1）：初始拉取 + 增量更新
    const handleNotifCounts = (data: { totalUnread?: number }) => {
      setServerUnread(typeof data.totalUnread === 'number' ? data.totalUnread : 0);
    };

    // 转接通知（业内最佳实践：访客看到“正在为您转接至 XXX”，8s 后自动消失）
    const handleTransferNotice = (data: { roomId?: string; toAgentName?: string }) => {
      if (data.roomId !== roomIdRef.current) return;
      setTransferNotice(data.toAgentName || null);
      if (transferNoticeTimer.current) clearTimeout(transferNoticeTimer.current);
      transferNoticeTimer.current = setTimeout(() => setTransferNotice(null), 8000);
    };

    on('new-message', handleNewMessage);
    on('messages-read', handleMessagesRead);
    on('presence-changed', handlePresence);
    on('room-status-changed', handleRoomStatusChanged);
    on('room-transfer-notice', handleTransferNotice);
    on('typing', handleTyping);
    on('stop-typing', handleStopTyping);
    on('notification-counts-updated', handleNotifCounts);
    on('notification-counts', handleNotifCounts);
    on('error', handleError);
    return () => {
      off('new-message');
      off('messages-read');
      off('presence-changed');
      off('room-status-changed');
      off('room-transfer-notice');
      off('typing');
      off('stop-typing');
      off('notification-counts-updated');
      off('notification-counts');
      off('error');
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
      if (transferNoticeTimer.current) clearTimeout(transferNoticeTimer.current);
    };
  }, [on, off, markRead, getRoom]);

  // 标记已读：延迟 2 秒 + 页面可见时才触发，避免「秒开秒关」或「切换桌面」也被标记为已读。
  // 用户在面板停留超过 2 秒且页面可见才视为真正阅读；期间收到新客服消息仍会实时标记（handleNewMessage）。
  useEffect(() => {
    if (!open || !room || isClosed || !connected) return;
    const timer = setTimeout(() => {
      if (!document.hidden) {
        markRead(room.roomId);
        setUnreadCount(0);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [open, room, isClosed, connected, markRead]);

  // 页面从隐藏恢复可见时，自动标记当前会话已读（用户回来看了）
  useEffect(() => {
    if (!open || !room || isClosed || !connected) return;
    const onVisibilityChange = () => {
      if (!document.hidden) {
        markRead(room.roomId);
        setUnreadCount(0);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [open, room, isClosed, connected, markRead]);

  // 安全网（push+pull 双模型）：定时 HTTP 同步当前会话消息。
  // socket 推送保证实时性，HTTP 拉取保证正确性——丢失的 new-message 回声
  // （自己发的消息不显示、客服消息延迟）在 5s 内自愈。
  const roomIdForSync = room?.roomId ?? null;
  useEffect(() => {
    if (!roomIdForSync) return;
    const rid = roomIdForSync;
    const syncMessages = () => {
      const email = clientEmailRef.current;
      if (!email) return;
      getRoom(rid, email)
        .then((r) => {
          if (r.roomId !== roomIdRef.current) return;
          setMessages((prev) => {
            const serverMsgs = r.messages ?? [];
            // 快路径：本地消息数 >= 服务端 → 无新增，跳过
            if (prev.length >= serverMsgs.length) return prev;
            const map = new Map<string, ChatMessage>();
            for (const m of prev) map.set(m.messageId, m);
            for (const m of serverMsgs) map.set(m.messageId, normalizeMessage(m));
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            );
          });
        })
        .catch(() => {});
    };
    const timer = setInterval(syncMessages, 5000);
    const onVis = () => {
      if (!document.hidden) syncMessages();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [roomIdForSync, getRoom]);

  // 取 Radix ScrollArea 真正可滚动的 Viewport，避免 scrollIntoView 误把整页滚到底
  const getChatViewport = useCallback((): HTMLElement | null => {
    const root = scrollAreaRef.current;
    if (!root) return null;
    return root.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const vp = getChatViewport();
      if (!vp) return;
      vp.scrollTo({ top: vp.scrollHeight, behavior });
    },
    [getChatViewport],
  );

  // 跟踪用户是否已在底部：阅读历史时不被“拽”到底部
  // 阈值 150px（业内最佳实践 Intercom/WhatsApp Web），避免微小布局抖动误判为「不在底部」
  // 依赖 open：确保面板打开后重新绑定监听（首次渲染时 viewport 可能尚未挂载）
  useEffect(() => {
    if (!open) return;
    const vp = getChatViewport();
    if (!vp) return;
    const onScroll = () => {
      const distance = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
      atBottomRef.current = distance < 150;
      // 用户滚回底部 → 清除「新消息」计数（业内最佳实践）
      if (atBottomRef.current) setNewMsgCount(0);
    };
    vp.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => vp.removeEventListener('scroll', onScroll);
  }, [getChatViewport, open]);

  // 打开面板：立即跳到底部（instant，不产生整页平滑滚动的诡异动画）
  useEffect(() => {
    if (!open) return;
    atBottomRef.current = true;
    setNewMsgCount(0);
    scrollToBottom('auto');
  }, [open, scrollToBottom]);

  // 心跳：输入框有未发送内容（文字或附件）时，每 3s 补发 typing 事件，
  // 确保 B 端始终显示预览气泡（业内最佳实践 LiveChat/Intercom：未发送前始终可见）
  useEffect(() => {
    if (!open || !connected || isClosed) return;
    if (!input.trim() && staged.length === 0) return;
    const id = setInterval(() => {
      const rid = roomIdRef.current;
      if (rid) sendTyping(rid, input || undefined);
    }, 3000);
    return () => clearInterval(id);
  }, [open, connected, isClosed, input, staged, sendTyping]);

  // 新消息到达（业内最佳实践 Intercom/WhatsApp Web/Telegram）：
  // - 访客自己发送的消息：永远 instant 滚底 + 清除新消息计数
  // - 客服消息 + 用户贴底：平滑滚底
  // - 客服消息 + 用户翻历史：不滚动，累加「新消息」计数 → 显示浮动按钮
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    const count = messages.length;
    const isNew = count > prevMsgCountRef.current;
    prevMsgCountRef.current = count;
    if (!isNew) return;
    const lastMsg = messages[count - 1];
    const isOwnMessage = lastMsg?.sender === 'client';
    if (isOwnMessage) {
      // 自己的消息：永远滚底 + 清除计数
      setNewMsgCount(0);
      const r1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom('auto'));
      });
      return () => cancelAnimationFrame(r1);
    }
    // 客服消息：贴底则滚，否则累加「新消息」计数
    if (atBottomRef.current) {
      const r1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom('smooth'));
      });
      return () => cancelAnimationFrame(r1);
    }
    setNewMsgCount((n) => n + 1);
  }, [messages, open, scrollToBottom]);

  // 内容高度异步变化（typing indicator 出现/消失、图片加载、Markdown 重排等）→
  // 若用户贴底则重新滚到底，修复「对方正在输入」指示器被 viewport 底部裁剪的问题。
  useEffect(() => {
    const content = chatContentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) scrollToBottom('auto');
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  // 打开面板时聚焦输入框（preventScroll 避免聚焦触发整页滚动）
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 250);
      return () => clearTimeout(id);
    }
  }, [open]);

  // 客服首条招呼消息的内容：依据实时在线状态自适应，确保「只剩一条消息」
  //  - 无坐席在线：明确「暂无人值守」并提示留言回复方式（邮件/电话）
  //  - 非工作时间/离开：给出对应时段的留言提示
  //  - 在线：使用站点配置/默认的招呼语
  const greetingContent = useMemo(() => {
    if (noAgentOnline) return t.noAgentHint;
    if (displayPresence === 'offline') return t.offlineHint;
    if (displayPresence === 'away') return t.presenceAway;
    return greetingText;
  }, [noAgentOnline, displayPresence, greetingText, t]);

  // 构造客服首条招呼消息（不写入后端，只在本地展示，模拟 Intercom 体验）
  const aiGreetingMessage: ChatMessage = useMemo(
    () => ({
      messageId: 'ai-greeting',
      content: greetingContent,
      sender: 'agent',
      senderEmail: 'agent@tzj.com',
      timestamp: new Date().toISOString(),
      isRead: true,
    }),
    [greetingContent],
  );

  // 真正显示给用户的消息列表：AI 招呼语始终作为首条保留，
  // 直到后端返回真实客服(agent)消息接管对话。
  const displayMessages = useMemo(() => {
    const hasAgentMessage = messages.some((m) => m.sender === 'agent');
    return hasAgentMessage ? messages : [aiGreetingMessage, ...messages];
  }, [messages, aiGreetingMessage]);

  // 预览气泡文案：
  //  - 有真实客服/AI 消息 → 取最近一条首段作预览
  //  - 否则（仅问候语）→ 用专门的邀请语（而非裸「您好」）
  const bubblePreview = useMemo(() => {
    const lastAgent = [...displayMessages]
      .reverse()
      .find((m) => m.sender === 'agent' && m.messageId !== 'ai-greeting');
    if (lastAgent) {
      return lastAgent.content.split('\n')[0]?.trim() || lastAgent.content;
    }
    // 在线且有坐席 → 常规邀请；无人值守/离线/离开 → 改为离线邀请语，
    // 避免在无人响应时仍写「有什么可以帮您」
    if (displayPresence === 'online' && !noAgentOnline) return t.launcherInvite;
    return noAgentOnline ? t.noAgentInvite : t.launcherInviteOffline;
  }, [
    displayMessages,
    displayPresence,
    noAgentOnline,
    t.launcherInvite,
    t.launcherInviteOffline,
    t.noAgentInvite,
  ]);

  // 是否已有真实客服消息（用于气泡底部区分「邀请」与「消息预览」）
  const hasRealAgentMsg = useMemo(
    () => displayMessages.some((m) => m.sender === 'agent' && m.messageId !== 'ai-greeting'),
    [displayMessages],
  );

  const bubbleTime = useMemo(
    () => formatRelative(displayMessages.at(-1)?.timestamp, t),
    [displayMessages, t],
  );

  // ── 自动弹出的预览气泡（Intercom 风格） ──
  // 每会话仅主动打扰一次：已关闭(dismissed)或已展示过(shown)则不再自动弹欢迎
  useEffect(() => {
    bubbleDismissedRef.current = sessionStorage.getItem(BUBBLE_DISMISSED_KEY) === '1';
    bubbleShownRef.current = sessionStorage.getItem(BUBBLE_SHOWN_KEY) === '1';
    if (bubbleDismissedRef.current) setBubbleDismissed(true);
    if (bubbleDismissedRef.current || bubbleShownRef.current) return;
    const id = setTimeout(() => {
      if (bubbleDismissedRef.current) return;
      setShowBubble(true);
      bubbleShownRef.current = true;
      sessionStorage.setItem(BUBBLE_SHOWN_KEY, '1');
    }, 4000);
    return () => clearTimeout(id);
  }, []);

  // 打开面板时收起气泡
  useEffect(() => {
    if (open) setShowBubble(false);
  }, [open]);

  // 生成游客占位邮箱（合法 email 格式，后端 @IsEmail() 校验通过）
  function generateGuestEmail(): string {
    const rand = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return `visitor-${rand}@guest.local`;
  }

  /** 确保存在房间：无房间时先建一个空房间（用于首次即带附件的场景）。 */
  const ensureRoom = useCallback(async (): Promise<{
    roomId: string;
    email: string;
  } | null> => {
    if (room && roomIdRef.current) {
      return { roomId: room.roomId, email: room.clientEmail };
    }
    try {
      const guestEmail = generateGuestEmail();
      const created = await createRoom({
        clientEmail: guestEmail,
        ...collectVisitorContext(),
      });
      enterChat(created, created.token);
      return { roomId: created.roomId, email: created.clientEmail };
    } catch {
      setError(t.failed);
      return null;
    }
  }, [room, enterChat, t.failed]);

  /** 选择文件 → 预签名直传 S3/OSS → 暂存为待发送附件。 */
  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const roomInfo = await ensureRoom();
      if (!roomInfo) return;
      const files = Array.from(fileList);
      setUploading(true);
      try {
        const uploaded = await Promise.all(
          files.map(async (file) => {
            const ct = resolveContentType(file);
            const presign = await presignChatAttachment(
              roomInfo.roomId,
              file.name,
              ct,
              file.size,
              roomInfo.email,
            );
            await fetch(presign.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': ct },
            });
            return {
              id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              key: presign.key,
              fileName: file.name,
              contentType: ct,
              size: file.size,
              url: presign.publicUrl,
            } satisfies ChatAttachment;
          }),
        );
        setStaged((prev) => [...prev, ...uploaded]);
        // 附件上传完成后补发 typing 事件，保持 B 端气泡可见（即使输入框无文字）
        const rid = roomIdRef.current;
        if (rid && connected) sendTyping(rid, inputRef.current?.value || undefined);
      } catch {
        setError(t.uploadFailed);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [ensureRoom, t.failed, connected, sendTyping],
  );

  // 发送第一条消息（无房间时先建房，再走 HTTP 落库，支持附件）
  const sendFirstMessage = useCallback(
    async (content: string, attachments: ChatAttachment[]) => {
      if (sending) return;
      setSending(true);
      setError('');
      try {
        const guestEmail = generateGuestEmail();
        const created = await createRoom({
          clientEmail: guestEmail,
          ...collectVisitorContext(),
        });
        enterChat(created, created.token);
        const keys = attachments.map((a) => a.key);
        const persisted = await sendMessageHTTP(created.roomId, content, guestEmail, keys);
        setMessages((persisted.messages ?? []).map(normalizeMessage));
      } catch {
        setError(t.failed);
      } finally {
        setSending(false);
      }
    },
    [sending, enterChat, t.failed],
  );

  // 承接一条消息开启「新会话」：用于访客向「已归档」会话发消息的场景。
  // 归档=冷存终态（业内最佳实践 Zendesk/Intercom）：不向归档会话追加消息，而是离开旧房间、
  // 清空本地存储后建新房 + 发送本条消息，B 端队列据此重开新对话，杜绝消息石沉大海。
  const restartWithMessage = useCallback(
    (content: string, attachments: ChatAttachment[]) => {
      // 离开归档旧房间：让 B 端按房间成员关系把旧会话的访客判定为离线。
      if (roomIdRef.current) {
        try {
          leaveRoom(roomIdRef.current);
        } catch {}
      }
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      roomIdRef.current = null;
      clientEmailRef.current = null;
      setRoom(null);
      setMessages([]);
      void sendFirstMessage(content, attachments);
    },
    [leaveRoom, sendFirstMessage],
  );

  // 同步 restartWithMessage 到 ref，供 socket 'error'（ROOM_ARCHIVED）回调运行时调用。
  useEffect(() => {
    restartWithMessageRef.current = restartWithMessage;
  }, [restartWithMessage]);

  const handleSend = useCallback(
    (e?: React.SyntheticEvent<HTMLFormElement>, override?: string) => {
      e?.preventDefault();
      const content = (override ?? input).trim();
      const keys = staged.map((a) => a.key);
      if (!content && keys.length === 0) return;
      const attachments = staged;
      setInput('');
      setStaged([]);
      setEmojiOpen(false);
      setUploading(false);
      if (room) {
        // 归档会话（冷存终态）：不原地追加，承接本条消息开启「新会话」（B 端重开新对话）。
        if (room.status === 'archived') {
          restartWithMessage(content, attachments);
          return;
        }
        // 已有房间：正常发（若是 closed 房间，后端按「回复即重开」把同一会话
        // 切回进行中并广播 room-status-changed，输入框随之恢复可用）。
        if (connected) {
          // 记住本条：若服务端回 ROOM_ARCHIVED（状态在发送瞬间恰被归档），据此承接到新会话。
          pendingOutgoingRef.current = { content, attachments };
          sendMessage(room.roomId, content, keys);
        } else {
          void sendMessageHTTP(room.roomId, content, room.clientEmail, keys)
            .then((r) => {
              setMessages((r.messages ?? []).map(normalizeMessage));
              // 离线兖底：重开场景下同步房间状态，避免输入框仍停留在关闭态
              setRoom((prev) => (prev ? { ...prev, status: r.status } : prev));
            })
            .catch(() => setError(t.failed));
        }
      } else {
        // 首次发送 → 建房 + 发送（含附件）
        void sendFirstMessage(content, attachments);
      }
    },
    [input, staged, room, connected, sendMessage, sendFirstMessage, restartWithMessage, t.failed],
  );

  // 在光标处插入 emoji（无焦点时追加到末尾），并恢复焦点与光标位置
  const insertEmoji = useCallback(
    (emoji: string) => {
      const ta = inputRef.current;
      let next: string;
      if (ta) {
        const start = ta.selectionStart ?? input.length;
        const end = ta.selectionEnd ?? input.length;
        next = input.slice(0, start) + emoji + input.slice(end);
        setInput(next);
        requestAnimationFrame(() => {
          ta.focus();
          const pos = start + emoji.length;
          ta.setSelectionRange(pos, pos);
        });
      } else {
        next = input + emoji;
        setInput(next);
      }
      setEmojiOpen(false);
      // 程序化插入不触发 onChange，手动补发 typing 事件保持 B 端气泡可见
      const rid = roomIdRef.current;
      if (rid && connected && next.trim()) sendTyping(rid, next);
    },
    [input, connected, sendTyping],
  );

  // 选择 emoji：输入框为空时直接发送该 emoji；否则插入到光标处
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (input.trim() === '') {
        handleSend(undefined, emoji);
      } else {
        insertEmoji(emoji);
        setEmojiOpen(false);
      }
    },
    [input, insertEmoji, handleSend],
  );

  // 输入框自动增高
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 粘贴文件（截图 / 复制的文件）→ 直接进入上传链路；纯文本粘贴保持默认行为
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0) return;
    // 存在文件才拦截默认行为，避免影响正常文本粘贴
    e.preventDefault();
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    void handleFiles(dt.files);
  };

  const startNewChat = () => {
    // 离开旧房间：让访客 socket 退出当前会话房间（socket.io room），
    // 网关据此广播 user-left，并按「房间成员关系」将该旧会话的访客判定为离线 → B 端旧会话立即显示离线。
    // 注意：离开房间不改变访客的「全局在线状态」（socket 仍在线，只是不再在该会话房间内），
    // 新会话（发出首条消息时生成新身份并加入新房间）会显示在线。双方均以房间成员关系为准，刷新亦一致。
    // 必须在清空 room 状态前用 roomIdRef 取到旧 roomId。
    if (roomIdRef.current) {
      try {
        leaveRoom(roomIdRef.current);
      } catch {}
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setRoom(null);
    setMessages([]);
    roomIdRef.current = null;
  };

  // 头部副标题：依据真实在线状态诚实呈现，并附 SLA 提示
  //  - 未连接：乐观显示在线（瞬时态）
  //  - 无坐席在线：明确「暂无人值守」（即使处于工作时间）
  //  - 在线且多坐席：细化为「N 位客服在线 · 通常 X 分钟内回复」
  //  - 在线单坐席：在线客服 · 通常 X 分钟内回复
  //  - 离开/离线：附「最后在线时间」
  const presenceLabel = !connected
    ? // 尚未连接：若已知有坐席在线，按工作时间区分文案（非工作时间显示「在线但回复稍慢」，
      // 与连接后的权威分支保持一致）；非营业且未知坐席数时不乐观声称在线，
      // 避免与灰点 + 下班留言相互矛盾（连接后收到 agents-online 会立即纠正）。
      agentsOnline > 0
      ? outsideHours
        ? t.presenceOutsideOnline
        : `${t.onlineAgent} · ${slaOnline}`
      : outsideHours
        ? t.presenceOffline
        : t.subtitle
    : noAgentOnline
      ? t.presenceNoAgent
      : displayPresence === 'offline'
        ? lastOnlineText
          ? `${t.presenceOffline} · ${t.lastOnline}${lastOnlineText}`
          : t.presenceOffline
        : displayPresence === 'away'
          ? lastOnlineText
            ? `${t.presenceAway} · ${t.lastOnline}${lastOnlineText}`
            : t.presenceAway
          : outsideHours
            ? t.presenceOutsideOnline
            : agentsOnline > 1
              ? `${t.multiAgent.replace('{n}', String(agentsOnline))} · ${slaOnline}`
              : `${t.onlineAgent} · ${slaOnline}`;

  // 可用性档位（决定圆点颜色）：green=真人在线可即时响应；amber=离开或
  // 「营业中但无坐席」（open but unmanned）；gray=真正离线/非工作时间无人。
  // 这样「营业中无人值守」与「已下班」被清晰区分，不会让用户误以为门店关闭。
  const availability: 'online' | 'away' | 'offline' = useMemo(() => {
    if (displayPresence === 'online') {
      return noAgentOnline ? 'away' : 'online';
    }
    if (displayPresence === 'away') return 'away';
    // offline：营业中但无坐席（无人在岗）→ amber；真正下班无人 → gray
    return noAgentOnline && !outsideHours ? 'away' : 'offline';
  }, [displayPresence, noAgentOnline, outsideHours]);

  // 头像状态圆点配色（业内最佳实践：常驻于头像，一眼可见可用状态）
  const presenceDotClass =
    availability === 'online'
      ? 'bg-emerald-500'
      : availability === 'away'
        ? 'bg-amber-400'
        : 'bg-zinc-300';

  return (
    <>
      {/* ── 自动弹出的预览气泡（Intercom 风格）：浮动按钮上方 ── */}
      {showBubble && !open && (
        <div
          className="fixed bottom-[5.5rem] right-5 z-[60] w-[min(320px,calc(100vw-2.5rem))] origin-bottom-right animate-in fade-in-0 slide-in-from-bottom-3 duration-300"
          role="status"
          aria-live="polite"
        >
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white p-3.5 shadow-2xl shadow-zinc-900/15">
            <button
              type="button"
              aria-label={t.close}
              onClick={() => {
                setShowBubble(false);
                setBubbleDismissed(true);
                bubbleDismissedRef.current = true;
                sessionStorage.setItem(BUBBLE_DISMISSED_KEY, '1');
              }}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setShowBubble(false);
              }}
              className="flex w-full items-start gap-2.5 pr-5 text-left"
            >
              <div className="relative shrink-0">
                <AgentAvatar
                  src={agentAvatarUrl}
                  name={agentName}
                  className="h-9 w-9"
                  fallbackClassName="bg-gradient-to-br from-[#e3000f] to-[#b3000b] text-xs font-bold text-white"
                />
                <span
                  aria-hidden
                  className={cn(
                    'border-white absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-2',
                    presenceDotClass,
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">{t.agentName}</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-zinc-600">
                  {bubblePreview}
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      displayPresence === 'online'
                        ? 'bg-emerald-500'
                        : displayPresence === 'away'
                          ? 'bg-amber-400'
                          : 'bg-zinc-300',
                    )}
                  />
                  {hasRealAgentMsg ? `${bubbleTime} · ${presenceLabel}` : presenceLabel}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── 浮动按钮：纯黑圆形 + 白色聊天气泡 + 右上角未读徽章（Klipy 风格） ── */}
      <button
        type="button"
        aria-label={t.brand}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-zinc-900/30 transition-all duration-300 ease-out',
          'bg-zinc-900 hover:bg-zinc-800 hover:scale-105 hover:shadow-xl hover:shadow-zinc-900/40 active:scale-95',
          open ? 'scale-90 opacity-0 pointer-events-none' : 'scale-100 opacity-100',
        )}
      >
        <MessageCircle className="h-6 w-6" strokeWidth={2} fill="white" />
        {serverUnread > 0 && (
          <span className="absolute top-0 right-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#e3000f] px-1.5 text-[11px] font-semibold leading-none text-white shadow-md ring-2 ring-white">
            {serverUnread > 99 ? '99+' : serverUnread}
          </span>
        )}
      </button>

      {/* ── 面板 ─────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-5 right-5 z-[60] flex w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-2xl shadow-zinc-900/15 ring-1 ring-zinc-900/5 transition-all duration-300 ease-out',
          'h-[min(640px,calc(100dvh-2.5rem))]',
          // 放大态：桌面端放大为更大的停靠面板；移动端（max-sm）直接全屏覆盖。
          // 注意：移动端全屏必须保持右下锚点（right-0 bottom-0），不能用 inset-0
          // 否则会引入 top/left:0，使锚点从左下跳到左上，动画方向错乱。
          expanded &&
            'max-sm:right-0 max-sm:bottom-0 max-sm:w-screen max-sm:h-[100dvh] max-sm:rounded-none sm:w-[min(520px,calc(100vw-3rem))] sm:h-[min(760px,calc(100dvh-3rem))]',
          open
            ? 'translate-y-0 opacity-100 scale-100'
            : 'pointer-events-none translate-y-3 opacity-0 scale-[0.98]',
        )}
        role="dialog"
        aria-label={t.brand}
      >
        {/* ── 头部：Klipy 极简单行 ───────────────────────── */}
        <div className="relative flex items-center gap-2 bg-white px-3 py-3">
          {/* 头像 + 标题 + 副标题 */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="relative shrink-0">
              <AgentAvatar
                src={agentAvatarUrl}
                name={agentName}
                className="h-8 w-8"
                fallbackClassName="bg-gradient-to-br from-[#e3000f] to-[#b3000b] text-xs font-bold text-white"
              />
              <span
                aria-hidden
                className={cn(
                  'border-white absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-2',
                  presenceDotClass,
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-zinc-900">
                {t.brand}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-tight text-zinc-500">
                {presenceLabel}
              </p>
            </div>
          </div>

          <TooltipProvider delayDuration={200}>
            {/* 新对话（进行中可见；结束态由底部面板提供，避免重复入口） */}
            {!isClosed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t.newChat}
                    onClick={startNewChat}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <SquarePen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t.newChat}</TooltipContent>
              </Tooltip>
            )}

            {/* 放大 / 还原（移动端点击即全屏，桌面端放大为更大停靠面板） */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={expanded ? t.minimize : t.expand}
                  aria-pressed={expanded}
                  onClick={() => setExpanded((v) => !v)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{expanded ? t.minimize : t.expand}</TooltipContent>
            </Tooltip>

            {/* 关闭 × */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t.close}
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t.close}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* ── 聊天区（Klipy 极简：纯白底，无气泡背景）+「↓ 新消息」浮动按钮
            业内最佳实践（WhatsApp/Telegram/Intercom）：pill 锚定在消息视口底缘，
            浮于消息内容之上，与输入区高度完全解耦 ── */}
        <div className="relative min-h-0 flex-1">
        <ScrollArea ref={scrollAreaRef} className="h-full bg-white [&>[data-radix-scroll-area-viewport]]:overscroll-contain">
          <ImagePreviewProvider>
            <div ref={chatContentRef} className="flex min-h-full flex-col gap-4 overflow-x-hidden px-4 py-4">
              {displayMessages.length === 0 ? (
                <div className="m-auto flex w-full max-w-[300px] flex-col items-center py-8 text-center">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">
                    {t.welcome}
                  </p>
                </div>
              ) : (
                <DayGroupedMessages
                  messages={displayMessages}
                  locale={locale}
                  t={t}
                  agentName={agentName}
                  agentTitle={agentTitle}
                />
              )}
              {error && <p className="mx-auto mt-1 text-xs text-red-600">{error}</p>}
              {/* 转接通知（业内最佳实践 Intercom/Zendesk：访客看到“正在为您转接至 XXX”） */}
              {transferNotice && (
                <div className="flex justify-center" aria-live="polite">
                  <span className="rounded-full bg-zinc-800/90 px-4 py-1.5 text-xs font-medium text-white shadow-sm">
                    正在为您转接至 {transferNotice}，请稍候…
                  </span>
                </div>
              )}
              {/* 对方正在输入指示器（P1 H2）—— 放在滚动区内部（业内最佳实践 Intercom/Zendesk），
                  避免占用外部布局空间导致消息列表高度跳变、遮挡最后一条消息、干扰滚底判断 */}
              {agentTyping && !isClosed && (
                <div className="flex items-start" aria-live="polite">
                  <div className="inline-flex items-center gap-1 rounded-2xl bg-zinc-100 px-4 py-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                  </div>
                </div>
              )}
              <div className="h-px shrink-0" />
            </div>
          </ImagePreviewProvider>
        </ScrollArea>

        {/* 「↓ 新消息」浮动按钮：用户翻历史时收到新消息 → 显示；
            点击或滚回底部 → 消失 */}
        {newMsgCount > 0 && (
          <button
            type="button"
            onClick={() => {
              scrollToBottom('smooth');
              setNewMsgCount(0);
            }}
            className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg shadow-zinc-900/20 transition-all hover:bg-zinc-700 hover:shadow-xl active:scale-95"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {t.newMessages.replace('{n}', String(newMsgCount))}
          </button>
        )}
        </div>

        {isClosed && (
          <div className="border-t border-zinc-100 bg-zinc-50/70 px-4 py-2.5 text-center">
            <p className="text-xs text-zinc-500">
              {t.closedReopenHint}
              <button
                type="button"
                onClick={startNewChat}
                className="ml-1 font-medium text-zinc-700 underline-offset-2 transition hover:underline"
              >
                {t.newChat}
              </button>
            </p>
          </div>
        )}
        {/* ── 输入区：已关闭会话仍可输入，访客回复即「重开」同一会话 ── */}
        <form onSubmit={handleSend} className="bg-white p-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/zip"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <div className="rounded-3xl border border-zinc-200 bg-white transition-colors focus-within:border-zinc-800">
            {staged.length > 0 && (
              <ImagePreviewProvider>
                <div className="flex flex-wrap gap-2 px-3.5 pt-2.5">
                  {staged.map((a) => {
                    const isImage = a.contentType.startsWith('image/');
                    // 图片：正方形缩略图，不显示文件名/大小；点击可灯箱预览
                    if (isImage) {
                      return (
                        <div
                          key={a.id}
                          className="group relative rounded-xl border border-zinc-200 bg-zinc-50 p-1"
                        >
                          <ImagePreview src={a.url}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.url}
                              alt={a.fileName}
                              className="aspect-square h-12 w-12 cursor-pointer rounded-md object-cover"
                            />
                          </ImagePreview>
                          <button
                            type="button"
                            aria-label="移除附件"
                            onClick={() => setStaged((prev) => prev.filter((x) => x.id !== a.id))}
                            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-white shadow-sm"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={a.id}
                        className="group relative flex max-w-[140px] items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 pr-2.5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-zinc-500">
                          <FileIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium text-zinc-700">
                            {a.fileName}
                          </p>
                          <p className="text-[10px] text-zinc-400">{formatBytes(a.size)}</p>
                        </div>
                        <button
                          type="button"
                          aria-label="移除附件"
                          onClick={() => setStaged((prev) => prev.filter((x) => x.id !== a.id))}
                          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </ImagePreviewProvider>
            )}
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  const v = e.target.value;
                  setInput(v);
                  // 输入中指示（P1 H2）：前沿节流 1.2s + 尾沿 800ms 确保最终文本必达
                  const rid = roomIdRef.current;
                  if (rid && connected && !isClosed) {
                    if (v.trim()) {
                      const now = Date.now();
                      if (now - typingEmitRef.current > 1200) {
                        // 前沿：立即发送（首次按键 / 超过节流窗口）
                        typingEmitRef.current = now;
                        if (typingTrailRef.current) clearTimeout(typingTrailRef.current);
                        sendTyping(rid, v);
                      } else {
                        // 尾沿：用户停止输入 800ms 后补发最终文本，修复截断问题
                        if (typingTrailRef.current) clearTimeout(typingTrailRef.current);
                        typingTrailRef.current = setTimeout(() => {
                          typingEmitRef.current = Date.now();
                          sendTyping(rid, v);
                        }, 800);
                      }
                    } else {
                      if (typingTrailRef.current) clearTimeout(typingTrailRef.current);
                      sendStopTyping(rid);
                    }
                  }
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onBlur={() => {
                  if (typingTrailRef.current) clearTimeout(typingTrailRef.current);
                  if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                  // 点击表情/文件按钮导致的短暂失焦 → 不发 stop-typing
                  if (interactingRef.current) return;
                  // 有未发送内容（文字/附件）→ 心跳维持，不需 stop-typing
                  const v = inputRef.current?.value ?? '';
                  if (v.trim() || staged.length > 0) return;
                  // 真正离开且无内容 → 立即停止
                  const rid = roomIdRef.current;
                  if (rid && connected) sendStopTyping(rid);
                }}
                onFocus={() => {
                  if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                  interactingRef.current = false;
                }}
                rows={1}
                placeholder={t.inputPlaceholder}
                className="block w-full min-h-0 resize-none border-0 bg-transparent shadow-none px-3.5 pt-2.5 pb-1 text-sm leading-relaxed text-zinc-900 [scrollbar-width:none] transition-colors placeholder:text-zinc-400 focus:ring-0 focus:outline-none focus-visible:ring-0"
              />
            <div className="flex items-center justify-between px-1.5 pb-1.5">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label={t.attach}
                  disabled={uploading}
                  onMouseDown={() => { interactingRef.current = true; }}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition',
                    uploading
                      ? 'text-zinc-300'
                      : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600',
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </button>
                <div className="relative">
                  <button
                    ref={emojiBtnRef}
                    type="button"
                    aria-label={t.emoji}
                    aria-expanded={emojiOpen}
                    onMouseDown={() => { interactingRef.current = true; }}
                    onClick={() => setEmojiOpen((v) => !v)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition',
                      emojiOpen
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600',
                    )}
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <EmojiPicker
                    open={emojiOpen}
                    onClose={() => setEmojiOpen(false)}
                    onSelect={handleEmojiSelect}
                    triggerRef={emojiBtnRef}
                  />
                </div>
                {/* 暂时隐藏 GIF / 语音输入（功能未上线）；恢复时移除外层 hidden 即可 */}
                <div className="hidden">
                  <button
                    type="button"
                    aria-label="GIF"
                    title={t.comingSoon}
                    disabled
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-zinc-400 transition hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    GIF
                  </button>
                  <button
                    type="button"
                    aria-label="语音"
                    title={t.comingSoon}
                    disabled
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                size="icon"
                disabled={(!input.trim() && staged.length === 0) || sending || uploading}
                aria-label={t.send}
                className={cn(
                  'h-8 w-8 shrink-0 rounded-full transition-all duration-200 active:scale-90',
                  (input.trim() || staged.length > 0) && !sending && !uploading
                    ? 'bg-zinc-900 text-white shadow-sm hover:bg-zinc-800'
                    : 'bg-zinc-200 text-zinc-400 shadow-none',
                )}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

/* ── 按天分组的消息列表 ─────────────────────────── */
function DayGroupedMessages({
  messages,
  locale,
  t,
  agentName,
  agentTitle,
}: {
  messages: ChatMessage[];
  locale: string;
  t: TI18N;
  agentName: string;
  agentTitle: string;
}) {
  const groups: { day: string; items: ChatMessage[] }[] = [];
  for (const m of messages) {
    const day = new Date(m.timestamp).toDateString();
    const last = groups.at(-1);
    if (last && last.day === day) {
      last.items.push(m);
    } else {
      groups.push({ day, items: [m] });
    }
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g, gi) => {
        const first = g.items[0];
        if (!first) return null;
        return (
          <div key={gi} className="flex flex-col gap-3">
            <div className="flex items-center justify-center">
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                {formatDayLabel(first.timestamp, locale, t)}
              </span>
            </div>
            {g.items.map((m) => (
              <MessageBubble
                key={m.messageId}
                message={m}
                agentName={agentName}
                agentTitle={agentTitle}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* 判断整条消息是否仅由 emoji 组成（用于放大渲染，最多 3 个字形） */
function isEmojiOnlyMessage(text: string, max = 3): boolean {
  const t = text.trim();
  if (!t) return false;
  if (typeof Intl.Segmenter === 'undefined') return false;
  const clusters = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t),
    (x) => x.segment,
  );
  if (clusters.length === 0 || clusters.length > max) return false;
  return clusters.every((c) => /\p{Extended_Pictographic}/u.test(c) && !/\p{L}|\p{N}/u.test(c));
}

/* ── 单条消息（Klipy 极简：无气泡背景，靠对齐+底部署名区分发送方） ─── */
function MessageBubble({
  message,
  agentName,
  agentTitle,
  locale,
  t,
}: {
  message: ChatMessage;
  agentName: string;
  agentTitle: string;
  locale: string;
  t: TI18N;
}) {
  // 系统消息（转接/分配等）：居中、弱化，与 admin 端保持一致
  if (message.sender === 'system') {
    return (
      <div className="animate-in fade-in flex justify-center py-1 duration-200 ease-out">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[0.7rem] leading-relaxed text-zinc-500">
          {message.content}
        </span>
      </div>
    );
  }

  const isAgent = message.sender === 'agent';
  // 纯 emoji 消息：放大 3 倍渲染（text-sm≈14px → text-5xl≈42px）
  const bigEmoji = !!message.content && isEmojiOnlyMessage(message.content);

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-1 duration-200',
        isAgent ? 'items-start' : 'items-end',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          isAgent ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-white',
          bigEmoji && 'bg-transparent px-0 py-0',
        )}
      >
        {message.content &&
          (bigEmoji ? (
            <p className="text-5xl leading-none">{message.content}</p>
          ) : isAgent ? (
            <ChatMarkdown content={message.content} />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ))}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {message.attachments.map((a) => {
              const isImage = a.contentType.startsWith('image/');
              // 图片：正方形缩略图，点击灯箱预览，不显示文件名/大小
              if (isImage) {
                return (
                  <ImagePreview key={a.id} src={a.url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.fileName}
                      className="aspect-square h-20 w-20 cursor-pointer rounded-lg object-cover"
                    />
                  </ImagePreview>
                );
              }
              // 其他文件：保留图标 + 文件名 + 大小
              return (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center gap-2 rounded-lg p-1.5 transition',
                    isAgent ? 'bg-white/70 hover:bg-white' : 'bg-white/10 hover:bg-white/20',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-md',
                      isAgent ? 'bg-zinc-200 text-zinc-500' : 'bg-white/15 text-white',
                    )}
                  >
                    <FileIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{a.fileName}</p>
                    <p className={cn('text-[10px]', isAgent ? 'text-zinc-500' : 'text-white/60')}>
                      {formatBytes(a.size)}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
      {/* 极简底部署名：客服显示「名称 · 角色 · 时间」；用户仅显示「时间」
          —— 不向客户暴露已读/未读回执（客户无需知道客服是否已读其消息） */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-1 text-[10px] text-zinc-400',
          isAgent ? '' : 'flex-row-reverse',
        )}
      >
        {isAgent ? (
          <span>
            <span className="font-medium text-zinc-500">{agentName}</span>
            <span className="mx-1 text-zinc-300">·</span>
            <span>{agentTitle}</span>
            <span className="mx-1 text-zinc-300">·</span>
            <span>{formatTime(message.timestamp, locale)}</span>
          </span>
        ) : (
          <span>{formatTime(message.timestamp, locale)}</span>
        )}
      </div>
    </div>
  );
}

/* 客服头像：配置头像优先；未配置时用昵称首字 + 品牌渐变兜底 */
function AgentAvatar({
  src,
  name,
  className,
  fallbackClassName,
}: {
  src: string;
  name: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const initial = name.trim().charAt(0) || '客';
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={fallbackClassName}>{initial}</AvatarFallback>
    </Avatar>
  );
}
