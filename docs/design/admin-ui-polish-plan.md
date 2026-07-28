# Admin 后台「去 AI 味」体验优化方案

> 对标参考：`next-shadcn-dashboard-starter`（shadcn 官方生态模板）
> 分析对象：`apps/admin` + `packages/ui`
> 状态：方案 v3.1（约 6~8 天；经评估保留流式渲染、底座升级、护栏固化三项） · 2026-07
> 前提约束：小团队，后台用户 ≤ 100 人，**防过度设计、保持简洁实用为第一约束**

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

仪表盘（管理员视角）纵向堆了 **7 个区块**：欢迎卡 → 内容库 6 卡 → 核心指标 4 卡 → 分析面板 → 最新询盘 → 最近操作 → 快捷入口。对比 starter 首页只有 **2 层**：4 张 stat cards + 图表网格。

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
| 阴影 | `shadow-xs/sm` 新刻度，卡片統一 `shadow-sm` | `shadow` 与 `shadow-sm` 混用，页面级再手写 `border-border/80` 微调 |
| data-slot | 全组件带 `data-slot`，支持 `*:data-[slot=card]` 父级统一控制 | 无，只能逐个卡片写重复 className |

页面层不得不用 `border-border/80`、`className="h-8 w-8"` 之类的局部补丁去修正组件默认值，补丁本身又造成新的不一致。

### 2.7 一致性层：排版与密度节奏随手化

同一页面内混用 `text-[10px]` / `text-[11px]` / `text-xs`；按钮高度 `h-7 / h-8 / h-9` 并存；`gap-1.5 / 2 / 3 / 4 / 6` 无规律切换；行动作里「阅读」和「预览」共用同一个 `Eye` 图标。单看每处都合理，整体却形成"每个局部由不同 prompt 生成"的观感——这正是 AI 味的本质：**局部最优、全局失调**。

### 2.8 综合判断：AI 味的本质是「过剩」，解法是删除

starter 的低 AI 味不是因为基建更多，而是因为它做得**少而一致**（首页仅 2 层结构、零 palette 色、零建议性文案）。我们的问题是**过剩**（多余区块、多余颜色、多余文案、多余形态）。因此去 AI 味的主路径是删除，而删除恰好是最便宜的操作——与「小团队、防过度设计」的约束完全同向。体验层需要新增的极少：一个进度条、几个 `loading.tsx`、两组语义令牌；流式渲染、底座对齐、CI 护栏属于工程质量投入，用「停止线」约束边界。

---

## 三、优化方案（合计约 6~8 天）

> 排序原则：**先删除，后新增**；体感与视觉先行（Step 1~3，约 3 天，可先上线），底座与护栏收尾（Step 4~5，可独立排期）。

### Step 1 — 仪表盘减法 + 文案清洗（1~1.5 天，去 AI 味主力）

1. 区块从 7 个减到 4 个：
   - **欢迎行**（去卡片化，一行日期+称呼，右侧 2 个主操作，即「快捷入口」唯一保留处）；
   - **指标区**：内容库 5 卡与核心指标 4 卡合并为一排 4 张关键指标（待处理询盘/未读/客户/已发布内容）；内容库明细降级为链接行；
   - **分析面板**（保留）；
   - **动态区**：最新询盘 + 最近操作双栏（保留）。
2. 「快捷入口」删除另外两处渲染，只保留欢迎行一种形态。
3. 删除所有 `hint` 赘语；文案规范：**名词短语 + 数据，禁用形容词/建议句/营销句**。"运营状态良好" → 删；"一站式概览" → "内容、询盘与访问概览"；灵犀 tooltip 压缩为一句功能描述。
4. 副产物：区块减少后，页面 API 调用从 11 个自然降到 5~6 个，为 Step 2 的流式渲染减负——需要 `<Suspense>` 包裹的数据区块更少、骨架更简单。

### Step 2 — 即时反馈链路（1~1.5 天，丝滑感主力）

1. admin 引入 `nextjs-toploader`（`color: var(--color-primary)`，`showSpinner: false`），挂根 layout；
2. 为 `(dashboard)` 核心路由补 `loading.tsx` + 一个共享 `PageSkeleton`（整页级一种即可，不做列表/详情多变体）；
3. **仪表盘逐块流式渲染**：`page.tsx` 拆为壳（欢迎行，静态即时渲染）+ 数据区块（各自 `<Suspense fallback={骨架}>` 包裹的 async 子组件），从"全部就绪才见首字节"变为"逐块吐出"；低频统计（内容库 count）如需缓存，用 `unstable_cache` 包裹查询函数——页面已声明 `export const dynamic = 'force-dynamic'`，路由级 `revalidate` 不生效。

> 依赖说明：必须先做 Step 1 减法再做本步——区块降到 4 个后，Suspense 边界只需 3 处（指标区/分析面板/动态区），复杂度可控；顺序颠倒则会为即将删除的区块白写骨架。

### Step 3 — 色彩收敛（0.5~1 天）

1. 在 `apps/admin/src/app/globals.css` 的 `@theme` 中补语义状态令牌（沿用现有冷灰色温调校，不引入新色相倾向）：

   ```css
   --color-success / --color-success-foreground / --color-success-muted
   --color-warning / --color-warning-foreground / --color-warning-muted
   ```

2. 全局清除 palette 逃逸：`emerald-*`、`amber-*` 等类名替换为上述令牌（`ContactStatusBadge`、核心指标 accent 态、HeroSummary 内嵌色字等）。
3. 收敛强调策略：一屏内彩色锚点 ≤ 2 处（品牌红指示 + 至多一个警示态）；正文数字不再单独着色，用 `font-medium` + `tabular-nums` 表达强调。

验收：`grep -rE '\b(emerald|amber|sky|violet|teal|rose|indigo)-[0-9]' apps/admin/src` 结果为 0（Step 5 将此检查固化进 CI）。

### Step 4 — 底座升级：@tzj/ui 对齐新版 shadcn（2~3 天，独立 PR）

1. Card 迁移到新结构（`gap-6` 布局 + `CardAction` 插槽 + `data-slot` 属性），消除页面层 `pb-4 space-y-0` 类补丁；`data-slot` 支持 `*:data-[slot=card]` 父级统一控制，替代逐卡片重复 className；
2. Button/Input 焦点态升级为 `focus-visible:ring-[3px] ring-ring/50 border-ring`；
3. 阴影统一：卡片一律 `shadow-sm`，禁止页面层再手写 `border-border/80`——把 `/80` 直接烘焙进 `--color-border`；
4. 「阅读」与「预览」图标去重（阅读 `BookOpen`，预览保留 `Eye`）；数字展示场景统一 `tabular-nums`。

> 注意：Card 结构变更影响 web 端共享使用处，需跑 `pnpm --filter @tzj/web typecheck` + 视觉回归后合并。

### Step 5 — 存量清零 + 护栏固化（1 天）

1. 清理存量排版逃逸：任意值字号 `text-[10px]` / `text-[11px]` → `text-xs`，`h-7` 式高度覆盖 → 组件 size 变体（现存 26 处、分布 10+ 文件，含 Sidebar/ResourceForm/MediaPicker 等；Step 1 仅覆盖仪表盘，其余在此清零，否则规范落地即全线违规）；
2. CI 增加逃逸色检查：Step 3 的 grep 作为脚本进 `scripts/`，接入现有 lint 流程，控制在一个脚本文件内，不引入新工具链；
3. CONVENTIONS.md 增补「后台 UI 文案规范」与「排版节奏表」（各一小节，不另立新文档）：
   - 字号只允许 `text-xs / sm / base / lg / 2xl` 五档，禁用任意值字号；
   - 间距节奏 `gap-2 / 4 / 6`，区块间距统一 `space-y-6`；
   - 按钮高度只用组件 size 变体，禁止 `h-7` 式覆盖。

> **停止线**：Step 1~3 完成即达成主要体验目标，可先上线观察；Step 4~5 为底座与护栏投入，独立排期、做完即止，不再向外延伸新基建。

---

## 四、验收（人眼标准，不引入测量工具）

| 检查项 | 通过标准 |
|--------|---------|
| 导航反馈 | 点任意导航，立即（体感无迟疑）看到进度条与骨架 |
| 流式渲染 | 仪表盘欢迎行先出现，数据区块逐块补齐，无整页空等 |
| 仪表盘密度 | 一屏区块 ≤ 4，彩色锚点 ≤ 2 |
| palette 逃逸 | grep 结果为 0（CI 卡口持续维持） |
| 文案 | 零形容词/建议句/营销句 |
| 重复形态 | 快捷入口仅 1 处 1 种形态 |
| 底座一致性 | 页面层无 `border-border/80`、`pb-4 space-y-0` 式组件补丁 |
| 排版节奏 | 任意值字号为 0，按钮高度只用 size 变体 |

## 五、不做什么（明确排除）

- ❌ 多主题切换（10 套配色）——与"品牌红单一锚点"的定位冲突；
- ❌ 替换品牌色与锐利圆角体系（AGENTS.md 既有规范继续有效）；
- ❌ 迁移 Base UI / `base-nova` 风格——@tzj/ui 的 Radix 底座保持不变；
- ❌ 图标语义表文档——直接修掉重复即可，不需要一份文档；
- ❌ `next/font` 加载 Inter——收益仅限拉丁字符与数字，`tabular-nums` 已覆盖主要场景，暂缓；
- ❌ 数字化性能指标（<100ms / <500ms）——内部工具以人眼验收，不引入测量工具。

> 附注（修订记录）：v2 曾以「防过度设计」为由将逐块流式渲染、底座升级、护栏固化移入本节；v3 经评估决定保留这三项，移回正文（Step 2.3 / Step 4 / Step 5），并以「停止线」约束其边界：做完即止，不再向外延伸新基建。v3.1 修复两处审计发现：① 补存量排版逃逸清理任务（此前验收要求「任意值字号为 0」但无 Step 负责）；② 修正 `force-dynamic` 页面下 `revalidate` 不生效的技术错误，改用 `unstable_cache`。

