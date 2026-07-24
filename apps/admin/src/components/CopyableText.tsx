'use client';

import { cn } from '@tzj/ui';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '@/lib/notify';

/** 可复制文本（常用于 IP 列），右侧带复制图标 */
export function CopyableText({
  value,
  className,
  mono = true,
  onActivate,
}: {
  value: string | null | undefined;
  className?: string;
  mono?: boolean;
  /** 提供时主值渲染为可点击链接（如打开详情抽屉），复制图标保留 */
  onActivate?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className={cn('text-muted-foreground', className)}>—</span>;
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      notifySuccess('已复制到剪贴板');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notifyError('复制失败，请手动选择复制');
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {onActivate ? (
        <button
          type="button"
          onClick={onActivate}
          className={cn('text-primary hover:underline', mono ? 'font-mono text-sm' : 'text-sm')}
        >
          {value}
        </button>
      ) : (
        <span className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</span>
      )}
      <button
        type="button"
        onClick={() => void onCopy()}
        className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`复制 ${value}`}
        title="复制"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
}

/** 优先展示完整 IP，无则回退脱敏地址 */
export function CopyableIp({
  ip,
  ipMasked,
  onActivate,
}: {
  ip: string | null | undefined;
  ipMasked?: string | null;
  onActivate?: () => void;
}) {
  return <CopyableText value={ip ?? ipMasked ?? null} onActivate={onActivate} />;
}
