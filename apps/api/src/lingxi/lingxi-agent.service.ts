import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { LingxiDataRefItem, LingxiMessageMeta, LingxiTimelineItem } from '@tzj/types';
import type { Response } from 'express';
import type OpenAI from 'openai';
import type { AuthUser } from '../auth/roles';
import { PrismaService } from '../prisma/prisma.service';
import type { ChatRequestDto } from './dto/chat.dto';
import { LingxiToolsService } from './lingxi-tools.service';
import { LlmClient } from './llm/llm-client';
import {
  LINGXI_DEFAULT_SUGGESTS,
  LINGXI_OFF_TOPIC_REPLY,
  LINGXI_PLANNER_PROMPT,
  LINGXI_SYSTEM_PROMPT,
} from './prompts';
import { type LingxiFrame, type RunBuffer, RunBufferRegistry } from './run-buffer';

/** 上下文回喂的历史轮数（user+assistant 各算一条） */
const HISTORY_LIMIT = 12;
/** tool-calling 循环上限；见顶后强制终答（§5.4 保底） */
const MAX_TOOL_TURNS = 8;
/** SSE 注释心跳间隔（防反代 read timeout 断连） */
const HEARTBEAT_MS = 15_000;

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** 规划调用的结构化输出（解析失败按默认范围继续） */
interface LingxiPlan {
  offTopic: boolean;
  from?: string;
  to?: string;
  channels?: string[];
  focus?: string;
  suggests?: string[];
}

/** 帧写入回调（写 RunBuffer + 同步时间线） */
type EmitFrame = (event: LingxiFrame['event'], data: unknown) => void;

/** 流式单轮聚合结果：content 为本轮流出的文本，toolCalls 非空则需执行工具续轮 */
interface StreamTurnResult {
  content: string;
  toolCalls: Array<{ id: string; name: string; args: string }>;
}

/**
 * 灵犀 Agent（M2）：规划调用 → tool-calling 循环 → 流式终答 → dataRef/suggest/done。
 * 生成与连接解耦（§5.6）：生成任务后台执行、帧写入 RunBuffer，
 * HTTP 响应只是缓冲订阅者——断连不取消生成，跑完照常落库。
 */
@Injectable()
export class LingxiAgentService {
  private readonly logger = new Logger(LingxiAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClient,
    private readonly tools: LingxiToolsService,
    private readonly buffers: RunBufferRegistry,
  ) {}

  async listConversations(userId: string, page = 1, pageSize = 20) {
    const where = { userId, deletedAt: null };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.lingxiConversation.count({ where }),
      this.prisma.lingxiConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async getConversation(userId: string, id: string) {
    const conversation = await this.prisma.lingxiConversation.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, meta: true, createdAt: true },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException('会话不存在或已删除');
    }
    // generating=true 时前端连 stream/:id 重放续播（刷新不丢正在生成的报告）
    return { ...conversation, generating: this.buffers.isGenerating(id) };
  }

  async softDeleteConversation(userId: string, id: string) {
    const result = await this.prisma.lingxiConversation.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('会话不存在或已删除');
    }
    return { success: true };
  }

  /**
   * 发起生成（SSE）。建流前完成全部可失败校验（LLM 未配置 503 / 会话不存在 404 /
   * 并发生成 409），失败走统一异常过滤器返回 JSON，不吐半截 SSE。
   */
  async chat(user: AuthUser, dto: ChatRequestDto, res: Response): Promise<void> {
    const { client, model } = await this.llm.resolve();
    const conversation = await this.loadOrCreateConversation(user.id, dto);

    const buffer = this.buffers.create(conversation.id);
    if (!buffer) {
      throw new ConflictException('该会话有正在进行的生成，请稍候或刷新查看');
    }

    await this.prisma.lingxiMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: dto.message },
    });

    // 后台生成（持强引用防 GC；断连不 abort），响应仅作为订阅者续播
    void this.runGeneration(client, model, conversation.id, dto.message).catch((err) => {
      this.logger.error(`灵犀生成任务异常退出 conversationId=${conversation.id}`, err?.stack);
    });

    await this.streamToResponse(res, buffer);
  }

  /** 流恢复：重放缓冲全部帧并续播直到 done（§5.6） */
  async resume(user: AuthUser, conversationId: string, res: Response): Promise<void> {
    const owned = await this.prisma.lingxiConversation.findFirst({
      where: { id: conversationId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) {
      throw new NotFoundException('会话不存在或已删除');
    }
    const buffer = this.buffers.get(conversationId);
    if (!buffer) {
      throw new NotFoundException('该会话没有进行中的生成');
    }
    await this.streamToResponse(res, buffer);
  }

  // ── 生成编排（唯一的 RunBuffer 写入者） ──────────────────────────────

  private async runGeneration(
    client: OpenAI,
    model: string,
    conversationId: string,
    userMessage: string,
  ): Promise<void> {
    const buffer = this.buffers.get(conversationId);
    if (!buffer) return;

    const timeline: LingxiTimelineItem[] = [];
    const dataRefs: LingxiDataRefItem[] = [];
    const usage = { promptTokens: 0, completionTokens: 0 };
    let suggests = LINGXI_DEFAULT_SUGGESTS;
    let fullText = '';
    let failed = false;

    const emit = (event: Parameters<RunBuffer['push']>[0], data: unknown) => {
      buffer.push(event, data);
      // thinking/tool 帧同步进时间线，落库后供刷新完整回放
      if (event === 'thinking') {
        timeline.push({ type: 'thinking', text: (data as { text: string }).text });
      } else if (event === 'tool') {
        const frame = data as { name: string; args: Record<string, unknown>; summary: string };
        timeline.push({ type: 'tool', ...frame });
      }
    };

    emit('status', { stage: 'accepted', conversationId });

    try {
      const history = await this.loadHistory(conversationId);

      // ① 规划调用：一次结构化输出判断域外/时间范围/渠道/追问建议
      emit('status', { stage: 'planning' });
      const plan = await this.planRequest(client, model, history, userMessage, usage);
      if (plan.suggests?.length) suggests = plan.suggests;

      if (plan.offTopic) {
        fullText = LINGXI_OFF_TOPIC_REPLY;
        emit('delta', { text: fullText });
        emit('suggest', { items: suggests });
        emit('done', { conversationId });
        return;
      }

      const rangeText =
        plan.from && plan.to ? `时间范围 ${plan.from} ~ ${plan.to}` : '时间范围按默认（近 14 天）';
      const channelText = plan.channels?.length ? ` · 聚焦 ${plan.channels.join('/')} 渠道` : '';
      emit('thinking', {
        text: `${rangeText}${channelText}${plan.focus ? ` · ${plan.focus}` : ''}`,
      });

      // ② tool-calling 循环（≤8 轮）；③ 终答流式生成
      // 单次流式调用两用：content 增量即 delta 帧，tool_calls 聚合后执行续轮
      const messages: ChatMessage[] = [
        { role: 'system', content: LINGXI_SYSTEM_PROMPT },
        ...history,
        {
          role: 'user',
          content:
            plan.from && plan.to
              ? `${userMessage}\n\n（规划确定的分析范围：${plan.from} ~ ${plan.to}，取数时使用该 from/to）`
              : userMessage,
        },
      ];

      fullText = await this.runToolLoop(client, model, messages, usage, emit, dataRefs);

      // ④ 数据溯源 + 建议追问 + done
      if (dataRefs.length) emit('dataRef', { items: dataRefs });
      emit('suggest', { items: suggests });
      emit('done', { conversationId });
    } catch (err) {
      // 不向客户端透出内部细节，完整错误进日志；assistant 侧落 error 标记消息
      this.logger.error(`灵犀生成失败 conversationId=${conversationId}`, (err as Error).stack);
      emit('error', { message: '灵犀暂时无法响应，请稍后重试' });
      failed = true;
      fullText = fullText || '（生成失败）';
    } finally {
      this.buffers.finish(conversationId, buffer);
      await this.persistAssistant(conversationId, fullText, {
        timeline,
        dataRefs,
        suggests,
        tokenUsage: usage,
        ...(failed ? { error: true } : {}),
      });
    }
  }

  /**
   * tool-calling 循环（≤8 轮）：无 tool_calls 时 content 即终答；
   * 见顶后禁用工具强制终答（§5.4 保底）。返回累积的终答文本。
   */
  private async runToolLoop(
    client: OpenAI,
    model: string,
    messages: ChatMessage[],
    usage: { promptTokens: number; completionTokens: number },
    emit: EmitFrame,
    dataRefs: LingxiDataRefItem[],
  ): Promise<string> {
    let generating = false;
    let fullText = '';
    for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
      const capped = turn === MAX_TOOL_TURNS; // 见顶：禁用工具，用已获数据强制生成
      if (!capped && turn === 0) emit('status', { stage: 'fetching' });

      const result = await this.streamTurn(client, model, messages, usage, capped, (text) => {
        if (!generating) {
          generating = true;
          emit('status', { stage: 'generating' });
        }
        fullText += text;
        emit('delta', { text });
      });

      if (!result.toolCalls.length) break; // 无 tool_calls → content 即终答，循环结束
      await this.executeToolCalls(result, messages, emit, dataRefs);
    }
    return fullText;
  }

  /** 执行工具（并行）→ 发 tool 帧 → 结果回填 messages */
  private async executeToolCalls(
    result: StreamTurnResult,
    messages: ChatMessage[],
    emit: EmitFrame,
    dataRefs: LingxiDataRefItem[],
  ): Promise<void> {
    messages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls.map((c) => ({
        id: c.id,
        type: 'function' as const,
        function: { name: c.name, arguments: c.args },
      })),
    });
    const outcomes = await Promise.all(
      result.toolCalls.map(async (call) => {
        const args = this.parseArgs(call.args);
        const outcome = await this.tools.execute(call.name, args);
        emit('tool', { name: call.name, args, summary: outcome.summary });
        dataRefs.push({ tool: call.name, range: outcome.range, rows: outcome.rows });
        return { call, outcome };
      }),
    );
    for (const { call, outcome } of outcomes) {
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome.data),
      });
    }
  }

  /** 单轮流式调用：content 增量回调外抛，tool_calls 按 index 聚合 */
  private async streamTurn(
    client: OpenAI,
    model: string,
    messages: ChatMessage[],
    usage: { promptTokens: number; completionTokens: number },
    disableTools: boolean,
    onDelta: (text: string) => void,
  ): Promise<StreamTurnResult> {
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      stream_options: { include_usage: true },
      messages,
      ...(disableTools ? {} : { tools: this.tools.definitions, tool_choice: 'auto' as const }),
    });

    let content = '';
    const toolCalls: StreamTurnResult['toolCalls'] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        onDelta(delta.content);
      }
      for (const tc of delta?.tool_calls ?? []) {
        this.collectToolCallDelta(toolCalls, tc);
      }
      if (chunk.usage) {
        usage.promptTokens += chunk.usage.prompt_tokens;
        usage.completionTokens += chunk.usage.completion_tokens;
      }
    }
    return { content, toolCalls: toolCalls.filter((c) => c.id && c.name) };
  }

  /** 聚合单个 tool_call 的流式增量（id/name/arguments 分片到达） */
  private collectToolCallDelta(
    toolCalls: StreamTurnResult['toolCalls'],
    tc: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall,
  ): void {
    let slot = toolCalls[tc.index];
    if (!slot) {
      slot = { id: '', name: '', args: '' };
      toolCalls[tc.index] = slot;
    }
    if (tc.id) slot.id = tc.id;
    if (tc.function?.name) slot.name += tc.function.name;
    if (tc.function?.arguments) slot.args += tc.function.arguments;
  }

  /** 规划调用（低温度 + json_object）；解析失败返回默认计划并 thinking 告知（§5.10） */
  private async planRequest(
    client: OpenAI,
    model: string,
    history: ChatMessage[],
    userMessage: string,
    usage: { promptTokens: number; completionTokens: number },
  ): Promise<LingxiPlan> {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: LINGXI_PLANNER_PROMPT.replace('{today}', today) },
          ...history.slice(-4),
          { role: 'user', content: userMessage },
        ],
      });
      if (completion.usage) {
        usage.promptTokens += completion.usage.prompt_tokens;
        usage.completionTokens += completion.usage.completion_tokens;
      }
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as LingxiPlan;
      return { ...parsed, offTopic: parsed.offTopic === true };
    } catch (err) {
      this.logger.warn(`灵犀规划调用失败，按默认范围继续：${(err as Error).message}`);
      const from = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);
      return { offTopic: false, from, to: today, focus: '规划解析失败，按近 14 天全渠道分析' };
    }
  }

  // ── SSE 写出（订阅者侧） ──────────────────────────────────────────────

  /** 订阅缓冲并写出（从第 0 帧重放）；含注释心跳；断连只停写出、不停生成 */
  private async streamToResponse(res: Response, buffer: RunBuffer): Promise<void> {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx 反代关闭缓冲
    res.flushHeaders?.();

    let closed = false;
    res.on('close', () => {
      closed = true;
    });
    const heartbeat = setInterval(() => {
      if (!closed) {
        res.write(': ping\n\n');
        this.flush(res);
      }
    }, HEARTBEAT_MS);

    try {
      for await (const frame of buffer.subscribe()) {
        if (closed) break;
        res.write(`event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`);
        this.flush(res);
      }
    } finally {
      clearInterval(heartbeat);
      if (!closed) res.end();
    }
  }

  /** 全局 compression() 会缓冲响应，每次写出后必须显式冲刷 */
  private flush(res: Response): void {
    (res as Response & { flush?: () => void }).flush?.();
  }

  // ── 辅助 ────────────────────────────────────────────────────────────

  private async loadHistory(conversationId: string): Promise<ChatMessage[]> {
    const rows = await this.prisma.lingxiMessage.findMany({
      where: { conversationId, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT + 1, // 最新一条是本轮 user 消息，排除后回喂
      select: { role: true, content: true },
    });
    return rows
      .slice(1)
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  private async persistAssistant(
    conversationId: string,
    content: string,
    meta: LingxiMessageMeta,
  ): Promise<void> {
    try {
      await this.prisma.lingxiMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content,
          meta: JSON.parse(JSON.stringify(meta)),
        },
      });
      await this.prisma.lingxiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`灵犀消息落库失败 conversationId=${conversationId}`, (err as Error).stack);
    }
  }

  private parseArgs(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw || '{}');
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private async loadOrCreateConversation(userId: string, dto: ChatRequestDto) {
    if (dto.conversationId) {
      const existing = await this.prisma.lingxiConversation.findFirst({
        where: { id: dto.conversationId, userId, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException('会话不存在或已删除');
      }
      return existing;
    }
    return this.prisma.lingxiConversation.create({
      data: { userId, title: dto.message.slice(0, 30) },
    });
  }
}
