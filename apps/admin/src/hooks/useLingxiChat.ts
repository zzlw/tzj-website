'use client';

/**
 * 灵犀对话状态机 hook（docs/lingxi-ai-report-design.md §7.2/7.3）。
 *
 * 消息流为本地 useState 状态机（流式场景不适合 react-query 缓存）；
 * 会话列表仍走 react-query，done 后失效 ['lingxi','conversations'] 刷新侧列。
 * delta 帧以 ~100ms 节流刷入 state，避免 react-markdown 每帧全量重解析卡顿。
 */
import { useQueryClient } from '@tanstack/react-query';
import type {
  LingxiConversationDetail,
  LingxiDataRefItem,
  LingxiSseEvent,
  LingxiStage,
  LingxiTimelineItem,
} from '@tzj/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/apiClient';
import { BASE_PATH } from '@/lib/config';
import { consumeSseStream } from '@/lib/sse';

const STREAM_URL = `${BASE_PATH}/api/lingxi/stream`;
const DELTA_FLUSH_MS = 100;

export interface LingxiUiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timeline: LingxiTimelineItem[];
  dataRefs: LingxiDataRefItem[];
  suggests: string[];
  /** 生成失败的错误文案（渲染可重试气泡） */
  error?: string;
  /** 正在流式生成中（时间线默认展开、光标动画） */
  streaming?: boolean;
}

let uid = 0;
const nextId = () => `local-${Date.now()}-${uid++}`;

export function useLingxiChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LingxiUiMessage[]>([]);
  const [stage, setStage] = useState<LingxiStage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const lastUserTextRef = useRef('');
  // delta 节流：文本累积在 ref，定时刷入 state
  const pendingTextRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchLastAssistant = useCallback((patch: Partial<LingxiUiMessage>) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role !== 'assistant') return prev;
      return [...prev.slice(0, -1), { ...last, ...patch }];
    });
  }, []);

  const flushDelta = useCallback(() => {
    flushTimerRef.current = null;
    const text = pendingTextRef.current;
    patchLastAssistant({ content: text });
  }, [patchLastAssistant]);

  const scheduleFlush = useCallback(() => {
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushDelta, DELTA_FLUSH_MS);
    }
  }, [flushDelta]);

  const handleFrame = useCallback(
    (frame: LingxiSseEvent) => {
      switch (frame.event) {
        case 'status':
          setStage(frame.data.stage);
          if (frame.data.conversationId) setConversationId(frame.data.conversationId);
          break;
        case 'thinking':
          setMessages((prev) => appendTimeline(prev, { type: 'thinking', text: frame.data.text }));
          break;
        case 'tool':
          setMessages((prev) => appendTimeline(prev, { type: 'tool', ...frame.data }));
          break;
        case 'delta':
          pendingTextRef.current += frame.data.text;
          scheduleFlush();
          break;
        case 'dataRef':
          patchLastAssistant({ dataRefs: frame.data.items });
          break;
        case 'suggest':
          patchLastAssistant({ suggests: frame.data.items });
          break;
        case 'error':
          patchLastAssistant({ error: frame.data.message, streaming: false });
          break;
        case 'done':
          // 确保最后一段 delta 落地后再收尾
          if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
          flushDelta();
          patchLastAssistant({ streaming: false });
          break;
      }
    },
    [patchLastAssistant, scheduleFlush, flushDelta],
  );

  /** 消费一路 SSE 流（发起生成或重连续播共用） */
  const consume = useCallback(
    async (open: () => Promise<Response>) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      pendingTextRef.current = '';
      setGenerating(true);
      setStage(null);

      try {
        const res = await open();
        if (!res.ok || !res.body) {
          patchLastAssistant({ error: await readErrorMessage(res), streaming: false });
          return;
        }
        await consumeSseStream(res.body, handleFrame, controller.signal);
      } catch {
        if (!controller.signal.aborted) {
          patchLastAssistant({ error: '连接中断，请重试', streaming: false });
        }
      } finally {
        if (abortRef.current === controller) {
          setGenerating(false);
          setStage(null);
          // 流结束时兜底：无论 done 帧是否到达都把 streaming 收掉
          if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
          flushDelta();
          patchLastAssistant({ streaming: false });
          qc.invalidateQueries({ queryKey: ['lingxi', 'conversations'] });
        }
      }
    },
    [handleFrame, patchLastAssistant, flushDelta, qc],
  );

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || generating) return;
      lastUserTextRef.current = message;
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', content: message, timeline: [], dataRefs: [], suggests: [] },
        emptyAssistant(),
      ]);
      void consume(() =>
        fetch(STREAM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationId: conversationId ?? undefined }),
        }),
      );
    },
    [consume, conversationId, generating],
  );

  /** 错误气泡重试：移除失败的 assistant 气泡与其 user 消息，重发同一条 */
  const retry = useCallback(() => {
    const text = lastUserTextRef.current;
    if (!text || generating) return;
    setMessages((prev) => {
      const trimmed = [...prev];
      while (trimmed.length > 0) {
        const last = trimmed[trimmed.length - 1];
        if (!last) break;
        trimmed.pop();
        if (last.role === 'user') break;
      }
      return trimmed;
    });
    send(text);
  }, [generating, send]);

  /** 打开历史会话：加载消息；generating=true 则自动重连续播（无感恢复） */
  const openConversation = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      setLoadingHistory(true);
      setConversationId(id);
      setMessages([]);
      setStage(null);
      try {
        const detail = await api.get<LingxiConversationDetail>('lingxi/conversations', id);
        setMessages(detail.messages.map(toUiMessage));
        if (detail.generating) {
          setMessages((prev) => [...prev, emptyAssistant()]);
          void consume(() => fetch(`${STREAM_URL}?cid=${encodeURIComponent(id)}`));
        }
      } finally {
        setLoadingHistory(false);
      }
    },
    [consume],
  );

  /** 新建会话：清空本地状态，下一次 send 不带 conversationId */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setStage(null);
    setGenerating(false);
  }, []);

  // 卸载时断开连接（生成在服务端 RunBuffer 继续，重进可续播）
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  return {
    conversationId,
    messages,
    stage,
    generating,
    loadingHistory,
    send,
    retry,
    openConversation,
    reset,
  };
}

function emptyAssistant(): LingxiUiMessage {
  return {
    id: nextId(),
    role: 'assistant',
    content: '',
    timeline: [],
    dataRefs: [],
    suggests: [],
    streaming: true,
  };
}

function appendTimeline(prev: LingxiUiMessage[], item: LingxiTimelineItem): LingxiUiMessage[] {
  const last = prev[prev.length - 1];
  if (last?.role !== 'assistant') return prev;
  return [...prev.slice(0, -1), { ...last, timeline: [...last.timeline, item] }];
}

/** 从非 200 响应中提取人类可读错误信息（Nest 错误体或兜底状态码） */
async function readErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const msg = body?.error?.message ?? body?.message ?? `请求失败 (${res.status})`;
  return Array.isArray(msg) ? String(msg[0]) : String(msg);
}

function toUiMessage(msg: LingxiConversationDetail['messages'][number]): LingxiUiMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timeline: msg.meta?.timeline ?? [],
    dataRefs: msg.meta?.dataRefs ?? [],
    suggests: msg.meta?.suggests ?? [],
    ...(msg.meta?.error ? { error: '生成失败' } : {}),
  };
}
