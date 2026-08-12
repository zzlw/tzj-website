import { formatChatDayLabel } from '@tzj/utils';

/** 消息列表日期分隔胶囊：今天 / 昨天 / 月日（跨年带年份），与 C 端挂件口径一致 */
export function ChatDayDivider({ timestamp }: { timestamp: string }) {
  const label = formatChatDayLabel({ ts: timestamp, locale: 'zh-CN' });
  if (!label) return null;
  return (
    <div className="flex items-center justify-center py-0.5">
      <span className="bg-muted/70 text-muted-foreground rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium tracking-wide">
        {label}
      </span>
    </div>
  );
}
