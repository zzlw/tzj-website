import { Injectable } from '@nestjs/common';
import type { LingxiSseEventName } from '@tzj/types';

/** 缓冲中的单帧（event 名 + 已序列化前的数据对象） */
export interface LingxiFrame {
  event: LingxiSseEventName;
  data: unknown;
}

/** done 后缓冲保留时长：容忍「刚完成即刷新」的重连竞态 */
const RETAIN_AFTER_DONE_MS = 120_000;

/**
 * 单次生成的内存帧缓冲（借鉴参考项目 RunBuffer 语义的 Node 版）。
 * 生成任务是唯一写入者；HTTP 响应只是订阅者——断连不影响生成，
 * 重连从第 0 帧重放并阻塞等待新帧直到 done。
 */
export class RunBuffer {
  private readonly frames: LingxiFrame[] = [];
  private doneFlag = false;
  private waiters: Array<() => void> = [];

  get done(): boolean {
    return this.doneFlag;
  }

  push(event: LingxiFrame['event'], data: unknown): void {
    if (this.doneFlag) return; // done 后拒绝写入，防止编排器误用
    this.frames.push({ event, data });
    this.notify();
  }

  /** 标记生成结束（成功/失败都要调用，否则订阅者永远挂起） */
  end(): void {
    this.doneFlag = true;
    this.notify();
  }

  /** 从第 0 帧重放 → 阻塞等待新帧 → done 后返回 */
  async *subscribe(): AsyncGenerator<LingxiFrame> {
    let cursor = 0;
    for (;;) {
      while (cursor < this.frames.length) {
        const frame = this.frames[cursor++];
        if (frame) yield frame;
      }
      if (this.doneFlag) return;
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }

  private notify(): void {
    const pending = this.waiters;
    this.waiters = [];
    for (const resolve of pending) resolve();
  }
}

/**
 * 会话 → RunBuffer 注册表（单实例进程内存；横向扩容时替换为 Redis Pub/Sub）。
 * 同会话并发生成互斥；done 后保留 120s 供刷新重连，再自动清理。
 */
@Injectable()
export class RunBufferRegistry {
  private readonly buffers = new Map<string, RunBuffer>();

  /** 是否有进行中的生成（会话详情 generating 标志） */
  isGenerating(conversationId: string): boolean {
    const buffer = this.buffers.get(conversationId);
    return Boolean(buffer && !buffer.done);
  }

  get(conversationId: string): RunBuffer | undefined {
    return this.buffers.get(conversationId);
  }

  /** 创建缓冲；同会话已有进行中的生成时返回 null（调用方转 409） */
  create(conversationId: string): RunBuffer | null {
    if (this.isGenerating(conversationId)) return null;
    const buffer = new RunBuffer();
    this.buffers.set(conversationId, buffer);
    return buffer;
  }

  /** 生成结束后调用：标记 done 并在保留期后清理（防内存泄漏） */
  finish(conversationId: string, buffer: RunBuffer): void {
    buffer.end();
    const timer = setTimeout(() => {
      // 保留期内可能已被新一轮生成覆盖，只清理仍是本次的条目
      if (this.buffers.get(conversationId) === buffer) {
        this.buffers.delete(conversationId);
      }
    }, RETAIN_AFTER_DONE_MS);
    timer.unref?.();
  }
}
