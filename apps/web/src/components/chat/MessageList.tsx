import { cn, ImagePreview } from '@tzj/ui';
import { File as FileIcon } from 'lucide-react';
import type { ChatMessage } from '@/features/chat/types';
import { ChatMarkdown } from './ChatMarkdown';
import { formatBytes, formatDayLabel, formatTime, isEmojiOnlyMessage } from './chat-format';
import type { ChatI18n } from './chat-i18n';

/* ── 按天分组的消息列表 ─────────────────────────── */
export function DayGroupedMessages({
  messages,
  locale,
  t,
  agentName,
  agentTitle,
}: {
  messages: ChatMessage[];
  locale: string;
  t: ChatI18n;
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
  t: ChatI18n;
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
                    {/* 豁免 next/image：聊天附件为运行时动态 URL，固定缩略图尺寸无 CLS */}
                    <img
                      src={a.url}
                      alt={a.fileName}
                      width={80}
                      height={80}
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
