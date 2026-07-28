# B1 迁移核对表 — Radix → Base UI

> 依据：`admin-ui-polish-plan.md` Phase B1（v4.5）。本表为执行期核对清单，迁移完成后归档。
> 底座目标：`@base-ui-components/react`（当前 latest：1.0.0-rc.0），组件结构对齐新版 shadcn（base-nova 风格）。

## 前置状态（已完成）

- [x] 基线截图：25 个核心页面，`apps/admin/scripts/visual-regression.mjs capture baseline`
  - 对比管线已自校验：同环境二次抓取 24/25 页差异 0.000%~0.292%；`audit-logs` 页有固有噪声（每次登录产生新审计记录，约 1%），对比超阈值时人工核对 diff 图即可
- [x] `asChild` 调用点实测：admin 75 + web 15 + ui 26 = **116 处**（Phase A 仪表盘重写削去 2 处）
- [x] Radix 依赖盘点：16 个 `@radix-ui/*` 包、19 个组件文件（见下表）

## 迁移约束（硬性）

1. **`asChild` 兼容层**：包装层保留 `asChild` prop，内部转 Base UI 的 `render` prop；业务侧 API 不变，双端零改造；兼容层为长期 API，不拆除。
2. **冻结窗口**：迁移期间 `@tzj/ui` 不接受其他改动；admin 页面 UI 层功能改动排队至对应组件迁移完成。
3. **不留双底座**：单组件迁移完成即删除对应 `@radix-ui/*` 依赖；全部完成后 `package.json` 中不残留任何 Radix 包。
4. **每批组件迁移后**：`capture current` + `compare`，差异超阈值需人工确认或修复后才进入下一批。
5. **web 端令牌桥接**：迁移引用的新刻度（`shadow-xs`、`ring-[3px] ring-ring/50` 等）需在 web 的 globals.css 同步补齐变量定义，不能只靠回归发现。

## 一、需换底座（19 个）

### 第 1 批 — 简单原语（低风险，先行练手兼容层）✅ 已完成

| # | 组件 | Radix 包 | Base UI 对应 | 备注 |
|---|------|----------|--------------|------|
| 1 | ✅ separator | react-separator | `Separator` | 纯展示 |
| 2 | ✅ avatar | react-avatar | `Avatar` | Image/Fallback 结构一致 |
| 3 | ✅ label (form/Label) | react-label | 原生 `<label>` | Base UI 无独立 Label |
| 4 | ✅ switch | react-switch | `Switch` | `data-checked`/`data-unchecked` 替代 `data-state` |
| 5 | ✅ slider | react-slider | `Slider` | 包装层锁定 `number[]` API + `onValueCommit` 名称；Track 不能 overflow-hidden |
| 6 | ✅ collapsible | react-collapsible | `Collapsible` | Content→Panel；integrations 页选择器同步为 `data-panel-open` |
| 7 | ✅ button | react-slot | 自研 `lib/slot.tsx` | 兼容层落地：`Slot` + `composeRefs` + `toRenderProps`；RSC 下 ref 仅在存在时注入 |
| 8 | ✅ breadcrumb | react-slot | 同上 | 复用 lib/slot |

验收（2026-07-28）：视觉对比 25 页全过（dashboard 0.000%，audit-logs 1.336% 为已知噪声）；ui/admin/web typecheck 通过；biome 干净；admin 生产 build 通过；浏览器实测 Collapsible/Switch/Slider 交互正常、控制台 0 error。7 个 Radix 包已卸载（Sidebar 的 Slot import 已预切至 lib/slot）。

### 第 2 批 — 浮层类（Portal/定位/焦点管理差异点集中）

| # | 组件 | Radix 包 | Base UI 对应 | 备注 |
|---|------|----------|--------------|------|
| 9 | ✅ tooltip | react-tooltip | `Tooltip` | Provider 的 delayDuration 映射为 delay |
| 10 | ✅ popover | react-popover | `Popover` | Positioner 新增层级；onOpenAutoFocus→Popup 的 initialFocus；PopoverAnchor 移除（零消费者） |
| 11 | ✅ hover-card | react-hover-card | `PreviewCard` | openDelay/closeDelay 经 context 桥接到 Trigger |
| 12 | ✅ dropdown-menu | react-dropdown-menu | `Menu` | Content→Popup、Sub→SubmenuRoot；Item 补 asChild/disabled 透传；Label 用原生 div |
| 13 | ✅ select | react-select | `Select` | rc.0 的 Value 无 placeholder：wrapper 渲染期收集 SelectItem 的 value→label 传 items + context 还原 placeholder，25 处调用零改造 |
| 14 | ✅ scroll-area | react-scroll-area | `ScrollArea` | viewport 标记改为 `data-slot="scroll-area-viewport"`，4 个业务泄漏点同步（ChatArea/ChatWidget/Sidebar/ContentListToolbar 的 --radix-* 变量与选择器） |
| 15 | ✅ tabs | react-tabs | `Tabs` | Trigger/Content→Tab/Panel；data-state=active→data-active |

验收（2026-07-28）：视觉对比 25 页 24 过（visitors 1.796% 为实时访客数据漂移，非样式回归）；ui/admin/web typecheck 通过；biome 改动文件干净（date-range-picker 一处 a11y 报错为存量代码）；浏览器实测 Select 选值/中文 label、DropdownMenu、Tabs 切换、Tooltip（键盘焦点）、HoverCard、ScrollArea 正常、控制台 0 error；admin 生产 build 通过。7 个 Radix 浮层包已卸载（仅剩 dialog/alert-dialog 待第 3 批）。

### 第 3 批 — 对话框族（共享 Dialog 底座）

| # | 组件 | Radix 包 | Base UI 对应 | 备注 |
|---|------|----------|--------------|------|
| 16 | ✅ dialog | react-dialog | `Dialog` | Overlay→Backdrop（无 Positioner）；Content 级 `onEscapeKeyDown`/`onPointerDownOutside`/`onInteractOutside` 经兼容层桥接到 Root `onOpenChange(open, details)` 的 reason + `cancel()`（DismissContext + registry，Dialog.tsx 内部 API，不经 barrel 公开）；simple-dialog/confirm-dialog/image-preview 零改造回归 |
| 17 | ✅ alert-dialog | react-alert-dialog | `AlertDialog` | Base UI 无 Action/Cancel 部件，均映射 `Close` + buttonVariants 样式；Root 语义自带禁点外关闭 |
| 18 | ✅ sheet | react-dialog | `Dialog`（侧滑变体） | 直接复用 Dialog.tsx 的 Root（含 dismiss 兼容层）与 `useDismissGuards`；sheetVariants 保留，`data-state` 选择器改 `data-open`/`data-closed` |

验收（2026-07-28）：视觉对比 25 页 24 过（audit-logs 1.891% 查 diff 图确认为审计日志实时数据漂移，版式零漂移）；ui/admin/web typecheck 通过；biome 干净；admin 生产 build 通过；浏览器实测 Dialog（导入 CSV 弹窗：data-open/ESC 关闭/焦点回迁触发按钮）、Sheet（访客抽屉：right side/真实 ESC 关闭）、**LIFO 双层栈**（抽屉+转化弹窗：第一次 ESC 只关弹窗、抽屉保持——兼容层 `onEscapeKeyDown`→`cancel()` 生效；第二次 ESC 关抽屉）、AlertDialog（媒体库「移入回收站」：role=alertdialog/data-open/取消关闭）全部通过，控制台 0 error。最后 2 个 Radix 包已卸载，**packages/ui 已零 Radix 依赖**。注意：Base UI 的 escape 处理只响应真实按键（合成 KeyboardEvent 无效）；后台标签页 rAF 冻结会挂起退出动画卸载（环境现象，非 bug）。

### 第 4 批 — 复合组件（难点，方案点名）

| # | 组件 | 依赖 | 备注 |
|---|------|------|------|
| 19 | ✅ sidebar | react-slot + 内部消费 Sheet/Tooltip | 源码已无 Radix import（Slot 第 1 批预切、Sheet/Tooltip 第 2/3 批换底）；本批修复 Radix 时代 Trigger 选择器残留：`data-[state=open]`→`data-[popup-open]`（ui Sidebar.tsx ×2 + admin Sidebar.tsx ×1，Base UI Trigger 挂 `data-popup-open` 存在型属性）；附带清理 2 个未使用 import（biome error） |
| ✅ | data-table | 消费 dropdown-menu/select 等 | 无直接 Radix 依赖；`data-[state=selected]` 为业务自设属性（非 Radix）保留；随依赖回归通过 |
| ✅ | calendar / date-picker 族 | react-day-picker + popover | popover 换底后回归通过（audit-logs/analytics 页视觉零漂移） |
| ✅ | form | 消费 Label | Label 已为原生 `<label>`，回归通过 |

验收（2026-07-28）：全仓扫描 `data-\[state=`/`--radix-`/Radix 专有 props（forceMount/onOpenAutoFocus 等）零残留（保留项均为 sidebar/table 自有属性）；ui/admin/web typecheck 通过；biome 0 error（余 3 条存量 warning：document.cookie/hook 依赖）；视觉对比 25 页 24 过（audit-logs 1.027% 查 diff 图确认为审计日志数据漂移）；浏览器实测折叠/展开切换 + cookie 持久化正常，`data-popup-open` 样式规则验证生效（bg/text 正确切换；菜单打开交互第 2 批已实测）；控制台 0 error；admin 生产 build 通过。

## 二、纯样式对齐（28 个，无底座变更）✅

alert / audio-player / badge / card / confirm-dialog / content-list / data-table / date-picker / date-range-picker / date-time-picker / empty-state / image-preview / input / key-value-list / list-toolbar / loading / markdown / page-header / pagination / simple-dialog / skeleton / spinner / string-list / table / tag / textarea / toast / calendar

对齐项：Card 新结构 + `CardAction` 插槽、`data-slot` 属性、focus `ring-[3px] ring-ring/50`、`shadow-xs/sm` 新刻度、container query。

验收（2026-07-28）：
- **组件库侧**：Card 重写为新结构（`py-6 gap-6` + CardHeader grid + `CardAction` 插槽 + `@container/card-header` + `[.border-b]:pb-6` / `[.border-t]:pt-6`），导出 `CardAction`；Button/Input/Textarea/Badge/Select/Switch/Tabs/Calendar/Slider/TagsInput 焦点环统一 `ring-[3px] ring-ring/50`、阴影对齐 `shadow-xs/sm` 新刻度；Table 全家/Skeleton/Alert/Button/Badge/Input/Textarea 补 `data-slot`。
- **页面补丁清扫（admin 20+ 文件）**：CardHeader `pb-2/pb-3/pb-4`、CardContent `pt-6/p-6/pt-0`、`space-y-0` 补丁全部删除，统一 24px 节奏；手写双栏 header（`flex flex-row justify-between`）×10 处改用 `CardAction` 插槽；冗余 `shadow-sm` 全删（Card 基类已带）；flush 列表卡补 `pb-0`、KPI/工具条小卡补 `py-0`。
- **新模型陷阱修复**：`py-0` 多子元素卡（MediaCard、DocFolderSidebar）补 `gap-0` 消除 gap-6 空隙；贴底深色 footer 卡（settings-site ×5、settings-chat ×3、WatermarkSettingsCard）Card 补 `pb-0` + footer `py-4`→`pt-4! pb-4` 对抗 `[.border-t]:pt-6` 双 class specificity；DocFolderSidebar 紧凑 header 用 `pb-3!` 对抗 `[.border-b]:pb-6`。
- **验证**：三包 typecheck + admin/web 生产 build 通过；biome 新增诊断 0（报错均为存量且不在本次 diff 行内）；视觉回归 25 页：15 过、10 页超阈但逐页人工确认均为有意变化（补丁删除后间距 8/12/16→24px 统一位移、CardAction 布局回流、实时数据噪声），media/customers 修复后归零。
- **遗留**：`border-border/80` 补丁保留（约 15 处），留待 B2 品牌令牌层统一调整边框色后消除。

## 完成标准

- [x] `grep -rn "@radix-ui" packages/ui` 零命中（2026-07-28 第 3 批后达成，含重新构建的 dist）
- [x] admin + web 双端 `typecheck` 通过（2026-07-28 第 4 批后复验）
- [x] `visual-regression.mjs compare` 全部页面差异在预期内（4 批均 24~25/25 过，唯一超阈页为 audit-logs/visitors 实时数据漂移，diff 图逐次人工确认）
- [x] 业务侧 `asChild` 调用点零改造（admin 75 + web 15 不变；ui 内部因兼容层实现新增定义/转发属予期）
- [x] 页面层历史补丁（`pb-4 space-y-0` 等）随迁移消除（2026-07-28「二、纯样式对齐」完成；`border-border/80` 例外保留，待 B2 令牌层处理）
