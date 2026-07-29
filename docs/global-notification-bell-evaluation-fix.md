# 全局通知铃铛与弹层技术方案

> **适用前提**：小而美团队，后台用户数 ≤ 100 人，坐席常态个位数、并发未读会话常态 < 10
> **核心原则**：防止过度设计、保持简洁实用——一切容量/性能决策以上述规模为基准

## 1. 背景与目标

### 1.1 现状

- ✅ Toast 迁移完成（@tzj/ui base-ui 底座，右上角固定宽度卡片）
- ✅ 未读计数三桶拆分（myUnread/unassignedUnread/othersUnread），后端负载 `totalUnread = myUnread + unassignedUnread`（前端 Context 中对应字段名为 `actionableUnread`，二者同一口径）
- ✅ ChatNotificationsBridge 挂载于 layout（全局监听 new-message / notification-counts-updated），且**已内置 `openRoom` 双分支跳转**（页内自定义事件 + 跨页 router.push）
- ✅ `notification-counts(-updated)` socket 负载**已携带** `roomCounts`（roomId / unreadCount / clientEmail / status / assignedAgentEmail）—— 弹层列表数据源现成
- ❌ **缺少可见的通知入口**：Sidebar 徽标仅存在于 `/chat` 菜单项（ChatNavBadge），dashboard 首页或其他页面无法直接看到通知中心

### 1.2 目标

参考 `next-shadcn-dashboard-starter` 的"右上角铃铛图标 + 弹层"模式，实现：

1. **右上角铃铛图标**（DashboardShell 顶栏右侧工具栏内）：入口常驻全站
2. **未读徽章**：当 `actionableUnread > 0` 时显示红色角标（数字 + 99+ 截断，与 Sidebar ChatNavBadge 同款逻辑）；**权限门控**：无 `chat.view` 权限（且非 `*` 通配符）的账号不渲染铃铛——与 Sidebar「在线客服」菜单隐藏逻辑一致
3. **弹层（Popover）**：点击铃铛后弹出未读会话列表，支持：
   - 展示未读会话（待认领优先；`slice(0, 50)` 仅作安全截断，常态规模远达不到）
   - 点击跳转到对应会话（全站任意页面可用）
   - 一键全部已读

### 1.3 设计原则

- **零第三方依赖 + 零后端改动（MVP）**：复用 `@tzj/ui` Popover + 现有 socket 事件（`get-notification-counts` / `mark-messages-read`），不新增 REST 端点
- **最小改动**：`ChatPresenceContextValue` 不扩容，弹层挂载时直接订阅 socket 事件自取数据
- **主题合规**：仅使用语义 token（`bg-popover` / `hover:bg-accent` / `text-muted-foreground`），**禁止** `dark:` 前缀手写深色分支——admin 多主题机制（`:root` / `.dark` / `.theme-*` 运行时变量）自动适配
- **按实际规模设计**：不为「假想的大规模」预置分页、虚拟滚动、聚合端点等设施；做/不做边界见 §6

---

## 2. 方案设计

### 2.1 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│ DashboardShell (apps/admin/src/components/DashboardShell.tsx)│
│  header 右侧工具栏：<NotificationBell /> + ThemeSelector ...  │
│                                                              │
│  NotificationBell（新，自含 Popover）                         │
│   ├─ PopoverTrigger: <button> Bell + UnreadBadge             │
│   │    └─ badge 数据源：useChatPresence().actionableUnread   │
│   └─ PopoverContent: <NotificationPanel />                   │
│        ├─ 挂载时 socket.requestNotificationCounts()          │
│        ├─ socket.on('notification-counts' /                  │
│        │   'notification-counts-updated') → 渲染 roomCounts  │
│        ├─ 点击条目 → openRoom(roomId)（复用 Bridge 同源逻辑）    │
│        └─ 全部已读 → 逐房间 socket.markRead(roomId)          │
└──────────────────────────────────────────────────────────────┘
         ▲ consumes（不扩容 Context）
         ▼
┌──────────────────────────────────────────────────────────────┐
│ ChatPresenceProvider（现状保持）                              │
│  - actionableUnread: number（Badge 唯一数据源）              │
│  - socket: UseChatSocketResult（on 返回 unsubscribe）        │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 数据流（关键修正：socket 直取，不新增 REST）

#### 2.2.1 Context 保持轻量

`ChatPresenceContextValue` **不新增任何字段**。Badge 用已有 `actionableUnread`；弹层列表由 `NotificationPanel` 挂载时（Popover 打开才挂载 Content）通过 socket 自取：

```ts
// NotificationPanel 数据获取（伪代码）
const { socket } = useChatPresence();

useEffect(() => {
  // Popover 打开 → 主动拉一次全量计数（网关已有 get-notification-counts handler）
  socket.requestNotificationCounts();
  // 打开期间实时刷新（两个事件负载形状一致）
  const off1 = socket.on('notification-counts', handlePayload);
  const off2 = socket.on('notification-counts-updated', handlePayload);
  return () => { off1(); off2(); };
}, [socket]);
```

**放弃原 REST 方案的理由**：

- `notification-counts` 负载已含 `roomCounts: Array<{ roomId, unreadCount, clientEmail, status, assignedAgentEmail }>`，正是弹层所需全部字段，新增 `GET /unread-rooms` 属重复建设
- socket 订阅天然获得实时增量（原 REST 方案打开弹层后数据静止）
- 关闭 Popover 即卸载 Content、退订事件，无常驻监听负担

#### 2.2.2 列表口径与过滤

前端对 `roomCounts` 做与主徽标一致的口径过滤（他人会话不进弹层，与 `actionableUnread` 一致）：

```ts
// agentEmail 直接取自 useChatPresence().agentEmail（Context 已有字段，无需另查 session）
const actionable = roomCounts.filter(
  (r) =>
    r.unreadCount > 0 &&
    (!r.assignedAgentEmail || r.assignedAgentEmail === agentEmail),
);
// 排序：仅一条规则——待认领（未分配）置顶，其余保持服务端返回顺序；
// slice(0, 50) 作为安全截断（常态未读会话个位数，不做分页/加载更多）
```

> ⚠️ `roomCounts` 当前**不含时间戳**（无 lastActivity）。MVP 弹层**不显示时间**、不承诺"按时间倒序"；如需时间展示，后端 `getNotificationCounts` 的 roomCounts 增补 `lastActivity` 字段（小改动，见 S4）。

#### 2.2.3 全部已读

后端无 `mark-all-read` 聚合端点，现有能力为 per-room `mark-messages-read`（socket）。**已核实关键行为**：`socket.markRead(roomId)` 发送的报文不带 `messageIds`，此时 `markMessagesAsReadByUser` 会将该房间**全部对向未读消息**写入 `MessageReadReceipt` 回执并更新房间未读计数——即单次调用 = 整房间已读，「全部已读」循环方案成立。（勘误：V3 曾记「不存在 ReadReceipt 模型」，实际 `MessageReadReceipt` 逐消息回执模型存在；V2 原文错在把它当作需新建的表）

- **采用方案（零后端改动）**：前端遍历弹层内 actionable 房间，逐一 `socket.markRead(roomId)`；服务端每次 fire-and-forget `broadcastNotificationCounts`，最终计数收敛归零
  - 代价：N 个房间触发 N 次广播。按适用前提（未读会话常态 < 10、坐席个位数），量级完全无感
- **后端 `mark-all-read` 聚合端点：默认不做**。仅当实测出现「全部已读后角标收敛肉眼可见地慢（>1s）」才立项，避免为不存在的规模写代码

#### 2.2.4 跳转会话（已有现成机制，仅需抽出复用）

早期的 hash 跳转技巧已被重写：`ChatNotificationsBridge` 现已内置 `openRoom(roomId)` 双分支——

- **已在 `/chat` 页**：`replaceState` 同步 URL + 派发 `CHAT_OPEN_ROOM_EVENT` 自定义事件（ChatMessenger 已监听，避开 useSearchParams 不同步的坑）
- **其他页**：`router.push('/chat?room=xxx')`，ChatMessenger 挂载后经 `roomParam` 自动选中

铃铛弹层的跳转需求与 toast「查看」完全同构，**不新建跳转机制**：把 Bridge 内的 `openRoom` 回调抽为小 hook（如 `useOpenChatRoom()`，仍放 `features/chat/`），Bridge 与 NotificationPanel 共同消费。

---

### 2.3 组件拆分

| 组件/文件 | 位置 | 职责 |
|------|------|------|
| `NotificationBell` | `apps/admin/src/components/NotificationBell.tsx` | 自含 Popover：`<button>` 触发器（Bell 图标 + 未读角标）+ Content 挂载 Panel |
| `NotificationPanel` | `apps/admin/src/features/chat/components/NotificationPanel.tsx` | 弹层内容：socket 订阅、口径过滤、列表渲染、全部已读 |
| `useOpenChatRoom` | `apps/admin/src/features/chat/use-open-chat-room.ts` | 从 Bridge 抽出的跳转 hook（Bridge 与 Panel 共用，逻辑不变） |

说明：

- **不存在** `components/header/` 目录，也不存在独立 `Header.tsx`——顶栏内联于 `DashboardShell.tsx`，集成即在其右侧工具栏 `<div className="ml-auto ...">` 内、`ThemeSelector` 之前插入 `<NotificationBell />`
- Panel 归入 `features/chat/components/`（与 ChatHeader 等同级）：它强依赖 chat socket/类型，不是通用 header 组件
- Popover / Badge 从 **`@tzj/ui`** 导入（`@/components/ui/popover` 路径不存在）
- 触发器必须是原生 `<button>`（PopoverTrigger 参数为 `ComponentPropsWithoutRef<'button'>`）；原方案 `<PopoverTrigger asChild><BellIconComponent /></PopoverTrigger>` 包裹无 forwardRef 的 div 组件会失效
- **S2 示例代码外部依赖已逐项核实可编译**：`PopoverContent` 支持 `align="end"` prop（包装层透传给 base-ui Positioner）；其默认类含 `w-72 p-4`，但 `cn()` 基于 twMerge，`w-[360px] p-0` 覆盖有效；`lucide-react` 已在 admin 依赖中；`useSession()`（`@/components/session`）返回 `{ username, role, permissions }`，无 Provider 时回退 `permissions: []` → 铃铛安全默认隐藏，门控无 crash 风险
- 99+ 截断逻辑与 `Sidebar.tsx` 的 `ChatNavBadge` 一致（`actionableUnread > 99 ? '99+' : actionableUnread`），实现时可抽出共享小函数避免分叉

### 2.4 样式规范（语义 token，禁止 dark: 手写分支）

| 元素 | Tailwind 类名 | 说明 |
|------|--------------|------|
| 触发按钮 | `relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground` | 对齐顶栏 ThemeModeToggle 的按钮尺寸/形态 |
| Bell 图标 | `h-4.5 w-4.5`（或 `size-[18px]`） | 与顶栏其他图标视觉等重 |
| 角标 | `absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-medium text-destructive-foreground` | `bg-destructive` 语义色随主题；`min-w-4` 容纳 99+ |
| PopoverContent | `w-[360px] p-0` | @tzj/ui Popover 自带 popover 背景/边框/阴影 |
| 列表容器 | `max-h-[400px] overflow-y-auto` | 超长滚动 |
| 条目 | `flex cursor-pointer items-start gap-3 border-b border-border p-3 transition-colors last:border-0 hover:bg-accent` | 语义 token 自动适配明暗与 10 套主题 |
| 未读点 | `mt-1 h-2 w-2 shrink-0 rounded-full bg-primary` | 不用硬编码 `bg-blue-500` |

---

## 3. 实施步骤

### S1：抽出跳转 hook（纯搬运，不改逻辑）

**文件**：`apps/admin/src/features/chat/use-open-chat-room.ts`（新）

- 将 `ChatNotificationsBridge.tsx` 内现有的 `openRoom` useCallback（含 pathnameRef 技巧）原样搬入 `useOpenChatRoom()` hook，Bridge 改为消费该 hook；行为零变化，只为 Panel 提供第二个消费方
- `CHAT_OPEN_ROOM_EVENT` 常量可随 hook 一并迁移（ChatMessenger 的 import 同步更新）

### S2：NotificationBell（触发器 + 角标）

**文件**：`apps/admin/src/components/NotificationBell.tsx`

```tsx
'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@tzj/ui';
import { Bell } from 'lucide-react';
import { NotificationPanel } from '@/features/chat/components/NotificationPanel';
import { useChatPresence } from '@/features/chat/ChatPresenceProvider';
import { useSession } from '@/components/session';

export function NotificationBell() {
  // 权限门控：与 Sidebar 菜单过滤同源口径（chat.view 或 * 通配符），
  // 避免无权限用户看到一个点击后无法访问 /chat 的入口
  const { permissions } = useSession();
  const { actionableUnread } = useChatPresence();
  if (!permissions.includes('*') && !permissions.includes('chat.view')) return null;

  const displayCount = actionableUnread > 99 ? '99+' : actionableUnread;

  return (
    <Popover>
      <PopoverTrigger
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={actionableUnread > 0 ? `未读消息 ${actionableUnread} 条` : '消息通知'}
      >
        <Bell className="size-[18px]" />
        {actionableUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-medium text-destructive-foreground">
            {displayCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <NotificationPanel />
      </PopoverContent>
    </Popover>
  );
}
```

**集成**：`DashboardShell.tsx` 右侧工具栏（`ThemeSelector` 前）插入 `<NotificationBell />`。

> 层级已核实：`(dashboard)/layout.tsx` 中 `Providers`（含 session）→ `ChatPresenceProvider` → `ChatNotificationsBridge` → `DashboardShell`，`useChatPresence` / `useSession` 在铃铛内直接可用，无需上移任何 Provider。

### S3：NotificationPanel（弹层内容）

**文件**：`apps/admin/src/features/chat/components/NotificationPanel.tsx`

要点（完整代码实现时展开）：

```tsx
'use client';

// 1. 数据：挂载时 socket.requestNotificationCounts()；
//    订阅 'notification-counts' + 'notification-counts-updated'（on 返回 unsubscribe，卸载时清理）
// 2. 口径：过滤 unreadCount>0 且（未分配 或 分配给我）；待认领置顶；slice(0, 50) 安全截断
// 3. 状态：
//    - 首包未到 → 「加载中…」（socket 断连时展示「连接已断开，稍后重试」而非永久 loading）
//    - 空列表 → 「暂无新消息」
// 4. 条目：clientEmail（无 clientName 字段，roomCounts 口径）+ 「N 条新消息」+
//    未分配显示「待认领」芯片（对齐会话列表「未分配」措辞）；点击 → useOpenChatRoom()(roomId)
// 5. 全部已读：遍历 actionable 房间逐一 socket.markRead(roomId)；
//    按钮置 disabled 防重复点击，列表随后续 counts 广播自然清空（不手动 setItems([])）
// 6. 不渲染时间戳（roomCounts 无时间字段，不伪造 Date.now()）
```

注意事项：

- **不使用** `fetch('/api/chat/...')`——admin 所有 chat REST 必须走 BFF（`/api/bff/chat-rooms/...`，httpOnly cookie 鉴权），裸路径会 401 静默失败（历史踩坑，见 `features/chat/api.ts` 头注）；本方案 MVP 根本不需要 REST
- 文案硬编码中文与 admin 现状一致（现有 chat 模块均为直写中文），不引入 i18n key

### S4：后端小改（唯一值得考虑的一项，可与 MVP 同期或后补）

- **roomCounts 增补 `lastActivity`**：`chat-room.service.ts#getNotificationCounts` 的 roomCounts 元素加一个字段（room 数据现成，改动约几行），弹层即可显示相对时间。属「低成本、直接提升可用性」的改动，不算过度设计；但 MVP 不阻塞于它——先上无时间版本亦可
- 涉及 `apps/api/src/support/**`，按所有权矩阵由 A2 实施

---

## 4. 测试计划

### 4.1 自动化测试

- admin 前端**无单测基础设施**（package.json 无 test script），MVP 不写前端单测，以手动 UAT 覆盖
- 若实施 S4（roomCounts 增补 lastActivity），在现有 `chat-room-unread.spec.ts` 补一条字段断言即可，不新建 spec 文件

### 4.2 手动 UAT（7 条，覆盖真实使用路径）

1. **无未读**：角标隐藏 → 点击铃铛 → 弹层「暂无新消息」
2. **单会话未读**：角标 `1` → 弹层 1 条 → 点击跳转选中该会话（分别在 dashboard 页与 /chat 页内各验证一次——跨页 `router.push` 与页内 `CHAT_OPEN_ROOM_EVENT` 两条路径）
3. **多会话未读 + 全部已读**：角标 `5`（含 1 条待认领，应置顶）→「全部已读」→ 角标消失 + 列表随广播收敛清空（按钮期间 disabled）
4. **他人会话**：分配给其他坐席的未读不出现在弹层、不计入角标（与 Sidebar 徽标口径一致）
5. **实时性 + 断连**：弹层保持打开 → 访客发新消息 → 列表与角标实时刷新；停掉 API 再打开弹层 → 显示断连提示而非永久 loading
6. **主题回归**：明/暗模式 + theme-brand 预设下弹层配色正常（语义 token 自动适配，抽查即可）
7. **权限隔离**：无 `chat.view` 权限的账号登录 → 顶栏不渲染铃铛（与 Sidebar「在线客服」菜单隐藏一致）

> 不做「60 条未读截断」类边界用例——该规模在适用前提下不会出现，`slice(0, 50)` 属防御性一行代码，无需专项验证

---

## 5. 验收标准

- ✅ Biome check 0 error；TypeScript typecheck 通过（四包）
- ✅ 角标在 `actionableUnread > 0` 时正确显示（数字 + 99+ 截断，与 Sidebar 徽标一致）；无 `chat.view` 权限时铃铛不渲染
- ✅ 弹层打开即拉取、打开期间实时刷新；关闭后无残留 socket 监听（on 返回的 unsubscribe 全部执行）
- ✅ 点击条目在**任意页面**均能跳转并选中对应会话
- ✅ 「全部已读」后角标与弹层随广播收敛清零
- ✅ 断连提示 / 空态 / 加载态三种非正常态 UI 齐备
- ✅ 明暗模式 + 主题预设下无硬编码颜色穿帮（不出现 `dark:` 前缀类与 `bg-blue-500` 类硬编码）
- ✅ 无新增 REST 端点、无 Context 字段扩容（MVP 承诺）

---

## 6. 做 / 不做边界（YAGNI 清单）

**值得做（唯一）**

- **时间信息**：roomCounts 增补 `lastActivity` → 弹层显示相对时间（"3 分钟前"）。几行后端改动、直接可感知的可用性提升（S4）

**明确不做（除非前提变化）**

| 项 | 不做理由 |
|----|---------|
| 后端 `mark-all-read` 聚合端点 | 前端循环 markRead 在 <10 会话规模下无感；触发条件见 §2.2.3 |
| 分页 / 加载更多 / 虚拟滚动 | 未读会话常态个位数；`slice(0, 50)` 一行防御足够 |
| BroadcastChannel 多标签页同步 | socket 广播已天然多端同步（每标签页独立连接均收到 counts 广播） |
| 通知流化（已读历史 + 落库 + REST 分页） | 当前弹层本质是**未读会话入口**，不是通知中心；数据模型不引入伪 `isRead` 字段。若未来业务真需要「历史通知」再整体评估 |
| 前端单测基础设施 | 不为单个组件引入 vitest 全套配置；7 条 UAT 覆盖真实路径 |

---

**创建时间**: 2026-07-29
**修订时间**: 2026-07-29（V3: 对齐代码库实测——集成点改为 DashboardShell、socket roomCounts 直取替代新增 REST、修正 ReadReceipt/跳转/深色类名/asChild 误用、测试计划落地为 UAT）
**修订时间**: 2026-07-29（V4: 按「小而美 ≤100 人」前提去过度设计——排序收敛为单规则、mark-all-read 聚合端点降为默认不做、UAT 压缩、§6 改写为做/不做边界清单）
**修订时间**: 2026-07-29（V5: 核实 Provider 层级消除待验证项；补齐 chat.view 权限门控——铃铛与 Sidebar 菜单同源隐藏，避免无权限用户看到不可用入口）
**修订时间**: 2026-07-29（V6: 对齐 Bridge 演进后的代码现状——跳转机制已现成（openRoom 双分支 + CHAT_OPEN_ROOM_EVENT），S1 缩为抽 hook 纯搬运；纠正 MessageReadReceipt 模型存在性误判；核实 markRead 不带 messageIds = 整房间已读，全部已读方案可行性落实）
**修订时间**: 2026-07-29（V7: 终校勘误——澄清后端 totalUnread 与前端 actionableUnread 为同一口径的两个字段名；注明过滤用 agentEmail 来自 ChatPresenceProvider；§6 UAT 条数 6→7 与 §4.2 对齐。无方案性变更，文档定稿）
**修订时间**: 2026-07-29（V8: S2 示例代码可编译性终审——逐项核实 align prop / twMerge 覆盖 / lucide 依赖 / useSession 无 Provider 回退，均成立；仅在 §2.3 补录核实结论，无方案变更）
**作者**: AI Agent (S0-S5 聊天未读通知系统负责人)
**状态**: 方案评审中 ✅
