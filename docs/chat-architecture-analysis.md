# 在线客服系统架构全面分析

> 分析日期：2026-07  
> 前提：**小而美团队，短期内后台用户 ≤ 100 人；以「防止过度设计、保持简洁实用」为第一约束。**  
> 姊妹篇：`chat-support-evaluation.md`（总体评估 + 行动计划）、`chat-code-audit-4-items.md`（四项专项排查）  
> 本文定位：**架构层面**的系统性分析——安全、数据模型、状态机、生命周期管理、错误处理、依赖方向，
> 聚焦 bug 与设计缺陷（不重复已有报告的结论，交叉引用即可）。

---

## 0. 结论速览

| 维度 | 评价 | 最重要的发现 |
|------|------|-------------|
| 安全 | ★★★★☆ | socket 路径安全闭环完善；但 **REST `POST :roomId/messages` 是一个 @Public 端点且信任客户端 `sender` 字段**——理论上可伪造坐席消息 |
| 数据模型 | ★★★★★ | 索引齐全、级联删除正确、软删自洽 |
| 状态机 | ★★★★☆ | 转换逻辑清晰（waiting→active→closed→archived）；`autoMaintain` 仅自动关闭 **waiting** 不关 active——设计意图正确但需记录 |
| 生命周期管理 | ★★★★★ | 5 层定时任务分工明确、无遗漏 |
| 错误处理 | ★★★☆☆ | 偏防御性过度——所有 controller try/catch 统一转 BAD_REQUEST 丢失 stacktrace |
| 依赖方向 | ★★★★★ | 单向无循环 |

---

## 1. 安全面

### 1.1 WebSocket 路径：安全闭环 ✅

**身份推导链**（C1/C2/C3 体系）：
- 握手：`chat token` 由服务端签发（坐席凭业务 access token 兑换；访客凭 roomId + clientEmail 兑换），socket 连接必须带 token。
- 命令执行：`getAuth(client)` 从 `client.data.auth` 推导发送者身份，**绝不信任报文中的 sender 字段**。
- 归属校验：`send-message` 中 `room.assignedAgentEmail !== auth.email` → NOT_ASSIGNEE 拒绝。

**限流**：内存 Map，30 条/分钟/socket，超限 emit error。  
**长度校验**：`content.length > 4000` → emit error。

判定：socket 路径**无可挑剔**（对当前规模而言）。

### 1.2 REST 路径：存在一个设计缺陷 ⚠️

**BUG-1（低~中·设计反模式，利用难度高）**：

```
POST /chat-rooms/:roomId/messages  —— @Public() 无鉴权
```

此端点直接透传 `SendMessageDto.sender`（'client' | 'agent'）到 `chatRoomService.sendMessage()`。
服务端**仅校验**：
- `sender === 'client' && senderEmail !== room.clientEmail` → 拒绝（L1168）

但**缺少**：
- `sender === 'agent'` 时**未校验 senderEmail 是否为合法坐席**

攻击向量：知道 roomId + 知道 clientEmail
→ 可以 `sender: 'agent', senderEmail: '任意邮箱'` 发送消息 → 在访客端显示为「客服消息」。

**实际风险评估**：
- roomId 是 cuid（128 bit 随机）：暴力枚举不可行；
- 需知道 roomId（仅在 token 解码后才可见、或通过 `GET client/:email/rooms/:roomId` 公开端点泄露）；
- `GET client/:email/rooms/:roomId` 本身需要 clientEmail + roomId 同时正确——形成互锁；
- **DTO 层追加校验**：`SendMessageDto.sender` 的 `@IsEnum(['client', 'agent'])` 阻止了
  `sender: 'system'` 注入（服务端签名 `sendMessage` 参数允许 system，但 DTO 校验在先，
  外部 HTTP 请求无法绕过 class-validator 发 system 消息——**这是一层有效防线**）。

**结论**：当前规模下风险为**低**（攻击者需同时获取两个秘密），
且 `sender: 'agent'` 仍能通过 DTO 校验到达服务端——服务端对 agent sender 缺少鉴权是真实的设计缺陷，
但利用难度高。属「设计反模式，非紧急 bug」。
**建议**（顺手做级，不紧急）：此端点改为 `@Public` + 强制 `sender = 'client'`（REST 路径只许访客发消息，坐席走 socket），
或要求坐席请求带 Bearer token。

### 1.3 其他 @Public 端点

| 端点 | 保护措施 | 判定 |
|------|---------|------|
| `POST /` (创建房间) | DTO 校验 email + 全局 IP 限流 | ✅ |
| `POST /visitor-token` | roomId + clientEmail 互锁 | ✅ |
| `POST /token` | 校验 access token 有效性 | ✅ |
| `GET /agent-availability` | 无敏感数据 | ✅ |
| `GET /client/:email/recent` | email 路径参数 = 调用者身份证明 | ⚠️ 弱（见 1.4） |
| `GET /client/:email/rooms/:roomId` | email + roomId 双重匹配 | ✅ |
| `POST /:roomId/messages` | 见 BUG-1 | ⚠️ |
| `POST /:roomId/attachments/presign` | DTO 校验 senderEmail + 文件类型/大小白名单 | ✅ |

### 1.4 访客端点的信息泄露风险（低）

`GET /client/:clientEmail/recent` 是 @Public——任何人知道 email 即可查到该访客是否有活跃会话
（返回 room 全量消息）。但：
- 需要猜中准确邮箱；
- 会话内容不含管理员隐私（只有聊天消息本身）；
- 有全局 IP 限流兜底。

判定：**当前规模可接受**，记录在案。若未来面向敏感行业，改为 chat token 鉴权。

### 1.5 XSS / Markdown 注入

- 消息渲染走 Vditor.preview（Lute 引擎）。Lute 默认启用 sanitize（`Sanitize` 选项为 true，
  过滤 `<script>`/`onerror`/`javascript:` 等 XSS 向量）——项目未显式传入 `sanitize: false`，
  使用默认值即安全。但需注意：**项目未显式声明 `sanitize: true`**，依赖的是 Vditor 默认行为，
  若 Vditor 升级变更默认值则可能引入风险（概率极低，Vditor 的安全默认从 2019 年沿用至今）。
- 全仓无 `dangerouslySetInnerHTML`，聊天相关组件无手动拼 HTML。
- 服务端不做 HTML 过滤（纯存储 Markdown 原文）——这是正确的：过滤在渲染端、以原始格式存储。

判定：✅ 无 XSS 风险（依赖 Vditor 默认 sanitize，有极小升级变更风险，记录在案）。

---

## 2. 数据模型

### 2.1 表结构与索引

| 表 | 索引 | 判定 |
|---|------|------|
| `chat_rooms` | `(status, lastActivity)` 复合索引 → 分桶游标分页的主查询路径 | ✅ 完美匹配 |
| | `(deletedAt)` → 回收站过滤 | ✅ |
| | `(customerId)` / `(visitorId)` → 按客户/访客查历史 | ✅ |
| `chat_messages` | `(chatRoomId)` → 房间消息查询 | ✅ |
| | GIN `content gin_trgm_ops` → 正文搜索 | ✅ 真实存在于 0_init 迁移 |
| `chat_attachments` | `(chatMessageId)` | ✅ |
| `chat_pending_uploads` | `(expiresAt)` → 孤儿清理 | ✅ |

**缺失索引（建议但不紧急）**：
- `chat_messages(chatRoomId, timestamp)` 复合索引——当 P1-1 `take: 200 + beforeMessageId` 分页落地后，
  `WHERE chatRoomId = ? AND timestamp < ? ORDER BY timestamp DESC` 将受益于此复合索引。
  当前全量加载（无 WHERE timestamp < ?）反而靠 `(chatRoomId)` 单索引足够。
  **P1-1 实施时顺手加**。

### 2.2 级联删除

```
ChatRoom → ChatMessage (onDelete: Cascade)
ChatMessage → ChatAttachment (onDelete: Cascade)
ChatMessage → MessageReadReceipt (onDelete: Cascade)
```

物理删除 ChatRoom 时全部下游级联清除。✅ 正确且自洽——与 `purgeChatRoom` 的显式清理（先删 S3 对象再删库记录）不矛盾：purge 先清 S3 keys、再 `chatRoom.delete` 触发级联清库。

### 2.3 Customer.chatRoomId 非外键设计

`Customer.chatRoomId` 是普通字符串字段（非 Prisma @relation）——物理删除会话时需显式置空。
当前 `purgeChatRoom` 已用 `customer.updateMany({ where: { chatRoomId: room.roomId }, data: { chatRoomId: null } })`
覆盖。✅ 自洽。

---

## 3. 状态机

### 3.1 状态转换图

```
[new visitor] ─── createChatRoom ──→ waiting
                                         │
                                         ├── agent replies / claims ──→ active
                                         │
                                         └── 24h idle (autoMaintain) ──→ closed
                                                                            │
       ┌── client replies ("回复即重开") ──────────────────────┘            │
       │                                                                    │
       ▼                                                                    ▼
    active ──── agent close / admin close ──→ closed ── 30d ──→ archived
                                                                    │
                                                         ┌──────────┘
                                                         ▼
                                          softDelete (deletedAt ≠ null)
                                                         │
                                                  30d ── purge
```

### 3.2 转换规则核验

| 转换 | 触发点 | 守卫 | 判定 |
|------|--------|------|------|
| waiting → active | 坐席首次回复 or 显式 claim | `if (status === 'waiting')` | ✅ |
| active → closed | 坐席手动 / 管理员 / REST close | `updateRoomStatus` (需 chat.manage) | ✅ |
| closed → active/waiting | 访客「回复即重开」 | `reopened = isClosed && isClientSender` | ✅ |
| closed → archived | 30d autoMaintain | `closedAt < cutoff` | ✅ |
| archived → (拒绝消息) | sendMessage | `isArchived && !isSystemSender → throw` | ✅ |
| * → softDeleted | softDeleteRooms / softDeleteChatRoom | `status in (closed, archived)` 守卫 | ✅ |
| softDeleted → restore | restoreChatRoom | 保持原 status | ✅ |

### 3.3 设计缺陷/风险

**DESIGN-1（记录在案·不修）**：`autoMaintain` 仅关闭 **waiting** 状态的空闲会话（24h），
**不关闭 active**——即坐席被分配后即使 24h 无活动也永远保持 active。
这是有意设计（active = 坐席已接手，由坐席决定何时关闭），但：
- 若坐席忘关，会话永远不会进入 closed → archived 链；
- 列表中 active 会无界增长（受分页保护，不影响性能）。

当前规模影响极低（≤10 坐席每天几十个会话），未来若出现坐席「养」着几百个 active 会话不关的情况，
可补一个「active 且 7d 无活动 → 自动关闭」策略。**现在不做**。

**DESIGN-2（已知·不修）**：`waiting → closed`（autoMaintain）不发系统消息通知访客。
访客无感知——从其视角看，聊天面板仍可输入，输入后触发「回复即重开」。
体验上可接受，记录即可。

---

## 4. 生命周期管理（定时任务体系）

5 层定时任务全部进程内，无外部依赖：

| 层 | 周期 | 职责 | 失败影响 |
|----|------|------|---------|
| L1 Presence 扫描 | 15s | 心跳超时 → away/offline | 状态延迟最多 15s，自愈 |
| L2 会话维护 | 60s | waiting 24h idle → closed；closed 30d → archived | 延迟最多 60s，无感 |
| L3 等待队列疏导 | 10s（周期）+ 坐席上线即触发 | 扫描 waiting 队列 → 自动分配坐席 | 延迟最多 10s |
| L4 限流 Map 清理 | 5min | 避免内存 Map 无界增长 | 无感，清理不及时只多占几 KB |
| L5 附件清理 | 每日 3AM | 孤儿文件 + 过期附件 | 延迟最多 24h，S3 成本微乎其微 |

### 4.1 风险评估

**重启瞬态**：进程重启时 L2/L3 状态重建需 60s~10s——重启后 autoMaintain 首次执行即补齐全部漏标。
L1 presence 在连接恢复时由 socket reconnect 触发 register-agent → 重建。
L4/L5 无状态。**结论：重启安全。**

**并发安全**：所有定时任务使用 `updateMany` 幂等操作（多次执行结果一致）。
单实例部署无并发风险。多实例时 L2 `updateMany` 同状态无条件竞态（幂等）；
L1 presence 需 Redis（多实例场景 §9.6 已决定摘除 → 确认永远单实例）。✅

---

## 5. 错误处理

### 5.1 Controller 层

全部 25 个 REST handler 结构一致：

```ts
try {
  return await this.service.method(…);
} catch (e) {
  if (e instanceof HttpException) throw e;
  throw new HttpException(errMsg(e), HttpStatus.BAD_REQUEST);
}
```

**问题（DESIGN-3·轻微·不修）**：非 HttpException 的异常统一转为 400 BAD_REQUEST——
某些本应是 500 的服务端异常（如 Prisma 连接超时）也变成了 400。但：
- NestJS 全局异常过滤器在 try/catch 之外仍会捕获未处理异常；
- BAD_REQUEST 比 INTERNAL_SERVER_ERROR 泄露的信息更少（安全角度反而有利）；
- 当前规模下 debug 靠日志、不靠 HTTP status 精确区分。

判定：风格有争议但不是 bug，不改。

### 5.2 Gateway 层

socket 事件 handler 中每个命令都有：
- `const auth = this.getAuth(client); if (!auth) return;`（未认证静默丢弃）
- `const room = await this.roomOrError(client, roomId, auth); if (!room) return;`（房间不存在 emit error）
- 业务逻辑中 try/catch → emit error（如限流、长度、非负责人等明确错误码）

判定：✅ 正确——socket 层不能 throw（会断连），统一 emit error 是业内最佳实践。

---

## 6. 依赖方向

```
ChatRoomController ─┐
SupportController ──┼──→ ChatRoomService ─┬──→ PrismaService
ChatGateway ────────┘                     ├──→ S3Service
                                          ├──→ ChatPresenceStore
                                          ├──→ ChatNotificationService
                                          ├──→ MessageSearchService
                                          └──→ IpLocationService
ChatGateway ──→ ChatRoomService（持久化）
            ──→ ChatAuthService（身份校验）
            ──→ ChatPresenceStore（状态管理）
```

- **无循环**：Gateway → Service → Prisma 单向；Gateway 不被 Service 反向引用。
- **ChatNotificationService** 只消费 ChatRoomService 的数据、不反向调用。
- **support.module.ts** 注册顺序正确（providers 数组中被依赖者先于依赖者）。

判定：✅ 教科书级的单向依赖。

---

## 7. 综合 Bug 清单（含新发现）

| # | 级别 | 问题 | 来源 |
|---|------|------|------|
| BUG-1 | 低~中 | REST `POST :roomId/messages` @Public 且信任 `sender` 字段 → 理论可伪造坐席消息（需知道 cuid roomId，利用难度高）| 本文 §1.2 |
| BUG-2 | 轻微 | 搜索 clientName/clientEmail 大小写不敏感口径与正文 ILIKE 不一致 | `chat-code-audit-4-items.md` A-1 |
| BUG-3 | 真 bug | 访客 token 失效后无续期链路（auth-error 用原 token 重连死循环） | `chat-support-evaluation.md` P1-6 |

其余问题均为设计缺陷 / 已知局限，非 bug。

---

## 8. 设计缺陷清单（不影响功能·记录在案）

| # | 问题 | 影响 | 处置 |
|---|------|------|------|
| D-1 | autoMaintain 不关 active（坐席忘关 → active 无界增长） | 低·分页保护 | 不修 |
| D-2 | waiting→closed 不通知访客 | 无感知·回复即重开 | 不修 |
| D-3 | Controller 统一 400（吞 500 stacktrace） | 调试不便 | 不修（安全优先） |
| D-4 | 14 个死 REST + 9 个死 socket 事件 | 心智负担 | 清理（见四项排查报告） |
| D-5 | VirtualList 为不存在的数据量而建 | 零运行时影响 | 冻结 |
| D-6 | 工单子系统死代码（490 行 + 2 表） | 维护噪声 | 决策后清理 |

---

## 9. 对照第一约束的最终判定

> **「防止过度设计、保持简洁实用」**

| 方面 | 该系统表现 |
|------|-----------|
| 功能匹配度 | 功能 > 需求（约 30% 超规格），但已建成且无活跃维护成本 |
| 安全匹配度 | socket 路径强于需求；REST 路径有一个缺陷（BUG-1）但实际风险低 |
| 复杂度匹配度 | 代码量偏大（1.4 万行）、死接口偏多（42% REST）、巨型文件（3 个 >1500 行） |
| 运维匹配度 | 零外部依赖（Redis 即将摘除）、定时任务全进程内、重启安全 |
| 测试匹配度 | 服务端有基本覆盖、前端零测试——与规模匹配的下限 |

**总结**：架构是正确的、安全是够用的、真 bug 只有 3 个（其中 1 个已有修复计划）。
系统的问题从来不是「架构错」，而是「面积大」——死代码、超规格件、巨型文件叠加在一起，
让维护成本超出了产出所需。正确策略依然是评估报告的结论：**只修 bug、只删不加、拒绝新特性**。
