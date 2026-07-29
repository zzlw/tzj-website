# 客服未读口径拆分与全局消息通知 — 技术方案

> 状态：已评审通过（v3.1，2026-07-28）—— 三轮评审闭环，可按 §6 实施拆分开工；本文档只做方案设计，不含代码变更
> 修订：v2 —— 按用户决策，全系 Toast 从 sonner 迁移至 shadcn base-ui Toast（见 §4.4 / S0）
> 修订：v3 —— 评审补缺：① `useChatSocket` 事件多播前置改造（§4.2.0，S2 硬前置）；② 新建房间坐席入房（§4.1.4，否则新询盘漏 toast）；另修正 base-ui upsert 表述、client 分支返回结构、Notification 授权时机等次要项
> 修订：v3.1 —— 复评残留小项：节流时间戳口径澄清（toast per-room / 提示音全局，二者分开维护）、§4.1.4 补 fetchSockets 频率实施提示、UAT 编号重排
> 关联文档：`chat-architecture-analysis.md`、`chat-support-evaluation.md`、`chat-code-audit-4-items.md`

---

## 1. 背景与问题

坐席端（Admin『在线客服』）当前存在两个体验缺陷：

| # | 问题 | 表现 |
|---|------|------|
| P1 | 未读总数不分归属 | 顶栏未读徽标把「分配给我的会话」和「分配给其他坐席的会话」的未读混在一起，数字对当前坐席没有行动指导意义 |
| P2 | 缺少全局消息通知 | 未读徽标只存在于 `/chat` 页面内部；坐席在后台其他页面时，新消息既无 toast、无侧边栏徽标、也无声音，完全无感知 |

## 2. 现状分析（代码事实）

### 2.1 未读计数链路

```
chat.gateway.ts getCountsFor(key, 'agent', email)
  └─ chatRoomService.getNotificationCounts(undefined, 'agent')   ← email 被丢弃
       └─ 统计所有 active/waiting 会话中 sender='client' 且无
          readReceipt(userType='agent') 的消息条数 → totalUnread
```

根因（`apps/api/src/support/chat-room.service.ts` `getNotificationCounts`）：

1. **坐席维度缺失**：对 agent 调用时 `userEmail` 传 `undefined`，查询完全没用 `chatRoom.assignedAgentEmail` 过滤——所有坐席看到同一个全局未读总数。
2. **已读回执按 userType 键控**：`readReceipts: { none: { userType: 'agent' } }`，即一名坐席已读 = 全员已读。这在「未读只按归属人计算」的新口径下反而是合理简化（我的会话只有我处理），无需改动。

### 2.2 通知链路

- `notification-counts` / `notification-counts-updated` 事件：仅 `ChatMessenger`（/chat 页）消费，驱动会话列表顶栏徽标；`ChatPresenceProvider`（dashboard layout 级全局 socket）不监听任何计数/消息事件。
- `new-message` 事件：gateway 只 `to(roomId)` 发送，但坐席连接时 `joinAgentToActiveRooms()` 会自动加入全部 active/waiting 房间（≤100），**因此全局层收得到「连接时已存在」会话的新消息**——这是前端做全局 toast 的关键前提，无需后端新增事件。⚠️ 但该前提**不覆盖连接后新建的会话**：gateway 没有任何「新房间创建时把在线坐席 join 进去」的逻辑，新访客发起的会话（最重要的新询盘场景）坐席收不到 `new-message`，须由 §4.1.4 补齐。
- ⚠️ `useChatSocket` 封装是**每事件单 handler**：`on` 为赋值覆盖、`off(event)` 调用不带回调的 socket.io `off`（清除该事件**全部**监听器）。ChatMessenger 卸载时 `off('new-message')` 等清理会连带杀掉任何全局监听——全局通知层落地前必须先做 §4.2.0 多播改造。
- Sidebar『在线客服』菜单项无任何未读标记；全站无消息类 toast。

### 2.3 现有 Toast 基建

- `@tzj/ui` 当前 toast 基于 **sonner 2.x** 封装：`packages/ui/src/components/toast/`（`Sonner.tsx` + `toast.ts`），对外导出 `Toaster` / `toast` / `ToastOptions`；admin 根 layout 挂 `<AppToaster>`（`position="top-center"`）。
- 调用面收敛度很高：**直接 import `toast` 的只有 2 个文件**（`ChatMessenger.tsx` 14 处、`lib/notify.ts` 2 处）；其余 38 个文件全部走 `notifyError/notifySuccess` 包装。全仓只用到 `toast.success/error/info/warning` 四个方法（`message/dismiss/loading` 已导出但无调用方）。web 端无任何 toast 使用。
- **sonner 是 @tzj/ui 里唯一的 toast 孤岛**：Dialog/Tooltip/Popover/DropdownMenu 等 10+ 组件均已基于 `@base-ui-components/react`（1.0.0-rc.0，**该版本已内置 `toast` 子包与 `createToastManager`**）。

## 3. 目标与非目标

**目标**

- G1 坐席未读总数 = 「分配给我的会话未读」+「待认领（waiting 且未分配）会话未读」；他人负责的会话不计入（Intercom/Zendesk 同款口径）。
- G2 坐席在后台任意页面都能感知新消息：toast 卡片（访客名 + 摘要 + 点击跳转）+ Sidebar 未读徽标 + 可选提示音 + 可选浏览器系统通知。
- G3 **全系 Toast 迁移到 shadcn base-ui Toast**（https://ui.shadcn.com/docs/components/base/toast ）：`@tzj/ui` 的 toast 内核从 sonner 替换为 `@base-ui-components/react/toast`，与包内其余 base-ui 组件统一体系；迁移完成后**移除 sonner 依赖**。零新增依赖（base-ui 已在 `packages/ui` 依赖中且含 Toast）。

**非目标**

- 不改 C 端（访客侧）未读逻辑与事件契约。
- 不改 readReceipts 数据模型（按 userType 键控保持不变）。
- 不做通知偏好设置页（免打扰时段、按会话静音等），留待后续。

## 4. 方案设计

### 4.1 后端：未读口径拆分（A 方案）

#### 4.1.1 `getNotificationCounts` 改造（chat-room.service.ts）

签名不变，坐席分支利用传入的 `userEmail` 拆桶：

```ts
// 返回结构扩展（坐席端新增三个字段，client 端不变）
{
  totalUnread: number;        // 语义变更（仅 agent）：= myUnread + unassignedUnread
  myUnread: number;           // assignedAgentEmail === userEmail 的会话未读合计
  unassignedUnread: number;   // status='waiting' 且 assignedAgentEmail 为空的会话未读合计
  othersUnread: number;       // 分配给其他坐席的会话未读合计（仅供列表弱化展示，不进主徽标）
  roomCounts: Array<{
    roomId; unreadCount; clientEmail; status;
    assignedAgentEmail: string | null;   // 新增：前端归属判断依据
  }>;
}
```

实现要点：

- 查询增加 `select: { assignedAgentEmail: true }`，循环内按 `assignedAgentEmail` 与 `userEmail` 对比分桶；SQL 查询次数不变（仍是单次 findMany + 关系计数）。
- `roomCounts` 继续返回**全部**房间（含 unread=0 与他人房间），保持「前端能重置已清空徽标」的既有约定。
- client 分支行为完全不变，**新字段一律不返回**（事件类型中定义为可选字段，前端按 `undefined` 兜底），避免联合类型分支膨胀。

#### 4.1.2 gateway 传参修复（chat.gateway.ts）

```ts
// getCountsFor 现状：agent 时 email 传 undefined —— 改为始终透传
return this.chatRoomService.getNotificationCounts(email, userType);
```

`broadcastNotificationCounts` 按用户逐个计算的既有循环不变，天然支持每个坐席拿到自己的口径。日志行补充 `my=/pool=/others=` 三段计数便于排查。

#### 4.1.3 兼容性

- `totalUnread` 字段名不变，但坐席端语义收窄为「可行动未读」。唯一消费方是 Admin `ChatMessenger`，同步升级（见 4.2），无第三方消费者。
- C 端 `notification-counts` payload 不变（client 分支未动）。

#### 4.1.4 新建/复活房间的坐席入房（评审补缺，P1）

`joinAgentToActiveRooms` 仅在坐席连接时执行一次，**连接后新建的会话坐席 socket 不在房间内**，收不到该会话的 `new-message`——恰是「新访客询盘」这一最需要通知的场景（UAT 2 按 v2 设计无法通过）。补齐方式：

- 挂点选 `handleJoinRoom` 的 **client 分支**：访客要聊天必先 `join-room`，此时 gateway `fetchSockets()` 按 `userType === 'agent'` 过滤，将全部在线坐席 socket 一并 `join(roomId)`（socket.io 重复 join 幂等，无需去重判断），与 `joinAgentToActiveRooms` 形成对称闭环。
- 实施提示：访客每次 `join-room`（含刷新、重连）都会触发一次全量 `fetchSockets()`，当前坐席/连接规模下开销可忽略（gateway 内 `enrichRoomsWithPresence` 已有同量级用法），但**不得在此路径叠加额外的循环查询或 DB 访问**；若未来连接规模增长，优先演进为 `agents` 频道而非在此处优化。
- 该修复保证 §2.2 前提对新建/归档复活房间同样成立；`agents` 频道统一广播（彻底消解 100 上限）仍留作后续演进，本期不做。

### 4.2 前端：全局通知层（A 方案）

#### 4.2.0 前置改造：`useChatSocket` 事件多播（评审补缺，P0，S2 硬前置）

现状 `on/off` 为单 handler 语义（`handlersRef.current[event] = cb` 赋值覆盖；`off(event)` 不带回调，socket.io 会移除该事件全部监听器）。若不改造，**坐席进过一次 /chat 再离开，ChatMessenger 卸载清理会连带清除 Bridge 的 `new-message` / `notification-counts(-updated)` 监听**——全局通知在最常见路径下静默失效；重连补挂（handlersRef 遍历）也只保留最后注册方。改造要求：

- `handlersRef` 改为 `Map<event, Set<cb>>`；`on(event, cb)` 追加并返回 unsubscribe 函数；`off(event, cb)` 按回调精确移除（`socketRef.current?.off(event, cb)`），保留 `off(event)` 全清仅供内部使用。
- 重连补挂遍历 Set 全量重新注册；`ChatAgentEventMap` 类型不变。
- ChatMessenger 现有 `socket.on/off` 调用同步改为持回调引用的精确移除（机械替换，无逻辑变化）。

#### 4.2.1 新增 `ChatNotificationsBridge`（挂在 ChatPresenceProvider 内部）

不动 `ChatPresenceProvider` 的连接/presence 职责，在其 children 内挂一个无 UI 的桥接组件，职责：

1. **监听 `notification-counts` / `notification-counts-updated`** → 把 `myUnread + unassignedUnread` 写入新的 context 字段 `actionableUnread`，供 Sidebar 徽标消费。初值无需主动拉取——`useChatSocket` 在 connect 回调里已自动 `emit('get-notification-counts')`，Bridge 只需保证监听注册早于连接建立（挂载即注册即可）。
2. **监听 `new-message`** → 按规则弹 toast（见 4.2.3 抑制规则）。
3. **提示音 / 浏览器通知**（见 4.2.5 / 4.2.6）。

Context 扩展：

```ts
interface ChatPresenceContextValue {
  // ...现有字段
  actionableUnread: number;   // 我的 + 待认领
}
```

#### 4.2.2 Toast 卡片（base-ui 自定义 data 渲染）

基于迁移后的 base-ui Toast（见 4.4），用官方推荐的 **custom data** 模式实现聊天消息卡片：

- 调用侧：`toast.chatMessage({ roomId, clientName, snippet, ... })` → 内部 `toastManager.add({ id: 'chat-msg-<roomId>', data: ChatToastData, timeout: 5000 })`。
- 渲染侧：`Toaster` 的 ToastList 内用类型守卫 `isChatToast(t)` 分支渲染 `ChatMessageToast` 卡片（访客名 + 消息摘要截断 60 字符（附件显示『[图片]/[文件]』）+ 相对时间 + 点击跳转 `/chat?room=<roomId>` 并 `toastManager.close(id)` + `<Toast.Close>` 关闭按钮）。
- 同会话合并：base-ui manager 的 `add` / `update` 为**分离 API**（不假设同 id `add` 即 upsert），适配层 `toast.chatMessage` 内部实现为「同 `chat-msg-<roomId>` id 已存在 → `toastManager.update`（计数递增，显示『N 条新消息』），否则 `add`」——同 roomId 新消息更新同一张卡片，避免轰炸。
- 位置跟随全局 Toaster viewport（bottom-right，2026-07-29 按用户决策从 top-center 调整，对齐桌面端后台业内惯例）。

#### 4.2.3 弹出/抑制规则（核心）

按顺序判断，命中任一条则**不弹**：

| # | 条件 | 理由 |
|---|------|------|
| 1 | `message.sender !== 'client'` | 坐席/系统消息不通知 |
| 2 | 会话归属他人（`assignedAgentEmail` 存在且 ≠ 我） | 与未读口径一致，别人的会话不打扰 |
| 3 | 当前在 `/chat` 页且该会话正被选中且页面可见 | 用户正在看，聊天区自身有实时渲染 |
| 4 | 同会话 3 秒内已弹过（**per-room 时间戳 Map** 节流窗口） | 防高频轰炸（toast 合并之外的兜底） |

补充：判断「归属」所需的 `assignedAgentEmail` 直接取自 `new-message` payload 的 `room` 字段（gateway 已携带）；「当前选中会话」通过 URL `?room=` 参数判断（chat 页已用 `replaceState` 同步，见编码规范），避免跨组件引用 ChatMessenger 内部 state。

#### 4.2.4 Sidebar 未读徽标

- `Sidebar.tsx`『在线客服』菜单项右侧渲染数字徽标（`actionableUnread`，>99 显示 `99+`；0 时隐藏）。
- 样式复用会话列表顶栏徽标的既有类（`bg-primary text-primary-foreground rounded-full ...`），收起态显示红点（遵循「红点=未读」既有语义规范）。
- `Sidebar.tsx` 已是 `'use client'` 且位于 `ChatPresenceProvider` 内部（layout → Provider → DashboardShell），可直接消费 context；仍抽一个 `ChatNavBadge` 小组件承接 `useChatPresence`，把未读变化引发的重渲染隔离在徽标节点内。

#### 4.2.5 提示音

- 资源：新增一段短提示音（≤1s，webm/mp3 双源，放 `apps/admin/public/sounds/`）。
- 播放实现：`new Audio()` 即可（一次性短音效不必引入 `react-use-audio-player` 的 hook 生命周期）；音量 0.5。
- 播放条件：与 toast 相同的抑制规则，且额外遵守**浏览器自动播放策略**——首次用户交互前播放失败时静默吞掉（`play().catch(() => {})`）。
- 节流：全局 3 秒内最多播一次（**独立的全局单值时间戳**；toast 节流是 per-room Map，二者口径不同、分开维护，不共用）。

#### 4.2.6 浏览器系统通知（Notification API）

- 仅当 `document.visibilityState === 'hidden'`（标签页在后台）时触发，前台一律只用 toast，避免双重打扰。
- 授权策略：不在启动时索权；绑定**用户手势**——坐席在 /chat 页**首次点开会话**时若 `Notification.permission === 'default'` 才请求（手势上下文内索权可避免 Chrome quieter permission UI 把请求降级为地址栏小图标，授权率更高）。`denied` 则永久静默跳过。
- 通知体：标题=访客名，正文=摘要，`tag: roomId`（同会话自动替换不堆叠），点击 → `window.focus()` + 跳转会话。

### 4.3 ChatMessenger 适配

- 顶栏 `totalUnread` 徽标改用新语义（后端已收窄，前端逻辑基本不变）；现有防闪烁机制（`recentUnreadBumpRef`、`displayedTotalUnread` 非对称防抖、选中会话扣减）全部保留。
- 会话列表中**他人负责的会话**：per-room 未读徽标改为弱化样式（`bg-muted text-muted-foreground`），与主口径视觉区分（对应 `roomCounts[].assignedAgentEmail` 新字段）。
- `handleNotifCounts` 里「选中会话扣减」逻辑同步作用于 `myUnread`。

### 4.4 全系 Toast 迁移（sonner → base-ui Toast）

将 `@tzj/ui` 的 toast 内核整体替换为 shadcn base-ui Toast，对外 API 保持兼容，使全仓 40 处调用（notify.ts 包装的 38 文件 + ChatMessenger 14 处）**零改动**。

#### 4.4.1 包内结构（`packages/ui/src/components/toast/`）

| 文件 | 职责 |
|------|------|
| `manager.ts`（新增） | `export const toastManager = Toast.createToastManager()` —— 模块级单例，React 内外均可调用（官方 Global manager 模式） |
| `toast.ts`（重写） | 适配层：`toast.success/error/info/warning/message(title, options?)` → `toastManager.add({ title, description, type, timeout })`；默认时长维持 4000ms（error 5000ms）；`dismiss` → `toastManager.close`；新增 `toast.chatMessage(data)`（见 4.2.2）。`ToastOptions` 从 sonner `ExternalToast` 收窄为自定义 `{ description?: string; duration?: number }`（全仓实际使用面仅此两项） |
| `Toaster.tsx`（新增，替代 `Sonner.tsx`） | `'use client'`；`<Toast.Provider toastManager={toastManager}>` + `<Toast.Portal>` + `<Toast.Viewport>`（bottom-right，2026-07-29 调整）+ `ToastList`；样式以 shadcn CLI（`pnpm dlx shadcn@latest add toast`，base 注册表）产物为基准落位 Tailwind 类，适配本仓设计令牌（`bg-popover/text-popover-foreground/border-border` 等，与现 Sonner 样式对齐）；type 图标沿用现有 lucide 五件套（CircleCheck/Info/TriangleAlert/OctagonX/Loader2）；堆叠/位移动画用 base-ui 的 `--toast-index` / `--toast-offset-y` / `--toast-swipe-movement-*` CSS 变量实现 |
| `Sonner.tsx`（删除） | 迁移完成后移除，`packages/ui/package.json` 同步删除 `sonner` 依赖 |

导出面（`index.ts` L219）保持 `export { Toaster, type ToastOptions, toast }` 不变。

#### 4.4.2 调用方影响

- `lib/notify.ts`、`ChatMessenger.tsx` 及其余 38 个文件：**零改动**（API 签名兼容）。
- `AppToaster.tsx`：简化——base-ui Toast 无样式内核，颜色全部走设计令牌，随 `.dark` 类自动切换，不再需要 `theme={resolvedTheme}` 透传，可收敛为直接 `<Toaster />`。
- 能力对齐清单（验收项）：hover 暂停计时、swipe 手势关闭、F6 键盘聚焦 viewport、堆叠收起/展开、`aria-live` 播报 —— 均为 base-ui 内置行为，无需自实现。

#### 4.4.3 版本说明

仓内现有 `@base-ui-components/react@1.0.0-rc.0` 已内置完整 `toast` 子包（含 `createToastManager`），本次**不升版、不改包名**（官方 1.0 stable 已改名 `@base-ui/react`，整包 rename 涉及 10+ 组件 import，属于 A1 依赖治理范畴，另立专项）。

## 5. 数据流总览

```
访客发消息（新会话：访客 join-room 时在线坐席已被一并拉入房间，见 4.1.4）
  └─ gateway handleSendMessage
       ├─ server.to(roomId).emit('new-message', {message, room})   ← 坐席已 join 全部活跃房间
       │    └─ [Admin 全局] ChatNotificationsBridge（经 4.2.0 多播 socket，与 ChatMessenger 监听共存互不干扰）
       │         ├─ 抑制规则判定 → toast.chatMessage(ChatMessageToast 卡片) / 提示音 / 系统通知
       │         └─ （/chat 页内 ChatMessenger 照常消费，互不影响）
       └─ broadcastNotificationCounts()
            └─ 每坐席: getNotificationCounts(email,'agent')
                 └─ emit('notification-counts-updated', {totalUnread, myUnread, unassignedUnread, othersUnread, roomCounts})
                      ├─ [全局] Bridge → context.actionableUnread → Sidebar 徽标
                      └─ [/chat] ChatMessenger → 顶栏徽标 + per-room 徽标
```

## 6. 实施拆分

| 阶段 | 内容 | 涉及文件 |
|------|------|----------|
| S0 Toast 迁移 | 4.4 全部：base-ui 内核替换 + 移除 sonner + 既有调用全量回归 | `packages/ui/src/components/toast/*`、`packages/ui/package.json`、`AppToaster.tsx` |
| S1 后端 | 4.1 全部：service 拆桶 + gateway 传参 + 新房间坐席入房（4.1.4）+ 日志 | `chat-room.service.ts`、`chat.gateway.ts` |
| S2a socket 多播 | 4.2.0：`useChatSocket` on/off 多播改造 + ChatMessenger 调用点机械替换（S2b 硬前置） | `useChatSocket.ts`、`ChatMessenger.tsx` |
| S2b 前端全局 | Bridge + toast 卡片（依赖 S0 的 `toast.chatMessage`）+ Sidebar 徽标 | `ChatPresenceProvider.tsx`（context 扩展）、新增 `ChatNotificationsBridge.tsx`、`ChatMessageToast.tsx`、`Sidebar.tsx`（含 `ChatNavBadge`） |
| S3 前端聊天页 | ChatMessenger 语义适配 + 他人会话弱化徽标 | `ChatMessenger.tsx`、`ChatConversationList.tsx`、`useChatSocket.ts`（类型） |
| S4 增强 | 提示音 + 浏览器通知 | Bridge 内实现 + 音频资源 |
| S5 验证 | 见 §7 | — |

S0、S1、S2a 三者无互相依赖可并行；S2b 同时依赖 S0（chatMessage toast）、S1（拆桶字段 + 4.1.4 入房）与 S2a（多播 socket）；S1→S3 按序；S4 可与 S3 并行。建议 S0 单独提 PR 独立回归（§7 第 0 条）后再叠加 S2b，避免全系 toast 回归与聊天通知风险面耦合。

## 7. 测试计划

**后端（Jest）**

- `getNotificationCounts('a@x','agent')`：我的/待认领/他人三桶各有未读时，验证四个计数字段与 roomCounts 的 assignedAgentEmail。
- 已关闭/归档会话不计入任何桶（既有行为回归）。
- client 分支输出与改造前逐字段一致（快照）。
- `handleJoinRoom` client 分支：访客入房后，在线坐席 socket 均已在该房间（4.1.4，mock fetchSockets 验证 join 调用）。

**前端（手动 UAT，双坐席 + 访客三端）**

0. **Toast 迁移回归**：任意 CRUD 页触发保存成功/失败 → success/error toast 样式、时长、关闭按钮与迁移前一致；暗色模式下颜色正确；hover 暂停、swipe 关闭可用；ChatMessenger 回收站/批量操作的 info/warning toast 正常。

1. 访客给坐席 A 的会话发消息 → A 在 dashboard 首页收到 toast + Sidebar 徽标 +1；坐席 B 无 toast、徽标不变。
2. 新访客进入（waiting 未分配，**坐席连接后才建房**，验证 4.1.4）→ A、B 都收到 toast 且徽标各 +1。
3. A 正在 /chat 查看该会话 → 无 toast、无声音，消息直接上屏。
4. A 从 /chat 离开到仪表盘后访客再发消息 → toast/徽标仍正常（验证 4.2.0：ChatMessenger 卸载不影响 Bridge 监听）。
5. A 标签页切后台 → 收系统通知；点击通知回到对应会话。
6. 同会话连发 5 条 → 只有一张 toast 卡片，计数递增；提示音在任意 3 秒窗口内最多 1 次。
7. A 读完全部消息 → Sidebar 徽标清零；B 的『他人会话』弱化徽标同步清零（userType 键控回执）。

**卡口**：`pnpm check`（biome 0 error）+ 四包 typecheck + api 单测。

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| `totalUnread` 语义收窄影响未知消费方 | 全仓 grep 确认仅 ChatMessenger/ChatConversationList 消费；C 端事件不动 |
| 坐席房间 join 上限 100，超出的会话收不到 new-message | 新建房间入房缺口已由 4.1.4 修复；剩余风险仅为「活跃房间 >100 被截断」的尾部场景，不在本方案扩大；toast 漏报兜底靠 counts 广播驱动的徽标；后续可改为 gateway 维护 `agents` 频道统一广播 |
| Bridge 与 ChatMessenger 监听同一 socket 事件互踩 | 4.2.0 多播改造作为 S2b 硬前置；UAT 4 专项验证「离开 /chat 后全局通知仍存活」 |
| 转接瞬间归属变化导致误弹/漏弹 | 抑制规则以 `new-message` payload 内 room 快照为准，转接自身另有 `room-transferred-in` 事件（已有专门处理），不叠加 |
| 提示音被自动播放策略拦截 | `play().catch` 静默；不做 AudioContext 预热等侵入性规避 |
| 多标签页同开 admin 重复弹 toast | 接受（toast 每页独立）；系统通知用 `tag` 去重；后续可用 BroadcastChannel 选主，本期不做 |
| base-ui toast 处于 rc 版本，API 存在变动可能 | 适配层（`toast.ts`）隔离：全仓只依赖 `@tzj/ui` 导出面，升版/改包名时只改 toast 目录内部；仓内其余 10+ 组件早已绑定同一 rc 版本，风险无增量 |
| 迁移后样式/交互细节与 sonner 不一致（堆叠动画、richColors） | 以 shadcn base 模板为基准 + §7 第 0 条全量回归；既有调用面仅四类状态 toast，回归面可控 |
