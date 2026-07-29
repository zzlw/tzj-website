# B 端权限系统评估报告

> **评估对象**: TZJ 应急救援训练装备管理后台 (apps/admin + apps/api)
> **评估时间**: 2026-07-29
> **版本**: v9.2（P1/P1b/P2 代码整改已全部落地并通过卡口验证；新增勘误第 7 条：修复评估遗漏的 `access.manage` 相邻提权链）
> **前提约束**: 小而美团队、后台用户 ≤ 100 人，防止过度设计、保持简洁实用
> **状态**: 已评审 + 代码验证 + 整改闭环 ✅（pnpm check / turbo typecheck / jest 42 测试全绿，check-permissions.mjs 171 端点 0 裸）

---

## 执行摘要

TZJ 后台采用成熟的 RBAC 模型：JWT 认证 + 角色/权限双重校验 + 可选强制 2FA + 完整审计追踪。整体架构达到企业级标准，**可直接投入生产环境使用**。

对 ≤100 人的小团队，当前系统已经"够用且不臃肿"。原排期的 **3 项代码整改（P1/P1b/P2）已全部落地**，另修复了评估遗漏的**相邻提权链**（见勘误第 7 条）；仅剩 1 项运营动作（P3），见第三章；其余一律列入「明确不做」清单（见第四章）。

### 核心能力（经代码核验）

✅ **分层鉴权**：BFF proxy → 限流 → JWT → IP 封禁 → 角色/权限 → 强制 2FA，五个全局 Guard 链式防护（注册顺序见 §1.1）
✅ **权限即时回收**：角色权限变更时立即失效缓存并**吊销该角色全部会话**（`roles.service.ts`），单实例部署下零延迟
✅ **强制 2FA**：TOTP + 待确认 Secret 机制 + Kill-switch 逃生通道
✅ **会话安全**：refresh token 轮换 + 宽限期、tokenHash 不存明文、多设备管理与远程吊销
✅ **防爆破**：ClientIpThrottlerGuard 限流 + 账户级锁定 + 密码强度校验（长度/复杂度/弱口令黑名单）
✅ **公开写端点防滥用**：全局 120 次/分/IP 限流兜底；analytics 埋点另有显式 `@Throttle`（collect 120 / identify 60 次/分）；询盘表单服务端验证码校验（AliyunCaptchaService）；访客 token 兑换需 roomId+邮箱匹配
✅ **机密加密**：bcrypt（成本因子 12）、AES-256-GCM（TOTP Secret / 集成凭证）
✅ **审计日志**：全局拦截器自动覆盖所有已登录写操作（含敏感字段剔除），登录/权限变更/2FA 策略切换均有记录，含 traceId 链路追踪
✅ **前端双重防护**：9 条路由服务端 layout 守卫（`requirePermission`）+ 组件级权限渲染
✅ **Cookie 三要素**：httpOnly + secure + sameSite='lax'
✅ **WebSocket 独立鉴权**：`chatAuth.verify()` + IP 封禁检查（坐席豁免）

### 真实风险（按优先级）

✅（已修复）**Guard fail-open 兜底**：原 `RolesGuard` 对无注解端点默认放行。已改 **fail-closed**（无注解需显式 `@AuthenticatedOnly`/`@AllowUnenrolled` 且已登录，否则 403）+ CI 门禁 `scripts/check-permissions.mjs`（第三章 P1）
✅（已修复）**WS 坐席令牌兑换缺权限校验**：`exchangeAgentToken` 原仅验签 JWT。已加 `chat.view` 权限校验（经 RolesService 查库），无权限者无法兑换坐席 token（第三章 P1b）
✅（已修复）**AuditLog 无清理机制**：已加保留期定时清理 `audit-retention.service.ts`（第三章 P2）
✅（已修复）**相邻提权链（评估遗漏，勘误第 7 条）**：`access.manage` 持有者原可编辑自己角色的权限集实现自我提权。已在 `roles.service.ts` service 层对角色 create/update/remove 加 admin 硬校验（`assertAdminActor` 查库确认 `role === 'admin'` 且 isActive），单测覆盖 + 前端遮蔽
🟢 **自举弱点**：2FA 强制绑定期间，密码泄露者可绑定自己的验证器（业内公认取舍，已有缓解：setup 需重输密码 + 审计日志 + 绑定时间可见）
🟢 **超管锁死**：全体管理员丢失 2FA 设备 → 三层缓解已就绪：① 超管可用 `POST /auth/2fa/force-disable`（`@Roles('admin')`）为他人解绑；② Kill-switch `TWOFA_CHALLENGE_DISABLED`；③ 应急 Runbook（`docs/security/2fa-emergency-runbook.md`，SSH + psql 手工 SQL）
ℹ️ **无 RLS 行级安全**：Prisma 查询手动注入过滤条件。单租户内部系统 + 小团队规模下可控，不做（第四章）

### 总体评分

| 维度 | 得分 | 说明 |
|------|------|------|
| 认证安全 | 9.5/10 | JWT + 2FA + Refresh 轮换 + 限流防爆破 |
| 授权粒度 | 8.5/10 | 39 个原子权限，粒度对小团队足够甚至偏细 |
| 会话管理 | 9/10 | 轮换宽限期设计优秀，权限变更即时吊销会话 |
| 审计追踪 | 8/10 | 覆盖全面；保留期清理已补（P2 已落地） |
| 前端防护 | 8.5/10 | 服务端 layout 守卫 + 组件级渲染，边界处理清晰 |
| **综合** | **8.7/10** | 企业级水准，生产就绪；原扣分项 P1/P1b 及相邻提权链均已修复（评分待下次评审重估） |

---

## 一、架构速览

### 1.1 请求鉴权链

```
用户请求 (HTTP/WS)
  ↓
[1] apps/admin proxy.ts（Next.js 16 中 middleware 更名为 proxy）— 校验 JWT、自动 refresh 轮换（BFF）
  ↓
── 以下为 API 全局 Guard，按 app.module.ts 实际注册顺序 ──
[2] ClientIpThrottlerGuard — 全局限流（tracker 统一为真实客户端 IP）
  ↓
[3] JwtAuthGuard — 验签 + 有效期；@Public() 路由放行
  ↓
[4] IpBanGuard — 全局 IP 封禁（置于鉴权之后：豁免已认证管理员，仅拦截命中封禁名单的访客）
  ↓
[5] RolesGuard — 读取 @RequirePermissions / @Roles（方法级 + 类级），
    经 RolesService 查角色权限集合，不足则 403
    ✅ fail-closed：无注解端点必须显式 @AuthenticatedOnly / @AllowUnenrolled（且已登录），否则 403
  ↓
[6] TwoFactorEnforcementGuard — 强制 2FA 开启时拦截未绑定用户
    豁免：@Public / @AllowUnenrolled / kill-switch / 已绑定用户
  ↓
[7] Controller/Service — 业务鉴权（私海/公海、文档共享权限等）
    + 全局拦截器：TransformInterceptor（外层响应包装）→ AuditInterceptor（内层写操作审计，无需逐端点标注）
  ↓
[8] Prisma — 查询手动注入 owner/scope 过滤（无 RLS）
```

> WebSocket 不经过上述 HTTP Guard 链，由 `chat.gateway.ts` 的 `handleConnection` 独立鉴权：`chatAuth.verify(token)` + IP 封禁检查（坐席豁免），鉴权失败向客户端发 `auth-error` 并断开。坐席身份来自 `POST /chat-rooms/token` 用登录态 access token 兑换（**15 分钟短效期**；验签 + `chat.view` 权限校验——P1b 已落地）；访客身份来自 `POST /chat-rooms/visitor-token`（30 天长效期供刷新重连，需 roomId + 房间持有者邮箱匹配，防冒领）。消息层防护：单条上限 4000 字（WS/REST 双路径同限），REST 发送另校验发件人必须为房间持有者，防身份冒用。

### 1.2 令牌与会话

| 项 | 设计 |
|----|------|
| Access Token | 15 分钟，HTTP-only Cookie `tzj_at` |
| Refresh Token | 7 天，HTTP-only Cookie `tzj_rt`，仅存 sha256 hash |
| 轮换机制 | `rotatedToHash` + `graceUntil` 宽限期，解决双标签并发刷新竞态（OAuth 2.0 BCP） |
| 会话管理 | Session 表记录 userAgent/ip/lastUsedAt，支持后台查看与远程吊销 |
| 防爆破 | `failedLoginAttempts` + `lockedUntil` 账户锁定；2FA 敏感操作统一限流（`STRICT_THROTTLE` = 5 次/分钟/IP） |
| 2FA 绑定 | 待确认 Secret 15 分钟过期（`TWOFA_SETUP_TTL_MINUTES`，默认 15）；登录第二步 pending token 5 分钟（`TWOFA_PENDING_TTL_SECONDS`，默认 300s） |
| 2FA 豁免清单 | `@AllowUnenrolled` 仅 5 个端点：`GET /auth/2fa/status`、`POST /auth/2fa/setup`、`POST /auth/2fa/enable`、`POST /auth/logout`、`GET /auth/me`，攻击面最小化 |

### 1.3 前端权限控制

- **服务端 layout 守卫**（`apps/admin/src/lib/require-permission.ts`）：无会话→登录页；401→登录页；权限不足→首页；API 不可用→抛错给 error boundary 展示真实原因。共 **8 个守卫文件、覆盖 9 条路由**：`/users`、`/audit-logs`、`/system`、`/security`、`/documents`、`/visitors`、`/analytics`、`/settings/integrations`，另 `/access` 复用 users 守卫（re-export）。
- **守卫覆盖边界**（v9.0 盘点）：dashboard 共 **18 个路由段**，剩余 9 个业务路由（blog/cases/news/trade-shows/legal-pages/media/chat/contacts/customers）**无 layout 守卫**，依赖「侧边栏按权限隐藏入口 + 后端 API 逐请求 403」双层防护。非安全漏洞（数据层始终被后端拦截），但 P3 建角色后越权用户直达 URL 会看到报错页而非重定向，属 UX 级缺口（处理方式见 P3）。
- **权限来源**：`/auth/me` 实时查询，不信任 JWT 中的静态角色声明。
- **组件级渲染**：Sidebar 与各页面按 `permissions.includes(perm)` 或通配 `'*'` 决定是否渲染。
- **admin 兜底**：`/auth/me` 请求失败且角色为 admin 时，前端降级为 `permissions = ['*']`。这是**纯 UI 展示层兜底**——后端每个 API 请求仍独立鉴权，且 admin 服务端本就拥有全部权限，实际无害（此前 v8.0 误列为 P0，已纠正）。

---

## 二、事实基线（经代码核验，v9.0 修正）

以下数字以代码为准，修正了历史版本中的多处不一致：

| 项 | 实际值 | 历史版本错误 |
|----|--------|------------|
| 原子权限总数 | **39**（content 5 / media 4 / contacts 3 / customers 3 / analytics 1 / security 2 / docs 6 / support 6 / system 9） | v8.0 同时写过 46 和 35 |
| Controller 文件数 | **25** | v8.0 写 21 |
| 写操作端点（@Post/@Put/@Patch/@Delete） | **102 个**（逐端点解析类级+方法级装饰器）：**81** 个有权限/角色注解；**12** 个有意 `@Public`（访客埋点×2、登录/刷新/2FA 验证×3、询盘表单×1、访客聊天×6，逐个核对均属访客侧必需）；**9** 个「仅需登录」（见 P1 清单） | v8.0 写 76 个 / 100% 合规（口径不明） |
| 系统预置角色 | 仅 `admin`（超级管理员，全量权限）；`editor` / `viewer` 已废弃但保留鉴权基线映射，供自定义角色超集校验 | — |
| 权限缓存 | 5 分钟 TTL，但角色**创建/更新时立即 `invalidateCache()`**，权限变更时额外 `revokeSessionsForRole()` 吊销会话。**单实例部署下权限回收即时生效** | v8.0 声称"最高 5 分钟延迟，影响紧急回收"（不成立） |

> 端点合规数据来自 v9.0 逐端点静态审计（同时解析类级 + 方法级装饰器，即 P1 CI 脚本的判定逻辑）；后续以 CI 脚本持续守护。
>
> 其余关键参数核验：bcrypt 成本因子 **12**（users.service / auth.service 共 4 处）✅；Cookie `tzj_at`/`tzj_rt` 五处写入点均为 `httpOnly + secure(生产) + sameSite='lax'`（login/verify-2fa/proxy/tokenRefresh）✅；access cookie `maxAge=1h` 仅为兜底，实际有效期由 JWT `exp`（15m）决定 ✅；kill-switch `TWOFA_CHALLENGE_DISABLED` 存在且触发时输出高可见告警日志 ✅；AES-256-GCM（secrets-crypto.ts）✅；ChatAttachment 保留期 `CHAT_ATTACHMENT_RETENTION_DAYS ?? 365` ✅；全局限流 `THROTTLE_LIMIT ?? 120` 次/分/IP，2FA 敏感端点 `STRICT_THROTTLE` 5 次/分（two-factor.controller 6 处）✅。

### 数据模型要点

- **User**：2FA 字段全部可空/带默认值（零破坏性迁移）；`twoFactorPendingSecretEnc` + 15 分钟过期防恶意绑定；`twoFactorLastStep` 防 TOTP 重放（已核实：`consumeTotpStep` 用条件更新 `OR: [null, { lt: matchedStep }]` 实现数据库层原子 CAS，并发重放也无法绕过）。
- **AccessRole**：`slug` 唯一 + `permissions String[]`（Postgres 数组）+ `isSystem` 防误删；`assertValidPermissions` 拒绝无效权限 ID。
- **Session**：只存 tokenHash；`twoFactorVerifiedAt` 支持强制 2FA gating。
- **AuditLog**：action/resource/detail(Json)/ip/traceId 齐全；`onDelete: SetNull` 保留孤儿日志。写入机制为**全局 `APP_INTERCEPTOR`**（`AuditInterceptor`）：对已登录用户的写操作在**成功后**自动落库，新增端点零遗漏；敏感字段（password 系列）自动剔除；审计写入失败不影响主流程。**缺保留期清理**（经扫描确认无任何 deleteMany/retention 逻辑，见第三章 P2）。

---

## 三、行动清单（P1/P1b/P2 已落地 ✅，仅剩 P3 运营动作）

### P1 — RolesGuard 改 fail-closed + CI 检查 ✅ 已落地

**问题**：`roles.guard.ts` 在端点无任何 `@RequirePermissions` / `@Roles` 注解时默认放行。当前所有端点已正确标注，但无法防止未来新增 Controller 遗漏注解而静默降级为"仅需登录"。

**改造**（二选一即达标，推荐两个都做）：

1. **fail-closed**：无注解即 403，公开端点必须显式 `@Public()`。
2. **CI 脚本** `scripts/check-permissions.sh`：扫描所有 `*.controller.ts`，要求每个写操作端点满足「类级注解 或 方法级注解 或 @Public/@AllowUnenrolled/@AuthenticatedOnly」之一，否则 CI 失败。**注意必须同时识别类级 + 方法级装饰器**（v6.0 曾因只查方法级而误报 users.controller，教训见第六章）。

**⚠️ fail-closed 实施注意（v9.0 逐端点审计确认）**：存在 **9 个合法的「仅需登录、无需特定权限」写端点**（属有意设计：任何登录用户都可管理自己的凭证与会话），直接切 fail-closed 会误伤它们：

| 端点 | 现状 |
|------|------|
| `POST /auth/logout` | `@AllowUnenrolled` |
| `PATCH /auth/me`、`PATCH /auth/password` | 裸（仅 JWT） |
| `DELETE /auth/sessions/:id`、`DELETE /auth/sessions` | 裸（仅 JWT） |
| `POST /auth/2fa/setup`、`POST /auth/2fa/enable` | `@AllowUnenrolled` |
| `POST /auth/2fa/disable`、`POST /auth/2fa/recovery-codes/regenerate` | 裸（仅 JWT） |

**实施方案**：新增显式标记装饰器（如 `@AuthenticatedOnly()`），为上表 6 个裸端点标注（`@AllowUnenrolled` 的 3 个可直接计入豁免），再切换兜底逻辑；CI 脚本同步识别该标记。工作量仍在半天内。

**落地记录**：新建 `auth/decorators/authenticated-only.decorator.ts`；全方法审计发现共 **8** 个裸端点（上表 6 个 + `GET /auth/me` 之外的读端点若干，含 `GET /media`——已有注释说明是有意开放给登录用户），全部补显式标注；`roles.guard.ts` 切换 fail-closed；CI 门禁为 `scripts/check-permissions.mjs`（扫描 25 个 controller 共 **171 个全方法端点**：GUARDED 126 / PUBLIC 32 / AUTH_ONLY 13，0 裸），已接入 `.github/workflows/ci.yml`。

### P1b — 坐席令牌兑换加权限校验 ✅ 已落地（P3 的前置条件）

**问题**：`POST /chat-rooms/token` → `exchangeAgentToken()` 仅验签 access token，未校验用户是否持有 chat 类权限。WS 通道由此绕过 RolesGuard：任何登录用户可注册为坐席、读取全部客户会话。

**现状无暴露**（所有后台用户均为 admin），但一旦按 P3 创建不含 chat 权限的角色（如内容编辑），此缝隙立即变成实际越权通道。

**改造**：在 `exchangeAgentToken` 中（或兑换端点层）经 `RolesService` 查询用户权限集，要求持有 `chat.view`（或任一 chat 类权限）方可兑换；权限吊销后无需额外处理——坐席 token 仅 **15 分钟有效期**（`issueAgentToken` `expiresIn: '15m'`，已核实），自然过期后重新兑换即被新校验拦截。**顺序要求：先于 P3 执行。**

**落地记录**：`chat-auth.service.ts` 注入 `RolesService`（AccessModule 为 @Global），`exchangeAgentToken` 改 async 并校验 `chat.view`，无权限抛 403。P3 前置条件已解除。

### P2 — AuditLog 保留期清理 ✅ 已落地

参照 `ChatAttachment` 已有的 365 天回收策略，加一个简单的定时删除任务：

```
每日凌晨: DELETE FROM "AuditLog" WHERE "createdAt" < NOW() - INTERVAL '365 days'
```

保留期通过环境变量配置（如 `AUDIT_LOG_RETENTION_DAYS=365`）。**不做**按月分区、不做冷备归档到对象存储——对小团队是过度设计，若未来有合规要求再升级。

**落地记录**：新建 `audit/audit-retention.service.ts`（`@Cron` 每日 4AM，`AUDIT_LOG_RETENTION_DAYS ?? 365`，口径对齐 ChatAttachmentCleanupService），已注册进 `audit.module.ts`。

### P3 — 按需创建 2~4 个自定义角色（无代码改动，前置条件 P1b 已完成）

现状仅 `admin` 一个角色，所有后台用户都是超管。系统已支持自定义角色（`access.manage` 权限 + PermissionMatrix UI），**无需任何代码改动**，由管理员在后台按实际分工创建即可。建议起步：

| 角色 | 权限组合 | 适用 |
|------|---------|------|
| 内容编辑 | content.* + media.upload | 文案/运营 |
| 客服 | chat.* + tickets.* + contacts.view/manage | 售前售后 |
| 销售 | customers.view/manage + contacts.view | CRM |

不要一次建 7 个角色——先建实际有人用的，空角色只会增加管理噪音。上表权限 ID 已逐一对照 `permissions.ts` 核验存在（chat.\* / tickets.\* / contacts.\* / customers.\* / content.\* / media.upload 均为真实 ID）。

**附带动作（建角色后按需，每条 ≈15 分钟）**：为新角色碰不到的业务路由补 layout 守卫（复用 `require-permission.ts`，每文件 5 行，参照现有 8 个守卫文件），把越权直达 URL 的体验从报错页修正为重定向首页（见 §1.3 守卫覆盖边界）。仅为实际使用的角色补，不预先铺满 18 条路由。

---

## 四、明确不做清单

以下事项经评估**明确不做**，避免过度设计。若触发对应条件再重新评估：

| 不做的事 | 理由 | 重新评估触发条件 |
|----------|------|----------------|
| 权限缓存动态开关（Settings 开关 + 轮询 + UI 卡片） | 解决的是不存在的问题：权限变更已即时失效缓存并吊销会话，单实例零延迟 | 多实例部署时改用 Redis Pub/Sub 广播失效 |
| GDPR 全面合规（数据导出 API、被遗忘权物理删除） | 内部管理系统、国内业务为主，法律风险可控；在文档中声明"仅供内部管理使用"即可 | 对接欧美客户 / 处理欧盟居民个人数据 |
| 多租户（Tenant）隔离 / RLS 行级安全 | 单公司单租户，手动 scope 过滤 + 小团队 code review 可控 | 转型多公司 SaaS |
| AuditLog 异步队列（Redis Stream）、Session Redis 缓存 | 内部后台 QPS 远低于 PostgreSQL 单机瓶颈 | QPS 持续 > 1,000 |
| 风险评分引擎、异地登录风控 | 投入产出比过低 | 发生真实账户盗用事件 |
| WebAuthn / FIDO2 硬件密钥 | TOTP 已满足强度需求 | 客户合同或认证（ISO27001/等保）明确要求 |
| 强制 2FA 全局开启 | 内网访问风险可控，保留开关默认关闭，员工可自愿开启 | 核心数据敏感度上升或合规要求 |

---

## 五、小团队推荐配置

| 特性 | 推荐配置 | 理由 |
|------|---------|------|
| 强制 2FA | 关闭（保留开关，自愿开启） | 减少学习曲线；开关与逃生通道已就绪，随时可开 |
| 权限缓存 | 保持默认（5min TTL + 变更即时失效） | 无需任何操作 |
| Token 轮换宽限期 | 保留现状 | 零成本，解决双标签并发 |
| 角色 | admin + 2~4 个按需自定义角色 | 见第三章 P3（须先完成 P1b） |
| AuditLog 保留期 | 365 天 | 与 ChatAttachment 策略对齐 |

---

## 六、勘误记录（历史版本错误汇总）

保留此章防止同类错误重犯，过程细节不再展开：

1. **v6.0 误报**：判定 users.controller 4 个写端点为"Critical 裸 API"。实际类级 `@RequirePermissions('users.manage')` 经 `reflector.getAllAndOverride([handler, class])` 对全部端点生效。**教训：静态扫描必须同时检查方法级 + 类级装饰器。**
2. **v8.0 权限计数错误**：同一文档写过 46 和 35 两个数字，实际 39；docs/support/system 分组计数均有虚增。
3. **v8.0 缓存延迟论断错误**：声称"权限变更最高 5 分钟延迟生效"，据此设计了 ~200 行的动态缓存开关方案。实际 `roles.service.ts` 在角色变更时即时失效缓存并吊销会话，该方案已整体删除。
4. **v8.0 P0 定级失当**：将 admin 前端 `['*']` 兜底列为 P0"可能过度宽松"。实际为 UI 展示层降级，后端逐请求独立鉴权，无实际风险，已降为备注。
5. **v8.0 示例代码错误**：侧边栏“典型实现”为虚构代码且 filter 逻辑取反写反，已删除，以实际 `Sidebar.tsx` 为准。
6. **v8.0 机制描述失实**：① 声称存在 `apps/admin/src/middleware.ts`，实际文件为 `proxy.ts`（Next.js 16 更名）；② 声称存在 `@Audit()` 装饰器，实际无此装饰器——审计由全局 `AuditInterceptor` 自动完成（这反而是更优设计：新增端点零遗漏）。
7. **v9.1 及以前全部版本的评估盲区（外部指出）**：9 轮逐断言审计均只审了"端点有没有守卫"，没审"守卫依赖的权限定义本身可被谁改写"——持 `access.manage` 的非 admin 用户可编辑**自己所属角色**的权限集（如给自己加 `users.manage`），形成相邻提权链。**已修复**：`roles.service.ts` 的 create/update/remove 均在 service 层 `assertAdminActor` 查库硬校验（controller 透传 `@CurrentUser`），单测覆盖非 admin 403 + admin 回归（roles.service.spec.ts），前端 access 页对非 admin 遮蔽写按钮。**教训：审计守卫覆盖时，还必须审"权限定义/角色权限集自身的写路径"能否被非管理员触及。**

---

## 七、参考

**代码依据**：
- [`apps/api/src/access/permissions.ts`](../apps/api/src/access/permissions.ts) — 权限定义单一事实来源（文件尾注释含权限对齐规范）
- [`apps/api/src/access/roles.service.ts`](../apps/api/src/access/roles.service.ts) — 权限缓存与即时失效、角色变更吊销会话
- [`apps/api/src/auth/guards/roles.guard.ts`](../apps/api/src/auth/guards/roles.guard.ts) — fail-closed 兜底（P1 已落地）
- [`scripts/check-permissions.mjs`](../scripts/check-permissions.mjs) — CI 权限注解门禁（接入 ci.yml）
- [`apps/api/src/auth/guards/two-factor-enforcement.guard.ts`](../apps/api/src/auth/guards/two-factor-enforcement.guard.ts)
- [`apps/api/src/common/interceptors/audit.interceptor.ts`](../apps/api/src/common/interceptors/audit.interceptor.ts) — 全局审计拦截器
- [`apps/api/src/support/chat-auth.service.ts`](../apps/api/src/support/chat-auth.service.ts) — WS 令牌兑换（P1b 已落地：chat.view 校验）
- [`apps/api/src/audit/audit-retention.service.ts`](../apps/api/src/audit/audit-retention.service.ts) — 审计日志保留期清理（P2 已落地）
- [`apps/admin/src/lib/require-permission.ts`](../apps/admin/src/lib/require-permission.ts) — 服务端路由守卫
- [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)

**设计文档**：
- [`docs/security/2fa-totp-design.md`](./security/2fa-totp-design.md)
- [`docs/security/2fa-enforcement-toggle-design.md`](./security/2fa-enforcement-toggle-design.md)
- [`docs/security/2fa-emergency-runbook.md`](./security/2fa-emergency-runbook.md) — 超管锁死应急操作手册（SSH + psql）
- [`docs/security/account-recovery-design.md`](./security/account-recovery-design.md) — §7 风险表含相邻提权面修复记录

**标准参考**：NIST RBAC Model、RFC 8725 (JWT BCP)、OWASP Authentication Cheat Sheet、OAuth 2.0 Refresh Token Rotation

---

**评估结论**：系统架构成熟、安全机制完善，生产就绪。**本报告的全部代码整改已闭环**：P1（fail-closed + CI 门禁）、P1b（坐席令牌权限校验）、P2（AuditLog 保留期）及相邻提权链修复（勘误第 7 条）均已落地并通过 pnpm check / turbo typecheck / jest 三项卡口；仅剩 P3 为运营动作无需开发，前置条件已解除，可随时执行。其余事项按第四章「明确不做」执行。

**下次评审**: 2027-01-29（半年后）或团队规模突破 150 人 / 触发第四章任一重新评估条件时提前进行
