'use client';

/** 建议追问 chips（suggest 帧 / 历史 meta 回放），点击即发送。 */
export function LingxiSuggests({
  items,
  disabled,
  onSelect,
}: {
  items: string[];
  disabled?: boolean;
  onSelect: (text: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(text)}
          className="rounded-2xl border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
