# C 端 CSS 双轨构建方案（Tailwind v4 + 旧内核兼容产物）

> 状态：M1–M3 已实施（v4.4，2026-08-05）
> v4.4 更新（实施完成）：`packages/legacy-css` 已落地（sync-theme / build / theme:check / verify 四脚本）；web build 前置挂载、Dockerfile deps+builder+runner、CI 校验、`/legacy/*` immutable 缓存头、layout `beforeInteractive` 注入与 `LEGACY_CSS_ENABLED` / `LEGACY_CSS_PERCENT` 灰度开关均已接通；本地产物 `legacy.<hash>.css`（130KB，0 `oklch` / 0 `@property` / 0 `@layer`，`color-mix` 2 处）与 `detect.<hash>.js` 已验证。剩余 M4 真机验收与发布灰度。
> v3 更新：**可行性 spike 已通过**（真实源码经预处理后可由 Tailwind v3 编译，token 提取与产物断言均验证）；经业务确认，**安卓百度 App 是重要用户渠道**，双轨构建为既定方向，M0 从「是否做」改为「分桶与基线」。
> v4 更新（终极评估落定）：修正 proxy 集成方式（仓库已有 `apps/web/src/proxy.ts`，应扩展现有文件而非新增）；补充 Dockerfile / CI 接入点、legacy.css 加载失败兜底、回滚方式与终极放行条件。
> v4.1 更新（终极评估复核）：修正 proxy 信号方向（必须走 request headers，与现有 `x-pathname` 模式一致）；生成模块需提交仓库或调整 CI 顺序；同源 `/legacy/*` 显式加 immutable 缓存头。
> v4.2 更新（交付前体检）：最低内核从 Chromium 86+ 调整为 **88+**（v3 preflight 输出含 `:where()`，Chrome 88 起支持）；检测脚本改为**构建期生成的独立外部文件** `detect.<hash>.js`（`next/script` 内联 + beforeInteractive 存在兼容坑，外部文件最稳）；确认 web build 脚本挂载点。
> v4.3 更新（业务决策已确认）：动画降级接受（不移植动画工具类）；JS 验收线=视觉可用+内容可读+静态导航可达（M5 条件触发）；7 天分桶基线执行；最低内核 Chromium 88+；灰度开关用环境变量。
> 范围：仅 `apps/web`（C 端）。admin 端为运行时多主题机制，依赖 `oklch()`/`@theme inline`，旧内核兼容需另行评估，不在本期。
> 关联文档：`docs/minio-to-aliyun-oss-migration-plan.md`（静态资源域名链路）、AGENTS.md「设计令牌规范」

---

## 1. 背景与问题

### 1.1 现象

线上 C 端（www.tzjii.com）在**安卓百度 App** 内置浏览器中样式完全丢失（表现如同 CSS 未加载）；其他浏览器与 iOS 百度 App 正常。

### 1.2 根因

经抓包与产物分析（2026-08-05）：

- 页面 HTML 与 CSS 文件本身正常：CSS 请求 200、`Content-Type: text/css`、gzip、内容完整，普通 UA 与安卓百度 UA 拿到的 HTML 一致。
- 主样式 chunk（`3swy_1w0xaiga.css`，127KB）为 **Tailwind v4** 产物，包含：
  - `@layer` × 5（Tailwind v4 将 base/components/utilities 全部包进 CSS Layer）
  - `@property` × 97、`color-mix()` × 169、`oklch()` × 4
  - `:has()` × 4、容器查询 × 1
- 安卓百度 App 内置内核有实测仅 **Chromium 91** 的案例（linux.do，chromiumchecker.com 检测）。而 `@layer` 需 Chrome 99+，`oklch()`/`color-mix()` 需 Chrome 111+。
- 老内核遇到不认识的 `@layer` at-rule 会**整段丢弃**，Tailwind v4 几乎全部样式都在 Layer 内，因此整份样式表失效——表现就是「CSS 加载不出来」。iOS 百度 App 使用现代 WKWebView，故正常。

Tailwind 官方口径：v4 目标基线为 Safari 16.4+ / Chrome 111+ / Firefox 128+；需要支持更老浏览器时官方建议使用 v3.x（tailwindlabs/tailwindcss discussion #15356、#15709）。

### 1.3 目标

1. 现代浏览器继续使用 Tailwind v4 产物，体验零变化。
2. 旧内核（Chromium <111、安卓百度 App/X5/UC/QQ 等）获得**视觉等价**的兼容样式。
3. 不手写两套样式：token 以 v4 `@theme` + web `:root` + `@theme inline` 为唯一事实源，自动生成 v3 配置与 CSS 变量块，避免漂移。

---

## 2. 总体架构

```
单一源码：apps/web/src/app/globals.css + packages/ui/src/globals.css（v4 指令 + 业务 CSS）
        │
        ├── 轨道 A（现状）：apps/web 现有 postcss.config.mjs + Tailwind v4
        │        → modern.css（_next/static/*.css，经 assetPrefix 上 OSS）
        │
        └── 轨道 B（新增）：packages/legacy-css 独立构建包
                 v3 CLI + 预处理剥离 v4 指令 + 兼容 transform
                 → apps/web/public/legacy/legacy.<hash>.css（同源）

运行时（客户端为主，服务端可选）：
  <head> 客户端脚本（detect.<hash>.js）：CSS.supports() 特性检测 → 旧内核注入 legacy.<hash>.css
  （可选）proxy.ts：UA 判定，仅当 CDN 缓存键已按 UA 区分时启用
  <html data-css-track="modern|legacy"> 供 JS 按轨降级
```

### 2.1 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| v3 构建位置 | 独立 workspace 包 `packages/legacy-css` | `apps/web` 已通过 catalog 依赖 `tailwindcss@^4.3.1`，同一 package.json 无法并存 v3；独立包同时隔离 postcss 配置，不触碰 `apps/web/postcss.config.mjs` |
| legacy 产物位置 | `apps/web/public/legacy/legacy.<hash>.css`（应用同源） | Next `assetPrefix` 不影响 `public/` 文件（官方文档确认）；同源可降低被旧内核/拦截规则误伤概率；文件名带内容 hash 便于 immutable 缓存 |
| 注入路径 | **客户端检测脚本为主**（外部 `detect.<hash>.js`），服务端 proxy 可选 | 站点在阿里云 CDN 后（Ali-Swift/Tengine），CDN 若缓存 HTML 且不按 UA 区分缓存键，服务端判定会失效；客户端特性检测在首屏前执行，免疫 CDN |
| 业务决策 | 安卓百度 App 确认为重要渠道 | 双轨构建为既定方向；M0 只做分桶统计与回归基线，不做是否上马的闸门 |
| token 事实源 | 三层解析：共享 `@theme` + web `:root` 覆盖 + `@theme inline` 映射 | web 实际用 `@theme inline` 把 `--color-*` 映射到 `:root` 运行时变量，生成器必须解析 `var()` 链；spike 已验证可提取 33 色 / 9 圆角 |
| 旧内核范围 | **Chromium 88+** / Android 7+（可配置） | v3 preflight 输出含 `:where()`（Chrome 88+）；覆盖百度/X5/UC/QQ 常见老内核（实测内核 Chromium 91 在范围内） |
| admin 端 | 本期不做 | B 端运行时主题（oklch 变量）在旧内核无法成立，单独评估 |

---

## 3. 轨道 B：legacy 构建链路

### 3.1 包结构与依赖

新增 workspace 包 `packages/legacy-css`（`pnpm-workspace.yaml` 已包含 `packages/*`）：

```jsonc
{
  "name": "@tzj/legacy-css",
  "private": true,
  "dependencies": {
    "tailwindcss": "3.4.19",
    "postcss": "^8.5.16",
    "autoprefixer": "^10.4.20",
    "postcss-preset-env": "^11.3.2",
    "@csstools/postcss-oklab-function": "^5.0.7",
    "culori": "^4.0.1"
  },
  "scripts": {
    "build": "node build.mjs"
  }
}
```

要点：

- **不修改** `apps/web/postcss.config.mjs`（当前仅挂 `@tailwindcss/postcss`，v4 专用）。
- v3 CLI 通过 `packages/legacy-css/node_modules/.bin/tailwindcss` 独立执行，输入输出均为跨包路径。
- `culori` 用于构建期把 `oklch()` 转 sRGB hex（spike 已验证）。
- root script：`build:legacy-css` → `pnpm --filter @tzj/legacy-css build`；`apps/web` 生产构建前置执行。

### 3.2 单一源码入口（预处理，spike 已验证）

legacy 管线**直接消费两份 v4 源码**，预处理阶段做指令改写，不新建手写入口：

1. `apps/web/src/app/globals.css`：
   - `@import "tailwindcss"` → v3 三段导入（`base` / `components` / `utilities`）；
   - **整块**移除 `@theme inline`（含闭合括号，不能按行删）；
   - 删除 `@source`、`@custom-variant` 行；
   - 移除对 `@tzj/ui/globals.css`、`tw-animate-css`、`shadcn/tailwind.css` 的 import（由 §3.4 等价物替代）；
   - 保留 `:root` 变量、`@layer base/components` 块内容、`@apply`、普通 CSS。
2. `packages/ui/src/globals.css`：
   - 删除 `@import "tailwindcss"`（web 输入统一注入三段指令）；
   - 整块移除 `@theme`（oklch token 由 §3.3 转成配置色值）；
   - 保留 `@layer base` 内容。

> spike 结果（2026-08-05，/tmp 隔离环境）：上述预处理后的两份真实源码拼接，Tailwind 3.4.19 编译通过（491ms），产物 124,650 字节，与 modern 主 chunk（127KB）量级一致；`@apply border-border outline-ring/50 bg-background text-foreground font-sans` 全部通过。

### 3.3 Token 生成（spike 已验证）

新增 `packages/legacy-css/sync-theme.mjs`：

1. 解析 `packages/ui/src/globals.css` 的共享 `@theme`（颜色/圆角/字体/动画）。
2. 解析 `apps/web/src/app/globals.css` 的 `:root` 覆盖（web 品牌红、灰阶、圆角覆盖）。
3. 解析 `@theme inline` 的别名映射（`--color-primary: var(--primary)` 等），递归解析 `var()` 链到最终字面值；无法解析的 token（如 `--sidebar-*` 依赖组件注入）跳过并记录日志。
4. 生成两份产物：
   - `tailwind.config.legacy.ts`：`theme.extend.colors`（oklch 转 sRGB hex，保留来源注释）、`borderRadius`、`fontFamily`、`keyframes`/`animation`、`screens`；`content` 与 v4 `@source` 一致（web src + `packages/ui/src`）。
   - `legacy-theme.css`：`:root { --color-*: …; --primary: …; --radius-*: …; --font-*: … }` 变量块，随 legacy.css 输出。

> ⚠️ 必须输出 `:root` 变量块：v4 会把 `@theme` 变量作为真实 CSS 变量输出，v3 不会；组件与自定义 CSS 中大量 `var(--color-*)` 引用依赖它。

> spike 结果：自动提取 **33 个颜色**（含 oklch 转 hex）与 **9 档圆角**，web `:root` 覆盖优先级正确。

CI 增加 `legacy:theme:check`：重新生成后 `git diff --exit-code`，防止 token 漂移。

### 3.4 兼容 transform 与第三方包移植

PostCSS 管线（v3 入口 → 产物）：

1. **`strip-tailwind-layers`（自定义插件，核心）**：
   - 删除 `@layer theme/base/components/utilities` 包装，把块内容提升为无层普通规则；
   - 将 `@property --x { … }` 降级为 `:root { --x: 初始值; }`（或移除并确保使用处有 fallback）。
2. **`@csstools/postcss-oklab-function`**：`oklch()/oklab()` → `rgb()`。
3. **`postcss-preset-env`（stage 3，browserslist）**：处理嵌套、可静态转换的 `color-mix()`。
4. **`autoprefixer`**：按 browserslist（`chrome >= 88, android >= 88, safari >= 14`）补前缀。

**第三方 CSS 包（spike 确认不能直接复用，需移植）**：

- `tw-animate-css/dist/tw-animate.css`（14.9KB）：含 17 处 `@property`、`@theme inline`、大量 **`@utility`**（v4 专属），v3 不识别。只提取其中 **7 组 keyframes**；`animate-in/out`、`fade-in/out-*`、`slide-in-from-*`、`zoom-in/out-*` 等动画工具类需在 legacy 中手工实现为普通 CSS 类（仓库当前共 **94 处引用**，集中在 Dialog/Popover/Sheet/Toaster/DropdownMenu）。
- `shadcn/dist/tailwind.css`（16KB）：含 `@theme inline`、`@custom-variant`（含 v4 的 `@slot`）、`oklch`/`color-mix`。提取 keyframes；其 `data-open/data-closed` 变体语义由 v3 原生 `data-[...]:` 变体覆盖，无需移植；其余 token 并入 legacy 变量块。

**可接受降级清单（已决策，2026-08-05）**：旧内核不做入场/出场动画（弹窗/抽屉/浮层直接出现）；**v1 不移植 94 处动画工具类**（未来业务要求动画时再按 §8 决策追加）；滚动条 thumb 的 2 处动态 `color-mix()` 规则失效（保留默认滚动条）；其余布局、颜色、字体、间距必须一致。

> spike 产物断言：输出 0 个 `oklch` / `@property`；仅剩 2 处动态 `color-mix()`（列入降级清单）与 v3 自带的 `@layer`（由 strip-layers 移除）。CI 断言不得包含 `@layer` / `@property` / `oklch(`（`color-mix(` 需显式 allowlist）。

### 3.5 构建接入与 hash

- 产物：`apps/web/public/legacy/legacy.<contentHash>.css` + `.map`，以及 `apps/web/public/legacy/detect.<contentHash>.js`（运行时检测脚本，见 §4.1）。
- 同时生成 `apps/web/src/generated/legacy-css.ts`：

```ts
export const legacyCssHref = '/legacy/legacy.<contentHash>.css';
export const legacyDetectJsHref = '/legacy/detect.<contentHash>.js';
```

  由 `build:legacy-css` 在 `next build` 前更新；**该生成模块提交进仓库**（内容为上次构建的 hash 或空串占位），避免 CI typecheck 在 `build:legacy-css` 之前运行时因缺文件编译失败；CI 用 `legacy:theme:check` 校验其与最新构建 diff 归零。本地 `pnpm dev` 可跳过（不注入），生产构建必须先生成。
- `public/legacy/` 自动进入 Next standalone 产物，无需 OSS 上传。
- 不改变 v4 构建路径：`pnpm dev` / 现有 CI 的 Tailwind v4 产物保持原样。
- **缓存头**：在 `apps/web/next.config.ts` 的 `headers()` 中给 `/legacy/:path*` 显式添加 `Cache-Control: public, max-age=31536000, immutable`（或由 CDN/nginx 配置），否则 public 文件默认 `max-age=0`，hash 文件名享受不到 immutable。

### 3.6 构建链与 CI 接入（v4 补充）

- **Dockerfile**（`apps/web/Dockerfile`）：
  - deps 阶段需新增 `COPY packages/legacy-css/package.json packages/legacy-css/`，否则 `pnpm install --frozen-lockfile` 不会安装 v3 依赖；
  - builder 阶段在 `pnpm exec turbo run build --filter=@tzj/web` 之前执行 `build:legacy-css`（推荐通过 web 的 build 脚本前置调用，或 turbo `dependsOn` 配置为 `@tzj/web` 依赖 `@tzj/legacy-css`）。
- **web build 脚本挂载点**：`apps/web/package.json` 的 `build` 当前为 `node scripts/generate-placeholders.mjs && next build`，改为：
  `node scripts/generate-placeholders.mjs && pnpm --filter @tzj/legacy-css build && next build`。
- **CI**（`.github/workflows/ci.yml`）：新增 `legacy:theme:check`（token 生成 diff 归零）与产物断言（无 `@layer` / `@property` / `oklch(`），防止漂移。生成模块采用「提交进仓库 + CI diff 校验」（§3.5），则 typecheck 顺序无需调整；若采用不提交方案，则 ci.yml 必须在 typecheck 前先执行 `build:legacy-css`。
- **deploy workflow** 无需改动：Docker build 已包含上述步骤。

---

## 4. 运行时注入

### 4.1 客户端判定（主路径，免疫 CDN 缓存）

检测逻辑由 `build:legacy-css` **构建期生成**为独立外部文件 `public/legacy/detect.<hash>.js`（legacy 的 hash href 直接内嵌在文件里），root layout 用 `next/script` 加载：

```tsx
import Script from 'next/script';
import { legacyDetectJsHref } from '@/generated/legacy-css';

<Script src={legacyDetectJsHref} strategy="beforeInteractive" />
```

`detect.<hash>.js` 内容（生成时写入，`LEGACY_CSS_HREF` 为实际 hash 值）：

```js
try {
  var ok = CSS.supports('color', 'oklch(50% 0.15 100)') &&
           CSS.supports('color', 'color-mix(in srgb, red 50%, blue)');
  if (!ok && !document.querySelector('link[data-track="legacy"]')) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'LEGACY_CSS_HREF'; // 生成时替换为 '/legacy/legacy.<hash>.css'
    l.setAttribute('data-track', 'legacy');
    document.head.appendChild(l);
  }
  document.documentElement.setAttribute('data-css-track', ok ? 'modern' : 'legacy');
} catch (e) {
  document.documentElement.setAttribute('data-css-track', 'legacy');
}
```

- 外部文件 + `beforeInteractive` 在首屏渲染前执行（避免 `next/script` 内联脚本与 beforeInteractive 的兼容坑），样式表插入后为 render-blocking，基本无 FOUC。
- `detect.<hash>.js` 带内容 hash，与 legacy.css 同享 immutable 缓存头。
- 该路径不依赖 UA、不受 CDN HTML 缓存影响。
- **加载失败兜底**：为注入的 `<link>` 注册 `onerror`，失败时上报埋点（`data-css-track=legacy` + `legacy.css` 加载失败），灰度监控据此识别「注入了但样式仍缺失」的会话；页面内容本身由 SSR 保证可读。

### 4.2 服务端判定（可选增强，扩展现有 proxy.ts）

仓库**已有** `apps/web/src/proxy.ts`（Next.js 16 的 proxy 约定，内含 next-intl 中间件与 307→308 改写）。**不要新建第二个 proxy.ts**（Next 只允许一个），服务端判定应扩展现有文件。仅当满足以下任一条件才启用：

- 阿里云 CDN 对 HTML 配置了按 UA 缓存键（或 HTML 不缓存）；
- 或服务端注入只作为客户端检测的补充标记（不承载「是否注入」的唯一决策）。

```ts
// 在现有 apps/web/src/proxy.ts 中追加（示意）
const LEGACY_UA = /Android.*BaiduboxApp|UCBrowser|MQQBrowser|X5|T7|baidubrowser/i;

function isLegacyCss(ua: string): boolean {
  const chrome = ua.match(/Chrome\/(\d+)/)?.[1];
  return LEGACY_UA.test(ua) || (chrome != null && Number(chrome) < 111);
}

// proxy 内、构造 intlRequest 之前设置（与现有 x-pathname 同一模式）：
// requestHeaders.set(
//   'x-css-track',
//   isLegacyCss(request.headers.get('user-agent') ?? '') ? 'legacy' : 'modern',
// );
// root layout 通过 headers().get('x-css-track') 读取——只有 request headers 可见。
```

> ⚠️ 典型安卓百度 UA 形如 `Linux; Android 13 … BaiduboxApp/…`，正则必须是 `Android.*BaiduboxApp`，不能反过来。
> 由于现有 proxy 的 matcher 已排除 `_next` 与带点路径，HTML 路由都会被覆盖，无需调整 matcher。
> 响应头（`response.headers.set(...)`）只用于 CDN/监控等可选场景，不能作为 layout 的服务端信号——layout 的 `headers()` 只能读到请求头。

### 4.3 防重复与层叠

- 客户端注入前检查 `link[data-track="legacy"]`，服务端已注入则不重复。
- `data-css-track` 供 JS 组件判断是否启用仅新内核支持的 CSS API/交互。
- 万一误判导致 modern + legacy 同时存在：legacy 在后、无层规则优先级更高，视觉以 legacy 为准，不会出现半套样式。

### 4.4 性能

- legacy.css 仅对旧内核下发；现代浏览器零额外开销。
- 产物带内容 hash，`Cache-Control: public, max-age=31536000, immutable`。

---

## 5. 验证与灰度

### 5.1 构建期断言（CI）

- `legacy:theme:check`：token 生成 diff 归零。
- 产物 grep 断言：无 `@layer` / `@property` / `oklch(`（`color-mix(` 需显式 allowlist）。
- `legacy.<hash>.css` 与 `legacy-css.ts` 的 href 一致。

### 5.2 浏览器矩阵

| 环境 | 验证方式 |
|------|---------|
| Chrome 126 / Edge / Safari 17 | 现有回归，确认 modern 轨不变 |
| Chromium 91 | Docker `browserless/chrome:91` 或 `selenium/standalone-chrome:91` 截图比对 |
| 安卓百度 App 真机 | 首页、案例详情、新闻详情、营销弹窗、聊天入口逐页验收 |
| UC / QQ / 微信 X5 | 抽样真机或 UA 模拟 + 截图 |

**动画降级验收（已确认）**：弹窗/抽屉/Toaster 在旧内核直接出现/消失、无过渡动画，视为通过；v1 不移植动画工具类。

**JS 兼容性冒烟（必须）**：在 Chromium 91 下除截图外，检查控制台错误与核心交互（导航、搜索、营销弹窗、聊天入口）。验收线已确认：**视觉可用 + 内容可读 + 静态导航/联系方式可达**（见 §8）；客户端交互（搜索联想、聊天等）不要求完整可用，M5 仅在灰度数据显示旧内核用户高频依赖这些交互时触发。

### 5.3 灰度与 M0（分桶基线，非上马闸门）

业务已确认安卓百度 App 是重要渠道，M0 不再决定是否实施，而是建立**分桶与回归基线**：

1. 7 天统计（CDN/回源日志）：按 UA 分桶——`Android.*BaiduboxApp` / `X5` / `UCBrowser` / `MQQBrowser` / Chrome <111，输出独立会话占比。
2. 对安卓百度真实会话建立基线：无样式页占比、跳出率、关键转化，作为灰度前后对比。
3. 全量发布 `legacy.<hash>.css`（**不注入**），确认产物可访问、无 404。
4. 客户端注入灰度：1% → 10% → 50% → 100%（开关用环境变量/配置）。
5. 可选 proxy 注入：仅在 CDN 缓存键确认后启用，并单独灰度。
6. 观察指标：legacy.css 请求量/404、`data-css-track` 埋点、无样式会话占比、转化/跳出。
7. **回滚**：legacy 注入由环境开关控制（如 `LEGACY_CSS_ENABLED`），关闭即回滚；已发布的 `legacy.<hash>.css` 保留在 `public/legacy/` 无害，不影响 modern 轨。

---

## 6. 风险与对策

| 风险 | 等级 | 对策 |
|------|------|------|
| v4/v3 token 漂移导致 legacy 视觉不一致 | 高 | 三层自动解析 + CI diff；关键页面截图回归 |
| v3 无法 100% 还原 v4 动效/颜色（oklch→rgb 误差、动态 color-mix） | 中 | 可接受降级清单（动画/滚动条）+ 设计确认 |
| 第三方 CSS 包（tw-animate-css / shadcn）深度 v4 专属 | 中低 | 已决策 v1 不移植动画工具类（§8），仅并入 token/keyframes 可选；视觉降级可接受 |
| 依赖共存（同一包无法同时依赖 v3/v4） | 高（已解决） | 独立 `packages/legacy-css` 包，spike 已验证 |
| CDN 缓存 HTML 导致服务端 UA 注入失效/串台 | 中 | 客户端特性检测为主路径；proxy 注入仅在 CDN 缓存键确认后启用 |
| UA 误判（漏判/错判） | 中 | 客户端 `CSS.supports()` 兜底；正则基于访问日志校准 |
| Chromium 91 上 JS 仍不可用 | 中 | 验收线已确认（视觉可用 + 内容可读 + 静态导航）；M5 按灰度数据显示的核心交互依赖度条件触发 |
| legacy 与 modern 同时加载导致覆盖混乱 | 低 | 正常路径只注入一种；误判时 legacy 在后、无层优先级更高 |
| 新组件只用 v4 能力、legacy 缺样式 | 中 | 规范约束使用 Tailwind 工具类；截图回归覆盖新增页面 |
| 构建时长/复杂度上升 | 低 | legacy 独立脚本，增量分钟级；不进入 v4 热更新路径 |
| legacy.css 加载失败（404/网络/被拦截） | 中 | `<link>` onerror 埋点；页面内容由 SSR 保证可读；灰度监控「注入了但仍无样式」会话 |
| Dockerfile / CI 集成遗漏（新包未安装、校验未跑） | 中 | §3.6 显式接入点；CI 断言 token diff 与产物特性 |

---

## 7. 里程碑

- **M0**：7 天 UA 分桶统计 + 安卓百度会话基线（待执行，与发布灰度并行；指标见 §8）
- **M1**：`packages/legacy-css` 骨架 + 三层 token 生成 + CI 校验（✅ 已实施）
- **M2**：预处理管线 + strip-layers/oklab/prefix 兼容 transform + 本地构建验证（✅ 已实施；Chrome 91 截图回归随 M4 进行）
- **M3**：客户端注入 + 灰度开关（✅ 已实施：`LEGACY_CSS_ENABLED`=1 开启，`LEGACY_CSS_PERCENT` 分桶）
- **M4**：真机百度 App 验收 + 观察期（待部署后进行）
- **M5（条件触发）**：Chromium 91 JS 兼容工作线（polyfill/降级）——仅当灰度数据显示旧内核用户高频依赖客户端交互时启动；v1 不默认执行

### 实施记录（2026-08-05）

- `packages/legacy-css/`：`sync-theme.mjs`（三层 token，`:root` 选择器解析）、`build.mjs`（v3 CLI + strip-layers/oklab/preset-env/autoprefixer，输出 hash 产物）、`theme-check.mjs`（token diff）、`verify-artifacts.mjs`（产物断言）。
- `apps/web`：build 前置 `pnpm --filter @tzj/legacy-css build`；`next.config.ts` 增加 `/legacy/:path*` immutable；`[locale]/layout.tsx` 用 `next/script` `beforeInteractive` 注入 `detect.<hash>.js`；`src/generated/legacy-css.ts` 提交进仓库。
- 灰度：`LEGACY_CSS_ENABLED`（构建+运行期，Dockerfile runner 与 `docker-compose.prod.yml` 均可覆盖）与 `LEGACY_CSS_PERCENT`（构建期写入 detect.js，UA 稳定分桶，默认 100）。
- 验证：`pnpm --filter @tzj/legacy-css build && verify && theme:check`、web typecheck、`LEGACY_CSS_ENABLED=1` 生产构建与 `next start` HTML 注入、`/legacy/*` 缓存头均通过。

---

## 8. 决策记录（2026-08-05 已确认）

1. **动画降级：接受**。旧内核不做入场/出场动画（弹窗/抽屉/浮层直接出现），v1 不移植 94 处动画工具类。
   理由：动画是增强体验，不影响内容可读与询盘转化；移植会带来持续的双轨维护成本，且旧内核本身动画性能差。
2. **JS 验收线：视觉可用 + 内容可读 + 静态导航/联系方式可达**。不要求 SPA 完整交互（搜索联想、聊天等）。
   理由：C 端核心路径是浏览内容 → 通过电话/微信/表单询盘，这些由 SSR HTML 与静态链接承载；完整交互兼容（polyfill/降级 bundle）成本高，仅在灰度数据显示旧内核用户高频依赖客户端交互时启动 M5。
3. **7 天分桶基线：执行**，与 M1 并行。指标：
   - 安卓百度系（`Android.*BaiduboxApp` / `X5` / `T7` / `UCBrowser` / `MQQBrowser`）独立会话占比与绝对量；
   - 无样式会话占比：修复前基线 ≈100% → 灰度后目标 <5%；
   - legacy.css 加载成功率 ≥99%；
   - 关键转化（询盘提交、联系方式点击）不下降。
4. **最低内核：Chromium 88+ / Android 7+**（v3 preflight 的 `:where()` 需要 88+；实测百度内核 Chromium 91 在范围内）。
5. **灰度开关形态：环境变量**（`LEGACY_CSS_ENABLED` + 百分比），v1 不建后台配置。

---

## 9. 终极放行条件（v4 评估通过）

✅ 放行条件已全部满足（决策见 §8）：

1. ✅ 动画降级清单已确认（无动画可接受）。
2. ✅ JS 验收线已拍板（视觉可用 + 内容可读 + 静态导航；M5 条件触发）。
3. ✅ 7 天分桶基线已确认执行（指标见 §8）。
4. ✅ 最低内核已确认（Chromium 88+ / Android 7+）。

进入实施。

---

## 附：可行性 spike 记录（2026-08-05）

环境：`/tmp/legacy-spike`（临时，正式实现时收入 `packages/legacy-css`）；Tailwind 3.4.19 + postcss + autoprefixer + postcss-preset-env + `@csstools/postcss-oklab-function` + culori。

验证结果：

- token 生成：解析共享 `@theme` + web `:root` + `@theme inline`，输出 33 色（oklch 自动转 hex）/ 9 圆角，web 覆盖优先级正确。
- 预处理：整块剥离 `@theme` / `@theme inline`、`@source`、`@custom-variant` 后，两份真实 globals 拼接可由 Tailwind 3.4.19 编译（491ms）。
- 产物：124,650 字节（modern 主 chunk 约 127KB）；0 `oklch` / `@property`；仅 2 处动态 `color-mix()`（滚动条 thumb，列入降级清单）；v3 自带 `@layer` 待 strip-layers 移除；preflight 含 5 处 `:where()`（故最低内核定为 Chromium 88+）。
- 未覆盖：`tw-animate-css` / `shadcn/tailwind.css` 的移植（已知为 v4 专属，工作量见 §3.4）、strip-layers 插件运行、Chrome 91 视觉回归、JS 兼容冒烟。

---

## 参考

- Tailwind CSS v4 浏览器支持（Chrome 111+ / Safari 16.4+）：tailwindlabs/tailwindcss discussion #15356、#15709
- Next.js 16：`middleware.ts` 已弃用，改用 `proxy.ts`（nextjs.org/docs/app/getting-started/proxy）
- Next.js `assetPrefix` 不影响 `public/` 文件（nextjs.org/docs）
- 社区兼容思路：`vite-plugin-tailwind-legacy`（v3 生成 legacy、按支持度注入）
- 安卓百度 App 内核实测案例：linux.do「百度 App 打开网站加载不出样式」（Chromium 91）
