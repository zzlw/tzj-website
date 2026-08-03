# 坐席在线状态改为「手动上线」技术方案

> 日期：2026-08-03  
> 状态：已实施（代码 + 测试全部完成，`src/support` 44 个用例全部通过，两应用 tsc 零错误；手动验证待执行）  
> 范围：`apps/api/src/support/chat.gateway.ts`、`chat-presence.store.ts`、`apps/admin/src/features/chat/ChatPresenceProvider.tsx`、`useChatSocket.ts`  
> 姊妹篇：`chat-support-evaluation.md`、`chat-architecture-analysis.md`

---

## 1. 问题描述

当前坐席（Agent）的在线状态行为为 **「连上即在线」**：一旦登录后台并建立 Socket 连接，服务端立即将状态置为 `online`，访客侧即时看到「在线客服」。

这与业内主流客服平台的最佳实践相悖。

### 1.1 业内对标

| 平台 | 登录后默认状态 | 上线方式 |
|------|--------------|---------|
| Zendesk | Offline | 手动点击「上线」 |
| LiveChat | Offline | 手动切换为 Available |
| Freshdesk Chat | Offline | 手动切换为 Available |
| Intercom | Offline | 手动设为 Available |
| Drift | Offline | 手动上线 |
| Tawk.to | **Online**（自动） | 少数例外，偏小团队 |
| **当前实现** | **Online**（自动） | 需手动下线 |

### 1.2 当前方案的问题

1. **坐席无准备时间** — 登录后可能需先回顾未读消息、了解上下文，自动上线导致访客消息瞬间涌入
2. **被迫接客** — 坐席可能只是打开后台查看数据，并不想接待聊天，但打开页面即被视为可接客
3. **意外分配** — 等待队列 `drainWaitingQueue()` 在坐席连接后立即触发自动派单，坐席还没准备好就被分配了会话
4. **语义混淆** — 「已登录后台」≠「已到岗接客」，两者应有明确区分

---

## 2. 目标行为

### 2.1 核心规则

| 场景 | 行为 | 理由 |
|------|------|------|
| 首次登录（无历史状态） | 默认 `offline`，需手动上线 | 业内标准 |
| 刷新页面 / 网络重连（之前是在线的） | 恢复为 `online` | 避免刷新后掉线，体验差 |
| 手动离线后重连 / 刷新 | 保持 `offline` | 尊重坐席意愿（当前已正确实现） |
| 手动上线后切走标签页 → 空闲超时 | 降级为 `away` | 当前已正确实现 |

### 2.2 判定逻辑

> **关键约束**：「首次登录保持 offline」仅对 **坐席（agent）** 生效。访客（client）仍为「连上即在线」——
> 访客打开聊天窗口就应被坐席看到，不存在「手动上线」的概念。

引入「**是否有过在线历史**」作为区分首次登录与重连的依据（仅 agent）：

- `ChatPresenceStore` 中新增 `hasBeenOnline` 标记
- `addSocket` 首次创建条目时 `hasBeenOnline = false`
- `setStatus` 设为 `online` 时，`hasBeenOnline = true`
- `handleConnectPresence` 中（按优先级从高到低）：
  1. `manualOffline === true` → 保持 `offline`（不变，适用于 agent）
  2. **agent** 且 `hasBeenOnline === false`（首次登录，从未上线过）→ 保持 `offline`，等待手动上线
  3. 其他（含所有 visitor + agent 重连/刷新）→ 恢复为 `online`（与当前行为一致）

> ⚠️ 判定条件**只用 `hasBeenOnline`，不附加 `prevCount === 0`**：后者在多标签页场景有误
> （坐席开第二个标签时 prevCount≥1 会被误判为非首次登录而自动上线）。`hasBeenOnline`
> 单独即可可靠区分「首次登录 vs 重连」。

---

## 3. 变更清单

### 3.1 服务端：`chat-presence.store.ts`

**新增 `hasBeenOnline` 字段**：

```typescript
// mem Map 的 value 类型新增字段
{
  // ...existing fields
  hasBeenOnline: boolean;  // 是否曾经被置为 online（区分首次登录 vs 重连）
}
```

**`addSocket` 方法**：

```typescript
// 首次创建条目时
entry = {
  // ...existing defaults
  hasBeenOnline: false,  // 新增：首次登录默认未上线
};
```

**`setStatus` 方法**：

```typescript
async setStatus(userKey: string, status: PresenceStatus, lastSeen = Date.now()): Promise<void> {
  const entry = this.mem.get(userKey);
  if (entry) {
    entry.status = status;
    entry.lastSeen = lastSeen;
    if (status === 'online') {
      entry.hasBeenOnline = true;  // 标记已上线过（一次性标记，不设回 false）
    }
  }
}
```

> **时序依赖**：`handleConnectPresence` 中先通过 `getMeta` 读取 `hasBeenOnline`，
> 再根据判定结果调用 `setStatus`。`hasBeenOnline` 仅在 `status === 'online'` 时
> 被置为 true，**不设回 false**——一旦上线过就永远标记为上线过（直到条目被 GC）。
> 这保证了 `setStatus('offline')` 不会意外清除标记。

**修改 `getMeta` 返回值**：

```typescript
async getMeta(userKey: string): Promise<{
  email: string;
  userType: 'client' | 'agent';
  status: PresenceStatus;
  lastSeen: number;
  manualOffline: boolean;
  chatPanelOpen: boolean;
  hasBeenOnline: boolean;  // ← 新增
} | null> {
  const entry = this.mem.get(userKey);
  if (!entry) return null;
  return {
    // ...existing fields
    hasBeenOnline: entry.hasBeenOnline ?? false,  // ← 新增
  };
}
```

> **`PresenceSummary` / `getAllSummaries` 不更新**：`hasBeenOnline` 是 `handleConnectPresence`
> 内部的判定标记，不对外暴露。`agentAvailability`、`broadcastAgentRoster` 等消费方无需感知，
> 保持现有 `PresenceSummary` 类型不变。

---

### 3.2 服务端：`chat.gateway.ts`

**修改 `handleConnectPresence`**：

```typescript
private async handleConnectPresence(
  client: Socket,
  userKey: string,
  auth: ChatTokenPayload,
): Promise<void> {
  // 注：prevCount 仅用于日志/调试，不参与首次登录判定
  const prevCount = await this.presence.getSocketCount(userKey);
  await this.presence.addSocket(userKey, auth.email, auth.type, client.id);

  // 取消待定离线定时器（不变）
  const timer = this.pendingOfflineTimers.get(userKey);
  if (timer) {
    clearTimeout(timer);
    this.pendingOfflineTimers.delete(userKey);
  }

  const meta = await this.presence.getMeta(userKey);

  // ① 手动离线的用户重连也不自动复活（不变）
  if (meta?.manualOffline) {
    await this.presence.setStatus(userKey, 'offline');
    await this.broadcastPresenceFor(userKey);
    return;
  }

  // ② 核心变更：区分「首次登录」与「重连/刷新」（仅 agent）
  //    - agent 首次登录（从未上线过）→ 保持 offline，等待手动上线
  //    - agent 曾上线过（刷新/重连/换设备/开新标签）→ 恢复 online
  //    - visitor 任何情况 → 恢复 online（访客无「手动上线」概念）
  //
  //    判定依据：addSocket 在首次创建条目时 hasBeenOnline=false，
  //    setStatus('online') 时置为 true。因此 hasBeenOnline 是可靠的「是否曾上线」信号。
  //
  //    ⚠️ 条件一：auth.type === 'agent' 不可省略——若不区分类型会将访客错误置为 offline。
  //    ⚠️ 条件二：不得附加 prevCount === 0——坐席开第二个标签时 prevCount≥1，
  //    会被误判为非首次登录而自动上线，违背「手动上线」意图。
  //    hasBeenOnline 单独即可可靠区分首次登录与重连。
  const isFirstLogin = auth.type === 'agent' && !meta?.hasBeenOnline;

  if (isFirstLogin) {
    // agent 首次登录：保持 offline，等待手动上线
    await this.presence.setStatus(userKey, 'offline');
    await this.broadcastPresenceFor(userKey);
    return;
  }

  // 重连/刷新：恢复 online（与当前行为一致）
  const restored: PresenceStatus = 'online';
  const changed = (meta?.status ?? 'offline') !== restored;
  await this.presence.setStatus(userKey, restored);
  if (changed) {
    await this.broadcastPresenceFor(userKey);
  } else if (auth.type === 'agent') {
    await this.broadcastAgentAvailabilityNow();
  }
}
```

**修改 `handleConnection` 中坐席分支**：

```typescript
if (payload.type === 'agent') {
  // ⚠️ getPresence 只读一次并复用，避免重复异步读取
  const myStatus = await this.presence.getPresence(data.userKey);
  client.emit('my-presence', { status: myStatus });
  await this.sendRoomListToAgent(client, payload.email);
  // 坐席需加入所有活跃房间才能接收实时 new-message 事件（无论是否在线——
  // 离线坐席仍需看到会话列表与历史消息，上线后立即无缝接客）
  await this.joinAgentToActiveRooms(client);
  await this.broadcastAgentRoster();
  // ⚠️ 关键变更：仅当坐席确实在线时才触发自动派单
  // 首次登录的坐席状态为 offline，不应触发 drainWaitingQueue
  if (myStatus === 'online') {
    void this.drainWaitingQueue();
  }
}
```

**无需修改 `handleRegisterAgent`（已验证）**：

客户端连接后会再发 `register-agent` 事件，其 handler 只做两件事：下发 `my-presence`
（只读）+ 推送房间列表，**不写任何 presence 状态**，不会绕过 `isFirstLogin` 检查。
唯一的副作用是 `my-presence` 会被下发两次（`handleConnection` 一次 + `register-agent` 一次），
两次值一致且客户端 handler 幂等，无影响。

---

### 3.3 客户端：`ChatPresenceProvider.tsx`

**初始状态调整**：

```typescript
// 当前：初始 offline，连接后由 my-presence 同步
// 改为：保持不变，初始仍为 offline
// 首次登录时 my-presence 下发 offline → UI 显示离线，坐席需手动点击上线
// 重连时 my-presence 下发 online → UI 自动恢复在线
const [agentStatus, setAgentStatus] = useState<PresenceStatus>('offline');
```

无需修改初始状态——当前已经是 `offline`，由服务端 `my-presence` 事件同步真实状态。

**新增：首次连接后若为 offline 不自动上线**：

当前 `useChatSocket.ts` 在 `connect` 事件中发送 `register-agent`，不主动上报 `set-presence: online`，这部分已经是正确的。

需要确认的是：`ChatPresenceProvider` 收到 `my-presence: offline` 后不会自动调用 `setPresence('online')`。当前实现中 `my-presence` 的 handler 只同步本地 state，不回射——这是正确的。

---

### 3.4 客户端：`useChatSocket.ts`

> ⚠️ **本节结论由「无需修改」更正为「需要一处小改」**：终审逐行核对该文件后发现
> 一条文档此前未覆盖的自动上线路径（visibilitychange 竞态），必须修复，否则会
> 旁路服务端的「首次登录保持 offline」。

**发现：visibilitychange 自动上报 online 的竞态窗口**（现有代码 L261-278）：

```typescript
sock.on('connect', () => {
  sock.emit('register-agent');
  hasEverBeenOnlineRef.current = true;  // ← 连接即无条件置 true
  ...
});
// ...
const handleVisibility = () => {
  // ...
  } else {
    // 标签页回到前台：若「曾在线」且非手动离线 → 自动报 online
    if (sock.connected && hasEverBeenOnlineRef.current && !manualOfflineRef.current) {
      sock.emit('set-presence', { status: 'online' });
    }
  }
};
```

**竞态序列**（新设计下首次登录）：

1. Socket 连接 → `connect` 触发 → `hasEverBeenOnlineRef = true`
2. 服务端处理中（`isFirstLogin → offline → my-presence` 尚未送达客户端）
3. 此时坐席切到该标签页 → `visibilitychange` 触发：
   `hasEverBeenOnlineRef(true) && !manualOfflineRef(仍为初始值 false)` → **emit set-presence: online**
4. 服务端 `handleSetPresence` → `manualOffline=false` + `status=online` → **首次登录被旁路，坐席被自动上线**

触发条件：「后台标签打开后台 + 慢网络下 my-presence 未送达时切回标签」，概率低但真实存在；
同样的窗口也会破坏现有「手动离线 → 刷新 → 保持离线」语义（刷新后 refs 归零，my-presence 未到达前切标签同样旁路）。

**修复**（约 5 行）：引入 `presenceSyncedRef`，visibilitychange 的自动上报必须等本次连接的
`my-presence` 到达后才允许：

```typescript
const presenceSyncedRef = useRef(false);

sock.on('connect', () => {
  sock.emit('register-agent');
  presenceSyncedRef.current = false;  // 每次（重）连接重置，等待服务端权威状态
  // hasEverBeenOnlineRef 的无条件置位不再作为自动上报门槛（语义由 presenceSyncedRef 接管）
  ...
});
sock.on('my-presence', (payload) => {
  manualOfflineRef.current = payload?.status === 'offline';
  presenceSyncedRef.current = true;  // 服务端权威状态已同步
});
// visibilitychange 回前台分支：
if (sock.connected && presenceSyncedRef.current && !manualOfflineRef.current) {
  sock.emit('set-presence', { status: 'online' });
}
```

修复后行为验证：

| 场景 | presenceSyncedRef | manualOfflineRef | 是否自动报 online |
|------|:---:|:---:|:---:|
| 首次登录，my-presence(offline) 前切标签 | false | — | 否 ✅（窗口关闭） |
| 首次登录，my-presence(offline) 后切标签 | true | true | 否 ✅ |
| 手动离线后刷新，my-presence(offline) 前切标签 | false | — | 否 ✅（顺带修复现有竞态） |
| 曾在线刷新，my-presence(online) 后切标签 | true | false | 是 ✅（恢复在线语义保留） |

**同时更新两处过期注释**（L220-224、L238-240）：原注释描述的「连上即在线」语义在本方案后
不再成立，需改为「首次登录保持 offline，my-presence 为唯一权威状态」。

---

### 3.5 客户端 UI 增强（可选但推荐）

**状态切换按钮位置优化**：

当前状态切换在 `ChatConversationList.tsx` 的会话列表顶部。首次登录的坐席进入聊天页面时看到的是离线状态，需要能方便地找到上线按钮。

建议保持现有 UI 不变——状态切换按钮已经在会话列表顶部显眼位置，坐席可以直观看到并点击。

---

## 4. 状态流转对比

### 4.1 变更前（当前）

```
坐席登录 → Socket 连接 → handleConnectPresence
  ├─ manualOffline? → 保持 offline
  └─ 否则 → 自动 online ← 问题所在
       └─ drainWaitingQueue() → 可能立即被分配会话
```

### 4.2 变更后

```
坐席登录 → Socket 连接 → handleConnectPresence
  ├─ manualOffline? → 保持 offline（不变）
  ├─ agent 首次登录（hasBeenOnline=false）→ 保持 offline ← 新增
  │    └─ 坐席手动点击「上线」→ set-presence: online → hasBeenOnline=true
  │         └─ drainWaitingQueue() → 此时才分配等待会话
  └─ agent 曾上线过 / visitor 任何情况 → 恢复 online（不变）
       └─ drainWaitingQueue()（不变）
```

---

## 5. 边界场景处理

| 场景 | 变更前 | 变更后 |
|------|--------|--------|
| 首次登录 | 自动 online | **offline**，需手动上线 |
| 刷新页面（之前在线） | 恢复 online | 恢复 online（不变） |
| 网络断开重连（之前在线） | 恢复 online | 恢复 online（不变） |
| 手动离线后刷新 | 保持 offline | 保持 offline（不变） |
| 手动离线后切走标签页再回来 | 保持 offline | 保持 offline（不变） |
| 换设备登录（之前在线） | 恢复 online | 恢复 online（不变） |
| 首次登录后开第二个标签页（未上线过） | 自动 online | **offline**（hasBeenOnline=false 仍为首次登录态，两个标签都需手动上线） |
| 上线后开第二个标签页 | 恢复 online | 恢复 online（hasBeenOnline=true，不变） |
| 清除浏览器数据后重新登录（之前在线） | 恢复 online（store 内存未清） | **offline**（`manualOffline` 仍在内存中保护——保持 offline；若之前未手动离线则 `hasBeenOnline=true` 仍为 online） |
| 服务端重启后坐席重连 | 恢复 online（store 重置为 offline） | **offline**（`hasBeenOnline` 丢失，等同首次登录） |
| 后台标签打开 + 慢网络下 my-presence 未到达时切回标签 | （现有隐性竞态）可能旁路手动离线 | **不会自动上线**（§3.4 `presenceSyncedRef` 修复后，自动上报必须等 my-presence 同步完成） |

### 5.1 服务端重启场景

`ChatPresenceStore` 当前为内存模式，服务端重启后所有状态丢失。坐席重连时：
- `addSocket` 创建新条目，`hasBeenOnline = false`
- 坐席需要重新手动上线

这与业内行为一致——服务端重启后坐席需重新上线（Zendesk/LiveChat 均如此）。

未来如果迁移到 Redis 持久化模式，`hasBeenOnline` 可以跨重启保留，行为更接近「恢复上次状态」。但当前内存模式下「重启后需重新上线」是合理的。

---

## 6. 影响评估

### 6.1 受影响文件

| 文件 | 变更类型 | 影响范围 |
|------|---------|---------|
| `apps/api/src/support/chat-presence.store.ts` | 新增字段 | 低风险，纯增量 |
| `apps/api/src/support/chat.gateway.ts` | 修改 `handleConnectPresence` + `handleConnection` 坐席分支 | 中风险，核心逻辑变更 |
| `apps/api/src/support/chat.gateway.ts` 的 `handleRegisterAgent` | 无需修改（已验证：只读 presence + 推列表，不写状态） | — |
| `apps/admin/src/features/chat/ChatPresenceProvider.tsx` | 无需修改 | — |
| `apps/admin/src/features/chat/useChatSocket.ts` | 小改（§3.4）：`presenceSyncedRef` 门控 visibilitychange 自动上报 + 更新过期注释 | 低风险，约 5 行 |

### 6.2 不受影响的功能

- 访客端在线状态（`isFirstLogin` 限定 `auth.type === 'agent'`，访客始终走「恢复 online」路径，行为完全不变）
- 空闲检测（`user-idle` / `user-active`）
- 断线宽限期（`schedulePendingOffline`）
- 手动离线保护（`manualOffline`）
- 转接功能（要求目标坐席在线，不受影响）
- 等待队列自动分配（已增加 `myStatus === 'online'` 门槛）

### 6.3 需要更新的测试

| 测试文件 | 需要更新 | 说明（已逐个用例核实） |
|---------|---------|------|
| `chat.gateway.presence.spec.ts` | **是（用例 3 需更新 + 新增用例）** | 用例 3（宽限期内重连恢复 online）直接调用 `handleConnectPresence`，其 `FakePresence` 构造的 meta 无 `hasBeenOnline` 字段 → 新逻辑下 `!undefined === true` 会被置 offline，断言 `status === 'online'` 失败。修复：`AnyMeta` 类型补 `hasBeenOnline?: boolean`，用例 3 的 meta 预置 `hasBeenOnline: true`（曾在线坐席断线重连的真实语义）。其余 6 个用例不受影响。另新增「agent 首次登录保持 offline」「visitor 首次连接仍 online」「多标签页不自动上线」用例 |
| `agent-presence-refresh.integration.spec.ts` | **是（用例 1、2 失败；用例 3 仍通过）** | 用例 1 首个断言 `expect(await getStatus()).toBe('online')`（首次连接后）在新逻辑下得到 offline → 失败；用例 2 断言断线后仍乐观保持 online，但首次连接即 offline → 失败；用例 3（手动离线后重连不复活）因 manualOffline 优先级最高而**仍然通过**。修复方式：用例 1/2 前置条件中先通过 `setStatus('online')` 将 `hasBeenOnline` 置为 true，模拟「已上线过」再测试刷新/重连 |
| `chat-conversation-lifecycle.integration.spec.ts` | **否（核实后预计全部通过）** | 逐条核实该测试 4 个用例的断言均为房间状态与访客侧 `clientPresence`，**无任何对坐席 presence 的断言**；坐席首次连接为 offline 不影响房间生命周期断言。为语义严谨，建议在 setup 中追加一行 `setStatus('online')` 模拟「坐席已上线」，但不强制 |
| `visitor-presence.spec.ts` | **否** | 纯函数测试（`resolveVisitorPresence` 的 away 防抖），不涉及服务端 presence 写入逻辑 |
| `chat-room.service.ts`（派单路由，非测试） | **否** | 已核实 `pickAvailableAgentEmail` 只从 `online` 两级选（无 online 时兜底 `away`），`offline` 坐席不入池——恰好符合本设计「未手动上线不接新会话」的意图，无需改动 |

---

## 7. 测试计划

### 7.1 新增单元测试

```
describe('handleConnectPresence — agent 首次登录 vs 重连', () => {
  it('agent 首次登录（hasBeenOnline=false）→ 保持 offline', async () => { ... });
  it('agent 首次登录后开第二个标签页（prevCount>0）→ 仍保持 offline，不自动上线', async () => { ... });
  it('agent 曾上线过（hasBeenOnline=true）刷新 → 恢复 online', async () => { ... });
  it('agent 曾上线过后断线超时 → 重连恢复 online', async () => { ... });
  it('agent 首次登录后手动上线 → hasBeenOnline 置为 true', async () => { ... });
  it('agent 首次登录后不触发 drainWaitingQueue', async () => { ... });
  it('agent 手动离线后刷新 → 保持 offline', async () => { ... });
});

describe('handleConnectPresence — visitor 不受影响', () => {
  it('visitor 首次连接 → 仍为 online', async () => { ... });
  it('visitor 重连 → 恢复 online', async () => { ... });
});

describe('useChatSocket visibilitychange 竞态（客户端）', () => {
  it('my-presence 未到达前切回标签 → 不 emit set-presence: online', async () => { ... });
  it('my-presence(offline) 到达后切回标签 → 不 emit set-presence: online', async () => { ... });
  it('my-presence(online) 到达后切回标签 → emit set-presence: online（恢复语义保留）', async () => { ... });
});
```

### 7.2 手动验证清单

**坐席端**：
- [ ] 坐席首次打开聊天页面 → 状态显示「离线」，访客侧看到「暂无客服在线」
- [ ] 坐席首次登录状态下开第二个标签页 → 第二个标签仍显示「离线」，不自动上线
- [ ] 坐席手动点击「上线」→ 状态变为「在线」，访客侧看到「在线客服」
- [ ] 坐席上线后开第二个标签页 → 第二个标签自动显示「在线」
- [ ] 坐席上线后刷新页面 → 自动恢复「在线」
- [ ] 坐席手动离线后刷新页面 → 保持「离线」
- [ ] 坐席上线后网络断开 → 宽限期后变为离线 → 重连后自动恢复在线
- [ ] 后台标签打开管理后台，网络较慢时快速切到该标签 → 不会自动上线（§3.4 竞态修复验证）
- [ ] 坐席首次登录时，等待队列中的会话不被分配给该坐席
- [ ] 坐席手动上线后，等待队列中的会话被自动分配

**访客端（回归验证）**：
- [ ] 访客首次打开聊天窗口 → 坐席端会话列表显示访客「在线」
- [ ] 访客刷新页面 → 在线状态不中断
- [ ] 访客关闭页面 → 坐席端显示访客「离线」

---

## 8. 回滚方案

变更涉及 2 个服务端文件 + 1 个客户端文件（约 5 行）+ 测试文件，回滚只需 `git revert` 对应 commit。无数据库变更、无环境变量变更、无配置变更。

---

## 9. 不做事项

- ❌ 不改变访客端在线状态逻辑（访客仍为「连上即在线」，这是正确的）
- ❌ 不增加「自动上线」配置项（当前规模不需要，保持简单）
- ❌ 不持久化 `hasBeenOnline` 到数据库（内存模式足够，未来 Redis 模式自然支持）
- ❌ 不改变手动离线（`manualOffline`）机制（当前实现已正确）
- ❌ 不改变断线宽限期机制（当前实现已正确）

---

## 10. 实施步骤

1. ✅ `ChatPresenceStore` 新增 `hasBeenOnline` 字段 + `setStatus` 时自动标记 + `getMeta` 返回值扩展
2. ✅ `handleConnectPresence` 增加首次登录判断（仅 `auth.type === 'agent' && !hasBeenOnline`，不带 prevCount 条件）
3. ✅ `handleConnection` 坐席分支：`getPresence` 合并为单次读取 + `myStatus === 'online'` 派单门槛
4. ✅ `useChatSocket.ts` 增加 `presenceSyncedRef` 门控（§3.4）；`hasEverBeenOnlineRef` 被其取代后已移除
5. ✅ 更新测试文件，新增覆盖用例（含多标签页场景）；实施中发现 `setStatus` 对不存在的条目是 no-op，测试前置须先 `addSocket` 建条目再置 online
6. ⬜ 手动验证全流程（首次登录 offline → 手动上线 → 刷新恢复 → 手动离线 → 刷新仍离线）
7. ⬜ 提交 PR
