# 聊天系统四项专项代码排查报告

> 排查日期：2026-07（姊妹篇：`docs/chat-support-evaluation.md` 总体评估报告）  
> 排查前提：**小而美团队，短期内后台用户 ≤ 100 人；以「防止过度设计、保持简洁实用」为第一约束。**  
> 排查方式：只读代码取证（全仓 grep 交叉比对 + 关键文件精读），未改动任何代码。  
> 排查对象：①消息搜索抽象层 ②坐席列表虚拟滚动 ③双通道数据源 ④43 socket 事件 + 33 REST 端点协议面

---

## 0. 结论速览（TL;DR）

| # | 项 | 写法对吗 | 有 bug 吗 | 一句话判定 |
|---|-----|---------|----------|-----------|
| 1 | 消息搜索抽象层（pg_trgm） | ✅ 对 | ⚠️ 1 个轻微不一致 | SQL 安全、索引真实存在；仅元数据搜索大小写口径与正文不一致 |
| 2 | VirtualList 虚拟滚动 | ✅ 基本对 | ⚠️ 3 个小瑕疵（无实害） | 实现正确但**设计前提永远不会发生**——列表是分页的，「万级条目」到不了它手里 |
| 3 | 双通道（socket + 5s 轮询） | ✅ 对，是全系统亮点 | ✅ 无实质 bug | 去重/竞态守卫齐全；唯一代价是轮询拉全量消息，与 P1-1 叠加放大 |
| 4 | 协议面（20 入 + 23 出 + 33 REST） | ⚠️ 面偏大 | ❌ **约 1/3 是死接口** | REST 33 个中 **14 个无任何调用方**（含整个工单子系统 8 个）；socket 3 入站 + 6 出站为死事件 |

**最重要的发现是第 4 项**：死接口不是「预留」，是已经无人认领的负债——每个死端点都仍在被鉴权、限流、
Swagger 文档和新人阅读成本「供养」。其余三项均属「写得对、略超规格」，无需动。

---

## 1. 消息搜索抽象层（`MessageSearchService` + `PgTrgmMessageSearchService`）

**文件**：`apps/api/src/support/message-search.service.ts`（101 行）；唯一调用方 `chat-room.service.ts` `getChatRooms`（搜索时并入 where.OR）；DI 注册于 `support.module.ts`（`useClass` 单实现）。

### 1.1 写法核验：正确 ✅

| 检查点 | 结论 | 证据 |
|--------|------|------|
| SQL 注入 | 安全 | 全程 `Prisma.sql` 参数化模板，无字符串拼接 |
| LIKE 通配符转义 | 正确 | `toLikePattern` 转义 `% _ \` 三个元字符 |
| `DISTINCT ON` 用法 | 正确 | 子查询内 `ORDER BY chatRoomId, similarity DESC, timestamp DESC` 与 DISTINCT ON 列前缀匹配，外层再按相关度全局排序——教科书写法 |
| limit 钳制 | 正确 | `Math.min(Math.max(limit, 1), 200)`，调用方传 200 |
| 软删过滤 | 正确 | `WHERE r."deletedAt" IS NULL`，回收站会话不进搜索 |
| 权限不绕过 | 正确 | 命中会话 id 并入 `getChatRooms` 外层 where（状态/桶/权限过滤复合生效），正文命中不越权 |
| 短词防噪 | 正确 | `< 2` 字符直接返回空，避免 trigram 无意义扫描 |
| GIN 索引真实存在 | 是 | `prisma/migrations/0_init/migration.sql` L3 建 pg_trgm 扩展、L935 建 `chat_messages_content_trgm_idx`（GIN + gin_trgm_ops），非「口头索引」 |

### 1.2 发现的问题

**A-1（轻微·口径不一致）**：`getChatRooms` 的元数据搜索
`{ clientName: { contains: q } }` / `{ clientEmail: { contains: q } }`（chat-room.service.ts L1054-1055）
**未加 `mode: 'insensitive'`**——PostgreSQL 下 Prisma `contains` 默认大小写敏感；
而正文搜索走 `ILIKE` 不敏感。结果：搜 `john` 能命中正文含 "John" 的消息，
却搜不到 clientName 为 "John" 的会话。修复是加两个 `mode: 'insensitive'` 的一行事，
可与 P1 批次顺手带上。

**A-2（已知局限·不修）**：`similarity()` 对中文相关度排序效果弱（trigram 对 CJK 分词粒度粗），
但 `ILIKE` 保证了召回不漏，只是排序不够聪明。当前规模无感知，记录即可。

### 1.3 抽象层本身（对照第一约束）

抽象是「一个 abstract class + 一个实现 + 一行 useClass」，维护成本≈0。
**保留不删**——与评估报告 §6 判定一致，此处不再重复论证。

---

## 2. 坐席列表虚拟滚动（`VirtualList.tsx`）

**文件**：`apps/admin/src/features/chat/components/VirtualList.tsx`（76 行）；
唯一使用点 `ChatConversationList.tsx` L471（`rowHeight={84}`）。

### 2.1 写法核验：基本正确 ✅

固定行高窗口化的标准三件套都对：`start = floor(scrollTop/rowHeight) - overscan`（钳 0）、
撑高容器 `height: total * rowHeight`、内层 `translateY(offsetY)` 平移。
`ResizeObserver` 监听容器高度、空态占位、零第三方依赖——作为 76 行的手写件，质量合格。

### 2.2 发现的问题（3 个小瑕疵，均无实际危害）

| # | 问题 | 影响 | 处置 |
|---|------|------|------|
| B-1 | `items` 收缩（如切桶/搜索过滤）时 `scrollTop` state 不钳制，瞬时 `start > total` 渲染空切片 | 一帧空白后浏览器自动回卷 scrollTop 触发 onScroll 自愈 | 不修 |
| B-2 | 每个 scroll 事件直接 `setState` 全量重渲染，无 rAF 合帧 | 列表行数小（见 2.3），实测无感 | 不修 |
| B-3 | 行 key 用 `(item as { roomId?: string })?.roomId ?? start + i` 类型断言 hack，泛型组件却偷看具体字段 | 仅代码洁净度问题；fallback 索引 key 在增删时可能错位复用（当前 items 都有 roomId，走不到 fallback） | 不修 |

另注意一个**使用契约**：行高硬编码 84px 且行容器无 `overflow-hidden`，行内容若因文案换行变高会溢出到下一行区域。当前行内容有 truncate 约束，成立但脆弱——将来改行内布局时需记得这条隐含契约。

### 2.3 对照第一约束：设计前提落空的超规格件

关键事实：**会话列表本身是游标分页的**——`ChatConversationList.tsx` L576 有「加载更多」按钮
（P1 游标分页，每页 20 条，`ChatMessenger.tsx` L38 `PAGE_SIZE = 20`）。
要让 VirtualList 面对「万级条目」，坐席需要手点约 500 次「加载更多」。
也就是说，虚拟化要解决的问题**被上游分页挡住了，永远不会发生**。

判定：无 bug、已建成、76 行成本已付清——**冻结即可，不删也不再投入**。
但它是「按 1000 坐席规格建造」的典型标本：为不会出现的数据量写的优化。
教训供未来参考：加性能件之前先看数据入口有没有天然上限。

---

## 3. 双通道数据源（socket 推送 + 5s HTTP 轮询自愈）

**文件**：访客端 `ChatWidget.tsx` L855-891（syncMessages）+ L672-684（handleNewMessage）；
坐席端 `ChatMessenger.tsx` 三处合并（重连补拉 / 5s 轮询 / handleSelect，前次排查已核）。

### 3.1 写法核验：正确，且是全系统质量最高的部分 ✅

逐项过竞态检查清单：

| 检查点 | 结论 | 证据 |
|--------|------|------|
| 双通道去重 | ✅ | 轮询合并用 `Map<messageId>` 并集；socket 到达用 `prev.some(m => m.messageId === msg.messageId)` 防重——两条路径同键去重，不会双写 |
| 过期响应守卫 | ✅ | `if (r.roomId !== roomIdRef.current) return`——切换会话后迟到的轮询响应被丢弃 |
| 快路径 | ✅ | `prev.length >= serverMsgs.length` 时跳过 setState，避免 5s 一次的无效重渲染 |
| 乐观发送闭环 | ✅ | 自己消息的 socket 回声清 `pendingOutgoingRef`；发送失败走 REST 重拉全量兜底（L1239） |
| 页面唤醒补拉 | ✅ | `visibilitychange` 非隐藏即 syncMessages，休眠唤醒场景 5s 内自愈 |
| 房间错投 | ✅ | `rid !== roomIdRef.current` 的消息直接丢弃 |
| 后台耗电 | ✅ | 浏览器对后台 tab 定时器天然节流至 ~1 次/分钟，无需自己处理 |

### 3.2 已知代价与两个理论缺口（均不构成当前要修的 bug）

**C-1（真实代价·已有修复计划）**：轮询调的 `getRoom` 返回**全量消息 + 回执 + 附件**
（`ROOM_WITH_MESSAGES` 无 `take`），即每个打开的访客窗口每 5 秒全量拉一次历史。
这不是双通道的错，是 P1-1 的放大器——评估报告 §9.1 的 `take: 200` 落地后自动缓解，
此处不新增行动项。

**C-2（理论缺口·不修）**：快路径按「条数」比较——若服务端删一条同时加一条（条数不变）会漏同步。
现实中消息不可删除，此路径不存在。

**C-3（理论缺口·不修）**：合并后排序仅按 `timestamp` 无 `id` 决胜键，同毫秒消息在两次渲染间
顺序理论上可抖动。访客场景同毫秒双消息概率极低，且 P1-1 双键分页落地后服务端口径统一，届时顺手对齐即可。

判定：**这套「推保实时、拉保正确」的架构是应当写进团队备忘的正面样板**，5s 轮询在
≤100 用户规模下的服务端压力可忽略（P1-1 修复后更是）。

---

## 4. 协议面盘点：20 入站 + 23 出站 + 33 REST

盘点方法：服务端定义（`@SubscribeMessage` / `@Get|@Post|@Put|@Delete` / `emit(`）与
**全仓库**消费方（apps/admin、apps/web、packages、scripts、infra）逐一交叉 grep。

### 4.1 REST：33 个端点中 14 个是死接口（42%）❌

**chat-rooms 前缀（25 个中 6 个死）**——以下端点全仓无任何调用方：

| 死端点 | 推测死因 |
|--------|---------|
| `GET /chat-rooms/notifications/counts` | 通知计数走了 socket `get-notification-counts`，REST 版从未接线 |
| `GET /chat-rooms/unread/count` | 同上，socket 化后遗留 |
| `GET /chat-rooms/:roomId/unread-count` | 同上 |
| `PUT /chat-rooms/:roomId/notifications/reset` | 与 socket 死事件 `reset-notification-count` 成对死亡 |
| `GET /chat-rooms/client/:clientEmail/history` | 访客端实际用 `/recent` + `/rooms/:roomId` 两个端点 |
| `GET /chat-rooms/client/:clientEmail` | 同上 |

其余 19 个端点均核实有真实调用方（含经 admin BFF `app/api/chat/token/route.ts` 中转的 `POST /chat-rooms/token`）。

**support 前缀（8 个全死）**——`SupportController` 的工单 CRUD + 评论 + `admin/stats`
在 admin、web、scripts 中**零调用**。这意味着整个工单子系统是死功能：
`support.controller.ts`（142 行）+ `support.service.ts`（260 行）+ `create-ticket.dto.ts`（84 行）
≈ **490 行代码 + 两张数据表（`Ticket`、`Comment`）在供养一个没有任何界面入口的功能**。
（已核实 `prisma.ticket` / `prisma.comment` 在全 API 仅 support.service.ts 使用，Comment 表为工单专用，
不与博客/新闻等其它模块共用，整体移除无连带影响。）
推测是早期规划的「工单系统」，后来被实时聊天 + 询盘模块取代，但代码没有随决策一起退场。

### 4.2 Socket：3 个死入站 + 6 个死出站 ⚠️

**死入站**（服务端有 handler，两端客户端从不 emit）：

- `get-room-info`（连同其唯一响应事件 `room-info` 成对死亡）
- `get-presence`
- `reset-notification-count`

**死出站**（服务端 emit，两端客户端无监听器，发出即蒸发）：

- `room-info`、`agent-registered`、`joined-room`、`left-room`、`user-joined`、`notification-count-reset`

其余 17 个入站、17 个出站均核实两端接线正常（web 端经 `handlersRef` 动态注册机制间接监听，已逐一比对 `ChatWidget` 的 `on('…')` 注册清单）。

### 4.3 判定与处置建议

死接口的持续成本是真实的：每个死 REST 端点仍挂着鉴权守卫、限流、Swagger 条目；
每个死 socket 事件仍占据 gateway 的阅读篇幅；新人建立心智模型时无法区分「活的 33」和「死的 14」。
这正是评估报告「1.4 万行心智负担」的组成部分——而且**删除它们有真实回报且零功能风险**（无人调用）。

建议按「只删不加」原则分两档处置（**均不紧急，下次进入该模块顺手做**）：

1. **随手删档**：6 个 chat-rooms 死端点 + 3 个死入站 + 6 个死出站 emit 调用——纯删除，
   预计半天内含回归（现有 spec 全绿即可）。
2. **决策删档**：工单子系统（~490 行 + `Ticket`、`Comment` 两张表）——删除前需人工确认一件事：
   **是否存在仓外消费方**（如第三方系统直接调 API）。确认没有后整体移除，
   顺带清掉 Prisma 中对应模型；若拿不准，至少先从 Swagger 中隐藏并加 `@deprecated` 注释。

> 注：本报告只记录、不动手。若确认执行，建议并入评估报告 §8 行动表作为第 7 项。

---

## 5. 总结：四项对照第一约束的最终画像

| 项 | 画像 |
|----|------|
| 搜索抽象层 | 写得对，超规格程度低，**保留**；带一个一行修复（大小写口径） |
| VirtualList | 写得对，但为不可能到达的数据量而建，**冻结** |
| 双通道 | 写得对且是正面样板，**保持**；代价项已被 P1-1 计划覆盖 |
| 协议面 | 定义得多、接线得少——**42% 的 REST 是死接口**，是四项中唯一值得主动动手的（纯删除、零风险、真回报） |

四项合起来再次印证评估报告的总判断：这套系统的问题从来不是「写错了」，
而是「建多了」。写法层面全部及格甚至优秀；需要管理的是规格与现实的差距——
死接口清理是差距中「零风险可兑现」的那部分。
