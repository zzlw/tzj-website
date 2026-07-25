---
kind: frontend_style
name: TZJ 前端样式体系：Tailwind v4 + shadcn/ui + 设计令牌分层
category: frontend_style
scope:
    - '**'
source_files:
    - packages/ui/src/globals.css
    - packages/ui/package.json
    - packages/ui/src/theme/ThemeProvider.tsx
    - packages/theme/src/index.ts
    - apps/web/src/app/globals.css
    - apps/admin/src/app/globals.css
    - apps/web/postcss.config.mjs
    - apps/admin/postcss.config.mjs
    - docs/design/tokens-web.md
---

## 1. 系统与方法论
- **CSS 框架**：两个 Next.js 应用（apps/web、apps/admin）均使用 **Tailwind CSS v4**，通过 `@tailwindcss/postcss` PostCSS 插件处理。PostCSS 配置位于各应用的 `postcss.config.mjs`，仅启用 `@tailwindcss/postcss`。
- **组件库**：基于 **shadcn/ui + Radix UI** 构建原子组件库，封装在 `packages/ui` 中，提供 Button、Dialog、Table、DataTable、Form、Sidebar、Toast 等 40+ 基础组件，并通过 `class-variance-authority` + `clsx` + `tailwind-merge` 组合样式。
- **设计令牌**：采用 **三层令牌架构**——共享基准令牌（`packages/ui/src/globals.css` 的 `@theme`）、业务品牌覆盖（`apps/web` / `apps/admin` 各自的 `globals.css`）、JS 常量导出（`packages/theme/src/index.ts`），形成 CSS 变量 + JS 常量双通道。
- **动画与动效**：引入 `tw-animate-css` 作为 Tailwind 动画扩展，配合 CSS `@keyframes` 与 View Transitions API 实现页面切换淡入淡出。

## 2. 核心文件与包
- `packages/ui/src/globals.css` — 共享 Tailwind v4 `@theme` 令牌（颜色、圆角、字体、动画），定义深色工业风基色（背景 #0a0a0b、主色 #c61516）与全局光标行为。
- `packages/ui/package.json` — 暴露 `./globals.css` 入口，声明 Radix UI、shadcn、tailwindcss、vditor 等依赖。
- `packages/ui/src/theme/ThemeProvider.tsx` — 提供 light/dark 主题切换 Context，通过 `document.documentElement` 的 class 切换。
- `packages/theme/src/index.ts` — 导出 JS 侧设计令牌（颜色、字体、间距、圆角、阴影、过渡），供 React 组件以常量方式使用。
- `apps/web/src/app/globals.css` — C 端品牌覆盖：Rosenbauer 工业浅色风格（白底 #ffffff、品牌红 #e3000f、锐利小圆角 2–6px），定义流体标题 `.rb-display`、`.rb-h1~h5`、媒体遮罩 `.rb-media-shade`、控制按钮 `.rb-control-icon` 等品牌类。
- `apps/admin/src/app/globals.css` — 管理后台品牌覆盖：对齐 C 端 Rosenbauer 浅色风格但保留深色 Sidebar HSL 变量，定制 Vditor Markdown 编辑器样式与聊天气泡内联 Markdown 重置。
- `apps/web/postcss.config.mjs` / `apps/admin/postcss.config.mjs` — 统一 PostCSS 配置，仅启用 `@tailwindcss/postcss`。
- `docs/design/tokens-web.md` — Web 设计令牌文档，规定锐利小圆角 + 大圆角双段式策略与品牌色取值。

## 3. 架构与约定
- **令牌分层覆盖**：`packages/ui` 提供默认深色令牌 → 各 app 在自身 `globals.css` 的 `@theme` 中覆盖颜色与圆角 → 通过 `@import "@tzj/ui/globals.css"` 注入共享令牌，确保品牌一致性同时允许差异化。
- **源码扫描**：两个应用均在 `globals.css` 中使用 `@source "../../../../packages/ui/src"` 显式纳入共享 UI 包源码，解决 Tailwind v4 默认只扫描本 app 导致共享组件工具类未生成的问题。
- **响应式策略**：C 端使用 `clamp()` 函数实现流体排版（如 `.rb-display` 的 `clamp(2.25rem, 3.17vw + 1.4rem, 4.5rem)`），结合 `@media (min-width: 768px/1024px)` 断点；Admin 端以固定宽度布局为主，侧边栏支持折叠态。
- **暗色模式**：通过 `@custom-variant dark (&:is(.dark *))` 自定义 dark 变体，由 `ThemeProvider` 切换 `html` 的 class 驱动。
- **滚动条与交互**：全局统一细窄滚动条样式（`scrollbar-width: thin`、`scrollbar-color`），按钮/链接统一 `cursor: pointer`，禁用态 `cursor: not-allowed`，遵循 MDN/shadcn 最佳实践。
- **Vditor 编辑器集成**：Admin 与 Web 分别定制 Vditor 浅色主题、预览模式、全屏模式、聊天气泡内联 Markdown 的样式，保持与各自品牌风格一致。

## 4. 约定与约束
- **圆角刻度单调递增**：根据 `docs/design/tokens-web.md` 中的「禁止断崖」约束，相邻大刻度必须单调递增，锐利小圆角（sm~2xl，2–6px）与大圆角（4xl+，32px+）之间用 3xl=16px 作桥梁过渡，禁止 8px→32px 直接跳跃。
- **品牌色唯一来源**：C 端品牌红主色 `#e3000f` 与深红 `#b3000b` 取自聊天浮窗头像渐变与未读角标，其余语义色沿用 `packages/ui` 与 Tailwind 默认调色板，不在 web 重复定义。
- **字体规范**：C 端正文使用 Inter/Noto Sans SC/PingFang SC，展示标题使用 Archivo 复刻 Rosenbauer Corporate S 字体；Admin 端与 C 端保持一致的无衬线字体栈。
- **组件样式复用**：所有 UI 组件必须通过 `packages/ui` 暴露，禁止在各应用中重复实现基础组件样式；共享组件使用的工具类需通过 `@source` 显式纳入扫描。
- **无障碍与可访问性**：按钮禁用态、输入框焦点环（`outline-ring/50`）、`prefers-reduced-motion` 媒体查询禁用动画，确保 WCAG AA 对比度要求（如品牌红小字使用 `--primary-accessible: #b8000c`）。