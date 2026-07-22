'use client';

import { cn } from '@tzj/ui';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

interface EmojiCategory {
  key: string;
  label: string;
  icon: string;
  emojis: string[];
}

// 自包含 emoji 数据集（无需第三方依赖），按语义分组，参考 Intercom / WhatsApp 的分类方案
const CATEGORIES: EmojiCategory[] = [
  {
    key: 'smileys',
    label: '笑脸',
    icon: '😀',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '🤣',
      '😂',
      '🙂',
      '🙃',
      '😉',
      '😊',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😗',
      '😚',
      '😙',
      '😋',
      '😛',
      '😜',
      '🤪',
      '😝',
      '🤑',
      '🤗',
      '🤭',
      '🤫',
      '🤔',
      '😐',
      '😑',
      '😶',
      '😏',
      '😒',
      '🙄',
      '😬',
      '😌',
      '😔',
      '😪',
      '😴',
      '😷',
      '🤒',
      '🤕',
      '🤢',
      '🤮',
      '🥵',
      '🥶',
      '😎',
      '🥳',
      '🥸',
      '🤓',
      '🧐',
      '😕',
      '😟',
      '🙁',
      '😮',
      '😯',
      '😲',
      '😳',
      '🥺',
      '😦',
      '😧',
      '😨',
      '😰',
      '😥',
      '😢',
      '😭',
      '😱',
      '😖',
      '😣',
      '😞',
      '😓',
      '😩',
      '😫',
      '🥱',
      '😤',
      '😡',
      '😠',
      '🤬',
      '😈',
      '👿',
      '💀',
      '🤡',
      '👻',
      '👽',
      '🤖',
      '🎃',
      '😺',
      '😸',
      '😹',
      '😻',
      '😼',
      '😽',
      '🙀',
      '😿',
      '😾',
    ],
  },
  {
    key: 'gestures',
    label: '手势',
    icon: '👍',
    emojis: [
      '👍',
      '👎',
      '👏',
      '🙌',
      '🙏',
      '💪',
      '🤝',
      '✌️',
      '🤞',
      '🤟',
      '🤘',
      '👌',
      '🤏',
      '✊',
      '👊',
      '🤛',
      '🤜',
      '🫶',
      '🫰',
      '🖐️',
      '✋',
      '🖖',
      '🤚',
      '🤙',
      '👈',
      '👉',
      '👆',
      '👇',
      '☝️',
      '🫵',
      '👋',
      '💅',
      '🤳',
      '👀',
      '🧠',
      '🫀',
      '🫁',
      '🦷',
      '🦴',
      '👃',
      '👂',
      '🫦',
      '👅',
      '👄',
      '💃',
      '🕺',
      '🤷',
      '🤦',
      '🫡',
      '💁',
    ],
  },
  {
    key: 'hearts',
    label: '符号',
    icon: '❤️',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❣️',
      '💕',
      '💖',
      '💗',
      '💓',
      '💞',
      '💘',
      '💝',
      '💟',
      '💌',
      '🔥',
      '⭐',
      '⚡',
      '💥',
      '✨',
      '🌟',
      '💫',
      '💯',
      '✅',
      '❌',
      '⭕',
      '🔆',
      '🌈',
      '☀️',
      '🌙',
      '⛅',
      '☁️',
      '💧',
      '🌊',
      '🍀',
    ],
  },
  {
    key: 'animals',
    label: '动物',
    icon: '🐶',
    emojis: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐸',
      '🐵',
      '🐔',
      '🐧',
      '🐦',
      '🦆',
      '🦅',
      '🦉',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
      '🐢',
      '🐍',
      '🐙',
      '🐠',
      '🐳',
      '🐬',
      '🦈',
      '🐊',
      '🐡',
      '🦭',
    ],
  },
  {
    key: 'food',
    label: '食物',
    icon: '🍔',
    emojis: [
      '🍏',
      '🍎',
      '🍐',
      '🍊',
      '🍋',
      '🍌',
      '🍉',
      '🍇',
      '🍓',
      '🫐',
      '🍒',
      '🍑',
      '🥭',
      '🍍',
      '🥥',
      '🥝',
      '🍅',
      '🥑',
      '🍆',
      '🥔',
      '🥕',
      '🌽',
      '🌶️',
      '🥦',
      '🍞',
      '🥐',
      '🥯',
      '🧀',
      '🥚',
      '🍳',
      '🥞',
      '🍔',
      '🍟',
      '🍕',
      '🌭',
      '🌮',
      '🌯',
      '🍜',
      '🍣',
      '🍱',
      '🍙',
      '🍚',
      '🍰',
      '🎂',
      '🍫',
      '🍬',
      '🍭',
      '🍿',
      '🍩',
      '🍪',
    ],
  },
  {
    key: 'activities',
    label: '活动',
    icon: '⚽',
    emojis: [
      '⚽',
      '🏀',
      '🏈',
      '⚾',
      '🎾',
      '🏐',
      '🏉',
      '🎱',
      '🏓',
      '🏸',
      '🥅',
      '🏒',
      '🏑',
      '🏏',
      '⛳',
      '🎿',
      '🛷',
      '🥊',
      '🥋',
      '🎽',
      '⛸️',
      '🛹',
      '🛼',
      '🎯',
      '🎮',
      '🎲',
      '🎸',
      '🎺',
      '🎻',
      '🥁',
      '🎤',
      '🎧',
      '🎬',
      '🎨',
      '🎭',
      '🎟️',
      '🎡',
      '🎢',
      '🎠',
      '🎪',
    ],
  },
  {
    key: 'travel',
    label: '旅行',
    icon: '✈️',
    emojis: [
      '🚗',
      '🚕',
      '🚙',
      '🚌',
      '🚎',
      '🏎️',
      '🚓',
      '🚑',
      '🚒',
      '🚐',
      '🚚',
      '🚛',
      '🚜',
      '🏍️',
      '🚲',
      '🛴',
      '🚨',
      '🚂',
      '🚆',
      '🚊',
      '🚉',
      '✈️',
      '🚀',
      '🛸',
      '🚁',
      '⛵',
      '🛥️',
      '🚢',
      '⚓',
      '🏝️',
      '🏔️',
      '🗺️',
      '🧭',
      '🏕️',
      '🏖️',
      '🏠',
      '🏡',
      '🏢',
      '🏬',
      '🏯',
      '🏰',
      '🗽',
      '🌋',
      '🗼',
      '🌃',
      '🌉',
      '🌁',
    ],
  },
  {
    key: 'objects',
    label: '物品',
    icon: '💡',
    emojis: [
      '⌚',
      '📱',
      '💻',
      '⌨️',
      '🖥️',
      '🖨️',
      '🖱️',
      '💽',
      '💾',
      '💿',
      '🔋',
      '🔌',
      '📷',
      '📹',
      '🎥',
      '📺',
      '📻',
      '🔊',
      '🔉',
      '🔈',
      '💡',
      '📚',
      '📖',
      '🔧',
      '🔨',
      '🛠️',
      '⚙️',
      '🧰',
      '🧲',
      '💣',
      '💊',
      '💉',
      '🩹',
      '🩺',
      '🧪',
      '🧬',
      '🔬',
      '🔭',
      '📡',
      '💰',
      '💴',
      '💵',
      '💶',
      '💷',
      '💳',
      '🪙',
      '💎',
      '🔑',
      '🔒',
      '🔓',
      '📦',
      '📫',
      '📮',
      '✉️',
      '📝',
      '📄',
      '📃',
      '📌',
      '📎',
      '🔗',
    ],
  },
];

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export function EmojiPicker({ open, onClose, onSelect, triggerRef }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // 点击选择器或触发按钮之外的区域 → 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose, triggerRef]);

  // 切换分类时重置焦点索引
  useEffect(() => {
    setFocusedIndex(0);
  }, [active]);

  // 键盘导航支持
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const current = CATEGORIES[active];
      if (!current) return;
      const cols = 7;
      const total = current.emojis.length;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % total);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + total) % total);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + cols, total - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - cols, 0));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (current.emojis[focusedIndex]) {
            onSelect(current.emojis[focusedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [active, focusedIndex, onSelect, onClose],
  );

  if (!open) return null;

  const current = CATEGORIES[active];
  if (!current) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="表情选择器"
      onKeyDown={handleKeyDown}
      className="absolute bottom-full left-0 z-[70] mb-2 flex h-[340px] w-[320px] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-900/15 ring-1 ring-zinc-900/5"
    >
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2 px-1 text-[11px] font-medium text-zinc-400">{current.label}</div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={current.label}>
          {current.emojis.map((emoji, i) => (
            <button
              key={`${current.key}-${i}`}
              type="button"
              onClick={() => onSelect(emoji)}
              onFocus={() => setFocusedIndex(i)}
              aria-label={emoji}
              aria-selected={i === focusedIndex}
              role="gridcell"
              tabIndex={i === focusedIndex ? 0 : -1}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50',
                i === focusedIndex && 'ring-2 ring-blue-400/50',
              )}
            >
              {/* 内层字形放大：用 transform 而非 font-size，避免重排；hover 抬起覆盖邻居 */}
              <span className="pointer-events-none relative block origin-center text-2xl leading-none transition-transform duration-150 ease-out group-hover:scale-[1.4] group-hover:z-10 group-active:scale-100">
                {emoji}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 分类标签栏 */}
      <div className="flex items-center gap-0.5 border-t border-zinc-100 bg-zinc-50/60 px-1.5 py-1.5">
        {CATEGORIES.map((category, i) => (
          <button
            key={category.key}
            type="button"
            title={category.label}
            aria-label={category.label}
            onClick={() => setActive(i)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-base transition active:scale-90',
              i === active ? 'bg-zinc-200/80' : 'hover:bg-zinc-100',
            )}
          >
            {category.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
