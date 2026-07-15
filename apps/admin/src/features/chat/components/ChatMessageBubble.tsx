'use client';

import { cn, ImagePreview } from '@tzj/ui';
import { Check, CheckCheck, File as FileIcon } from 'lucide-react';
import type { ChatMessage } from '../types';
import { ChatMarkdown } from './ChatMarkdown';

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${Number((bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1))} ${units[i]}`;
}

/**
 * 判断「对方是否已读本条消息」。
 * 参考业内最佳实践（WhatsApp / iMessage 已读回执）：
 * - 客服发的消息（sender=agent）：看「客户 client」是否读了 → userType==="client"
 * - 访客发的消息（sender=client）：看「客服 agent」是否读了 → userType==="agent"
 * 注意：不能用 message.isRead（后端语义是「双方都读过」才置 true），
 * 单看己方回执即可表达「对方是否已读」。
 */
function readByOpposite(message: ChatMessage): boolean {
  const opposite = message.sender === 'agent' ? 'client' : 'agent';
  return (message.readBy ?? []).some((r) => r.userType === opposite);
}

/* 判断整条消息是否仅由 emoji 组成（用于放大渲染，最多 3 个字形），与 C 端保持一致 */
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

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  // 系统消息：居中、弱化，不参与 normal flow 装修
  if (message.sender === 'system') {
    return (
      <div className="animate-in fade-in flex justify-center py-1 duration-200 ease-out">
        <span className="text-muted-foreground rounded-full bg-muted/60 px-3 py-1 text-[0.7rem] leading-relaxed">
          {message.content}
        </span>
      </div>
    );
  }

  const isAgent = message.sender === 'agent';
  // 对方是否已读本条消息（客服发出 → 看客户是否读；访客发出 → 看客服是否读）
  const isReadByOpposite = readByOpposite(message);
  // 纯 emoji 消息：放大 3 倍渲染（与 C 端保持一致，访客发来的大 emoji 客服端也大）
  const bigEmoji = !!message.content && isEmojiOnlyMessage(message.content);

  return (
    <div
      className={cn(
        // 仅用 fade-in，不用 slide-in-from-bottom：
        // transform 不影响 scrollHeight，会导致最后一条消息底部被裁切
        'animate-in fade-in flex flex-col gap-1 duration-200 ease-out',
        isAgent ? 'items-end' : 'items-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl border px-3 py-2 text-sm sm:max-w-[80%] sm:rounded-3xl sm:px-4 sm:py-3',
          isAgent
            ? 'border-primary/40 bg-primary text-primary-foreground'
            : 'border-transparent bg-muted',
        )}
      >
        <p
          className={cn(
            'text-[0.7rem] font-medium',
            isAgent ? 'text-primary-foreground/80' : 'text-foreground/70',
          )}
        >
          {isAgent ? '客服' : (message.senderEmail ?? '访客')}
        </p>
        {message.content &&
          (bigEmoji ? (
            <p className="mt-1 text-5xl leading-none">{message.content}</p>
          ) : isAgent ? (
            <div className="mt-1">
              <ChatMarkdown content={message.content} className="leading-relaxed" />
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          ))}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {message.attachments.map((a) => {
              const isImage = a.contentType.startsWith('image/');
              const cardClass = cn(
                'flex items-center gap-2 rounded-lg p-1.5 transition',
                isAgent
                  ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25'
                  : 'bg-background/70 hover:bg-background',
              );
              const inner = (
                <>
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.fileName}
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                        isAgent ? 'bg-primary-foreground/20' : 'bg-muted',
                      )}
                    >
                      <FileIcon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{a.fileName}</p>
                    <p
                      className={cn(
                        'text-[0.65rem]',
                        isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {formatBytes(a.size)}
                    </p>
                  </div>
                </>
              );

              // 图片：复用项目已有的灯箱预览（react-photo-view / ImagePreviewProvider）
              if (isImage) {
                return (
                  <ImagePreview key={a.id} src={a.url}>
                    <div className={cardClass}>{inner}</div>
                  </ImagePreview>
                );
              }
              // 非图片：新标签页打开
              return (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardClass}
                >
                  {inner}
                </a>
              );
            })}
          </div>
        )}
        <div
          className={cn(
            'mt-1.5 flex items-center justify-end gap-1 text-[0.65rem]',
            isAgent ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {/* 已读回执：仅客服发出的消息展示「已读 / 未读」，对齐 iMessage / WhatsApp 实践 */}
          {isAgent &&
            (isReadByOpposite ? (
              <span className="flex items-center gap-0.5 text-primary-foreground" title="客户已读">
                <CheckCheck className="h-3 w-3" aria-hidden="true" />
                <span>已读</span>
              </span>
            ) : (
              <span
                className="flex items-center gap-0.5 text-primary-foreground/55"
                title="客户尚未阅读"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                <span>未读</span>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
