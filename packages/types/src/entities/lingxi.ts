/**
 * 灵犀 · AI 投放报告助手 — 共享类型（docs/lingxi-ai-report-design.md §8）
 *
 * ⚠️ 全部为字符串字面量联合类型 + interface（type-only）：
 * admin 无法值导入 @tzj/types（Turbopack + NodeNext .js 后缀解析问题），
 * 禁止改成 TS enum。前后端共用同一份帧协议定义，防止 SSE 协议漂移。
 */

/** SSE 阶段（status 帧的 stage 字段） */
export type LingxiStage = 'accepted' | 'planning' | 'fetching' | 'generating';

/** SSE 事件名（8 帧协议） */
export type LingxiSseEventName =
  | 'status'
  | 'thinking'
  | 'tool'
  | 'delta'
  | 'dataRef'
  | 'suggest'
  | 'done'
  | 'error';

export interface LingxiStatusFrame {
  stage: LingxiStage;
  /** 首帧（accepted）携带，供前端拿到新建会话 ID */
  conversationId?: string;
}

export interface LingxiThinkingFrame {
  text: string;
}

/** 取数动作帧（工具执行完成后发出，summary 为人类可读摘要） */
export interface LingxiToolFrame {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface LingxiDeltaFrame {
  text: string;
}

/** 数据溯源条目：报告尾部「数字可回查」卡片 */
export interface LingxiDataRefItem {
  tool: string;
  /** 取数时间范围，如 "2026-07-16 ~ 2026-07-30" */
  range: string;
  /** 主结果集行数（聚合口径） */
  rows: number;
}

export interface LingxiDataRefFrame {
  items: LingxiDataRefItem[];
}

export interface LingxiSuggestFrame {
  items: string[];
}

export interface LingxiDoneFrame {
  conversationId: string;
}

export interface LingxiErrorFrame {
  message: string;
}

/** SSE 帧判别联合：解析器（admin lib/sse.ts）与编排器（api agent）共用 */
export type LingxiSseEvent =
  | { event: 'status'; data: LingxiStatusFrame }
  | { event: 'thinking'; data: LingxiThinkingFrame }
  | { event: 'tool'; data: LingxiToolFrame }
  | { event: 'delta'; data: LingxiDeltaFrame }
  | { event: 'dataRef'; data: LingxiDataRefFrame }
  | { event: 'suggest'; data: LingxiSuggestFrame }
  | { event: 'done'; data: LingxiDoneFrame }
  | { event: 'error'; data: LingxiErrorFrame };

/** 消息时间线条目（thinking/tool 帧落库回放用） */
export type LingxiTimelineItem =
  | { type: 'thinking'; text: string }
  | { type: 'tool'; name: string; args: Record<string, unknown>; summary: string };

/** assistant 消息的执行元数据（LingxiMessage.meta Json 字段） */
export interface LingxiMessageMeta {
  timeline?: LingxiTimelineItem[];
  dataRefs?: LingxiDataRefItem[];
  suggests?: string[];
  tokenUsage?: { promptTokens: number; completionTokens: number };
  /** 生成失败标记（assistant 侧 error 消息） */
  error?: boolean;
}

export type LingxiMessageRole = 'user' | 'assistant';

export interface LingxiMessageEntity {
  id: string;
  role: LingxiMessageRole;
  content: string;
  meta: LingxiMessageMeta | null;
  createdAt: Date;
}

export interface LingxiConversationSummary {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LingxiConversationDetail extends LingxiConversationSummary {
  messages: LingxiMessageEntity[];
  /** 是否有进行中的生成（前端据此决定是否连 stream/:id 续播） */
  generating: boolean;
}
