import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/roles';
import { PrismaService } from '../prisma/prisma.service';
import type { ChatRequestDto } from './dto/chat.dto';
import { LlmClient } from './llm/llm-client';
import { LINGXI_SYSTEM_PROMPT } from './prompts';

/** 上下文回喂的历史轮数（user+assistant 各算一条） */
const HISTORY_LIMIT = 12;

/**
 * 灵犀 Agent（M1 最小版）：会话管理 + 直答流式生成（无工具）。
 * M2 引入规划调用、tool-calling 循环与 RunBuffer（生成与连接解耦）。
 */
@Injectable()
export class LingxiAgentService {
  private readonly logger = new Logger(LingxiAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClient,
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
    // generating: M4 接入 RunBuffer 后按缓冲状态返回，前端据此决定是否重连续播
    return { ...conversation, generating: false };
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
   * 发起生成（SSE）。调用前控制器已完成 LLM 配置检查（未配置时 503，不建流）。
   * M1 帧序列：status(accepted) → status(generating) → delta* → done；失败发 error 帧。
   */
  async chat(user: AuthUser, dto: ChatRequestDto, res: Response): Promise<void> {
    const { client, model } = await this.llm.resolve();
    const conversation = await this.loadOrCreateConversation(user.id, dto);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx 反代关闭缓冲
    res.flushHeaders?.();

    this.writeFrame(res, 'status', { stage: 'accepted', conversationId: conversation.id });

    await this.prisma.lingxiMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: dto.message },
    });

    try {
      const history = await this.prisma.lingxiMessage.findMany({
        where: { conversationId: conversation.id, role: { in: ['user', 'assistant'] } },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
        select: { role: true, content: true },
      });
      history.reverse();

      this.writeFrame(res, 'status', { stage: 'generating' });
      const stream = await client.chat.completions.create({
        model,
        stream: true,
        messages: [
          { role: 'system', content: LINGXI_SYSTEM_PROMPT },
          ...history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
      });

      let fullText = '';
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          fullText += text;
          this.writeFrame(res, 'delta', { text });
        }
      }

      await this.prisma.lingxiMessage.create({
        data: { conversationId: conversation.id, role: 'assistant', content: fullText },
      });
      await this.prisma.lingxiConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      this.writeFrame(res, 'done', { conversationId: conversation.id });
    } catch (err) {
      // 不向客户端透出内部细节，完整错误进日志
      this.logger.error(`灵犀生成失败 conversationId=${conversation.id}`, (err as Error).stack);
      this.writeFrame(res, 'error', { message: '灵犀暂时无法响应，请稍后重试' });
    } finally {
      res.end();
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

  /** 单帧写出并立即 flush（全局 compression() 会缓冲，必须显式冲刷） */
  private writeFrame(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    (res as Response & { flush?: () => void }).flush?.();
  }
}
