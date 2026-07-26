# 技术方案：两步验证（2FA）全局强制开关

> 状态：**待评审**（2026-07 起草）
> 前提约束：① 小而美公司，短期用户数 ≤ 100；② 防止过度设计，保持简洁实用。
> 适用范围：`apps/api`（NestJS）+ `apps/admin`（Next.js App Router BFF）
> 关联方案：[后台 TOTP 双因子认证](./2fa-totp-design.md)（已上线）——其 §0.3 曾裁掉「enrollmentToken 强制化第三态 + Deadline 状态机」，本方案是该需求复活后的**轻量替代实现**，不恢复被裁的状态机。

---

## 1. 背景与需求

当前 2FA 为**用户自愿开启**：设置页自助绑定，未绑定用户密码登录即全量放行。唯一的覆盖率控制是用户列表的「2FA 状态」列 + 线下催办（原方案 §0.3 的补偿控制）。

新需求：**超级管理员可在后台一键强制全员开启 2FA**——开关打开后，未绑定 2FA 的用户不能正常使用系统，必须先完成绑定。

## 2. 业内实践参考与方案选型

强制 MFA 的两种主流落地形态：

| 形态 | 代表 | 做法 |
|------|------|------|
| **A. 登录后受限会话（Post-login restricted session）** | GitHub 组织级 2FA 强制、Google Workspace「宽限期后强制注册」 | 密码登录照常成功，但会话被限制在「绑定 2FA」流程内，绑定完成前访问其他资源一律拒绝 |
| B. 登录时第三态（Pre-session enrollment token） | Okta / Auth0 的 enrollment flow | 密码校验后不发正式令牌，改发 enrollmentToken，绑定完成才建会话 |

**选型：A（登录后受限会话）**，理由：

1. **零登录链路改动**：`LoginResult` 保持两态联合，`AuthService.login()`、BFF `login/route.ts`、登录页状态机全部不动。形态 B 正是原方案 §12.1 被裁的设计——需要新令牌类型、jti 单用、fp 校验、`LoginResult` 第三态、登录页第三步，实现面约 3 倍。
2. **零 Schema 变更**：无需 Prisma 迁移，开关存 `Setting` 表（现成 KV + Zod + 默认值合并模式）。
3. **强制即刻生效**：开关打开后，未绑定用户的**存量会话**在下一个 API 请求即被拦截（每请求检查），而非只拦新登录——比形态 B 覆盖更完整。
4. **安全等价**：两种形态在「密码泄露者可绑定自己的验证器」这一自举弱点上完全相同（GitHub/Google 同样接受该弱点，缓解手段一致：setup 需重输密码 + 全程审计）。形态 B 的额外复杂度不换来额外安全。

## 3. 目标与非目标

**目标**

1. 超级管理员（`role=admin`）可在后台开/关「强制 2FA」全局开关。
2. 开关打开后：未绑定 2FA 的用户登录（或已在会话中）时，除「绑定 2FA / 登出」相关接口外全部 API 返回 403，前端强制进入绑定引导页；绑定完成即恢复正常。
3. 开关操作写审计日志；打开开关的操作者自身必须已启用 2FA（防「立法者自己违法」，对齐 GitHub 组织强制 2FA 的前置要求）。

**非目标（有意裁剪，防过度设计）**

- ❌ 宽限期 / Deadline 倒计时状态机——内部系统、绑定全程 < 5 分钟，开关打开前线下打个招呼即可；需要缓冲就晚几天再打开开关，开关本身就是宽限期。
- ❌ 按角色 / 按用户分组的差异化强制——≤100 人一刀切，未来真有需求再加字段。
- ❌ 强制解绑重绑、密码过期联动、邮件通知自动化。
- ❌ enrollmentToken / `LoginResult` 第三态（见 §2 选型）。

## 4. 设计总览

```
┌─ 超级管理员 ─────────────────────────────────────────────┐
│ admin 用户管理页「两步验证策略」卡片                        │
│   PUT /settings/security/auth { twoFactorRequired: true } │
│   （@Roles('admin')；置 true 时校验操作者自身已启用 2FA）    │
└──────────────┬───────────────────────────────────────────┘
               ▼
      Setting 表 key='security.auth'  value={ twoFactorRequired }
               │  （SettingsService 内存缓存 30s，单实例）
               ▼
┌─ 每个已认证请求 ──────────────────────────────────────────┐
│ JwtAuthGuard → TwoFactorEnforcementGuard（新增全局守卫）    │
│   放行条件（任一满足）：                                    │
│     · 开关关闭 / kill-switch TWOFA_CHALLENGE_DISABLED=true │
│     · user.twoFactorEnabled === true                      │
│     · 路由带 @Public() 或 @AllowUnenrolled()（绑定豁免清单）│
│   否则 → 403 { code: 'TWOFA_ENROLLMENT_REQUIRED' }        │
└──────────────┬───────────────────────────────────────────┘
               ▼
┌─ admin 前端 ─────────────────────────────────────────────┐
│ (dashboard)/layout.tsx 读 /auth/me 的 twoFactorSetupRequired│
│   为 true → redirect('/enroll-2fa')（受保护的绑定引导页）    │
│   绑定页复用现有 setup → enable 向导，成功后回 '/'          │
└──────────────────────────────────────────────────────────┘
```

## 5. 后端设计（`apps/api`）

### 5.1 设置存储（复用 Settings 模块既有模式）

新增设置项 `security.auth`（group=`security`），与 `site.public` 等同构（Zod schema + defaults + merge）：

```
apps/api/src/settings/
├── settings-security.schema.ts    # securityAuthSettingsSchema
└── settings-security.defaults.ts  # DEFAULT / merge / SECURITY_AUTH_SETTING_KEY
```

```typescript
// packages/types（A1 审批）
export interface SecurityAuthSettings {
  /** 强制全员启用两步验证 */
  twoFactorRequired: boolean;
}
// 默认 { twoFactorRequired: false }，无 Setting 行时回落默认值 → 向后兼容零迁移
```

`SettingsService` 新增：

```typescript
getSecurityAuthSettings(): Promise<SecurityAuthSettings>   // 内存缓存 30s（见 §5.4）
updateSecurityAuthSettings(raw, actorId): Promise<SecurityAuthSettings>
```

`updateSecurityAuthSettings` 额外规则（区别于普通站点设置）：

1. 置 `twoFactorRequired: true` 时，查询操作者 `twoFactorEnabled`，为 false 则 400「请先为自己启用两步验证，再强制全员开启」。
2. 值变更写审计：`2fa_policy_enabled` / `2fa_policy_disabled`（沿用 `AuditLog`，与 `2fa_killswitch_activated` 等既有动作名同一 const 对象维护）。注意：全局 `AuditInterceptor` 已对写操作自动审计，实施时二选一（建议保留本条显式审计的语义化动作名，并确认拦截器不重复记录），避免同一次变更产生两条日志。

### 5.2 API 契约

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/settings/security/auth` | `@Roles('admin')` | 读取开关状态 |
| PUT | `/settings/security/auth` | `@Roles('admin')` | 更新开关（含 §5.1 前置校验） |

用 `@Roles('admin')` 而非 `settings.manage`：自定义角色可能持有 `settings.manage`，但强制 2FA 是安全策略，权限口径对齐既有 `POST /auth/2fa/force-disable`（同为 admin 专属）。

`GET /auth/me` 响应扩展一个计算字段（`packages/types`，A1 审批）：

```typescript
export interface MeResult {
  // ...现有字段
  /** 强制开关已打开且本人未绑定 2FA（前端据此跳绑定页） */
  twoFactorSetupRequired: boolean;
}
```

### 5.3 强制守卫 `TwoFactorEnforcementGuard`（核心新增，全局注册）

```
apps/api/src/auth/guards/two-factor-enforcement.guard.ts
apps/api/src/auth/decorators/allow-unenrolled.decorator.ts
```

```typescript
// 伪代码
canActivate(ctx) {
  if (isPublic(ctx)) return true;                          // @Public() 路由不管（login/verify 本就无 user）
  if (hasAllowUnenrolled(ctx)) return true;                // 绑定豁免清单
  if (this.auth.twoFactorChallengeDisabled()) return true; // kill-switch 同步豁免（事故止血口径与既有一致）
  const user = req.user;                                   // JwtStrategy 已查库注入
  if (user.twoFactorEnabled) return true;
  const { twoFactorRequired } = await this.settings.getSecurityAuthSettings(); // 30s 缓存
  if (!twoFactorRequired) return true;
  throw new ForbiddenException({ code: 'TWOFA_ENROLLMENT_REQUIRED', message: '管理员已强制开启两步验证，请先完成绑定' });
}
```

配套小改动：

- `JwtStrategy.validate()` 返回的 `AuthUser` 增加 `twoFactorEnabled`（user 行本就每请求查出，零额外查询；`AuthUser` 类型扩展需 A1 知悉）。
- 全局注册顺序：`JwtAuthGuard → RolesGuard → TwoFactorEnforcementGuard`（守卫依赖 `req.user`，必须在认证守卫之后）。

**`@AllowUnenrolled()` 豁免清单**（未绑定者在强制期唯一可用的接口，最小集）：

| 接口 | 理由 |
|------|------|
| `GET /auth/me` | 前端判定跳转依据 |
| `POST /auth/logout` | 允许放弃绑定退出 |
| `GET /auth/2fa/status`、`POST /auth/2fa/setup`、`POST /auth/2fa/enable` | 绑定流程本体 |

其余接口（含 `PATCH /auth/me`、媒体、内容等）一律拦截。`POST /auth/refresh` 是 `@Public` 不受影响——未绑定用户会话可续期，但续期后的 access token 依旧被本守卫拦在绑定流程内，无绕过面。

### 5.4 开关读取的缓存策略

单实例部署（与 2FA 主方案 §6.4 单实例声明同前提）：`SettingsService` 内存缓存 `security.auth` 值，TTL 30s，`update` 时立即失效。

注意该缓存是**必要项而非优化项**：读设置发生在常态路径上——开关关闭（默认态）时多数用户尚未绑定 2FA，其每个请求都会落到读设置分支（仅 `twoFactorEnabled=true` 才短路），省略缓存意味着默认态下几乎每请求多一次 DB 查询。不引入 Redis、不做多实例广播——水平扩容时缓存 TTL 30s 的最终一致性也完全够用（策略生效延迟 ≤30s 可接受）。

## 6. 前端设计（`apps/admin`）

### 6.1 超级管理员开关入口

放在 **用户管理页（`(dashboard)/users`）顶部**，新增「两步验证策略」卡片：

- 与既有「2FA 状态」列同屏：超管在同一页看到覆盖率（谁没绑）并决定是否强制，操作闭环。
- `<Can allow={['admin']}>` 包裹，非超管不可见（服务端由 `@Roles('admin')` 兜底）。
- 组件：`Switch` + 确认弹窗（打开时提示影响：「所有未绑定用户将被强制进入绑定流程」；自身未绑定时按钮置灰并提示先绑定）。
- 数据钩子：`useSecurityAuthSettings` / `useUpdateSecurityAuthSettings`（react-query，走既有 BFF `bff/[...path]` 代理，无需新 BFF 路由）。

### 6.2 绑定引导页 `/enroll-2fa`

新增独立路由（**不在** `(dashboard)` 组内，避免 dashboard layout 的重定向与侧边栏），带最小外壳（logo + 卡片居中）：

- 服务端 layout：`getSession()` 无会话 → `redirect('/login')`；拉 `/auth/me`，`twoFactorSetupRequired=false` → `redirect('/')`（已绑定或开关已关，防直达）。
- 页面主体**复用现有 `TwoFactorCard` 的 setup → enable → 恢复码展示向导**（抽出向导子组件共享，避免复制粘贴），文案改为强制语境：「管理员要求启用两步验证后才能继续使用系统」。
- 绑定成功（恢复码已确认保存）→ `router.replace('/')`。
- 附「退出登录」链接（对应豁免的 logout）。

### 6.3 拦截与跳转

两层兜底：

1. **服务端**：`(dashboard)/layout.tsx` 已有的 `apiFetch('/auth/me')` 结果新增判断——`twoFactorSetupRequired === true` → `redirect('/enroll-2fa')`。覆盖所有页面导航。
2. **客户端**：`apiClient` 统一响应处理中识别 403 + `code === 'TWOFA_ENROLLMENT_REQUIRED'` → `window.location.assign('/enroll-2fa')`。覆盖「用户停留在已打开的页面、开关中途被打开」的场景（下一次数据请求即被引导走）。

## 7. 安全考量与已接受残余风险

| # | 事项 | 结论 |
|---|------|------|
| 1 | **自举弱点**：强制期内密码泄露者可绑定攻击者自己的验证器 | 与 GitHub/Google 强制注册流程相同的业内公认取舍；缓解：`setup` 需重输密码（既有）、`2fa_enabled` 审计（既有）、用户列表 2FA 状态列可见绑定时间。不为此建审批流。 |
| 2 | **超管全体失联锁死**：所有 admin 丢失 2FA 设备且开关打开 | 既有逃生通道不变：① `TWOFA_CHALLENGE_DISABLED` kill-switch 同步豁免本守卫（§5.3）；② SSH 改库 runbook（既有）追加一条：`UPDATE settings SET value='{"twoFactorRequired":false}' WHERE key='security.auth';` |
| 3 | 开关打开瞬间，未绑定用户正在编辑的表单会因 403 丢失未保存内容 | ≤100 人内部系统，开关操作前线下通知即可；不做「宽限期」机制（§3 非目标） |
| 4 | 30s 缓存导致开关生效延迟 ≤30s | 可接受；`update` 后本实例立即失效，实际延迟通常为 0 |
| 5 | 未绑定用户的 refresh 续期不受限 | 无绕过面（§5.3 末段）；不改 refresh 逻辑 |
| 6 | 守卫每请求执行 | `twoFactorEnabled=true` 用户零开销短路；未绑定用户多一次缓存读。无性能议题 |
| 7 | **WebSocket 入口不经过 HTTP 守卫**：开关打开时，未绑定坐席已建立的 socket.io 连接（聊天控制台）不被本守卫拦截 | 接受，不在 WS 握手处重复实现检查：① 前端收到任一 HTTP 403 即 `window.location.assign('/enroll-2fa')`，页面销毁时 socket 随之断开，暴露窗口极小；② chat token 每 10 分钟经 HTTP 刷新，刷新请求会被拦截，旧连接自然失效 |

## 8. 实施清单与工作量

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | `packages/types`：`SecurityAuthSettings`、`MeResult.twoFactorSetupRequired`、403 错误码常量（A1 审批） | 0.5h |
| 2 | Settings 模块：schema / defaults / service 方法（含缓存与审计）/ controller 两个端点 | 2h |
| 3 | `TwoFactorEnforcementGuard` + `@AllowUnenrolled()` + `JwtStrategy` 扩展 + 全局注册 + 豁免标注 | 2h |
| 4 | `AuthService.me()` 计算 `twoFactorSetupRequired` | 0.5h |
| 5 | admin：users 页策略卡片 + 数据钩子 | 2h |
| 6 | admin：`/enroll-2fa` 页（复用向导）+ layout 重定向 + apiClient 403 拦截 | 3h |
| 7 | 测试（§9）+ 运维 README 追加逃生 SQL | 2h |

合计约 **1.5 人日**。无 Prisma 迁移、无新依赖、无登录链路改动。

## 9. 测试要点

- 开关关闭：未绑定用户一切照旧（回归基线）。
- 开关打开：未绑定用户任意业务 API 返回 403 `TWOFA_ENROLLMENT_REQUIRED`；豁免清单 5 个接口可用；绑定完成后立即（无需重登）恢复全量访问。
- 已绑定用户：开关开/关均无感知。
- 打开开关前置校验：操作者自身未绑定 → 400；非 admin 角色（即使持 `settings.manage`）→ 403。
- 存量会话：开关打开后，已登录的未绑定用户下一次请求即被拦截、前端跳绑定页。
- kill-switch：`TWOFA_CHALLENGE_DISABLED=true` 时本守卫豁免（与登录挑战、refresh gating 口径一致）。
- 直达防护：已绑定用户访问 `/enroll-2fa` 被重定向回 `/`。
- 审计：开关两个方向的变更各产生一条 AuditLog。

## 10. 回滚

- 功能开关本身即回滚手段：PUT 置 `false` 立即恢复自愿模式。
- 代码级回滚：移除守卫全局注册一行即可禁用全部强制逻辑；Setting 行残留无副作用（读取方已删）。
- 数据级：无迁移，无数据回滚问题。
