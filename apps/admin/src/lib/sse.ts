/**
 * SSE 解析器（fetch ReadableStream 版，docs/lingxi-ai-report-design.md §7.1）。
 *
 * 不用 EventSource：它只支持 GET 且无法带 POST body；灵犀发起生成走 fetch POST。
 * 逐块解码 → 按空行切帧 → 解析 event:/data: 行，注释行（: ping 心跳）自动忽略。
 * 帧类型来自 @tzj/types 的 LingxiSseEvent（type-only），与后端编排器共用防协议漂移。
 */
import type { LingxiSseEvent } from '@tzj/types';

/** 消费 SSE 响应体，逐帧回调；流正常结束或 reader 取消后返回 */
export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: LingxiSseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const abort = () => reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', abort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 帧以空行分隔；保留最后一段不完整数据等待下一块
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const parsed = parseFrame(frame);
        if (parsed) onEvent(parsed);
      }
    }
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

function parseFrame(raw: string): LingxiSseEvent | null {
  let event = '';
  let data = '';
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // 多行 data 按规范以换行拼接
      data += (data ? '\n' : '') + line.slice(5).trimStart();
    }
    // 「: ping」等注释行与其他字段忽略
  }
  if (!event || !data) return null;
  try {
    return { event, data: JSON.parse(data) } as LingxiSseEvent;
  } catch {
    return null;
  }
}
