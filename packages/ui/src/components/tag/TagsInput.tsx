"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { TagChip } from "../tag/TagChip";

function parseTags(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinTags(tags: string[]): string {
  return tags.join(", ");
}

export interface TagsInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** 标签 Chip 输入（Enter 新建，Backspace 删除最后一项）。 */
export function TagsInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "输入标签后按 Enter 添加…",
  disabled = false,
  className,
  id,
}: TagsInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(() => parseTags(value), [value]);

  const filteredSuggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return suggestions.filter((s) => !tags.includes(s)).slice(0, 8);
    return suggestions
      .filter((s) => !tags.includes(s) && s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [input, suggestions, tags]);

  const addTag = useCallback(
    (raw: string) => {
      const name = raw.trim().replace(/\s+/g, " ");
      if (!name || tags.includes(name)) return;
      onChange(joinTags([...tags, name]));
      setInput("");
    },
    [onChange, tags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(joinTags(tags.filter((t) => t !== tag)));
    },
    [onChange, tags],
  );

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "，") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      removeTag(tags[tags.length - 1]!);
    }
  }

  return (
    <div className={cn("relative space-y-2", className)}>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 shadow-sm transition-colors",
          focused && "ring-2 ring-ring ring-offset-2 ring-offset-background",
          disabled && "cursor-not-allowed opacity-60",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-md border border-border/80 bg-muted/50 pl-2 pr-1 text-xs"
          >
            {tag}
            {!disabled ? (
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                aria-label={`移除 ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={tags.length ? "" : placeholder}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {focused && filteredSuggestions.length ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-popover p-2 shadow-md">
          <p className="mb-1.5 px-1 text-xs text-muted-foreground">已有标签</p>
          <div className="flex flex-wrap gap-1.5">
            {filteredSuggestions.map((s) => (
              <TagChip
                key={s}
                label={s}
                onClick={() => addTag(s)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
