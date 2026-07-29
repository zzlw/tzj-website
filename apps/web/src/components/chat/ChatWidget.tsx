'use client';

import type { AgentProfile, BusinessHours, ChatPrompts, LocalizedText } from '@tzj/types';
import {
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
import { presignChatAttachment, sendMessageHTTP } from '@/features/chat/api';
import type { ChatAttachment, ChatMessage } from '@/features/chat/types';
import { useAgentPresence } from '@/features/chat/useAgentPresence';
import { useChatMessages } from '@/features/chat/useChatMessages';
import { useChatSession } from '@/features/chat/useChatSession';
import { useVisitorChat } from '@/features/chat/useVisitorChat';
import { resolveMediaUrl } from '@/lib/media-url';
import { AgentAvatar } from './AgentAvatar';
import {
  formatBytes,
  formatRelative,
  formatRelativeTime,
  normalizeMessage,
  resolveContentType,
} from './chat-format';
import { resolveChatI18n } from './chat-i18n';
import { EmojiPicker } from './EmojiPicker';
import { DayGroupedMessages } from './MessageList';

// 会话级标记：避免刷新/重渲染重复主动打扰（Intercom 默认「每会话一次」）
const BUBBLE_DISMISSED_KEY = 'tzj_chat_bubble_dismissed'; // 用户主动关闭
const BUBBLE_SHOWN_KEY = 'tzj_chat_bubble_shown'; // 已自动展示过欢迎

export function ChatWidget({
  businessHours,
  agentProfile,
  chatPrompts,
}: {
  businessHours?: BusinessHours;
  agentProfile?: AgentProfile;
  chatPrompts?: ChatPrompts;
}) {
  const locale = useLocale() as string;
  const t = resolveChatI18n(locale);

  // 在线客服资料：优先用站点设置配置，缺失字段回退到本地 i18n 默认
  const agentName = agentProfile?.name?.trim() || t.agentName;
  const agentTitle = agentProfile?.title?.trim() || t.agentRole;
  const agentAvatarRaw = agentProfile?.avatar?.trim() || '';
  const agentAvatarUrl = agentAvatarRaw ? resolveMediaUrl(agentAvatarRaw) : '';
  const greetingText = agentProfile?.greeting?.trim() || t.aiGreeting;
  // 自动提示语：优先用当前语言配置值，该语言留空时回退到本地 i18n 默认
  const pickPrompt = (map: LocalizedText | undefined, fallback: string): string =>
    map?.[locale as keyof LocalizedText]?.trim() || fallback;
  const offlineHintText = pickPrompt(chatPrompts?.offlineMessage, t.offlineHint);
  const noAgentHintText = pickPrompt(chatPrompts?.noAgentMessage, t.noAgentHint);

  const [token, setToken] = useState<string | null>(null);

  const {
    connected,
    authError,
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
  const [input, setInput] = useState('');
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

  // 会话/token 生命周期（本地恢复、续期、建房、归档承接、新会话），逻辑拆分至 useChatSession
  const {
    room,
    setRoom,
    messages,
    setMessages,
    error,
    setError,
    sending,
    isClosed,
    roomIdRef,
    clientEmailRef,
    pendingOutgoingRef,
    restartWithMessageRef,
    ensureRoom,
    sendFirstMessage,
    restartWithMessage,
    startNewChat,
  } = useChatSession({
    token,
    setToken,
    connected,
    authError,
    joinRoom,
    leaveRoom,
    failedText: t.failed,
  });

  // 坐席 presence 聚合展示态（REST 自愈轮询 + 双防抖 + 营业时间兜底），逻辑拆分至 useAgentPresence
  const { displayPresence, availability, noAgentOnline, outsideHours, applyPresenceSignal } =
    useAgentPresence({
      connected,
      agentsOnline,
      agentsAway,
      setAgentsOnline,
      setAgentsAway,
      businessHours,
    });

  // 面板未打开时收到客服消息 → 弹预览气泡（每会话一次的 dismissed 判定仍在本组件）
  const onAgentMessageWhileClosed = useCallback(() => {
    if (!bubbleDismissedRef.current) setShowBubble(true);
  }, []);

  // 消息流/已读回执/socket 事件与瞬态通知，逻辑拆分至 useChatMessages
  const { serverUnread, agentTyping, transferNotice } = useChatMessages({
    open,
    openRef,
    connected,
    room,
    isClosed,
    on,
    off,
    markRead,
    applyPresenceSignal,
    roomIdRef,
    clientEmailRef,
    pendingOutgoingRef,
    restartWithMessageRef,
    setMessages,
    setRoom,
    onAgentMessageWhileClosed,
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

  // 取 ScrollArea 真正可滚动的 Viewport，避免 scrollIntoView 误把整页滚到底
  const getChatViewport = useCallback((): HTMLElement | null => {
    const root = scrollAreaRef.current;
    if (!root) return null;
    return root.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
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
  }, [open, connected, isClosed, input, staged, sendTyping, roomIdRef]);

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
    if (noAgentOnline) return noAgentHintText;
    if (displayPresence === 'offline') return offlineHintText;
    if (displayPresence === 'away') return t.presenceAway;
    return greetingText;
  }, [noAgentOnline, displayPresence, greetingText, noAgentHintText, offlineHintText, t]);

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
    [ensureRoom, t.failed, connected, sendTyping, roomIdRef, setError],
  );

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
    [
      input,
      staged,
      room,
      connected,
      sendMessage,
      sendFirstMessage,
      restartWithMessage,
      t.failed,
      pendingOutgoingRef,
      setMessages,
      setRoom,
      setError,
    ],
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
    [input, connected, sendTyping, roomIdRef],
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

  // 头部副标题：依据真实在线状态诚实呈现，并附 SLA 提示
  //  - 未连接：乐观显示在线（瞬时态）
  //  - 无坐席在线：明确「暂无人值守」（即使处于工作时间）
  //  - 在线且多坐席：细化为「N 位客服在线 · 通常 X 分钟内回复」
  //  - 在线单坐席：在线客服 · 通常 X 分钟内回复
  //  - 离开/离线：附「最后在线时间」
  const presenceLabel = !connected
    ? // 尚未连接：文案与圆点共用同一真值 displayPresence（即圆点所依赖的
      // effectivePresence），避免「计数未知但已收到 presence 在线信号」时，
      // 圆点变绿而文案仍按 agentsOnline 判为离线的矛盾。
      displayPresence === 'online'
      ? outsideHours
        ? t.presenceOutsideOnline
        : agentsOnline > 0
          ? `${t.onlineAgent} · ${slaOnline}`
          : t.subtitle
      : displayPresence === 'away'
        ? t.presenceAway
        : t.presenceOffline
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
          <ScrollArea
            ref={scrollAreaRef}
            className="h-full bg-white [&>[data-slot=scroll-area-viewport]]:overscroll-contain"
          >
            <ImagePreviewProvider>
              <div
                ref={chatContentRef}
                className="flex min-h-full flex-col gap-4 overflow-x-hidden px-4 py-4"
              >
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
                            {/* 豁免 next/image：运行时上传附件（动态 URL、尺寸未知），固定缩略图尺寸无 CLS */}
                            <img
                              src={a.url}
                              alt={a.fileName}
                              width={48}
                              height={48}
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
                  onMouseDown={() => {
                    interactingRef.current = true;
                  }}
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
                    onMouseDown={() => {
                      interactingRef.current = true;
                    }}
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
