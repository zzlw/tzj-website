# Admin 后台「去 AI 味」体验优化方案

> 对标参考：`next-shadcn-dashboard-starter`（shadcn 官方生态模板）
> 分析对象：`apps/admin` + `packages/ui`
> 状态：方案 v4.5（全面重构版，约 3.5~5 周；原六项排除项经决策全部纳入） · 2026-07
> 范围说明：小团队、后台用户 ≤ 100 人的背景不变；v4 经用户决策由「渐进优化」升级为「设计系统全面重构」（彻底替换品牌体系 + Base UI 全量迁移），通过分批交付与停止线控制风险

---

## 一、问题定义

同样是 shadcn 技术栈的管理后台，为什么 starter 观感「丝滑、低 AI 味」，而我们的 admin「AI 味浓」？

「AI 味」不是玄学，可以拆解为两类可度量的信号：

| 维度 | starter 的表现 | 我们的表现 |
|------|--------------|-----------|
| **体感（丝滑）** | 任何点击都有即时反馈，页面切换有骨架/进度条过渡 | 点导航后界面"卡住"，等服务端返回才整页跳出 |
| **视觉（AI 味）** | 单一设计语言，克制、留白、节奏统一 | 模块堆满、彩色逃逸、文案带"助手腔"、细节不统一 |

以下逐条给出证据与根因。

---

## 二、根因分析

### 2.1 体感层：缺失「即时反馈链路」（不丝滑的最大来源）

starter 的丝滑感来自一条完整的反馈链路，我们一环都没有：

| 反馈环节 | starter | admin 现状 |
|---------|---------|-----------|
| 路由切换进度 | `NextTopLoader`（顶部品牌色进度条） | ❌ 无任何指示 |
| 页面加载骨架 | `PageContainer isLoading` + `loading.tsx` | ❌ 全仓 **0 个** `loading.tsx` |
| 首屏数据阻塞 | 图表走 parallel routes 分块流式渲染 | ❌ 仪表盘 `force-dynamic` 一次 `await` **11 个 API**（`apps/admin/src/app/(dashboard)/page.tsx` L204-234），全部返回前页面空等 |
| 主题/状态切换 | View Transition 波纹、无闪烁 cookie 持久化 | ⚠️ sidebar 状态已做 cookie 持久化（这点没问题） |

**这是「不丝滑」的第一根因**：RSC 页面在数据就绪前不渲染任何东西，用户感知为"点了没反应"。starter 即使数据同样慢，用户也始终能看到进度条 + 骨架，体感完全不同。

### 2.2 视觉层：色彩逃逸出令牌系统

CONVENTIONS.md 明文规定「所有颜色使用 design token，禁止硬编码」，但仪表盘存在典型的 AI 生成套路——**语义状态直接抓 Tailwind palette**：

```tsx
// page.tsx L94/L98 — 状态徽标
'border-emerald-200 bg-emerald-50 text-emerald-700'
'border-amber-200 bg-amber-50 text-amber-700'
// page.tsx L320/L328 — 指标卡强调态
'border-amber-200/80 bg-amber-50/40'  'bg-amber-500/15 text-amber-700'
// page.tsx L174 — 正文里内嵌彩色数字
'font-medium text-amber-700'
```

而 starter **全项目零 palette 类名**，成功/警告/图表全部走 oklch 语义令牌。在「白/深灰/品牌红」的工业色系里突然出现 emerald/amber 五彩斑斓，正是"一眼 AI"的最强视觉信号——因为它是模型的高频默认解，而不是这套设计系统的解。

### 2.3 视觉层：信息过载，缺少「减法」

仪表盘（管理员视角）纵向堆了 **7 个区块**：欢迎卡 → 内容库 5 卡 → 核心指标 4 卡 → 分析面板 → 最新询盘 → 最近操作 → 快捷入口。对比 starter 首页只有 **2 层**：4 张 stat cards + 图表网格。

具体的"填满页面"症状：

- 「快捷入口」在代码里存在**两套不同样式**的渲染（右栏 `outline` 默认尺寸 / 底部 `outline sm`，另欢迎卡里还有第三套 `secondary sm`）——同一功能三种形态；
- 每张指标卡都塞了 `hint` 赘语（"需尽快跟进""累计客户咨询""已建档客户"）——数字本身已经表达的信息再用文字复述一遍，是典型的 LLM 补白行为；
- 所有卡片都是可点击链接 + `hover:border-primary/40 hover:shadow-md` + 数字变红——"everything is a card, every card is a link"套路。starter 的卡片默认静态，交互集中在明确的按钮上。

### 2.4 视觉层：文案带「助手腔 / 营销腔」

UI 文案是比样式更强的 AI 指纹：

| 现状文案 | 问题 |
|---------|------|
| "内容运营、询盘与官网访问的**一站式概览**" | 营销腔，后台工具不需要推销自己 |
| "运营状态**良好**" | 系统替用户下结论（助手腔） |
| "建议优先跟进" | 同上 |
| 灵犀 tooltip："像与人交谈……**你负责说，剩下的交给灵犀**" | 发布会文案出现在侧边栏 tooltip 里 |

对比 starter：全部文案是名词短语或数据陈述（"Total Revenue" / "Visitors for the last 6 months"），零形容词、零建议、零感叹。

### 2.5 基建层：字体声明了但从未加载

`packages/ui/src/globals.css` 声明 `--font-sans: "Inter", "Noto Sans SC", ...`，但 admin **没有任何 `next/font` 加载**（全仓 grep 为零）。实际渲染是各操作系统的回退字体——Windows 上是雅黑、mac 上是苹方，数字不等宽、字重层次弱。starter 用 `next/font` 真实加载 Geist 并注入变量，这是"质感差一截"的隐性原因。

### 2.6 基建层：`@tzj/ui` 是旧版 shadcn 快照，细节代差

| 细节 | starter（新版 shadcn） | @tzj/ui（旧快照） |
|------|----------------------|------------------|
| Card 结构 | `flex flex-col gap-6 py-6` + `CardAction` 插槽 + container query | 旧版 `p-6 / pt-0` 补丁式间距，无 CardAction |
| Button 焦点 | `focus-visible:ring-[3px] ring-ring/50`（柔和光环） | `ring-1`（生硬细线） |
| 阴影 | `shadow-xs/sm` 新刻度，卡片统一 `shadow-sm` | `shadow` 与 `shadow-sm` 混用，页面级再手写 `border-border/80` 微调 |
| data-slot | 全组件带 `data-slot`，支持 `*:data-[slot=card]` 父级统一控制 | 无，只能逐个卡片写重复 className |

页面层不得不用 `border-border/80`、`className="h-8 w-8"` 之类的局部补丁去修正组件默认值，补丁本身又造成新的不一致。

### 2.7 一致性层：排版与密度节奏随手化

同一页面内混用 `text-[10px]` / `text-[11px]` / `text-xs`；按钮高度 `h-7 / h-8 / h-9` 并存；`gap-1.5 / 2 / 3 / 4 / 6` 无规律切换；行动作里「阅读」和「预览」共用同一个 `Eye` 图标。单看每处都合理，整体却形成"每个局部由不同 prompt 生成"的观感——这正是 AI 味的本质：**局部最优、全局失调**。

### 2.8 综合判断：AI 味的本质是「过剩」，解法是删除

starter 的低 AI 味不是因为基建更多，而是因为它做得**少而一致**（首页仅 2 层结构、零 palette 色、零建议性文案）。我们的问题是**过剩**（多余区块、多余颜色、多余文案、多余形态）。因此去 AI 味的主路径是删除，而删除恰好是最便宜的操作——与「小团队、防过度设计」的约束完全同向。体验层需要新增的极少：一个进度条、几个 `loading.tsx`、两组语义令牌；流式渲染、设计系统重构、CI 护栏属于工程质量投入，用分批交付与「停止线」约束边界。

---

## 三、优化方案（v4 全面重构版，分项加总约 3.5~5 周，分三批交付）

> 排序原则：**先删除，后新增**；体验层速赢先行（Phase A，3~4 天，可先上线），设计系统重构居中（Phase B，周级独立投入），护栏与度量收尾（Phase C）。

### Phase A — 体验层速赢（3~4 天）

#### A1 仪表盘减法 + 文案清洗（1~1.5 天，去 AI 味主力）

1. 区块从 7 个减到 4 个：
   - **欢迎行**（去卡片化，一行日期+称呼，右侧 2 个主操作，即「快捷入口」唯一保留处）；
   - **指标区**：内容库 5 卡与核心指标 4 卡合并为一排 4 张关键指标（待处理询盘/未读/客户/已发布内容）；内容库明细降级为链接行；
   - **分析面板**（保留）；
   - **动态区**：最新询盘 + 最近操作双栏（保留）。
2. 「快捷入口」删除另外两处渲染，只保留欢迎行一种形态。
3. 删除所有 `hint` 赘语；文案规范：**名词短语 + 数据，禁用形容词/建议句/营销句**。"运营状态良好" → 删；"一站式概览" → "内容、询盘与访问概览"；灵犀 tooltip 压缩为一句功能描述。
4. 副产物：区块减少后，页面 API 调用从 11 个自然降到 5~6 个，为 A2 的流式渲染减负——需要 `<Suspense>` 包裹的数据区块更少、骨架更简单。

#### A2 即时反馈链路（1~1.5 天，丝滑感主力）

1. admin 引入 `nextjs-toploader`（`color: var(--color-primary)`，`showSpinner: false`），挂根 layout；
2. 为 `(dashboard)` 核心路由补 `loading.tsx` + 一个共享 `PageSkeleton`（整页级一种即可，不做列表/详情多变体）；
3. **仪表盘逐块流式渲染**：`page.tsx` 拆为壳（欢迎行，静态即时渲染）+ 数据区块（各自 `<Suspense fallback={骨架}>` 包裹的 async 子组件），从"全部就绪才见首字节"变为"逐块吐出"；低频统计（内容库 count）如需缓存，用 `unstable_cache` 包裹查询函数——页面已声明 `export const dynamic = 'force-dynamic'`，路由级 `revalidate` 不生效。

> 依赖说明：必须先做 A1 减法再做本步——区块降到 4 个后，Suspense 边界只需 3 处（指标区/分析面板/动态区），复杂度可控；顺序颠倒则会为即将删除的区块白写骨架。

#### A3 色彩收敛（0.5~1 天，过渡性投入）

1. 在 `packages/ui/src/globals.css` 的 `@theme` 中补语义状态令牌（admin 已 `@import "@tzj/ui/globals.css"`，自动获得，无需在 admin 侧重复定义；定义在 ui 包是因为 A3.2 要清理的逃逸色有 4 处在 ui 组件内部。令牌沿用现有冷灰色温调校，不引入新色相倾向；令牌值直接以 oklch 书写，B2 品牌体系替换时仅搬运不重定义，消除返工）：

   ```css
   --color-success / --color-success-foreground / --color-success-muted
   --color-warning / --color-warning-foreground / --color-warning-muted
   ```

2. 全局清除 palette 逃逸：`emerald-*`、`amber-*` 等类名替换为上述令牌（`ContactStatusBadge`、核心指标 accent 态、HeroSummary 内嵌色字等）；**清理范围含 `packages/ui/src`**——实测 @tzj/ui 内另有 4 处逃逸（`ContentListItem` 的 amber 高亮 ×3、`Alert` success 变体的 `green-500`），admin 页面消费这些组件时逃逸色照样渲染，只清 admin 页面层等于漏网。
3. 收敛强调策略：一屏内彩色锚点 ≤ 2 处（品牌红指示 + 至多一个警示态）；正文数字不再单独着色，用 `font-medium` + `tabular-nums` 表达强调。

验收：`grep -rE '\b(emerald|amber|sky|violet|teal|rose|indigo|green|orange)-[0-9]' apps/admin/src packages/ui/src` 结果为 0（C1 将此检查固化进 CI）。`apps/web` 豁免——web 视觉不在本方案范围（实测 web 存量 4 处，集中在 ChatWidget，留待 web 自身迭代处理）。

> 过渡说明：B2 品牌体系替换后，本步的 success/warning 令牌将并入主题预设体系；先行落地是为了立即消除 palette 逃逸，属低成本过渡投入。

### Phase B — 设计系统全面重构（约 2.5~4 周，独立大 PR）

> 执行顺序：**先换底座（B1），再换主题（B2）**——新版 shadcn 组件自带 oklch 令牌约定，先迁组件再挂主题只做一遍适配；顺序颠倒则旧组件上的主题适配在迁移时全部作废。

#### B1 @tzj/ui 全量迁移 Base UI（2~3 周，一次性）

1. Radix → Base UI（base-nova 风格）整体替换，组件结构对齐新版 shadcn：Card 新结构 + `CardAction` 插槽 + `data-slot` 属性、focus `ring-[3px] ring-ring/50`、`shadow-xs/sm` 新刻度、container query。**工作量结构（实测）**：共 47 个组件，其中真正依赖 Radix 需换底座的 **19 个**（dialog/select/dropdown-menu/sheet/sidebar/form 等），其余 28 个为纯样式组件只需对齐新结构与新刻度；工期按 2~3 周计（难点集中在 data-table/sidebar/calendar/form 四个复合组件）；
2. **`asChild` API 断裂面（关键约束）**：Base UI 无 Radix 的 `Slot/asChild` 机制（改用 `render` prop），而全仓 `asChild` 调用点实测 **118 处**（admin 77 + web 15 + ui 内部 26）。若直接暴露 Base UI API，双端业务代码需大面积同步改造，web 就不再是「只做兼容回归」。**硬性要求：@tzj/ui 包装层保留 `asChild` prop，内部转换为 `render`，业务侧 API 不变**，双端零改造；兼容层作为长期 API，不计划后续拆除；
3. **web 端令牌桥接（独立子任务）**：迁移后组件引用新令牌刻度（`shadow-xs`、`ring/50` 等），web 的 globals.css 需同步补齐对应变量定义，否则静默视觉劣化，不能只靠回归时发现；
4. 随迁移消除页面层历史补丁（`pb-4 space-y-0`、`border-border/80` 等）；
5. 完成标准：admin + web 双端 `typecheck` 通过 + 视觉回归。**回归执行方式明确为**：Playwright（admin 已有依赖）对核心页面清单截图对比，迁移前先落基线截图；
6. 风险控制：迁移期间冻结 @tzj/ui 其他改动，**admin 页面 UI 层功能改动排队至对应组件迁移完成**，避免大面积冲突；若单 PR 过大，按「基础组件 → 复合组件 → 页面适配」拆为 3 个连续 PR 合入，不长期保留双底座。

#### B2 品牌体系替换 + 多主题（2~3 天）

1. 放弃「品牌红单一锚点 + 锐利圆角」体系，对齐 starter 的 oklch 语义令牌 + 主题预设机制：10 套配色预设、明暗模式、cookie 持久化、切换 View Transition 波纹（用原生 `document.startViewTransition` + 能力检测降级，不依赖 Next experimental flag，starter 即此做法）；**机制前提（实测缺失）**：admin 当前无任何主题 provider，需新增 `next-themes` 依赖（管明暗）+ 自建 ActiveThemeProvider（管配色预设，cookie 读写）+ 主题切换器组件，直接移植 starter 的 `theme-provider/active-theme/theme-selector/theme-mode-toggle` 四件套，不自行设计；
2. 默认主题采用 starter 中性体系，品牌红沉淀为预设之一（已验证：`#e3000f` 在 src 内无散落硬编码，品牌色全在令牌层，替换面干净）；
3. **暗色模式存量适配（新增子任务）**：admin globals.css 的石墨蓝侧栏 HSL 变量与品牌覆盖层需补暗色对应值（已验证：页面层 bg-white 类硬编码仅 1 处，页面负担小，主要工作在令牌层）；
4. 同步修订 AGENTS.md 与 CONVENTIONS.md 的设计令牌章节（「圆角单调递增」等旧规范同步废止或改写，避免规范与实现打架）；
5. 替换范围限 `apps/admin` 主题层；web 官网视觉不变（B1 已做令牌桥接，此处仅需确认 web 不加载主题切换器）。

#### B3 字体与图标（0.5~1 天）

1. `next/font` 加载 Inter（`variable: '--font-sans-latin'`）注入 admin 根 layout，中文回退保持现状；数字展示场景统一 `tabular-nums`；
2. 图标语义表：一个动作一个图标（阅读 `BookOpen` / 预览 `Eye` / 编辑 `Pencil` / 删除 `Trash2`），沉淀为 `docs/design/icon-semantics.md`，「阅读/预览」共用 `Eye` 的重复随表落地一并修正。

### Phase C — 存量清零 + 护栏度量（约 1.5 天）

#### C1 存量清零 + 护栏固化（1 天）

1. 清理存量排版逃逸：任意值字号 `text-[10px]` / `text-[11px]` → `text-xs`，`h-7` 式高度覆盖 → 组件 size 变体（现存 26 处、分布 10+ 文件，含 Sidebar/ResourceForm/MediaPicker 等；A1 仅覆盖仪表盘，其余在此清零，否则规范落地即全线违规）；
2. CI 增加逃逸色检查：A3 的 grep 作为脚本进 `scripts/`，**检查范围 = `apps/admin/src` + `packages/ui/src`**（与 A3 清理范围一致，否则组件库回潮无人拦截），接入现有 lint 流程，控制在一个脚本文件内，不引入新工具链；
3. CONVENTIONS.md 增补「后台 UI 文案规范」与「排版节奏表」（各一小节，不另立新文档）：
   - 字号只允许 `text-xs / sm / base / lg / 2xl` 五档，禁用任意值字号；
   - 间距节奏 `gap-2 / 4 / 6`，区块间距统一 `space-y-6`；
   - 按钮高度只用组件 size 变体，禁止 `h-7` 式覆盖。

#### C2 数字化性能度量（0.5 天）

1. Playwright 脚本度量两项指标：导航点击 → 首个视觉反馈 < 100ms；仪表盘首块内容可见 < 500ms（admin 已有 playwright 依赖，不新增工具链；阈值断言仅本地参考，CI 中只记录不卡卡口，避免环境波动导致的假失败）；
2. 脚本进 `scripts/perf/`，本地 + CI 手动触发，不做常驻监控。

> **停止线**：Phase A 完成可先上线观察；Phase B 为一次性重构投入，B1 合入后不保留双底座；Phase C 完成后本方案关闭，后续视觉需求走常规迭代，不再向外延伸新基建。

---

## 四、验收（人眼 + 脚本度量结合）

| 检查项 | 通过标准 |
|--------|---------|
| 导航反馈 | 点任意导航立即看到进度条与骨架；脚本度量 < 100ms |
| 流式渲染 | 仪表盘欢迎行先出现，数据区块逐块补齐；首块内容 < 500ms |
| 仪表盘密度 | 一屏区块 ≤ 4，彩色锚点 ≤ 2 |
| palette 逃逸 | `apps/admin/src` + `packages/ui/src` grep 结果为 0（CI 卡口持续维持；web 豁免） |
| 文案 | 零形容词/建议句/营销句 |
| 重复形态 | 快捷入口仅 1 处 1 种形态 |
| 主题体系 | 10 套预设可切换、明暗模式无闪烁、cookie 持久化生效；web 官网视觉不受影响 |
| 底座一致性 | Base UI 迁移后页面层无 `border-border/80`、`pb-4 space-y-0` 式补丁；admin + web 双端 typecheck 与视觉回归通过 |
| 排版节奏 | 任意值字号为 0，按钮高度只用 size 变体 |
| 图标语义 | 与 `icon-semantics.md` 一一对应，无一图标多义 |

## 五、不做什么（明确排除）

- ❌ web 官网（C 端）视觉改版——品牌体系替换范围限 admin，web 仅承担 @tzj/ui 迁移的兼容回归；
- ❌ 常驻性能监控 / APM——度量脚本仅本地与 CI 手动触发；
- ❌ 迁移期间 @tzj/ui 新增组件需求——冻结至 B1 合入。

> 附注（修订记录）：v2 曾以「防过度设计」为由将逐块流式渲染、底座升级、护栏固化移入本节；v3 经评估保留这三项；v3.1 修复存量清理缺口与 `force-dynamic` 下 `revalidate` 失效的技术错误。v4 经用户决策将原六项排除全部纳入实施（品牌体系彻底替换 + Base UI 一次性全量迁移，均为用户明确确认）。v4.1 修复四处审计发现：① Phase B 执行顺序纠正为先底座后主题（原顺序会导致主题适配返工）；② Base UI 迁移工期按实测 47 个组件修正为 2~3 周；③ 补 web 端令牌桥接与暗色模式存量适配两项缺失子任务；④ 视觉回归执行方式明确为 Playwright 截图对比（基线先行），性能阈值 CI 只记录不卡卡口。v4.2 修复两处审计发现：① palette 清理与 CI 卡口范围扩展至 `packages/ui/src`（实测组件库内 4 处逃逸会随组件渲染进 admin，原方案只查 admin 页面层存在漏网）；② 2.3 节「内容库 6 卡」与代码实况（`CONTENT_STATS` 共 5 项）不符，订正为 5 卡；另注明 View Transition 用原生 API 不依赖框架实验特性。v4.3 修复一处实质漏洞并订正工作量结构：① B1 补「`asChild` API 断裂面」硬性约束——Base UI 无 Slot/asChild 机制，全仓 118 处调用点（admin 77/web 15/ui 26），若不在包装层兼容则双端业务代码需大面积改造，与「web 只做回归」的前提矛盾；② 实测 47 个组件中仅 19 个真正依赖 Radix，其余 28 个为纯样式对齐，工作量结构比「47 个全换底座」乐观，难点收敛到四个复合组件。v4.4 修复两处：① 工期算术订正——分项加总（A 3~4 天 + B1 2~3 周 + B2 2~3 天 + B3 0.5~1 天 + C 1.5 天）应为 3.5~5 周，原头部「3~4 周」低估上限；② B2 补主题机制前提——admin 实测无任何主题 provider，需引入 next-themes + 移植 starter 主题四件套，避免实施时才发现需从零搭 provider。v4.5 消除修订叠加产生的内部矛盾：A3 令牌定义位置统一为 `packages/ui/src/globals.css`（原 1/2 两款分别写 admin 侧定义与 ui 侧定义，互相打架）；Phase A 工期表述统一为 3~4 天；修正一处繁体字残留。自本版起审计收敛：共八轮纸面审计，发现量递减至仅剩表述级问题，后续不再修订方案文本，以实施反馈为准。

