/**
 * @tzj/theme — Design Tokens
 *
 * 拓之迹（TZJ）品牌设计令牌，CSS 变量 + JS 常量双导出。
 * 灵感：Rosenbauer 深色工业调性 + WHP Training Towers 信息流。
 *
 * @module @tzj/theme
 */

// ─── 颜色 Tokens ──────────────────────────────────────────

/** 主背景色 */
export const COLOR_BACKGROUND = '#111215';
/** 表面色 */
export const COLOR_SURFACE = '#1B1C20';
/** 卡片背景 */
export const COLOR_CARD = '#1B1C20';
/** 主文字色 */
export const COLOR_FOREGROUND = '#FFFFFF';
/** 次要文字色 */
export const COLOR_SECONDARY_TEXT = '#B8B8B8';
/** 品牌强调色（红色） */
export const COLOR_PRIMARY = '#E60012';
/** 边框色 */
export const COLOR_BORDER = '#2B2C31';
/** 输入框背景 */
export const COLOR_INPUT = '#2B2C31';
/** 破坏性操作色 */
export const COLOR_DESTRUCTIVE = '#EF4444';
/** 静音色 */
export const COLOR_MUTED = '#3F3F46';

// ─── 字体 Tokens ──────────────────────────────────────────

export const FONT_FAMILY_SANS = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
export const FONT_FAMILY_MONO = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace';

export const FONT_SIZE_XS = '0.75rem';    // 12px
export const FONT_SIZE_SM = '0.875rem';   // 14px
export const FONT_SIZE_BASE = '1rem';     // 16px
export const FONT_SIZE_LG = '1.125rem';   // 18px
export const FONT_SIZE_XL = '1.25rem';    // 20px
export const FONT_SIZE_2XL = '1.5rem';    // 24px
export const FONT_SIZE_3XL = '1.875rem';  // 30px
export const FONT_SIZE_4XL = '2.25rem';   // 36px
export const FONT_SIZE_5XL = '3rem';      // 48px
export const FONT_SIZE_6XL = '3.75rem';   // 60px

// ─── 间距 Tokens ──────────────────────────────────────────

export const SPACING_SECTION = '6rem';     // Section 间间距
export const SPACING_CONTENT_MAX = '80rem'; // 内容区最大宽度 1280px

// ─── 圆角 Tokens ──────────────────────────────────────────

export const RADIUS_SM = '0.25rem';   // 4px
export const RADIUS_MD = '0.375rem';  // 6px
export const RADIUS_LG = '0.5rem';    // 8px
export const RADIUS_XL = '0.75rem';   // 12px

// ─── 阴影 Tokens ──────────────────────────────────────────

export const SHADOW_SM = '0 1px 2px 0 rgba(0, 0, 0, 0.3)';
export const SHADOW_MD = '0 4px 6px -1px rgba(0, 0, 0, 0.4)';
export const SHADOW_LG = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';

// ─── 动画 Tokens ──────────────────────────────────────────

export const TRANSITION_FAST = '150ms ease';
export const TRANSITION_BASE = '250ms ease';
export const TRANSITION_SLOW = '500ms ease';

// ─── 完整 Token Map ──────────────────────────────────────

export const tokens = {
  colors: {
    background: COLOR_BACKGROUND,
    surface: COLOR_SURFACE,
    card: COLOR_CARD,
    foreground: COLOR_FOREGROUND,
    secondaryText: COLOR_SECONDARY_TEXT,
    primary: COLOR_PRIMARY,
    border: COLOR_BORDER,
    input: COLOR_INPUT,
    destructive: COLOR_DESTRUCTIVE,
    muted: COLOR_MUTED,
  },
  fonts: {
    sans: FONT_FAMILY_SANS,
    mono: FONT_FAMILY_MONO,
  },
  radii: {
    sm: RADIUS_SM,
    md: RADIUS_MD,
    lg: RADIUS_LG,
    xl: RADIUS_XL,
  },
  transitions: {
    fast: TRANSITION_FAST,
    base: TRANSITION_BASE,
    slow: TRANSITION_SLOW,
  },
} as const;

export type ThemeTokens = typeof tokens;
