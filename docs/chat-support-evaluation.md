# 在线客服系统评估报告（/chat）

> 评估日期：2026-07（同月经一轮反向评审后修订：原 P0 降级、token 收紧移入不做清单、分页游标改双键、补记 REST 限流；
> 随后二次增补：决定摘除 Redis（先运维后代码，§9.6）、搜索抽象层明确保留不删）  
> 评估范围：`apps/api/src/support/**`、`apps/admin/src/features/chat/**`、`apps/web/src/components/chat/**`  
> 评估前提：**小而美团队，短期内后台用户 ≤ 100 人；以「防止过度设计、保持简洁实用」为第一约束。**  
> 全文所有结论均以该前提为评判基准，不以「大厂标准」评判。

---

## 1. 结论摘要（TL;DR）

| 维度 | 评价 | 一句话 |
|------|------|--------|
| 功能完整度 | ★★★★★ | 对标 Intercom/Zendesk 的核心能力基本齐全，甚至超出当前规模所需 |
| 架构合理性 | ★★★★☆ | 三端分离清晰、推送+轮询双通道稳健、Redis 可选降级设计得当 |
| 代码可维护性 | ★★★☆☆ | 三个 1400~2100 行的巨型文件是最大隐患，补丁式注释密集 |
| 测试保障 | ★★☆☆☆ | 服务端仅 5 个 spec 文件，前端零测试；但对当前规模属可接受下限 |
| 过度设计程度 | **中度偏高** | 约 30% 的复杂度服务于「当前规模用不到」的场景，详见 §6 |

**总体判断：这是一套「按 1000 坐席规格建造、实际服务 ≤10 坐席」的系统。**
功能与健壮性无可指摘，真正的风险不在「缺什么」，而在「维护成本超出小团队的承受力」——
三端合计约 **1.4 万行**聊天相关代码，任何一个新人接手都需要数天才能建立心智模型。
后续原则应是：**只修 bug、只删不加、拒绝新特性**，除非有真实用户反馈驱动。

---

## 2. 系统全景

### 2.1 三端组成与代码规模

```
访客（Web :3000）── socket.io + 5s HTTP 轮询兜底 ──┐
                                                    ├── API（NestJS :4000）── PostgreSQL / Redis(可选) / S3
坐席（Admin :3002/chat）── socket.io + REST ────────┘
```

| 端 | 位置 | 生产代码量 | 核心文件 |
|----|------|-----------|---------|
| API 服务端 | `apps/api/src/support/` | ≈ 5,100 行（13 文件） | `chat-room.service.ts` 1,800 行、`chat.gateway.ts` 1,448 行、`chat-room.controller.ts` 499 行 |
| Admin 坐席端 | `apps/admin/src/features/chat/` | ≈ 5,370 行（16 文件） | `ChatMessenger.tsx` 1,636 行、`VisitorProfileSheet.tsx` 855 行、`ChatConversationList.tsx` 596 行 |
| Web 访客端 | `apps/web/src/{components,features}/chat/` | ≈ 3,280 行（7 文件） | `ChatWidget.tsx` 2,095 行（89 KB 单文件）、`useVisitorChat.ts` |
| 测试 | 仅 API 端 | 838 行（5 spec 文件，约 20 用例） | 前端两端均为零测试 |

### 2.2 通信协议面

- **Socket 入站事件（`@SubscribeMessage`）：20 个**——register/join/leave、send-message、typing/stop-typing、mark-read、get-room-info、transfer、claim 等。
- **Socket 出站事件：约 23 个**——new-message、room-status-changed、room-list-updated、presence-changed、notification-counts-updated、agent-roster、room-transfer-notice 等。
- **REST 端点：33 个**（ChatRoomController 25 + SupportController 8）——分桶列表、批量操作（close/archive/delete）、回收站（软删/恢复/purge）、消息搜索（pg_trgm）、转客户档案等。

### 2.3 数据模型（5 张表）

```
ChatRoom (roomId, status: waiting|active|closed|archived, deletedAt 软删, agentEmail…)
 ├─ ChatMessage (级联删除)
 │   ├─ ChatAttachment (级联)
 │   └─ MessageReadReceipt (级联)
 └─ ChatPendingUpload (上传中占位)
Customer.chatRoomId —— 普通字段非外键，物理删除会话时需显式置空（purge/清理脚本已处理）
```

### 2.4 关键机制

| 机制 | 实现 | 备注 |
|------|------|------|
| 身份认证 | JWT chat token：访客 30 天 / 坐席 15 分钟（10 分钟静默刷新） | `chat-auth.service.ts` |
| 在线状态 | `ChatPresenceStore` 双实现：有 `REDIS_URL` 走 Redis 有序集合（跨实例一致），无则内存 Set 降级 | 含断线宽限期 |
| 消息限流 | socket 层：内存 Map，30 条/分钟/socket；REST 层：全局 `ThrottlerModule` + `ClientIpThrottlerGuard` 按真实客户端 IP 限流（匿名建会话接口亦被覆盖） | socket 层多实例部署时各实例独立计数 |
| 消息可达性 | socket 推送 + 访客端 5s HTTP 轮询兜底 | 双通道，弱网可靠 |
| 定时任务 | 15s presence 扫描、60s 会话自动维护、10s 等待队列疏导、5min 限流 Map 清理、每日 3AM 附件/回收站清理 | 全部进程内，无外部依赖 |
| 删除策略 | 软删（deletedAt）→ 回收站 → 30 天自动物理清理；`chat.delete` 权限门控、purge 仅管理员 | 详见 `docs/design/deletion-strategy.md` |
| 消息搜索 | PostgreSQL pg_trgm GIN 索引，单次 limit 200 | 无需引入 Elasticsearch，正确的规模选择 |

---

## 3. 能力清单与成熟度

| 能力 | 状态 | 相对 ≤100 人规模的评价 |
|------|------|----------------------|
| 访客发起会话 / 坐席接待 | ✅ 成熟 | 核心，必要 |
| 排队 / 认领 / 接管 / 转接 | ✅ 成熟 | 转接+接管对 ≤10 坐席团队略重，但已建成，保留 |
| 已读回执（精确到消息×用户） | ✅ 成熟 | 精确但代价高（见 §5 性能项） |
| 输入中指示（typing） | ✅ 成熟 | 体验加分项，成本低，合理 |
| 附件上传（S3 直传 + 占位记录 + 孤儿清理） | ✅ 成熟 | 完整，pending-upload 机制略重但可靠 |
| 消息全文搜索 | ✅ 成熟 | pg_trgm 是本规模最优解 |
| 访客画像 / 转客户档案（CRM 联动） | ✅ 成熟 | 与 Customer 模块打通，价值高 |
| 六桶会话管理 + 批量操作 + 回收站 | ✅ 成熟 | 功能超出规模需求，但已稳定（本轮修复后） |
| 未读计数 / 通知 | ✅ 成熟 | 实时从回执表推导，无计数器漂移，设计正确 |
| 多实例水平扩展 | ⚠️ 半成品 | Redis adapter + presence 已就绪，但内存限流/内存队列多实例失效——**当前无需修复，单实例即可**；且已决定摘除 Redis（§9.6） |
| 坐席绩效报表 / SLA / 机器人 | ❌ 无 | **正确的「无」**，不要做 |

---

## 4. 做得好的地方（应当保持的决策）

1. **推送 + 轮询双通道**：访客端 5s HTTP 兜底使 socket 掉线不丢消息，是低成本高收益的可靠性设计。
2. **Redis 严格可选**：无 `REDIS_URL` 时全链路内存降级，本地开发/小型部署零外部依赖。这是「可选依赖」的正确姿势——不是画大饼，是真能跑。正因如此，§9.6 的 Redis 摘除第一步可以做到**零代码改动**。
3. **未读数无状态推导**：从 `MessageReadReceipt` 实时计算而非维护增量计数器，从根上消灭了并发竞态导致的计数漂移。
4. **删除策略自洽**：软删 → 回收站 → 30 天清理 → admin-only purge，链路完整且有设计文档（`deletion-strategy.md`）支撑；本轮修复后「回收站内必为已结束会话」不变量在前后端双重守卫。
5. **搜索用 pg_trgm 而非引入搜索引擎**：完全匹配数据规模，零运维成本。
6. **权限门控清晰**：`chat.delete` 独立权限、purge 仅管理员，与全站 RBAC 一致。
7. **中文注释密度高且解释「为什么」**：大文件虽难读，但补丁注释保留了决策上下文（如批量删除守卫处注明了软删不阻断客户发消息的因果链）。

---

## 5. 问题与风险清单

### P1 — 无截止时间，下次进入该模块时顺手做

> 2026-07 评审修订：原 P0-1/P0-2 降级为 P1 首位。按本文第一约束重新拷问：≤100 后台用户规模下，
> 客服单会话通常仅几十条消息，「数千条长会话」被用户感知的概率很低，「1~2 周内处理」是
> 错误的紧迫感信号。保留在首位仅因它们是全系统唯一随数据量单调恶化的项，且合计成本约 1 天。

| # | 问题 | 说明 |
|---|------|------|
| P1-1 | **全量消息加载无分页**（原 P0-1） | `chat-room.service.ts` `ROOM_WITH_MESSAGES`（无 `take`）：打开会话一次性加载全部消息 + 每条的回执和附件。修法克制即可：加 `take: 200` 取最近消息 + 「加载更早」一档，**不要做**无限滚动虚拟化那套。→ §9.1 |
| P1-2 | **未读计数物化整表**（原 P0-2） | `getUnreadCountForUser`：`findMany` 全量消息 + `include readReceipts` 后内存过滤；`getNotificationCounts`：已在 DB 侧过滤未读，但仍物化每条未读消息的 id 行。前者改单条 count，后者改带过滤的关系计数，均无需缓存层。→ §9.2 |
| P1-3 | **三个巨型文件**：`chat-room.service.ts` 1,800 行、`ChatWidget.tsx` 2,095 行、`ChatMessenger.tsx` 1,636 行 | 单文件承载全部状态机+补丁，新人接手成本高、改动波及面难评估。**但注意：拆分本身也是成本**——建议只在下次因 bug 必须动这些文件时「顺手」按职责切 2~3 块（如 service 拆出 trash/notification 部分），不要发起专项重构。 |
| P1-4 | **前端零测试** | Admin 端 12 个防闪烁/时序补丁（P0/P1/P2、H/M 系列）全靠手工回归。本轮「回收站按钮可用」bug 正是无测试守护的典型回归。建议只为**已修复的 bug** 补最小化回归测试（批量删除守卫、回收站只读门控约 3~5 个用例），不追求覆盖率。→ §9.3 |
| P1-5 | **坐席 token 15 分钟 + 10 分钟刷新的时序脆弱** | 电脑休眠唤醒后可能出现刷新窗口错过 → 静默掉线。轮询兜底能掩盖大部分症状，但值得在唤醒事件（`visibilitychange`）时主动补一次刷新。→ §9.4 |
| P1-6 | **访客 token 失效后无续期链路（真 bug）** | `useVisitorChat.ts` 的 auth-error 处理仅用**原 token** 1 秒后重连，不重新兑换、不更新 `sock.auth`——token 一旦失效（过期、换签名密钥）即陷入重连循环。原方案捆绑的「有效期 30d→7d 收紧」经评审移入 §7 不做清单。→ §9.5 |

### P2 — 记录在案，当前规模明确不修

| # | 问题 | 不修的理由 |
|---|------|-----------|
| P2-1 | 内存限流多实例失效 | 当前单实例部署；≤100 后台用户 + 少量访客根本触不到多实例。真要横向扩容那天再改 Redis 计数。 |
| P2-2 | 等待队列 `setInterval` 进程内疏导，重启丢队列态 | 重启后 60s 自动维护任务会重建状态，实际影响是秒级的重复通知，可接受。 |
| P2-3 | `enrichRoomsWithPresence` 对列表每行查 presence | 列表分页 ≤50 行，Redis/内存查询都是亚毫秒级，规模内无感。 |
| P2-4 | socket 事件面较大（20 入 + 23 出），无 schema 校验层 | 加 zod 校验每个事件 payload 属于典型过度设计；两端同仓库、类型共享自 `packages/types`，编译期已覆盖大部分风险。 |

### 案例复盘：回收站不变量 bug 链（2026-07 已修复）

本次评估前刚修复的一组关联 bug，值得作为「守卫要前后端同口径」的案例留档：

1. 服务端批量软删 `softDeleteRooms` 缺状态守卫（单删有、批量没有）→ 「进行中」会话进入回收站；
2. 前端 `ChatHeader` 按钮门控只看 `status` 不看 `deletedAt` → 回收站会话 5 个操作按钮全部可用；
3. 前端批量删除守卫又过粗（当前打开的会话无条件跳过）→ 已关闭会话反而删不掉。

**教训**：同一业务不变量（回收站内必为已结束）在单删/批删、前端/服务端出现了四种不同口径。
修复后口径统一为：服务端 `where status in (closed, archived)` 双保险 + 前端预过滤提示 + 回收站视图整体只读化。
新增此类状态门控时，检查清单应为：单个操作、批量操作、REST、socket、UI 五处口径一致。

---

## 6. 过度设计审视（对照 ≤100 后台用户）

按「该复杂度在当前规模下是否兑现价值」逐项评估：

| 设计 | 复杂度 | 当前规模下的判定 |
|------|--------|-----------------|
| Redis presence 双实现（265 行） | 中 | ❌ **决定摘除（2026-07 二次评审）**——生产 compose 里为它跑着一个带 AOF 持久化的 Redis 容器（api 还 `depends_on` 它），代码消费方却只有 support 模块 + health check。在线状态本质是易失数据（socket 重连即重建），单实例内存模式零功能损失。先运维摘除（零代码）、后代码摘除（可选），见 §9.6。 |
| Socket.IO Redis adapter | 低 | ❌ 随 Redis 一并摘除（§9.6）——单实例下 adapter 无事可做。 |
| 消息搜索抽象层（`MessageSearchService` 接口 + pg_trgm 单实现） | 低 | ✅ **保留不删（2026-07 二次评审）**——几十行的死抽象不运行、不出 bug、不需升级，维护成本≈0；删除却要动搜索调用链 + DI 注册。收益接近零的删除是另一种过度设计。 |
| 消息级已读回执表（精确到消息×用户） | 高 | ⚠️ **偏重**。≤10 坐席场景「会话级最后已读时间戳」即可，且是 P1-2 性能问题的根源。但推倒重来不划算——只优化查询（§5 P1-2），不动模型。 |
| 六桶会话管理（all/waiting/active/closed/archived/deleted） | 中 | ⚠️ closed 与 archived 双终态对小团队认知负担偏高（本轮 bug 部分源于此）。**不建议现在合并**（数据/UI 改动面大），但未来若重做 UI 可考虑合并为「已结束」。 |
| 批量操作 + 预过滤 + 服务端双保险 | 中 | ✅ 合理，批量是真实高频需求，双保险是本轮 bug 的正确答案。 |
| 约 12 个防闪烁/时序补丁（P0/P1/P2、H/M 系列） | 高 | ⚠️ 这是**演进式补丁堆积**而非过度设计——每个补丁都对应真实症状。风险在于无测试守护 + 补丁间相互作用难推理。对策见 §5 P1-4。 |
| ChatPendingUpload 上传占位 + 每日孤儿清理 | 中 | ✅ 合理，S3 直传必然产生孤儿对象，清理是刚需。 |
| 转接 / 接管 / 坐席花名册（agent-roster） | 中 | ⚖️ 对 2~3 坐席团队略超前，但属于「客服系统的常识性功能」，保留。 |
| 访客端 2,095 行单文件 ChatWidget | 高 | ⚠️ 单文件本身即技术债，但功能稳定、无活跃开发。**冻结即可**，见 §7。 |

**量化印象**：约 70% 的复杂度服务于当前规模的真实需求，约 30%（消息级回执、六桶、部分多实例预留）属于「为未来买的保险」。
这些保险已经买了、退保（重构删除）的成本**通常**高于保费，所以默认策略是**停止续保**——不再沿这些方向加码。
唯一例外是 Redis（§9.6）：它不只是代码，还是生产环境里一个要监控、要升级、要挂持久化卷的**活服务**，
退保第一步零成本（去掉环境变量即降级），收益是真金白银的运维简化——这类「删除有真实回报」的项才值得动手。

---

## 7. 「不建议做」清单（防过度设计红线）

以下事项在 ≤100 后台用户、小团队前提下**明确不做**，除非出现真实、反复的用户反馈：

1. ❌ **消息队列**（BullMQ/RabbitMQ）——进程内 `@Interval` 定时任务完全够用。
2. ❌ **Elasticsearch / 独立搜索服务**——pg_trgm 上限远未触及。
3. ❌ **多实例部署与配套改造**（Redis 限流、分布式队列）——单实例 + PM2/容器重启策略即可。
4. ❌ **机器人 / 自动回复 / AI 客服**——先有人工客服的真实流量再谈。
5. ❌ **坐席绩效报表、SLA 计时、满意度评分**——≤10 坐席用嘴沟通比报表快。
6. ❌ **ChatWidget / ChatMessenger 专项大重构**——冻结现状，仅在修 bug 时顺手拆分。
7. ❌ **消息端到端加密、审计留痕升级**——现有 HTTPS + JWT + RBAC 已匹配数据敏感度。
8. ❌ **socket 事件 zod 运行时校验层**——同仓库共享类型已覆盖，收益不抵成本。
9. ❌ **前端测试覆盖率工程**——只为已修 bug 写回归用例，不设覆盖率目标。
10. ❌ **消息虚拟滚动 / 无限加载**——P1-1 的「最近 200 条 + 加载更早」一档即封顶。
11. ❌ **访客 token 有效期收紧（30d → 7d）**——匿名访客会话无敏感数据，安全收益不抵前后端改动；续期缺口作为真 bug 单独修（§9.5），修完后有效期长短不再影响可用性。

---

## 8. 行动建议（全部无截止时间——下次进入该模块时顺手做；合计约 2~3 人日）

| 顺序 | 动作 | 预估 | 落地细则 |
|--------|------|------|---------|
| 1 | P1-1：`ROOM_WITH_MESSAGES` 加 `take: 200`（最近消息）+ REST 补一个「加载更早」参数 | 0.5 天 | §9.1 |
| 2 | P1-2：`getUnreadCountForUser` / `getNotificationCounts` 改 SQL 计数 | 0.5 天 | §9.2 |
| 3 | P1-4：为本轮修复的回收站/批量删除 bug 补 3~5 个服务端回归用例（前端可暂缓） | 0.5 天 | §9.3 |
| 4 | P1-5：Admin 坐席端 `visibilitychange` 唤醒时主动刷新 chat token | 0.25 天 | §9.4 |
| 5 | P1-6：访客 token 失效后的续期链路修复 | 0.25 天 | §9.5 |
| 6 | Redis 摘除第一步（运维层，零代码）：去 `REDIS_URL` + compose 删 redis 服务 | 0.25 天 | §9.6 |
| 6b | Redis 摘除第二步（代码层，**可选**，第一步跑稳后顺手做） | 0.5~1 天 | §9.6 |
| — | 其余全部进入「不做」或「顺手做」清单 | — | — |

完成以上 6 项后，本系统在目标规模下即可视为**功能封版**，转入纯维护模式。

---

## 9. 实施细则（逐项落地方案，尚未动代码）

> 以下方案已逐项核对过实际代码位置与调用链，可直接按此执行。
> 每项均含：涉及文件 → 具体改法 → 兼容性注意 → 验收标准。

### 9.1 P1-1：消息加载封顶 + 「加载更早」一档

**现状**：`chat-room.service.ts` 的 `ROOM_WITH_MESSAGES`（约 L330）对 `messages` 无 `take`，
5 个使用点（`createChatRoom`、`getChatRoomById`、`getChatRoomByClientEmail`、
`getMostRecentChatRoomByClientEmail`、`getAllChatRoomsForClient`）均一次性加载全部消息
及每条的回执与附件。

**改法（服务端）**
1. `ROOM_WITH_MESSAGES.messages` 增加 `orderBy: { timestamp: 'desc' }, take: 200`，
   在 `mapRoom` 中将消息数组 `reverse()` 恢复升序（现有前端按升序渲染，接口形状不变）。
   注意：ChatMessage 的排序字段是 **`timestamp`**（非 `createdAt`），与现有 `orderBy: { timestamp: 'asc' }` 一致。
2. `getChatRoomById` 增加可选参数 `beforeMessageId?: string`：传入时消息子查询附加
   `(timestamp, id) < (该消息的 timestamp, id)` 的**双键 keyset 条件**——单用 `timestamp <`
   在同一时间戳多条消息时会漏消息/重复，参照 `getChatRooms` 已有的 `(lastActivity, id)`
   keyset 分页范式（代码里现成可拄）——返回更早的一页（同样 200 条封顶）。
   REST `GET /chat-rooms/:roomId` 透传同名 query 参数；socket `get-room-info` 不改（仅用于打开会话首屏）。
3. `getAllChatRoomsForClient`（访客端历史会话列表）改为不含消息体、只带最后一条预览——
   与坐席端列表 `getChatRooms` 同口径；访客点开历史会话时已走 `getRoom` 单独拉取，无功能损失。
4. `createChatRoom` 的 include 保持不变即可（新会话消息数为 0/1，`take` 无副作用）。

**改法（前端，两端各一个按钮）**
- Admin `ChatArea.tsx` / Web `ChatWidget.tsx`：当首屏消息数恰为 200 时，在消息列表顶部渲染
  「加载更早消息」按钮，点击后以最早一条的 `messageId` 调 `beforeMessageId` 参数，结果前插。
  **明确不做**：无限滚动、虚拟化、滚动位置锚定动画——按钮 + 前插即封顶。

**兼容性注意**
- 未读计数与已读标记逻辑（`markMessagesRead`、`getNotificationCounts`）均独立查询，不依赖
  `ROOM_WITH_MESSAGES`，不受影响。
- Web 访客端 5s 轮询兜底走 `getRoom`，自动获得同样的封顶行为，无需单独处理。

**验收**
- 最低验收档（必做，约 5 分钟）：脚本造一个 250 条消息的会话，打开会话在网络面板确认
  响应仅 200 条，点一次「加载更早」补齐其余 50 条；
- 完整验收（有时间再做）：坐席端/访客端双端逐页加载直至最早一条；关闭/归档/删除/转接流程回归无异常。

### 9.2 P1-2：未读计数改 SQL 聚合

**现状**：
- `getUnreadCountForUser`（`chat-room.service.ts` 约 L1391）：`findMany` 拉取会话内**全部**对方消息
  并 `include readReceipts`，在内存中 `filter` 计数——O(全部消息)。
- `getNotificationCounts`（约 L1414）：已在 DB 侧用 `readReceipts: { none: ... }` 过滤未读，
  但 `select { id }` 仍逐条物化未读消息行，再在内存里 `length` 求和。

**改法**
1. `getUnreadCountForUser` 改为单条 count 查询：
   `prisma.chatMessage.count({ where: { room: { roomId }, sender: oppositeSender, readReceipts: { none: { userEmail } } } })`。
   注意语义对齐：现有内存过滤只按 `userEmail` 匹配回执（不校验 userType），`none` 条件保持只写
   `userEmail`，行为完全等价。
2. `getNotificationCounts` 把 `messages: { where: ..., select: { id: true } }` 改为
   `_count: { select: { messages: { where: <原过滤条件不动> } } }`（Prisma 支持带过滤的关系计数），
   后续累加逻辑从 `room.messages.length` 改读 `room._count.messages`。**where 过滤条件一字不改**，
   包括坐席端仅统计 active/waiting 会话、client/agent 两分支的回执过滤。

**验收**
- 最低验收档（必做）：现有 spec 全绿 + 打开一个部分已读会话，改前后未读角标数字一致；
- 完整验收：新增 2 个用例（①部分已读会话计数正确；②跨 client/agent 两视角计数互不串扰）。

### 9.3 P1-4：回收站不变量回归测试（仅服务端）

**位置**：新增 `apps/api/src/support/chat-room.trash.spec.ts`，
与现有 `*.integration.spec.ts` 同框架（Jest，根 `pnpm --filter api test` 运行）、同 mock 风格。

**用例清单（5 个，对应 §5 案例复盘的四种口径）**
1. `softDeleteRooms`（批量）：混合传入 closed/archived/active/waiting 四种状态的 roomId，
   仅前两者被软删，返回 count 精确等于已结束会话数；
2. `softDeleteChatRoom`（单删）：对 active 会话调用被拒绝（保持与批量同口径）；
3. `restoreChatRoom`：恢复后 `deletedAt = null` 且 status 保持原值（closed 恢复后仍是 closed）；
4. `purgeChatRoom`：物理删除会话行，且关联 `Customer.chatRoomId` 被置空断链；
5. 回收站列表（`getChatRooms` 带 `deleted: true`）：仅返回 `deletedAt` 非空的会话，
   且全部满足 status ∈ {closed, archived}（不变量断言）。

**明确不做**：前端组件测试、E2E、覆盖率目标——只守护这 5 个已知回归点。

### 9.4 P1-5：坐席端唤醒时主动刷新 chat token

**位置**：`apps/admin/src/features/chat/ChatPresenceProvider.tsx` L57-62 的定时刷新 effect。

**现状与缺口**：`setInterval` 10 分钟刷新（token 15 分钟）依赖 JS 定时器持续运行；
电脑休眠时定时器冻结，唤醒后若已越过 15 分钟窗口，socket 静默掉线，
需等下一个 interval tick 或 `auth-error` 兜底才恢复。

**改法**：在同一 effect 内追加 `document.addEventListener('visibilitychange', ...)`：
`visibilityState === 'visible'` 时立即 `void fetchToken()`；加一个 30 秒节流
（记录上次刷新时间戳，间隔内不重复请求），避免频繁切 tab 打请求。
cleanup 中同步移除监听。现有 `auth-error → fetchToken` 兜底保留不动。

**验收**
- 最低验收档（必做，零成本）：午休合盖/切走标签页超过 15 分钟后回来，直接发一条消息成功即通过；
- 完整验收：模拟休眠（DevTools 暂停 20 分钟或真实合盖）后唤醒，30 秒内 socket 重连成功、
  收发消息正常，全程无需手动刷新页面。

### 9.5 P1-6：访客 token 失效后的续期链路修复

**现状（真 bug，核对代码确认）**：
访客端把 token 持久化在 localStorage，恢复会话时**只要 stored.token 存在就直接使用**
（`ChatWidget.tsx` 约 L657），仅在 token 缺失时才重新兑换；而 `useVisitorChat.ts` 的
`auth-error` 处理只是 1 秒后用**原 token** 重连——并未重新兑换 token、也未更新 `sock.auth`。
token 一旦失效（过期、服务端更换签名密钥等），访客端会陷入
「auth-error → 原 token 重连 → 再次 auth-error」的循环。

**改法**：`ChatWidget` 监听 auth-error（经 `useVisitorChat` 透出回调或事件），
用 localStorage 中的 `email + roomId` 调 `fetchVisitorToken` 重新兑换，`setToken` 并回写
localStorage；`useVisitorChat` 重连前同步更新 `sock.auth.token`。

**明确不做（2026-07 评审修订）**：原方案捆绑的「有效期 30d → 7d 收紧」移入 §7 不做清单——
匿名访客会话无敏感数据，安全收益不抵改动；修完续期链路后，有效期长短不再影响可用性。

**验收**
- 最低验收档（必做，约 1 分钟）：手工把 localStorage 中 token 替换为任意非法字符串 → 刷新页面，
  访客自动完成「兑换新 token → 重连 → 历史消息可见」，无循环报错；坐席端 token（15m）行为不变。

### 9.6 Redis 摘除（先运维、后代码，2026-07 二次评审增补）

**背景与事实核验（grep 确认）**：代码中 Redis 的消费方仅两处——
`support.module.ts`（`createClient` ×3：pub/sub/presence）+ `chat.gateway.ts`（redis-adapter 装配）
+ `chat-presence.store.ts`（双实现的 Redis 分支），另有 `health.service.ts` 的可选检测
（无 `REDIS_URL` 时自动跳过）。而部署面上，`docker-compose.prod.yml` 为它运行着带 AOF
持久化卷的 redis:7 容器，api 服务 `depends_on` 它。在线状态是易失数据（socket 重连即重建），
单实例下内存模式无功能损失——本地开发一直这么跑。

**第一步：运维摘除（零代码、可逆，收益兑现 90%）**
1. `.env.prod` 去掉 `REDIS_URL`（先确认确实设了）；本地 `.env` 同理。
2. `infra/docker/docker-compose.prod.yml`：删 redis 服务、api 的 `depends_on: redis`、`redisdata` 卷；
   `docker-compose.dev.yml` 同理（确认无其它消费方后）。
3. health check 检测到无 `REDIS_URL` 会自动跳过，无需改动。
4. 回退预案：加回环境变量 + compose 定义即恢复 Redis 模式，无数据迁移问题（在线状态易失）。

**第二步：代码摘除（可选，第一步跑稳一两周后顺手做）**
1. 删 `chat-presence.store.ts` 的 Redis 分支（保留内存实现）；
2. 删 `support.module.ts` 的 `createClient` 三连与相关 provider；
3. 删 `chat.gateway.ts` 的 redis-adapter 装配与 `health.service.ts` 的 redis 检测分支；
4. `package.json` 移除 `redis`、`@socket.io/redis-adapter` 两个依赖（持续收益：少两个要跟安全更新的包）；
5. `env.validation.ts` 去掉 `REDIS_URL` 定义。

风险可控：现有集成测试全部基于 `new ChatPresenceStore(null)`（内存模式）编写，
删除后保留的正是有测试护航的那条路径。

**明确不做**：不同步摘除消息搜索抽象层（`MessageSearchService`）——死抽象维护成本≈0，
删除收益接近零却要白担改动风险，见 §6 判定。

**验收**
- 最低验收档（第一步，必做）：无 `REDIS_URL` 启动 API，日志显示内存模式；访客/坐席双端收发消息、
  在线状态圆点、断线宽限期正常；health 端点不报 redis 异常。
- 完整验收（第二步）：现有 spec 全绿 + `pnpm --filter api build` 通过 + 生产部署后观察一周无 presence 异常。

---

## 附录 A：Socket 事件清单（出站，节选自 `chat.gateway.ts`）

`new-message` `room-status-changed` `room-list-updated` `room-info` `room-transfer-notice`
`room-transferred-in` `presence-changed` `my-presence` `agents-online` `agent-roster`
`agent-registered` `notification-counts` `notification-counts-updated` `notification-count-reset`
`messages-read` `typing` `stop-typing` `user-joined` `user-left` `joined-room` `left-room`
`auth-error` `error`

## 附录 B：定时任务清单

| 周期 | 任务 | 位置 |
|------|------|------|
| 10s | 等待队列疏导 `drainWaitingQueue` | `chat.gateway.ts`（setInterval） |
| 15s | presence 过期扫描 | `chat.gateway.ts` `@Interval` |
| 60s | 会话自动维护（超时关闭等） | `chat.gateway.ts` `@Interval` → `chat-room.service.ts` |
| 5min | 限流/typing 节流 Map 清理 | `chat.gateway.ts` `@Interval` |
| 每日 3AM | 孤儿附件清理 + 回收站 30 天过期清理 | `chat-attachment-cleanup.service.ts` `@Cron` |

## 附录 C：相关文档

- `docs/design/deletion-strategy.md` — 删除/回收站策略设计
- `apps/api/scripts/clean-dirty-trashed-chatrooms.ts` — 回收站脏数据一次性清理脚本（2026-07，已执行完毕）
