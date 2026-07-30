'use client';

/**
 * 空状态（docs/lingxi-ai-report-design.md §7.2）：
 * 大号灵犀声波动画（AudioLines + lingxi-icon 既有 CSS 动画）+ 3 个快捷问题。
 */
import { AudioLines } from 'lucide-react';

const QUICK_QUESTIONS = [
  '近两周整体投放表现如何？',
  '百度渠道的询盘成本划算吗？',
  '哪个落地页转化最差？',
] as const;

export function LingxiEmptyState({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <AudioLines className="lingxi-icon size-14 text-primary" strokeWidth={1.5} />
      <h2 className="mt-5 text-lg font-semibold text-foreground">灵犀 · AI 投放分析</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        用一句话生成投放报告：流量趋势、渠道效果、转化漏斗、询盘成本，数据可溯源。
      </p>
      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
        {QUICK_QUESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(text)}
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
