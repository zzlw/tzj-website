# C 端（apps/web）UI · 交互 · 代码全面评估报告

> 评估日期：2026-07-29
> 评估对象：`apps/web`（TZJ 拓之迹消防训练塔企业官网，Next.js C 端）及其依赖的 `packages/ui` 共享组件库
> 评估方法：全量代码调研（326 个源文件）+ grep 量化审计 + 本地运行时实测（web:3001 / api:4000）+ 浏览器交互验证
> 评估基准：`AGENTS.md` Constitutional Rules、`CONVENTIONS.md`、`docs/design/tokens-web.md`

---

## 一、总体结论

| 维度 | 评级 | 摘要 |
|------|------|------|
| 架构与技术栈 | ★★★★★ | Next.js 16 App Router + React 19 + Tailwind v4，选型激进但工程化完整；SSR/ISR/流式渲染运用正确 |
| UI / 设计系统 | ★★★★☆ | 三层设计令牌体系清晰，Rosenbauer 工业风执行到位，圆角"双段式 + 桥梁"约束有文档支撑；欠缺组件可视化文档（Storybook） |
| 交互体验 | ★★★★☆ | MegaMenu / 语言切换 / ChatWidget / 移动抽屉均达到业内主流水准；A11y 语义化基础好；个别按钮触达细节可优化 |
| 代码质量 | ★★★★☆ | 类型质量优秀（`any` / `@ts-ignore` 零处）；存在少量规范偏差（console 遗留、JsonLd 未转义、localhost 默认值）与超大组件（ChatWidget 2127 行） |
| SEO | ★★★★★ | metadata / sitemap / robots / manifest / 五类 JSON-LD 结构化数据齐备，SSR HTML 完整（首页 331KB 全量内容） |
| 测试 | ★☆☆☆☆ | **apps/web 与 packages/ui 均为零测试、无 Storybook**，是当前最大短板 |

**一句话结论**：这是一个架构设计与视觉体系成熟度高于行业平均水平的 C 端官网工程，主要债务集中在「测试缺失」「ChatWidget 巨石组件」「少量 Constitutional Rules 偏差」三处，均可增量修复，无需重构。

---

## 二、技术栈与架构概览

### 2.1 技术栈

- **框架**：Next.js 16（App Router + Turbopack dev）、React 19（流式 SSR + Suspense）
- **样式**：Tailwind CSS v4（`@theme` 令牌、`@source` 扫描共享包）
- **语言**：TypeScript 6，`strict: true` 全量合规
- **国际化**：next-intl，三语言（zh-CN / zh-TW / en），`localePrefix: 'always'`
- **其它**：next-view-transitions（页面过渡）、socket.io-client（客服实时通道）、vditor（富文本渲染）

### 2.2 路由与信息架构

`[locale]` 动态段下覆盖：首页、5 大产品线（fixed-tower / modular-tower / towers / burn-rooms / accessories）、solutions、cases、why-us、resources（blog / news / trade-shows）、search、contact、privacy、terms。信息架构与导航（7 个一级项 + 13 产品线 MegaMenu）一致性好，Footer 提供镜像二级导航增强可发现性。

### 2.3 数据层

- `fetchApi` 统一封装：**10s 超时 + 2 次重试 + ISR 60s** 缓存，容错设计合理
- 站点设置 `site-settings` 单独缓存：生产 ISR 300s，开发环境 0（不缓存）
- 图片经 OSS `x-oss-process` 参数化裁剪，配合自定义 loader
- i18n messages 采用「core + 按路径模块化按需加载」（`message-modules.ts` 显式枚举以规避 Turbopack 动态 import 限制），每语言约 50 个 JSON（三语共 150 个），避免全量 messages 注水

### 2.4 运行时验证（本地实测）

- 首页 SSR HTML **331KB 完整输出**（含 h1、23 张图、42 处业务文案），contact 页含完整表单、产品页含完整正文——**SEO 与无 JS 降级场景完全可用**
- 导航性能（dev 模式）：`responseEnd 234ms`、`DOMContentLoaded 614ms`、`load 639ms`，感知良好
- 全部 API 请求（settings / agent-availability / analytics）200/201 正常

> ⚠️ **实测勘误（重要）**：浏览器自动化初测曾报告"所有页面主内容永远停留在『加载中…』"，经逐层排查为**自动化环境假象**——自动化浏览器窗口处于 `document.visibilityState === 'hidden'` 状态，React 19 流式渲染的边界揭示机制（`$RV` 队列）依赖 `requestAnimationFrame`，隐藏标签页中 rAF 永不触发，导致 Suspense 边界内容滞留在 `display:none` 容器（`S:0`）中不被交换。手动冲刷 `$RB` 队列后主内容立即完整渲染（2207 字符）。**真实用户（可见标签页）不受影响**；该结论已用 curl（完整 `$RC` 交换脚本 ×3）与浏览器内 fetch（210ms 拿到完整流）双重交叉验证。后续凡在无头/隐藏窗口环境实测本站，需注意此机制以免误判。

---

## 三、UI 与设计系统评估

### 3.1 设计令牌三层体系 ✅

```
packages/ui/src/globals.css        —— 深色工业基准（#0a0a0b / #c61516）
        ↓ 被覆盖
apps/web/src/app/globals.css       —— Rosenbauer 浅色品牌层（#ffffff / #e3000f）
        ↓ 被消费
Tailwind v4 @theme 工具类           —— 编译期直写，无运行时主题开销
```

亮点：

- **无障碍色阶意识**：品牌红 `--primary: #e3000f` 之外单独提供 `--primary-accessible: #b8000c`（正文场景满足 WCAG AA 对比度），这一细节超出多数企业站水准
- **圆角"双段式 + 桥梁"**：`sm~xl` 锐利（2/2/4/4px）→ `2xl=6px` → `3xl=16px` 桥梁 → `4xl/6xl/8xl` 大圆角（32/48/64px），符合 AGENTS.md「禁止断崖」的 Constitutional 约束，且有 `docs/design/tokens-web.md` 文档背书
- 细节令牌完善：`--media-shade` 媒体渐变遮罩、`--site-header-offset` 滚动隐藏体系、`scrollbar-gutter: stable` 防滚动条抖动、View Transitions 淡入淡出、`prefers-reduced-motion` 降级

### 3.2 packages/ui（@tzj/ui）组件库

- **47 个组件目录**，底层为 `@base-ui-components/react`（非 Radix），`cva` + `cn(clsx + tailwind-merge)` 组合，风格统一
- 包装层设计有工程巧思：
  - `Select.tsx`：渲染期自动收集 SelectItem 构建 value→label 映射（`SelectItemsContext`），补齐 Base-UI 缺失的 placeholder 兼容层；`multiple` 被显式 Omit 保持单选语义清晰
  - `Dialog.tsx`：`DismissGuards` 兼容层将 Radix 风格 `onEscapeKeyDown / onPointerDownOutside / onInteractOutside` 桥接到 Base-UI 的 `onOpenChange(reason) + cancel` 机制，迁移成本低
- **风险点**：`@base-ui-components/react` 锁定在 **1.0.0-rc.0（候选版）**，正式版发布后可能有 breaking change，建议纳入升级观察清单
- **短板**：零测试、零 Storybook——47 个组件的行为契约完全靠使用方回归

### 3.3 web 对 @tzj/ui 的使用度（已核实）

**15 处 import、14 个文件**（内容列表 ContentListShell/Pagination/Toolbar、聊天 ChatWidget/EmojiPicker/ChatMarkdown、布局 Header/TopBar/ProductMegaMenu/LanguageSelectorDrawer、markdown 渲染等）。营销区块另有自有轻量 UI 层（`components/ui/index.tsx`：Container、Eyebrow、SectionHeading、PageHero、VideoHero、RbButton、RbLink）——**"共享库管交互复杂件、自有层管品牌表现件"的分层是合理的**，不属于重复建设。

---

## 四、交互体验评估（运行时实测）

| 测试项 | 结果 | 说明 |
|--------|------|------|
| 首页 Hero + 滚动 | ✅ | 视频背景 Hero（hero.mp4 206 分段加载）、图片懒加载、区块完整 |
| 产品中心 MegaMenu | ✅ | 「四大板块 · 13 大产品线」编号式（01–13）布局，`aria-haspopup` / `aria-expanded` 语义完整，信息层级清晰，工业感与品牌定位契合 |
| 产品页 IA | ✅ | 面包屑 + Tab（钢结构/标准塔型/定制）+ 相关产品线推荐，结构完整 |
| 语言切换 | ✅ | `/zh-CN` ↔ `/en` 路由级切换正常，导航/Footer/客服文案全量翻译跟随 |
| 站内搜索 | ✅ | `/search?q=` SSR 输出搜索结果页（h1「搜索结果」），SearchOverlay 按需加载 |
| 资源/新闻列表 | ✅ | SSR 完整（「媒体报道」列表），分页/工具栏组件按需 chunk |
| 联系表单 | ✅ | SSR 含完整 `<form>`，ContactSection 独立 chunk 按需加载 |
| ChatWidget 在线客服 | ✅ | 默认 `open=false`，Intercom 风格预览气泡（**4 秒后每会话仅弹一次**，sessionStorage 记忆 dismissed/shown）；会话 token 续期链路、归档会话冷存清理（对齐 Zendesk/LiveChat 实践）设计成熟 |
| 移动端导航 | ✅（结构验证） | 「全部菜单」抽屉 Dialog 组件完备、带关闭按钮与语义标签；受自动化环境无法改视口所限，未做 390×844 真机布局走查，建议人工补测一次触控目标尺寸 |
| 控制台错误 | ⚠️ | 无 runtime error；有 3 条 `link preload` 未及时使用的警告（lucide-react icons chunk、ContactSection chunk 等），dev 模式预加载策略噪音，建议上生产构建复核一次 |

**A11y 观察**：landmark（banner/navigation/contentinfo/status）、role、aria-label 使用普遍规范，读屏语义基础好；Loading fallback 使用 `role=status`。

**可优化的交互细节**：

1. 预览气泡自动弹出虽已限频（每会话一次 + 关闭记忆），可考虑增加「滚动深度 ≥ 25%」触发条件，进一步减少首屏打扰
2. preload 警告若在生产构建仍存在，应检查按需 chunk 的 `rel=preload` 注入策略

---

## 五、代码质量审计（对照 AGENTS.md Constitutional Rules）

### 5.1 合规项 ✅

| 规则 | 结果 |
|------|------|
| TypeScript strict mode | ✅ 实跑 `tsc --noEmit` 通过（exit 0，2026-07-29 复核） |
| 禁止 `any` | ✅ **0 处**（含 `@ts-ignore` / `@ts-nocheck` 0 处），类型质量优秀 |
| Hook 规则 / 组件命名 | ✅ 抽查未见违规 |
| SSR 兼容（Server Component 无 window/document） | ✅ 未发现违规（抽查） |
| i18n key 覆盖 | ✅ 用户可见文案均走 next-intl，三语齐备 |

### 5.2 偏差项 ⚠️（按严重度排序）

#### P1-1 `JsonLd.tsx` 使用 `dangerouslySetInnerHTML` 且未转义 `<`

`apps/web/src/components/JsonLd.tsx` 直接 `JSON.stringify` 注入 `<script type="application/ld+json">`。JSON-LD 注入本身是业界标准做法（Next.js 官方文档同款），但**当前未对输出做 `<` 转义**——若 CMS 内容（产品名/文章标题）中出现 `</script>` 字样即可提前闭合脚本标签造成 XSS。
**修复**（一行）：`JSON.stringify(...).replace(/</g, '\\u003c')`。

#### P1-2 环境变量无启动校验 + 硬编码 localhost 默认值（7 处文件）

经复核，`apps/web` **未引入 zod 环境变量校验，也未使用 `@tzj/config` 共享校验包**，违反 AGENTS.md「使用 zod 在启动时验证所有环境变量」。与之叠加，`lib/api.ts`、`lib/site-settings.ts`、`lib/media-url.ts`、`lib/analytics.ts`、`lib/integrations-public.ts`、`features/chat/api.ts`、`features/chat/useVisitorChat.ts` 共 7 个文件存在形如
`process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'`、`'http://localhost:9000/tzj-uploads-dev'` 的回退值。
违反 AGENTS.md「禁止硬编码 URL，统一 `S3_PUBLIC_DOMAIN` 等环境变量」。风险：生产环境漏配环境变量时**静默回退到 localhost** 而非启动报错。
**建议**：抽取 `lib/env.ts` 用 zod 校验并集中导出（或接入 `@tzj/config`）；开发默认值仅在 `NODE_ENV !== 'production'` 下生效，生产缺失直接 fail-fast。

#### P1-3 零测试

`apps/web` 与 `packages/ui` 均无任何 `*.test.*` / `*.spec.*`，无 Storybook。ChatWidget（token 续期、归档清理、气泡限频）这类状态机逻辑完全无回归保障。
**建议**：优先补三类——① `lib/` 纯函数单测（media-url、jsonld、load-messages 回退链）；② ChatWidget 关键 hook 拆出后的单测；③ Playwright 冒烟（首页/产品/联系表单/语言切换 4 条路径）。

#### P2-1 `console.*` 遗留（6 处 / 5 文件）

| 位置 | 判定 |
|------|------|
| `app/[locale]/error.tsx`、`global-error.tsx` | 可接受（错误边界上报前的兜底，业界常见），建议换上报管道 |
| `app/api/search/analytics/route.ts` | 应替换为结构化日志或移除 |
| `components/ConsoleBranding.tsx` | 有意为之的控制台彩蛋，可豁免（建议加 biome-ignore 注释显式声明） |
| `lib/i18n/load-messages.ts` L87/L100 | **遗留**，应移除或降级为仅 dev 输出 |

#### P2-2 超大组件

| 文件 | 行数 |
|------|------|
| `components/chat/ChatWidget.tsx` | **2127** |
| `components/chat/EmojiPicker.tsx` | 628 |
| `components/layout/Header.tsx` | 592 |
| `components/search/SearchBar.tsx` | 535 |
| `components/sections/ContactSection.tsx` | 380 |
| `features/chat/useVisitorChat.ts` | 333 |

ChatWidget 集 socket 连接、token 生命周期、消息流、气泡策略、上传、UI 于一体，建议按「useChatSession（会话/token）/ useChatMessages（消息流）/ ChatBubble / ChatPanel」拆分——这也是补测试的前置条件。

#### P2-3 原生 `<img>`（8 处 / 7 文件）

`ui/index.tsx`、`HeroSection`、`SocialChannelBar`、`SocialQrImage`、`ChatWidget`、`TopBar`、`LanguageSelectorDrawer`。其中二维码/图标类小图属合理豁免；Hero 与内容图应确认是否已由 OSS loader 承担优化（若是装饰性小图可保留，但建议统一加 `width/height` 防 CLS）。

---

## 六、问题分级清单与行动建议

### P0（无）

未发现阻断发布或用户不可用级别的问题。

### P1（建议本迭代处理）

| # | 问题 | 位置 | 工作量 | 状态 |
|---|------|------|--------|------|
| 1 | JsonLd 输出未转义 `<`（XSS 面） | `components/JsonLd.tsx` | 5 分钟 | ✅ 已修复（`\u003c` 转义 + biome-ignore 声明，附单测验证） |
| 2 | 环境变量无 zod 校验 + localhost 默认值静默回退 | 7 文件 → 收敛到 zod env | 0.5 天 | ✅ 已完成（`lib/env.ts` zod 校验，生产缺失 fail-fast，7 文件全部收敛，附单测） |
| 3 | 零测试（先补 lib 纯函数 + 4 条 E2E 冒烟） | `apps/web` / `packages/ui` | 2–3 天起步 | 🔶 部分落实：vitest 已接入，lib 单测 4 文件 40 用例（media-url / jsonld+JsonLd 转义 / env / message-modules+loadMessages）；E2E 冒烟与 packages/ui 测试待补 |

### P2（纳入 Backlog）

| # | 问题 | 建议 | 状态 |
|---|------|------|------|
| 4 | ChatWidget 2127 行 | 拆分 hooks + 子组件，配套单测 | ✅ 已完成（2127→1117 行，共拆出 8 个模块：6 个展示/纯函数模块 + useChatSession / useChatMessages 两个有状态 hook，行为不变，配套单测全绿） |
| 5 | console.* 6 处 | load-messages / search route 清理；error 边界接上报管道 | ✅ 已治理（load-messages / search route 均已 dev-gate；error 边界保留兜底，上报管道待接） |
| 6 | 原生 `<img>` 8 处 | 逐一确认豁免或迁移，统一补 width/height | ✅ 已治理（实际 6 处使用点均属合理豁免：聊天附件/二维码/三方国旗 CDN；已补齐缺失的 width/height + lazy，并把失效的 eslint-disable 换为豁免理由注释） |
| 7 | Base-UI 1.0.0-rc.0 | 关注正式版发布，安排一次升级验证 | ✅ 已升级（正式版已发布且改名 `@base-ui/react`，已升级至 1.6.0；rc.0 时期的 Toast flushSync 本地补丁已被上游 1.0.0 修复，随升级移除；tsc/测试/构建全绿） |
| 8 | preload 警告 | 生产构建下复核，必要时调整按需 chunk 预加载 | ✅ 已修复（根因：layout 手工对聊天专用 lute.min.js 注入 preload，首屏必然「预加载未使用」；已改为 prefetch。生产 HTML 复核：余下仅 hero LCP 图与 Next 框架自注入的低优先级 chunk preload，均为正当用法） |
| 9 | 无 Storybook | packages/ui 47 组件建议补可视化文档，降低协作成本 | ⏳ 待处理 |
| 10 | 移动端真机走查 | 人工补一轮 390×844 触控尺寸/抽屉动效/ChatWidget 遮挡检查 | ⏳ 待人工 |

### 落实记录

- **2026-07-29**：P1-1（JsonLd 转义）、P1-2（zod env 收敛）、P2-5（console 治理）完成；P1-3 首批 lib 单测落地：`vitest.config.ts`（node 环境 + oxc automatic JSX）+ 4 个测试文件 40 用例全过，`tsc --noEmit` / biome 同步通过。覆盖：media-url 归一链、JSON-LD 五类构建器与 `</script>` 注入防护、env 生产 fail-fast/开发回退/URL 校验/chat 派生、i18n 按需加载计划与 loadMessages 回退链。
- **2026-07-29（第二批）**：P2-4 ChatWidget 拆分第一阶段完成（纯迁移、行为不变）：2127→1504 行，拆出 `chat-i18n.ts`（文案表 + 类型）、`chat-format.ts`（格式化纯函数）、`MessageList.tsx`（按天分组 + 消息气泡）、`AgentAvatar.tsx`、`features/chat/business-hours.ts`（营业时间兜底）、`features/chat/useAgentPresence.ts`（presence 聚合：REST 自愈轮询 + 5s/90s 双防抖 + 营业时间兜底）。新增 `chat-format` 20 用例 + `business-hours` 6 用例（含未知 locale 回退 zh-CN、时区判定等行为锁定），全量 6 文件 66 用例全过，`tsc --noEmit` / biome 同步通过（仅剩拆分前即存在的存量告警）。
- **2026-07-29（第三批）**：P2-4 ChatWidget 拆分第二阶段完成（纯迁移、行为不变）：1504→1117 行。拆出 `features/chat/useChatSession.ts`（会话/token 生命周期：本地恢复、auth-error 续期、重连重加入、建房/首条消息、归档承接与新会话；token 状态留在 ChatWidget 经 options 注入，规避与 useVisitorChat 的循环依赖）与 `features/chat/useChatMessages.ts`（消息流：socket 业务事件注册、已读标记（2s 延迟 + 可见性判定）、5s HTTP 对账自愈、未读/输入中/转接通知瞬态；预览气泡弹出经 `onAgentMessageWhileClosed` 回调解耦）；`normalizeMessage` 下沉至 `features/chat/message-utils.ts`（chat-format re-export 保持既有引用）。验证：`tsc --noEmit` 零错误、66 用例全过、biome error 清零（仅剩存量告警）。
- **2026-07-29（第四批）**：P2-6 原生 `<img>` 治理完成：实际 6 处使用点（评估时 8 处含测试字符串与注释误计）逐一判定均为合理豁免——聊天附件缩略图（ChatWidget/MessageList，运行时动态 URL）、弹层二维码（TopBar/SocialChannelBar，按需展示非 LCP）、失败回退链二维码（SocialQrImage，依赖原生 onError）、三方 flagcdn 国旗（LanguageSelectorDrawer），不适合迁 next/image。治理动作：4 处补齐 width/height（防 CLS）、弹层二维码补 `loading="lazy"`，6 处均把已失效的 `eslint-disable @next/next/no-img-element`（next lint 已移除）换为明确的豁免理由注释。验证：`tsc --noEmit` 零错误、66 用例全过、biome 零 error。
- **2026-07-29（第五批）**：P2-8 preload 警告复核与修复完成。生产构建（本地注入 env 后 `next build` + `next start`）复核：控制台无 lucide-react/ContactSection chunk 的 preload 警告（确认为 dev 模式 Turbopack 预加载策略噪音）；但定位到一处真实问题——`[locale]/layout.tsx` 手工对聊天 Markdown 引擎 `lute.min.js` 注入 `rel="preload"`，该脚本仅在访客打开聊天时才执行，首屏必然触发「预加载未及时使用」警告并抢占首屏带宽，已改为 `rel="prefetch"`（空闲低优先级预取进缓存，语义匹配「留待后续场景使用」）。重建后生产 HTML 复核：lute 已为 prefetch 且重复注入消失，余下 preload 仅 hero LCP 图（fetchPriority=high）与 Next 框架自注入的低优先级 chunk，均为正当用法。
- **2026-07-29（第六批）**：P2-7 Base UI 升级完成。上游 1.0.0 正式版已于 2025-12-11 发布，唯一破坏性变更为包改名 `@base-ui-components/react` → `@base-ui/react`（旧包 latest 停在 rc.0，故此前观察未见新版）；本次直接升级至最新稳定版 1.6.0（2026-06-17，1.x minor 无破坏性变更声明）。变更：`packages/ui` 依赖改名升版、19 个源码文件 import 子路径批量改名（子路径结构不变）、移除 `patchedDependencies` 与 Toast flushSync 本地补丁（上游 1.0.0 #3443 已修复同一问题）。验证：`@tzj/ui` 构建、web/admin `tsc --noEmit`、66 用例、biome（仅存量告警）、web/admin 生产构建全部通过。建议人工补一轮 Toast/弹层类交互抽查（Toast 堆叠、Select/Menu/Tooltip 弹出定位）。

---

## 七、附录：实测环境说明

- 服务：web `localhost:3001`（Next dev + Turbopack）、api `localhost:4000`、MinIO `localhost:9000`，均正常
- 验证手段：curl SSR 抽样（首页/产品/联系/新闻/搜索 5 页）、CDP 浏览器 DOM/网络/控制台巡检、`$RB/$RV` 流式揭示队列手动冲刷复现实验
- 评估局限：性能数据均为 dev 模式（未做生产构建 Lighthouse / bundle 体积分析）；A11y 为语义抽查（未跑 axe 自动扫描）；星级评分为定性评级，无量化基线
- 已知实测工具限制（记录在案，避免未来误判）：
  1. 隐藏窗口下 React 19 流式边界不揭示（rAF 挂起）→ 表现为「永远加载中」假象
  2. 同因导致 `take_screenshot` 超时，本轮未能产出渲染截图；`.qoder/01-homepage-hero.png` 为初测所得（呈现的是 fallback 状态，不代表真实视觉）
  3. MCP 网络面板将 304 标记为 "failed"，属工具显示口径，非真实失败
