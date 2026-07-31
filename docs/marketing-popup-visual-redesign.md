# 营销弹窗视觉重设计方案（Marketing Popup Visual Redesign）

> 状态：已评估修订（v1.1，评估发现的 10 项问题已全部回写）
> 日期：2026-07-31
> 关联：`docs/activity-system-design.md` v3.5（功能已落地，本方案只解决「视觉/体验」层）
> 改动范围：仅 `apps/web/src/components/marketing/MarketingPopupDialog.tsx` + 少量 `@tzj/ui` Dialog 增强（1 个可选 prop）
> 原则：零新增依赖、不动 API/admin/薄壳逻辑、遵循「小而美」哲学

---

## 1. 问题诊断：为什么现在的弹窗「丑」

当前实现直接复用了 `@tzj/ui` 的后台风格 Dialog 默认样式，效果等同于一个「系统确认框」：

| # | 问题 | 现状 | 后果 |
|---|------|------|------|
| P1 | **无品牌基因** | 白底黑字 + 灰色正文 + 默认圆角，与 admin 后台弹窗同款 | 访客第一反应是「系统消息」，不是「活动邀请」，营销转化天然打折 |
| P2 | **视觉焦点缺失** | 标题左上、正文一行灰字、大片空白 | 3 秒内没有任何元素抓住视线；无图时尤其空洞（见截图） |
| P3 | **排版体系脱节** | 标题用 `text-xl` 系统字体，而全站标题是 Archivo `rb-h*` 流体字号 + 红杠眉标 | 弹窗像「贴」在网站上的异物，破坏 Rosenbauer 工业风一致性 |
| P4 | **CTA 弱** | 普通 `bg-primary` 圆角按钮，与「关闭」并排右下（后台表单的确认/取消布局） | 营销弹窗的 CTA 应是全场唯一主角；右下角双按钮是「操作确认」心智，不是「行动召唤」心智 |
| P5 | **比例失衡** | `max-w-lg`（512px）+ 内容极少时，宽扁空旷 | 信息密度低时观感廉价 |
| P6 | **移动端未针对性设计** | 桌面样式等比缩小居中 | 小屏中央弹窗遮挡感强，也不符合移动端营销弹层的主流形态（底部抽屉） |

**一句话根因**：功能实现期直接借用了 B 端组件的默认皮肤，没有把弹窗当作「一张浓缩的 Landing Page」来设计。

---

## 2. 业内最佳实践参考

### 2.1 设计模式层（营销弹窗领域共识）

综合 Shopify / Klaviyo / OptinMonster / HubSpot 等营销工具的高转化弹窗模板，以及 NN/g（Nielsen Norman Group）对 modal 的可用性研究，收敛出 6 条对本项目适用的原则：

1. **单一焦点（One Goal Per Popup）**：一个弹窗只推一个动作。CTA 必须是唯一视觉主角，「关闭」降级为低调的文字链接或仅保留右上角 X——绝不和 CTA 并排成「双按钮确认框」。
2. **媒体先行（Media-led Layout）**：高转化模板几乎全部采用「上图下文」或「左图右文」结构，图占弹窗面积 40–55%。图片本身承担情绪与主题传达，文案只做补充。
3. **弹窗 = 品牌浓缩页**：字体、色彩、按钮形态与站点主视觉完全一致。用户应当感觉「这是这个网站在对我说话」，而非浏览器/系统在打断我。
4. **无图必须有兜底视觉**：运营不传图时，用品牌色块/纹理/大字排版补位，绝不允许出现「白板 + 两行字」。
5. **移动端形态切换**：移动端主流是底部抽屉（bottom sheet）或小面积卡片。Google 自 2017 年起对「遮挡主内容的插页式弹层」有移动搜索降权政策（intrusive interstitial penalty），营销弹窗在移动端应控制高度（建议 ≤ 60vh）并贴底呈现，降低遮挡感。
6. **克制的进出场动效**：200–300ms 的 fade + 轻微位移/缩放即可；尊重 `prefers-reduced-motion`。华丽动效（弹跳、旋转）已被主流品牌淘汰。

### 2.2 品牌语言层（站内已有资产，直接复用）

本站 C 端已建立完整的 Rosenbauer 工业风体系，弹窗只需「归队」：

| 资产 | 定义位置 | 用途 |
|------|----------|------|
| 品牌红 `--primary: #e3000f` / hover `#d4000e` | `apps/web/src/app/globals.css` | CTA、眉标红杠 |
| 展示字体 Archivo（`font-display`）| 同上 | 弹窗标题 |
| `rb-h3` 流体标题（clamp 1.25→2.13rem）| 同上 | 标题字号规格 |
| `Eyebrow` 眉标（红短杠 + uppercase 0.18em 字距）| `apps/web/src/components/ui/index.tsx` | 标题上方的活动类型眉标 |
| `RbButton`（右侧方形图标芯片 + 悬停箭头穿越动画）| 同上 | 主 CTA |
| 媒体深色 scrim 语言（`--media-shade` 系自底向上，弹窗头图需自定义 top-down 变体 `bg-gradient-to-b from-black/40`） | `globals.css` | 图上白色 X 的可见性保障 |
| 锐角体系（`rounded-[2px]`，全站 sm~xl 为 2–4px）| 设计令牌规范（AGENTS.md）| 弹窗容器与内部元素 |

---

## 3. 设计方案

### 3.1 桌面端：媒体头图卡片（推荐，方案 A）

```
┌────────────────────────────────────┐ ← rounded-[2px] 锐角容器，无内边距
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ [X] │
│ ▒▒▒▒▒▒▒  coverImage 16:9  ▒▒▒▒▒▒▒ │ ← 顶部轻微 top-scrim 保证白色 X 可见
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │
├────────────────────────────────────┤
│  ─ 限时活动                        │ ← Eyebrow：红短杠 + uppercase 眉标
│  区域消防训练设施研讨会            │ ← rb-h3 / font-display / neutral-900
│                                    │
│  测试测试……（Markdown 正文）      │ ← text-secondary-text，行高宽松
│                                    │
│  ┌──────────────────┐              │
│  │ 立即参与    [→] │   不再提醒→关闭 │ ← RbButton primary（左对齐，唯一主角）
│  └──────────────────┘              │    次要关闭 = 无边框文字链接
└────────────────────────────────────┘
```

**规格**：

| 项 | 值 | 说明 |
|----|----|------|
| 容器宽 | `max-w-md`（448px，无图）/ `max-w-lg`（512px，有图） | 略收窄，避免内容少时宽扁空旷（P5） |
| 容器圆角 | `rounded-[2px]` | 对齐全站锐角工业风；覆盖 DialogContent 默认 `sm:rounded-lg` |
| 容器结构 | 三段式 grid：`grid-rows-[auto_minmax(0,1fr)_auto]` = 头图 / 滚动正文 / 固定 CTA 区；**容器只设 `max-h-[70vh]`，`overflow-y-auto` 移到正文段** | 关键修正：若把 overflow 放在 Popup 根上（现状做法），长文时右上 X（absolute 相对滚动容器）与 CTA 会随内容滚出视口——营销弹窗 CTA 必须常驻可见 |
| 图片区 | `aspect-video`、`object-cover`、无内边距通栏 | 媒体先行；顶部叠 `bg-gradient-to-b from-black/40 to-transparent`（约 25% 高度）保证 X 可见 |
| 内容区 | `p-6 sm:p-8` | 比现在更大的呼吸感 |
| 眉标 | `<Eyebrow>` + i18n 活动类型标签（`content.categories.tradeShows.types.*`，promotion → 促销活动） | 复用既有组件与三语标签，零新增文案 |
| 标题 | `rb-h3 text-neutral-900` | Archivo 流体字号，与站内 section 标题同源 |
| 正文 | `MarkdownBody`，容器 `text-sm leading-relaxed text-secondary-text`（用语义字号档，不引入 `text-[15px]` 任意值）；正文段 `min-h-0 overflow-y-auto` 承担滚动 | |
| 主 CTA | `RbButton`（variant=primary，icon 默认 ArrowRight），左对齐 | 站内标志性按钮：红底白字 + 白色方形芯片 + 悬停箭头穿越动画，营销感与品牌感同时到位（P4） |
| 次要关闭 | 文字链接样式：`text-sm text-secondary-text underline-offset-4 hover:underline`，置于 CTA 右侧或下方 | 从「并排按钮」降级为低视觉权重链接；仍保留初始焦点（a11y 决策不变） |
| 右上 X | 白色（图上/深色 banner 上），并处理焦点环：`focus:ring-offset-0`（默认 `ring-offset-background` 在深色上会出白圈） | 需 `@tzj/ui` DialogContent 增加 `closeClassName` 透传（见 §4.2）；X 常驻依赖上一行的三段式结构 |

**无图兜底（P2 关键）**：`coverImage` 为空时，头图区替换为品牌视觉块——

```
┌────────────────────────────────────┐
│ █ neutral-900 深色块（h-28）    [X]│ ← 深空灰 #1c1c1c
│ █  ─ 限时活动（眉标 inverted）     │ ← 白色眉标压在深色块上
│ █  区域消防训练设施研讨会          │ ← rb-h3 白字，压深色块（借鉴站内 Hero 的图上白字语言）
├────────────────────────────────────┤
│  正文 + CTA（同上）                │
└────────────────────────────────────┘
```

即「无图时标题上移进深色 banner」，用站内 Hero/媒体区的深色 + 白字 + 红眉标语言补位，彻底消灭白板感。深色块底边可加 `h-1 bg-primary` 红色细条（对齐站内 `<span class="h-1 w-20 bg-primary">` 的红杠装饰语言）。

### 3.2 移动端（< 640px）：底部抽屉形态

- 形态：贴底、全宽、仅顶部两角 `rounded-t-[2px]`（保持锐利）、自底滑入；
- 高度上限 `max-h-[60vh]`（低于桌面的 70vh），减轻遮挡感、规避 Google 移动插页惩罚风险；
- 图片区在移动端压为 `aspect-[2/1]`，把空间让给文案与 CTA；
- CTA 全宽：`RbButton` 透传 `w-full justify-between`（root 无 justify 类，twMerge 无冲突；只加 `w-full` 会让文字与箭头芯片都靠左，视觉不佳）；次要关闭链接居中置于 CTA 下方。

**实现路径（评估修订：首选 Sheet）**：

1. **首选：复用 `@tzj/ui` Sheet 的 `side="bottom"` 变体**——核查确认 `sheetVariants` 已内置 bottom（`inset-x-0 bottom-0` + `slide-in-from-bottom` 现成进出场动画，且 Sheet Root 复用同一 Dialog 兼容层与 a11y 原语）。弹窗本就是客户端触发时才渲染、薄壳已用 `matchMedia` 做设备过滤，触发时一次性判定视口宽度渲染 `Dialog`（桌面）或 `Sheet side="bottom"`（移动）即可，无 SSR/水合问题；bottom 变体自带 `border-t`，无需处理四边框。
2. **退化路径：纯 `max-sm:` 覆盖 DialogContent**——需覆盖 left/top/translate-x/translate-y/max-w/rounded 及 4 个 `data-[open|closed]:slide-*` 共 10+ 个类；twMerge 对不同 variant 前缀不合并、双方类共存，最终靠 tw-animate-css 同名 CSS 变量（`--tw-enter-translate-y` 等）的级联顺序取胜，该顺序取决于 Tailwind v4 变体排序，**需实测验证**，且贴底还要额外去掉左右下边框。仅在 Sheet 路径评审不通过时采用。

### 3.3 动效与可访问性（维持并微调）

- **非阻断式模态（实施期补充，Constitutional）**：弹窗必须用 `modal={false}`。Base UI 只要 `modal !== false`（含 `'trap-focus'`，见 DialogPopup 的 `modal: modal !== false` → markOthers ariaHidden）就会给弹窗外整棵 DOM 打 `aria-hidden`（inert 化），而弹窗可能在首页下半屏懒加载 section 尚未水合时打开，实测会引发全页 hydration attribute mismatch（'trap-focus' 也复现，已验证）；modal=false 完全跳过 inert 化与滚动锁，仅放弃焦点圈定，对非阻断营销浮层可接受（ESC/遮罩/X/链接四途径关闭、初始焦点管理不变）；
- **层级（实施期补充）**：弹窗 overlay `z-[90]` / content `z-[91]`，位于站内 z 刻度模态顶层（Header 50 → 抽屉/ChatWidget 60 → 语言抽屉 70 → 搜索 80 → 营销弹窗 90 → Toast/Tooltip 100）；百度商桥/爱番番第三方挂件（内部 z-index 为 int 上限）已在 `globals.css` 通过根容器堆叠上下文收编到 60 档，不会盖住任何站内浮层；
- 入场：现有 `data-open` fade + zoom 保留；移动端换 slide-in-from-bottom；`motion-reduce:animate-none` 已有，保留；
- 初始焦点：仍落在次要关闭元素（现有 a11y 决策不变，避免 CTA 抢焦点）；
- 对比度：标题 `#1c1c1c`/白底、白字/`neutral-900` 深色块、CTA 白字/品牌红均满足 WCAG AA；眉标使用 `--primary-accessible`（#b8000c）已达标；
- ESC / 遮罩点击 / X / 文字链接四途径可关闭（现状已满足）。

### 3.4 被否决的备选方案

| 方案 | 否决理由 |
|------|----------|
| B：左图右文分栏（桌面 640px+ 宽） | 需要横版且主体居中的图，运营上传竖图/方图时布局崩坏；宽弹窗遮挡感更强。对「最多同时 1 个活动」的小规模场景性价比低 |
| C：全屏 takeover / 视频背景弹窗 | 打断感过强，与「小而美、克制」哲学冲突；且需新增视频字段，超出视觉层范围 |
| D：倒计时 / 装饰彩带 / 多步表单 | 典型过度设计；本系统弹窗只承载「告知 + 跳转」单一职责 |

---

## 4. 实施改动清单

### 4.1 `apps/web/src/components/marketing/MarketingPopupDialog.tsx`（A2，主体改动）

1. 重写 JSX 结构：头图区（含 top-scrim）/ 无图深色 banner 兜底 / 眉标 + `rb-h3` 标题 / 正文 / `RbButton` CTA + 文字链接关闭；
2. 眉标文案：`useTranslations('content.categories.tradeShows.types')` —— **需要 API 白名单补一个 `eventType` 键**（已核查：`eventType` 不在 `INTERNAL_KEYS` 内、公开列表本就返回且可作过滤参数，无泄露风险）。同步改动三处：`MARKETING_SELECT` +1 键、web `MarketingActivity` 类型 +1 字段、**`trade-shows.service.spec.ts` 的白名单键集合断言**（该测试断言了 keys 全集，漏改必挂 CI）；若不想动 API，可退化为固定文案眉标（如「活动邀请」i18n key），评审时二选一；
3. 响应式：按 §3.2 首选路径，触发时 `matchMedia` 判定渲染 Dialog（桌面）或 Sheet `side="bottom"`（移动）；
4. `RbButton` 复用 `apps/web/src/components/ui/index.tsx` 现有导出（支持 `onClick`，无需改造）。

### 4.2 `packages/ui` Dialog（A2 职权内小改，知会 A1 即可）

- 按 AGENTS.md 所有权矩阵，`packages/ui/src/**` 所有者为 A2（仅新增/删除组件需 A1 知悉），给现有组件加可选 prop 属 A2 职权；且 `DialogContent` 已有 `overlayClassName` 同款透传先例，模式一致。
- `DialogContent` 新增可选 `closeClassName?: string`，透传给内置右上角 `DialogPrimitive.Close`（默认值不变，存量调用零影响）。用于图上白色 X / 白底深色 X 的两态切换。
- 若评审不通过：退化方案为头图 top-scrim 加深（black/50），默认深色 X 在 scrim 上依然可辨，可不改 ui 包。

### 4.3 文案（T7 已有基础，最多 +1 key）

- 若采用固定眉标文案：`marketing.eyebrow` 三语（「限时活动 / 限時活動 / Special Event」）；采用 eventType 眉标则无需新增。

### 4.4 明确不改

- 薄壳 `MarketingPopup.tsx`（fetch/过滤/触发逻辑）、`frequency.ts`、`events.ts`、API、admin、数据库——全部不动；
- 曝光/点击埋点时机不动（渲染体挂载计 view、CTA 计 click）。

---

## 5. 验收清单

- [ ] 有图：头图通栏 16:9，X 在图上清晰可见，眉标/标题/CTA 与站内 section 视觉同源
- [ ] 无图：深色 banner + 白字标题 + 红眉标，无「白板感」
- [ ] CTA 是唯一强视觉按钮，悬停箭头穿越动画正常；「关闭」为低权重文字链接
- [ ] 桌面居中卡片 / 移动端底部抽屉（≤60vh、全宽 CTA、自底滑入）两形态正确切换
- [ ] `prefers-reduced-motion` 下无动画；ESC/遮罩/X/文字链接四途径可关闭；初始焦点在关闭链接
- [ ] 正文超长时仅正文段内部滚动，**右上 X 与 CTA 区常驻可见**；容器不超过 70vh（桌面）/60vh（移动）
- [ ] 三语（zh-CN/zh-TW/en）文案完整；`turbo typecheck/lint/build` 全绿
- [ ] 既有单测不受影响；若走 eventType 眉标路线，service spec 的白名单键断言已同步更新
- [ ] 结构重写后 view/click 埋点仍各只触发一次（挂载 effect 依赖勿动）

## 6. 工作量预估

| 项 | 预估 |
|----|------|
| MarketingPopupDialog 重写（三段式结构 + 无图兜底 + Dialog/Sheet 双形态） | 3h |
| ui 包 closeClassName（含存量回归确认） | 0.5h |
| （可选）MARKETING_SELECT + 类型 + spec 断言 +eventType | 0.5h |
| 三端目视验收（桌面/移动/无图/长文/三语） | 1h |
| **合计** | **~5h** |

## 7. 评估期无法验证、留待实施期确认的事项

1. Sheet `side="bottom"` 在弹窗场景下的初始焦点/焦点圈行为与 Dialog 是否一致（原语相同，预期一致，需实测）；
2. 若走退化路径：`max-sm:` 变体与 tw-animate-css CSS 变量的级联顺序（Tailwind v4 排序），必须真机/浏览器实测；
3. 头图 top-scrim `from-black/40` 在浅色图片上的 X 对比度，目视微调浓度；
4. 工业风整体观感的最终目视验收（无自动化手段）。
