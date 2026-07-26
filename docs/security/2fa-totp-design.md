# 技术方案：后台 TOTP 双因子认证（2FA/MFA）

> 状态：**已定稿·小而美落地版（待实施）**—2026-07 裁定：admin 确认公网可达且无法网络层收口、系统用户短期 <100，按下方〈§0 最终落地裁定〉裁剪范围；**正文任何条目与 §0 冲突时，以 §0 为准**
> 适用范围：`apps/api`（NestJS）+ `apps/admin`（Next.js App Router BFF）
> 关联方案：[CapJS 无感验证集成](./capjs-captcha-design.md)（同样改动登录链路；**最终裁定：CapJS 已搁置不实施**，决策记录见其文档头部；两者共同的 P0 前置是「统一真实 IP 解析口径」，见 §14.7）

---

## 0. 最终落地裁定（小而美版 · 本节优先级最高）

> 决策背景（2026-07 拍板）：① admin 后台**确认公网可达且无法网络层收口**（IP 白名单 / VPN / 零信任网关均不可行）；② 系统总用户数短期 **<100**、管理员个位数；③ 1C2G 单机、无专职安全/运维。据此对本方案做最终裁剪。关联决策：CapJS PoW 方案整体**搁置不实施**（见其文档头部决策记录）。

### 0.1 P0 前置（先于本方案，约半天）

修复「统一真实 IP 解析口径」（§14.7）：`extractClientIp` 不再无条件信任 XFF、BFF 转发时显式透传真实 IP/UA、Throttler tracker 与 AuditLog 统一口径。这是现网活漏洞，独立于本方案先行。

### 0.2 保留实施（核心，约 3-5 天）

| 范围 | 出处 |
|------|------|
| setup → enable 绑定流程（二维码 + 确认码 + 事务原子性） | §6.3 A |
| login 返回 pendingToken → verify（时间步防重放、jti 单用、per-账号（sub 维度）尝试上限——均为进程内结构，key 维度见 §0.5-2） | §6.3 B、§6.4 |
| 恢复码 10 个（SHA-256 + 独立盐、常量时间比对、用后即焚） | §4、§6.3 B 3b |
| Secret AES-256-GCM 加密落库（复用 secrets-crypto 泛化）；`SECRETS_ENCRYPTION_KEY` 改必填 fail-fast | §5、§8 |
| refresh gating：`Session.twoFactorVerifiedAt` + `reuseWithinGrace` 继承（堵 refresh 绕过 2FA） | §6.4 |
| 2FA 接口 5/min 限流（复用 Throttler）；2FA 失败**不**累加账号锁 | §6.4 |
| disable / regenerate 管理接口 + 设置页向导 + 登录页两步化 | §6.2、§7 |
| JWT 显式钉死 HS256、pending Cookie 加 `Secure`、admin refresh TTL 缩至 24h | §14.4、§14.5、§12.5 |
| 单个 kill-switch `TWOFA_CHALLENGE_DISABLED`（含 refresh gating 同步豁免） | §9（双开关合并为一） |

### 0.3 裁掉（本期不实施）

- ❌ **enrollmentToken 强制化第三态 + Deadline 状态机**（§6.3 B / §12.1）→ 管理员个位数，线下通知限期绑定；到期未绑者由超管在用户管理中停用账号即可，无需状态机与 `requiresEnrollment` 响应变体；**补偿控制（必做，约半小时）**：用户管理列表加「2FA 状态」列，超管一眼可见谁未绑定——裁掉强制化后，覆盖率可见性是唯一兼价的替代品
- ❌ **fp 设备指纹（含分档处置）**（§6.3 B）→ 文档已自证为弱信号；pendingToken 防护靠 5min TTL + jti 单用 + 尝试上限已足
- ❌ **`TWOFA_ENFORCEMENT_DISABLED` 开关**（§9）→ 强制化状态机已裁，此开关无对象
- ❌ **实时告警 + 配置漂移监控体系**（§6.4「检测与响应」/ §9 治理约束）→ 降级为 AuditLog + 应用日志 WARN；审计动作名直接用字符串常量，不建 packages/types 枚举。**保底不再裁**：① kill-switch 置位时启动日志打 ERROR 横幅 + 写 `2fa_killswitch_activated` 审计事件；② verify 失败写 `2fa_failed` 审计（见 §6.3 B）——告警已裁，AuditLog 是唯一检测面
- ❌ **break-glass 双人复核流程**（§6.3 C / §12.3）→ 保留 force-disable 接口（super-admin + 自身二次确认），流程简化为「操作即审计」；极端情况 SSH 执行重置 SQL，写入运维 README
- ❌ §12（除 12.5 与 §8 密钥必填）、§13 全部、§14.2 / §14.3 / §14.6 → 维持既有 [条件触发]/[不适用] 标注，条件未触发前不进排期

### 0.4 Passkey 决策记录（回答 §11 决策注）

本期仍选 TOTP 先行：管理员设备/浏览器环境不受控（个人手机 + 多浏览器），TOTP 是零门槛通用兜底且裁剪后实现面更小；Passkey 保留为 v2 方向（§11），不作为本期阻塞。

### 0.5 已接受残余风险（集中清单 · 前提变化即触发重评）

> 接受前提：单实例 1C2G、用户 <100、管理员个位数、无监控基建。任一前提失效（水平扩容 / 用户破百 / 接入交易支付 / 引入 Redis 或监控体系）须回到本清单逐条重评，而非默认延续接受。

| # | 残余风险 | 接受理由 / 缓解 |
|---|---------|----------------|
| 1 | 进程内结构重启清零：jti 单用黑名单、尝试计数器均为内存 Map/Set，进程重启丢失窗口内记录（≤5min） | 单实例 + 重启低频，窗口极短；水平扩容时必须迁 Redis（§6.4 单实例声明） |
| 2 | 尝试上限计数器以账号 `sub` 为 key（不可用 pendingToken/jti 为 key，否则攻击者重走密码关重签 token 即可刷新配额）：副作用是攻击者可故意输错码耗尽某账号配额，致其 ≤5min 内无法完成第二步（轻度 DoS） | 拿 pendingToken 须先过密码关，攻击前提成本高；5min 自愈、不触发账号锁 |
| 3 | fp 设备指纹已裁：pendingToken 防护仅剩 5min TTL + jti 单用 + per-账号尝试上限三重 | fp 本为弱信号（UA 客户端自报、合法 IP 可漂移），删除属诚实简化 |
| 4 | refresh 轮换宽限期（约 10s）内旧令牌重放可获新 Session | 既有轮换设计的已知取舍（§6.4）；admin refresh TTL 缩至 24h 压缩暴露面 |
| 5 | 无实时告警：检测面仅 AuditLog + 应用日志，攻击成功可能无声直至人工翻审计 | 保底必写 `2fa_failed` / `2fa_killswitch_activated` 审计事件（§0.3）；超管定期人工核查 |
| 6 | 无强制绑定状态机：2FA 覆盖率靠超管盯用户列表「2FA 状态」列 + 线下催办 / 到期停用账号 | 管理员个位数，人工约束成本低于状态机（§0.3 补偿控制） |
| 7 | 实时钓鱼代理中继（Evilginx 类）TOTP 原理性防不了 | v2 Passkey 是根本解（§11）；过渡缓解见 §6.4 末行 |

---

## 1. 背景与现状

当前 admin 后台登录链路：

```
LoginPage(app/login/page.tsx)
  → BFF POST /api/auth/login (admin app/api/auth/login/route.ts)
    → NestJS POST /api/v1/auth/login (auth.controller.ts)
      → AuthService.login()：bcrypt 校验 → 签发 access/refresh JWT → Session 表持久化 refresh hash
  ← BFF 将两枚 JWT 写入 httpOnly Cookie
```

已有可复用的安全基建：

| 设施 | 位置 | 复用方式 |
|------|------|---------|
| AES-256-GCM 加密工具 | `apps/api/src/common/crypto/secrets-crypto.ts` | 泛化后用于加密 TOTP Secret |
| 全局限流 `@nestjs/throttler` | `app.module.ts`（全局 Guard） | 用 `@Throttle()` 对 2FA 接口收紧到 5 次/分钟 |
| 账号锁定 | `User.failedLoginAttempts / lockedUntil` | verify 仅检查 `lockedUntil` 拒绝锁定账号；2FA 失败**不**累加计数（防锁户 DoS，见 §6.4 ②） |
| 审计日志 | `AuthService.audit()` → `AuditLog` | 记录 2FA 全生命周期事件 |
| env 校验（zod） | `apps/api/src/config/env.validation.ts` | 新增环境变量的启动期校验 |

### 1.1 前置假设：admin 后台暴露模型

> **本方案当前按「admin 后台公网可达」设计**。这是所有安全控件 ROI 的边界前提，评审者须先确认。

- **公网可达（✅ 已确认，2026-07 裁定）**：admin 域名直接暴露公网且**无法网络层收口**（IP 白名单 / VPN / 零信任网关均不可行）→ 2FA 为必做硬控件；PoW 已随 CapJS 方案搁置，告警降级为日志（见 §0）。
- **内网 / VPN / 堡垒机可达（可降级）**：若实际仅企业内网或经零信任网关可达，则网络层隔离（IP 白名单 / Cloudflare Access / 零信任网关）已做粗粒度防护，2FA+PoW 的边际收益下降。此时建议：先以网络层做主隔离，2FA 退为纵深补充，PoW 可按需省略以降维护成本。
- **混合**：公网可达但限定来源国/区域 → 在网络层 + 本方案间取交集，本方案仍适用。

> 若后续暴露模型变更，须重新评估 §6.4 的限流阈值与告警阈值，而非照搬本文档数值。

## 2. 目标

1. **绑定（Setup）**：生成 256 位 base32 Secret → `otpauth://` URI → 二维码；用户输码确认后才启用；启用时发放 10 个一次性恢复码。
2. **登录二次校验（Challenge）**：密码正确且已启用 2FA 时，不发正式令牌，改发短时效预鉴权令牌；`verify-2fa` 校验动态码（±1 时间窗）后才签发正式令牌。
3. **管理（Management）**：解绑需「当前密码 + 当前动态码」；恢复码可替代动态码救急登录（用后即焚）。

安全红线：Secret 加密落库（AES-256-GCM）、验证接口 5 次/分钟限流、拒绝重放（同一动态码不能二次使用）、只用成熟库不手写算法。

## 3. 依赖引入（需 A1 审批）

| 包 | 用途 | 说明 |
|----|------|------|
| `otplib` (^12) | TOTP 生成/校验、otpauth URI | RFC 6238 标准实现，纯 JS 零原生依赖 |
| `qrcode` (^1.5) | 服务端生成二维码 Data URL | 仅在 setup 接口调用，无常驻开销 |

两者均加入 `apps/api/package.json`；前端不新增依赖（二维码由后端返回 Data URL，`<img>` 直接展示）。

## 4. 数据库 Schema 变更（`apps/api/prisma/schema.prisma`，A1 审批）

```prisma
model User {
  // ── 2FA（新增字段，全部可空/带默认值，向后兼容，无破坏性迁移）──
  twoFactorEnabled          Boolean   @default(false) // 是否已启用 2FA
  twoFactorSecretEnc        String?                   // AES-256-GCM 加密后的 TOTP Secret（启用后才写入）
  twoFactorPendingSecretEnc String?                   // 绑定流程中的待确认 Secret（加密），确认或超时后清空
  twoFactorPendingCreatedAt DateTime?                 // 待确认 Secret 生成时间（15 分钟过期）
  twoFactorConfirmedAt      DateTime?                 // 启用时间（审计/展示用）
  twoFactorLastStep         BigInt?                   // 最近一次成功校验的 TOTP 绝对时间步（重放防护；用 BigInt 规避 Int32 溢出）

  recoveryCodes TwoFactorRecoveryCode[]
}

model TwoFactorRecoveryCode {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String                    // SHA-256(codeSalt ‖ 规范化恢复码)，不存明文
  codeSalt  String                    // 每码独立 salt（CSPRNG），与 codeHash 同记录
  usedAt    DateTime?                 // 使用即标记，永不复用
  createdAt DateTime  @default(now())

  @@index([userId])   // 加盐后无法按 hash 反查（§6.3 B 3b 逐条带 salt 比对），原 @@unique([userId, codeHash]) 已成死约束，且极端哈希碰撞会抛令人困惑的唯一冲突，故降为普通索引
}
```

设计说明：

- **不存明文**：`twoFactorSecretEnc` 存 `base64(iv + authTag + ciphertext)`，与 `secrets-crypto.ts` 现有格式一致。
- **重放防护用时间步而非「最近 N 个码」**：TOTP 的时间步 `step = floor(epoch / 30)` 单调递增。成功校验后记录命中的 step，后续要求 `matchedStep > twoFactorLastStep`，天然拒绝同码重放，也拒绝 ±1 容差窗口内的「旧码回放」。单字段即可，无需额外表。
- **恢复码用 SHA-256 + 每码独立 salt 而非 bcrypt**：恢复码为 10 字节（80 位）CSPRNG 随机值，熵足够高，快哈希即可安全（与 GitHub 做法一致）；且验证时需要对最多 10 条记录做匹配，bcrypt 会放大延时。**加盐决策（已拍板）**：每个 `TwoFactorRecoveryCode` 记录携带独立 `codeSalt`（CSPRNG 生成），落库 `SHA-256(codeSalt ‖ 规范化码)`。理由：① 防跨用户相同哈希关联；② 盐使离线爆破单码无法复用到全表。验证时遍历该用户记录 `SHA-256(codeSalt ‖ 候选码)` 比对，**不破坏「10 条匹配」逻辑**。

## 5. 密钥加密方案

泛化现有 `secrets-crypto.ts`（当前 KDF salt 写死为 `tzj-integration-secrets-v1`，且只支持 `Record<string,string>`）：

```
apps/api/src/common/crypto/secrets-crypto.ts
  + encryptString(plaintext, key, context)  // context 参与 KDF salt，实现域分离
  + decryptString(blob, key, context)
  // 2FA 使用 context = 'tzj-2fa-totp-v1'，与集成凭证密钥域隔离
```

- 复用现有环境变量 `SECRETS_ENCRYPTION_KEY`（≥32 字符，env.validation.ts 已校验），不新增密钥管理负担。
- AES-256-GCM + scrypt KDF + 随机 12 字节 IV + 16 字节 auth tag，认证加密防篡改。
- 现有 `encryptSecrets/decryptSecrets` 保持不动（不破坏集成模块），新函数并列导出。

## 6. 后端设计（`apps/api/src/auth/`）

### 6.1 新增文件

```
auth/
├── two-factor.service.ts     # TOTP 生成/校验、恢复码、加解密（核心逻辑）
├── two-factor.controller.ts  # /auth/2fa/* 路由
└── dto/two-factor.dto.ts     # 请求 DTO（class-validator）
```

`AuthService.login()` 小幅改造（见 6.3），其余不动。

### 6.2 API 契约

统一前缀 `/api/v1/auth/2fa`（除 `verify` 外均需登录态 Bearer）：

| 方法 | 路径 | 鉴权 | 限流 | 说明 |
|------|------|------|------|------|
| GET  | `/2fa/status` | Bearer | 默认 | 返回 `{ enabled, confirmedAt, recoveryCodesRemaining }` |
| POST | `/2fa/setup` | Bearer + 密码〔§0.3 已裁：~~或 enrollmentToken 强制化路径~~ 本期不实施〕 | 5/min | 生成待确认 Secret，返回 otpauth URI + 二维码 Data URL |
| POST | `/2fa/enable` | Bearer〔§0.3 已裁：~~或 enrollmentToken~~〕 | 5/min | 校验 6 位码确认绑定，返回 10 个恢复码（唯一一次明文展示） |
| POST | `/2fa/disable` | Bearer | 5/min | 需当前密码 + 当前动态码（或恢复码），关闭并清除所有 2FA 数据 |
| POST | `/2fa/recovery-codes/regenerate` | Bearer | 5/min | 需当前动态码，作废旧恢复码并生成新一批 |
| POST | `/2fa/verify` | **@Public**（凭 pendingToken） | **5/min（IP 维度）** | 登录第二步：校验动态码或恢复码，签发正式令牌（per-user 维度需自定义 keyed guard，见 §6.4 备注） |

请求/响应类型新增到 `packages/types/src/dto/auth.ts`（A1 审批）：

```typescript
/** POST /auth/login 响应扩展：开启 2FA 的账号返回预鉴权态而非令牌 */
export type LoginResult =
  | { requires2fa: false; accessToken: string; refreshToken: string; expiresIn: number; user: AuthUser }
  | { requires2fa: true; pendingToken: string; expiresIn: number };                 // pendingToken 有效期 300s
// 〔§0.3 已裁〕强制化第三态 `{ requiresEnrollment: true; enrollmentToken }` 本期不实现——LoginResult 仅上述两态联合；
// 未来启用强制化（条件触发）时再扩展该变体，原设计存档见 §12.1。

/** POST /auth/2fa/setup 响应 */
export interface TwoFactorSetupResult {
  otpauthUri: string;   // otpauth://totp/TZJ%20Admin:{username}?secret=...&issuer=TZJ%20Admin&algorithm=SHA1&digits=6&period=30
                        // ⚠️ 算法取舍明示：SHA1 虽已在通用签名场景淘汰，但 TOTP-SHA1（RFC 6238 HMAC 用法）在 NIST 语境下仍被普遍接受，且 Google Authenticator 旧版仅支持 SHA1——此为兼容性优先的**有意取舍**，非疏漏。
                        // 升级 SHA256 须在 v2 评估：需确认所有目标 Authenticator App 支持（部分 App 忽略 algorithm 参数仍按 SHA1 出码 → 全员校验失败），且已绑定用户须重新 enroll，不可静默切换。
  qrDataUrl: string;    // data:image/png;base64,...（前端 <img> 直接渲染）
  secret: string;      // 完整 base32 密钥（供无法扫码用户手动输入；setup 在受信设备上一次性展示，不遮罩）
  expiresAt: string;    // 待确认 Secret 的 15 分钟过期时间
}

/** POST /auth/2fa/enable 响应 */
export interface TwoFactorEnableResult {
  recoveryCodes: string[]; // 10 个，格式 XXXXXXXX-XXXXXXXX（randomBytes(10)→base32 16 字符分两段，80 位熵；与 §6.3 A 一致，原 XXXXX-XXXXX 为笔误已订正），仅此一次明文返回
}

/** POST /auth/2fa/verify 请求 */
export interface TwoFactorVerifyDto {
  pendingToken: string;
  code?: string;         // 6 位动态码（与 recoveryCode 二选一）
  recoveryCode?: string; // 恢复码救急
}
```

### 6.3 核心流程

**A. 绑定（Setup → Enable）**

```
POST /2fa/setup { password }
  0. 防御：若 user.twoFactorEnabled 已为 true → 400『已启用，请先关闭两步验证』（避免覆盖待确认态）
  1. bcrypt 校验当前密码（防会话劫持者静默绑定）。〔§0.3 已裁〕enrollmentToken 强制化路径本期不存在：setup 一律要求有效 Session + 密码校验，无任何跳过分支。
  2. secret = otplib authenticator.generateSecret(32)      // 32 字节熵 → 256 位，base32 编码
  3. uri = authenticator.keyuri(username, 'TZJ Admin', secret)
  4. qrDataUrl = await QRCode.toDataURL(uri)
  5. user.twoFactorPendingSecretEnc = encryptString(secret, ...)   // 只落「待确认」字段
     user.twoFactorPendingCreatedAt = now
  6. 返回 { otpauthUri, qrDataUrl, secret, expiresAt }             // 返回完整 base32 secret 供手动录入；Secret 明文不留服务端日志

POST /2fa/enable { code }
  1. 待确认 Secret 存在且未过期（15 分钟），否则 400 要求重新 setup
  2. authenticator.options = { window: 1 }                                        // ±1 时间步容差（window 只能设在 options 上，不是 verify 的入参）
     const delta = authenticator.checkDelta(code, secret)                         // ⚠️ 用 checkDelta 才返回偏移量(number)；verify() 只返回 boolean
     if (delta === null) → 400『验证码错误』
  3. 事务内：
     twoFactorEnabled = true, twoFactorSecretEnc = pending, pending* 清空,
     twoFactorConfirmedAt = now, twoFactorLastStep = null  // 置 null：首登走 NULL 分支放行；种子「启用步」会误杀启用后 30s 内的首登（见 §10）
     生成 10 个恢复码（randomBytes(10) → base32 → 'XXXXXXXX-XXXXXXXX'，每码 80 位熵；每码另 randomBytes(16) 作 codeSalt），SHA-256(codeSalt ‖ 规范化码) 后连同 salt 批量落库
  4. 撤销该用户其他所有 Session（启用 2FA 是敏感变更，强制其它设备重新登录）
  4.5. 置**当前** Session.twoFactorVerifiedAt = now（避免 §6.4 的 refresh 401 误踢启用者；本期仅 opt-in 路径，当前请求必带有效 Session，直接置位即可。〔§0.3 已裁〕enrollment 路径不存在）
  5. audit('2fa_enabled')，返回恢复码明文（唯一一次）
```

**B. 登录二次校验（改造 `AuthService.login` + 新增 verify）**

```
AuthService.login()（改造点唯一：签发令牌前插入分支）
  密码校验通过后：
  if (user.twoFactorEnabled) {
    // 〔§0.3 已裁〕fp 设备指纹本期不实现：payload 不含 fp，pendingToken 防护 = 5min TTL + jti 单用 + per-账号尝试上限（残余风险见 §0.5-3）
    pendingToken = jwt.sign({ sub, username, type: 'twofa_pending', jti }, JWT_SECRET, { expiresIn: '5m' })
    audit('login_2fa_challenge')
    return { requires2fa: true, pendingToken, expiresIn: 300 }   // 不发正式令牌、不建 Session
  }
  // ┄┄┄┄〔§0.3 已裁 · 以下「强制化第三态 + enrollmentToken」整段本期不实施，保留仅作条件触发后的设计存档，勿照此实现〕┄┄┄┄
  // ↓↓↓ 强制化第三态（见 §12.1）：Deadline 后未绑定者既不可放行（强制化须是真强制），也不可静默锁死成自 DoS（旧两态分支的表达盲区）
  if (enforcementDeadline 已生效 && !user.twoFactorEnabled) {   // ⚠️ 本期范围（复核修正）：当前 User 模型无 identityType 字段、系统内亦无 SERVICE/BOT 账号（官网 CMS 而非 ERP），本期不引入该字段，强制化即覆盖全部 admin 角色用户；未来出现 API 集成账号时再加 `identityType === 'HUMAN'` 过滤（§13.1 已降级为条件触发项）
    // ⚠️ 必须同 pendingToken 一样携带 fp（见上）——enrollmentToken 权力远大于 pendingToken（可绑攻击者自己的 Authenticator + 直接建正式 Session = 完全账号接管），凭证越强防护越不能弱。窗口压至 15m（enroll 全程实测 <5min，30m 无必要地扩大截获后接管窗口）
    enrollmentToken = jwt.sign({ sub, username, type: 'twofa_enrollment', jti, fp }, JWT_SECRET, { expiresIn: '15m' })
    audit('login_2fa_enrollment_required')
    return { requires2fa: false, requiresEnrollment: true, enrollmentToken, expiresIn: 900 }   // 不发正式令牌、不建 Session；前端内联「绑定向导」
  }
  // ⚠️ enrollmentToken 准入边界（setup/enable 侧强制执行）：
  //   ① 类型白名单：仅接受 type === 'twofa_enrollment'，拒绝 'twofa_pending' / access / refresh —— 否则 mid-login 的 pendingToken 也能调 setup/enable，等价鉴权开口被扩大
  //   ② 单用：jti 复用 pendingToken 的单用黑名单机制，enable 成功即作废该 enrollmentToken；15m 窗口内被拦截的 token 不可反复 enroll 恶意设备
  //   ③ fp 校验：setup/enable 侧按 verify 同款分档（§6.3 B verify 步骤1）校验 fp——admin 硬拒 / 其余 soft signal；封死 enrollmentToken 被异地截获后从容完成 setup→enable 接管账号的路径
  // ┄┄┄┄〔已裁段落结束〕┄┄┄┄
  // 未启用 → 走现有路径，响应附 requires2fa: false（本期无 Deadline 概念）

POST /2fa/verify { pendingToken, code | recoveryCode }
  1. 验签 pendingToken：type 必须为 'twofa_pending'，过期即 401「请重新登录」。
     〔§0.3 已裁〕fp 校验及其 mismatch 分档处置（admin 硬拒 / 其余 soft signal）本期不实现——fp 为弱信号（UA 客户端自报、合法 IP 可漂移、§14.7 落地前亦可伪造），残余风险见 §0.5-3。
  2. 加载用户，检查 isActive / lockedUntil（沿用现有锁定机制）
  3a. 动态码路径：
      // ⚠️ 用 checkDelta 取「偏移量 delta」(-1/0/+1)；authenticator.verify() 只返回 boolean，拿不到 delta
      authenticator.options = { window: 1 };                 // ±1 时间步容差（window 设在 options，不是入参）
      const delta = authenticator.checkDelta(code, secret);  // number | null，null = 无效
      if (delta === null) → audit('2fa_failed') + 401『验证码错误』
      // ⚠️ §0.3 保底：verify 所有失败分支（码错 / 重放拒绝 / 恢复码未命中或已消费）统一先写 audit('2fa_failed') 再 401——告警已裁，AuditLog 是唯一检测面
      // 换算绝对时间步：floor(epoch/30) + delta（防重放的关键，不能存 delta 本身）
      // ⚠️ 必须 BigInt：列类型是 BigInt，若用 number 与 BigInt 比较会抛 TypeError（number <= BigInt 非法）
      const matchedStep = BigInt(Math.floor(Date.now() / 30_000) + delta);
      // 重放检查（快速路径预检，最终裁决在下方原子写）：首次 twoFactorLastStep 为 null 时跳过（新用户首登）
      if (user.twoFactorLastStep !== null && matchedStep <= user.twoFactorLastStep)
        → 401『该验证码已使用，请等待约 30 秒后重试』
      // 成功：⚠️ 原子条件写入绝对步（复核修正 A1：不可先读后写——两个并发 verify 同读旧 step 会双双放行，构成 TOCTOU 并发重放）
      //   const { count } = await prisma.user.updateMany({
      //     where: { id: user.id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: matchedStep } }] },
      //     data: { twoFactorLastStep: matchedStep } })
      //   if (count === 0) → 401『该验证码已使用…』  // 并发请求已抢先消费该时间步；以 affected rows 为唯一裁决，上方预检仅为省一次写
      // 注意：2FA 失败【不】累加账号级 failedLoginAttempts（防锁户 DoS，见 §6.4）
  3b. 恢复码路径：
      normalize（去连字符转大写）→ 遍历该用户所有 usedAt=null 记录，
      逐条计算 SHA-256(record.codeSalt ‖ 规范化候选码) 与 record.codeHash **用 `crypto.timingSafeEqual` 常量时间比对**（不可用 `===`，逐条 hash 比对若短路会引入微弱时序侧信道，泄露命中位置）；两侧须为等长 Buffer，长度不等直接判否，
      命中 → ⚠️ 原子条件消费（复核修正 A2：一次一密不可先查后改，否则并发双花）：
        const { count } = await prisma.twoFactorRecoveryCode.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } })
        if (count === 0) → 401『恢复码无效』  // 并发请求已抢先消费该码
        count === 1 才算成功 → audit('2fa_recovery_used')
      （⚠️ 恢复码每码独立 salt，无法按 hash 反查；salt 由记录自带，须逐条带 salt 重算，呼应 §4）
      剩余 ≤ 2 时响应携带 warning 提醒重新生成
  4. 签发正式 access/refresh 令牌 + persistSession()（与现有 login 成功路径完全一致）
  5. 重置 failedLoginAttempts，audit('2fa_verified')
```

**C. 解绑**

```
POST /2fa/disable { password, code | recoveryCode }
  1. bcrypt 校验密码 且 校验动态码/恢复码（双重确认）
  2. 事务清空全部 2FA 字段 + 删除该用户所有 TwoFactorRecoveryCode
  3. audit('2fa_disabled')（高危事件，后续可接告警）

  // ── 运维救急（break-glass）──
  // 当用户同时丢失 2FA 设备【且】全部恢复码时，必须有 super-admin 强制关闭通道：
  //   POST /admin/maintenance/2fa/force-disable { targetUserId }
  //   （仅 super-admin 角色 + 自身 2FA/密码二次确认）
  //   事务内清空该用户全部 2FA 字段与恢复码，audit('2fa_force_disabled') 并告警。
  // 该接口本身即是高危入口，必须独立于普通 disable、带更严格的鉴权与审计。
  // ⚠️ 治理要求〔§0.3 再降级〕：流程简化为「操作即审计」（audit('2fa_force_disabled')），无双人复核环节；
  //   极端情况（super-admin 自身失联/失效）由 SSH 执行重置 SQL 救急，SQL 与步骤写入运维 README。
```

### 6.4 防暴力破解与重放（对照需求红线）

| 威胁 | 对策 |
|------|------|
| 在线爆破 6 位码（1e6 空间） | ① 路由级 `@Throttle({ default: { limit: 5, ttl: 60_000 } })`（**per-IP 兜底**维度）；② **不累加账号级 `failedLoginAttempts`**（避免攻击者连错 5 次把合法用户锁 15 分钟的 DoS）；③ **必须**叠加「per-账号（sub 维度）尝试上限」：`verify` 内以 `pendingToken.sub` 为 key 维护计数器（⚠️ 复核修正 A3：key **不可**用 jti/pendingToken 本身，否则攻击者重走密码关重签新 token 即可刷新配额；副作用见 §0.5-2）（单实例用内存 Map，TTL=5min；多实例见 §6.4 单实例声明），达上限即**作废该 pendingToken**（加入黑名单/使其重签无效），强制重走密码关——这是「超限即作废 pendingToken」承诺的**真正落地机制**，单靠 IP 限流无法兑现；④ pendingToken 仅 5 分钟有效 |
| 限流维度单一（仅 IP） | 当前 `@Throttle` 默认按 IP：企业 NAT / 办公统一出口下可能误伤合法管理员，且无法限制「同一账号被不同 IP 撞库」。**必须（原「建议」提升）叠加 per-user keyed guard**（以 `pendingToken.sub` 为 key）：因 2FA 失败**不**累加账号锁（已规避 DoS），per-user 限流安全可行，防护更强；与 ①-③ 的 per-账号计数器**同源实现**（同一 key 维度）。 |
| 动态码重放 | `twoFactorLastStep` 存**绝对时间步**（`floor(now/30)+delta`）单调递增校验，同码/旧码一律拒绝（首次为 null 跳过） |
| pendingToken 重放 | 令牌只授予「进入 2FA 校验」资格，无任何数据权限；5 分钟自失效。**建议实现（单实例下零成本）**：`pendingToken` 携带 `jti`，成功 verify 后将该 `jti` 记入进程内 `Set`（5 分钟 TTL），重复 `jti` 直接 401——闭合「同一 pendingToken 重放」残余。本环境为单实例（1C2G 无 Redis/多副本），内存结构即可，重启仅丢失窗口内记录，影响可忽略。 |
| 恢复码爆破 | 80 位熵 + 同一限流管道，不可行 |
| Secret 泄露（拖库） | AES-256-GCM 加密，密钥在环境变量不落库；域分离 KDF 防跨模块密文互解 |
| 会话劫持者绑定/解绑 2FA | setup 与 disable 均要求重输当前密码 |
| **refresh 令牌绕开 2FA（头号缺口·必须收敛）** | 现有 `refresh()` 仅验 refresh token + session，不查 2FA 状态，refresh TTL 7 天 → 盗得一次有效 refresh token 即可在 7 天内免 2FA 续命（违反 OWASP ASVS 2.8「MFA 须覆盖每次认证事件，含令牌刷新」）。**收敛方案（推荐落地）**：① `Session` 模型加 `twoFactorVerifiedAt DateTime?`；② `verify-2fa` 成功签发前将该会话 `twoFactorVerifiedAt=now`（经 `issueTokens` 新增入参或专用发放路径）；③ `refresh()` 在 `user.twoFactorEnabled && !session.twoFactorVerifiedAt` 时直接 401 强制重走密码+2FA（⚠️ 此 gating 须受 §9 `TWOFA_CHALLENGE_DISABLED` 同步豁免，否则事故期密码登录的会话会在 refresh 处被反复踢出、kill-switch 止血仅 15min）；④ 轮换产出的新会话继承该标记。启用 2FA 时（§6.3 B 步骤4）已撤销其他会话，当前启用会话可在 enable 时一并置 `twoFactorVerifiedAt=now` 避免启用者被误踢。如此 pre-enable 的长效 token 一旦 2FA 启用即在下次刷新被拒（特权角色 refresh TTL 收紧见 §12.5）。 |
| **refresh 令牌被盗（轮换已实现·须对齐而非重建）** | ✅ **事实修正（对照 `auth.service.ts` 复核）**：刷新令牌轮换**已在现有 `refresh()` 落地**（撤销旧 Session、记录 `rotatedToHash` + `graceUntil` 宽限期），且代码注释明确说明**故意不做「复用即吊销全部会话」**——中间件 + BFF 双套刷新逻辑与多标签页并发竞态下会频繁误杀坐席（OAuth 2.0 安全 BCP / Auth0 宽限期实践）。本方案不得重新引入「二次使用即全吊销」，避免与既有设计决策打架。真正要做的是：① **`reuseWithinGrace()` 新建的 Session 必须继承 `twoFactorVerifiedAt`**——该路径会为宽限期内复用者签发全新 Session，若不继承，合法用户竞态复用后会在下次 refresh 被上一行收敛③误踢；② **记录残余风险**：宽限期（默认 10s）内攻击者重放刚被轮换的旧令牌同样能拿到新 Session，这是既有宽限设计的已知取舍，与 §12.5 特权角色 TTL 缩短协同压缩暴露面即可。 |
| **实时钓鱼代理中继（Evilginx 类·残余天花板）** | TOTP 是「用户→服务器」单向码，无通道绑定；遭遇反向代理钓鱼（真实中继登录请求到真服务器）时，攻击者可于 30s 窗口内把 victim 的 TOTP 同步提交，2FA 形同虚设。CapJS 只证明「是人」而非「是特定的人」，同样不防。→ **根本解：v2 引入 WebAuthn / Passkey**（域名绑定、抗钓鱼、无共享密钥）；过渡期缓解：① 缩短 access TTL；② 高敏操作（关闭 2FA / 改密码 / 角色变更）强制 step-up 重验 2FA；③ 严格 CSP 缩小 XSS→会话劫持面。 |

**检测与响应**：〔§0.3 已降级〕~~实时告警体系~~ 本期不建，检测面 = AuditLog + 应用日志 WARN（残余风险见 §0.5-5）。保底必做：① verify 失败写 `2fa_failed` 审计（已落入 §6.3 B 3a 伪代码）；② kill-switch 置位打启动日志 ERROR 横幅 + 写 `2fa_killswitch_activated` 审计；③ `2fa_force_disabled` / `2fa_recovery_used` 照常落审计，由超管定期人工核查。〔§0.3 已裁〕~~动作名收敛为 packages/types 常量枚举~~——审计动作名直接用 `apps/api` 内字符串常量（集中到一个 const 对象防拼写漂移即可，不建共享枚举）。

> ⚠️ **单实例假设（架构雷·须显式声明）**：本方案多处安全机制硬依赖单实例——`pendingToken` 单用靠进程内 `Set`（§6.4 jti 行）、`@Throttle` 默认 per-IP 且不跨副本共享、per-user keyed guard 同样无共享存储。一旦水平扩容（多副本 / 多 Pod），这些行为**静默失效**（jti 单用失效、限流被稀释），且不会报错。→ 本设计**当前仅适用于单实例部署**；若未来需横向扩容，`pendingToken` 单用计数与限流须迁移至 Redis / 集中式存储，否则上述防护在扩容瞬间失守。

## 7. 前端设计（`apps/admin`）

### 7.1 BFF 改动

```
  app/api/auth/login/route.ts（改造）
  上游返回 requires2fa: true 时：
    - pendingToken 写入 httpOnly Cookie `tzj_2fa_pending`（maxAge 300s, sameSite lax）
    - 响应 { success: false, requires2fa: true }（令牌不进前端 JS）
  ⚠️ **重写而非追加**：现有 BFF `login/route.ts` 有兜底 `if (!accessToken || !refreshToken) return 502『服务端未返回令牌』`。2FA 开启后 login 返回的是 `requires2fa:true` 且无 token，若不替换该分支会被误判 502、前端卡死。必须将整个成功分支改为「先判 requires2fa，true 则写 pending Cookie 并返回 requires2fa；false 才走现有写 token 逻辑」。

app/api/auth/verify-2fa/route.ts（新增）
  1. 从 Cookie 读 pendingToken（前端 JS 全程接触不到）
  2. 代理 POST /auth/2fa/verify { pendingToken, code | recoveryCode }
  3. 成功：写 access/refresh Cookie（复用现有写法）、删除 pending Cookie
  4. 失败：透传错误消息（含剩余尝试提示）

app/api/auth/2fa/[...]/route.ts（新增，简单透传）
  status / setup / enable / disable / regenerate → 携带 access Cookie 代理到 NestJS
```

⚠️ **BFF 卫生要求（复核追加）**：① `setup` 响应含**明文 TOTP Secret 与二维码 Data URL**——BFF 透传路由与任何日志/监控中间件**不得记录该响应体**，且响应头加 `Cache-Control: no-store`；② 现有 `login/route.ts` 的 `retryFetch(..., { retryWrites: true })` 注释「login 无副作用，安全重试」**已不成立**：登录失败会累加 `failedLoginAttempts`（网络抖动重试错密码 → 双倍计数、加速锁户），2FA 后重试还会重复消耗限流配额、重复签发 pendingToken 与重复审计。登录 / verify-2fa / setup 类请求须**关闭写重试**（仅「未收到任何响应」的网络级失败可重试）。

### 7.2 页面改动

**登录页 `app/login/page.tsx`**：单页两步（不新增路由，避免中间态被直达）：

```tsx
// 伪代码：状态机 'credentials' | 'totp'
const [step, setStep] = useState<'credentials' | 'totp'>('credentials');

// 第一步提交后：
if (body.requires2fa) { setStep('totp'); return; }   // pendingToken 已在 httpOnly Cookie

// 第二步 UI：6 位分格输入框（自动聚焦、自动提交）+「使用恢复码」切换链接
await fetch(`${BASE_PATH}/api/auth/verify-2fa`, { method: 'POST', body: JSON.stringify({ code }) });
// 成功 → router.replace(from ?? '/')；pendingToken 过期 → 提示并退回第一步
```

**安全设置（个人资料页新增「两步验证」卡片）**：

```
未启用：[启用两步验证] → Dialog 向导三步：
  ① 输入当前密码 → 调 setup
  ② 展示二维码（<img src={qrDataUrl}>）+ 展示**完整 base32 密钥**（带复制按钮，setup 为受信设备一次性操作、无需遮罩）+ 手动密钥录入入口 → 输入 App 上的 6 位码 → 调 enable
  ③ 展示 10 个恢复码 + [复制全部] / [下载 .txt]，勾选「我已保存」才能关闭
已启用：显示启用时间 / 恢复码剩余数，[重新生成恢复码] [关闭两步验证]（均需二次验证 Dialog）
```

复用 `@tzj/ui` 现有 `SimpleDialog / ConfirmDialog / Input / Button`，无新 UI 依赖。

## 8. 环境变量

无新增必填项。复用：`JWT_SECRET`（pendingToken 签名）、`SECRETS_ENCRYPTION_KEY`（Secret 加密）。
⚠️ **`SECRETS_ENCRYPTION_KEY` 当前在 `env.validation.ts` 为 `.optional()`**，但 2FA 加密 TOTP Secret 强依赖它——若生产未配置，`enable()` 运行期会抛「key must be at least 32 characters」。**必须改为必填**（或 `TwoFactorModule` 初始化时 fail-fast 校验），否则上线即崩。KMS/Vault 注入与 escrow 备份为 **[条件触发]** 项（见 §12.2）；本期基线 = env 注入 + 必填 fail-fast + 密钥离机备份 runbook。
可选新增（zod `.optional()` + 默认值）：

```
TWOFA_PENDING_TTL_SECONDS=300   # 预鉴权令牌有效期
TWOFA_SETUP_TTL_MINUTES=15      # 待确认 Secret 有效期
```

## 9. 实施顺序与回滚

1. Prisma 迁移（纯新增字段/表，可安全回滚）
2. `secrets-crypto.ts` 泛化 + 单测（加解密回环、篡改检测）
3. `TwoFactorService` + 单测（±1 窗口、重放拒绝、恢复码用后即焚）
4. Controller + DTO + 限流注解；`AuthService.login` 分支改造
5. `packages/types` 契约（A1 审批）
6. admin BFF 路由 + 登录页两步化 + 设置页向导
7. E2E：绑定→登出→两步登录→恢复码登录→解绑 全链路

回滚策略：`login()` 的 2FA 分支仅对 `twoFactorEnabled=true` 的用户生效，未绑定用户零感知；出问题可由 DBA 将指定用户 `twoFactorEnabled` 置 false 紧急放行（字段保留，重新绑定即可）。
⚠️ **全局紧急 kill-switch（P1 事故预案，逐用户改库在全局故障中不可接受）**：若发生全局性故障——`SECRETS_ENCRYPTION_KEY` 注入失败（全员 Secret 解不开）、服务器时钟严重漂移（全量 TOTP 校验失败）、加密库升级回归——须有分钟级止血手段。〔§0.2 已合并为单开关〕本期仅设一个环境开关：
- ~~`TWOFA_ENFORCEMENT_DISABLED`~~〔§0.3 已裁：强制化状态机已裁，此开关无对象〕
- `TWOFA_CHALLENGE_DISABLED=true` → 暂停 2FA 挑战（`twoFactorEnabled=true` 用户也暂时跳过第二步，仅密码登录）。
⚠️ **`TWOFA_CHALLENGE_DISABLED` 必须同步豁免 refresh gating（否则止血只有 15 分钟 = 形同虚设）**：事故期间用密码登录建的 Session **没有 `twoFactorVerifiedAt`**，而 §6.4 收敛③会在 `twoFactorEnabled && !session.twoFactorVerifiedAt` 时于 refresh 直接 401 → access token 过期（约 15min）后用户被反复踢出重登，循环无解。因此开关置位期间，`refresh()` 的 2FA gating（§6.4 收敛③）**同步豁免**。
⚠️ **事故结束后的处置（必须写明，否则运维会把期望行为当成新故障）**：开关关闭时，所有 `twoFactorVerifiedAt=null` 的存量会话将在下次 `refresh()` 被拒、强制重走完整密码+2FA 认证——这是**期望的收敛行为**（把事故期未验 2FA 的会话清退），非 bug；复盘须提前通知运维与用户预期一次集中重登。
**治理约束（防止开关沦为后门）**〔§0.3 已降级〕：① 开关置位即刻打启动日志 **ERROR 横幅** + 写审计事件 `2fa_killswitch_activated`（~~实时安全告警 + 配置漂移监控~~ 已裁，检测面仅剩审计，见 §0.5-5）；② 仅限事故窗口启用，事故复盘须记录启用/关闭时间戳；③ 生产长期置位视作安全控制拆除，超管月度核查审计。

## 10. 测试要点

- 时钟漂移：伪造 ±30s / ±60s 的码，前者过后者拒；另：服务端须保证系统时钟准确（建议启用 NTP/chrony），否则真实 TOTP 会因服务器漂移偶发校验失败——这是 TOTP 方案的外部依赖，部署文档需声明。
- 重放：同一个码连续提交两次，第二次必须 401
- 限流：1 分钟内第 6 次 verify 请求返回 429
- 限流/锁定：2FA 失败走 `@Throttle(5/min)`（IP 维度）且**不**累加账号级 `failedLoginAttempts`（防锁户 DoS，见 §6.4）；连续超限即作废 pendingToken，需重走密码关
- pendingToken：过期后提交返回 401 且引导回第一步；用正式 accessToken 冒充 pendingToken 必须被 type 校验拒绝
- 恢复码：使用后立即失效；`regenerate` 后旧码全部失效；校验须逐条 `SHA-256(codeSalt ‖ 规范化码)` 比对（每码独立 salt，呼应 §4、§6.3 B 3b），不得按 hash 直接反查
- 兼容性：Microsoft Authenticator / Google Authenticator / Bitwarden 扫码均能出码（标准 SHA1/6 位/30s，全兼容）
- 重放（绝对步）：同一绝对步 `(floor(now/30)+delta)` 连续提交两次，第二次必须 401；并补一条「新用户 `twoFactorLastStep=null` 时首次任意有效码应放行」的用例（验证 NULL 分支）
- 原子性（复核追加）：`enable` 事务中「置 enabled + 迁移 Secret + 写 10 条恢复码」任一步失败须整体回滚，不得出现 `twoFactorEnabled=true` 而恢复码缺失的半态
- 并发原子性（复核修正 A1/A2）：同一有效动态码**并发**提交 2 个请求，恰好 1 个成功、另 1 个 401（`updateMany` 条件写以 affected rows 裁决）；同一恢复码并发提交 2 个请求，恰好 1 个成功（`WHERE usedAt IS NULL` 原子消费，无双花）
- 幂等/重试（复核追加）：BFF 重试或用户双击导致的重复 `setup` 只应覆盖刷新待确认 Secret（旧 pending 作废），不得多份并存；`enable` 成功后的重复提交须 400「已启用」
- 宽限期继承（复核追加）：refresh 宽限期竞态复用（`reuseWithinGrace`）产出的新 Session 须继承 `twoFactorVerifiedAt`，否则合法用户会在下次 refresh 被 2FA gating 误踢（见 §6.4 复核修正行）

## 11. 后续演进（v2 方向，不在本期）

> ⚠️ **决策前必须正面回答（复核追加）**：本系统管理员**个位数且全部受控**，「**Passkey-first、直接跳过 TOTP**」是严肃选项——直接上 WebAuthn 可整体删除：恢复码全生命周期（生成/加盐哈希/用后即焚/剩余告警/重生成）、TOTP Secret 加密与密钥轮换故事、NTP 时钟漂移运维依赖，并天然免疫 §6.4 承认 TOTP 防不了的实时钓鱼中继；`@simplewebauthn` 系列成熟度不低于 otplib。若仍选 TOTP 先行，评审记录须写明理由（如需覆盖无 Passkey 硬件/旧浏览器的兜底场景），不得默认 TOTP 是必经第一步。

- **WebAuthn / Passkey（已拍板）**：TOTP 可被实时钓鱼代理中继（见 §6.4），抗钓鱼的终局是 WebAuthn（域名绑定、无共享密钥、设备/生物因子）。**决策：作为快速跟随 v2，TOTP 生产稳定后紧接启动（目标下季度 GA）**；`User` / `TwoFactor` 抽象现在即预留 WebAuthn credential 表与因子枚举（`FACTOR_TOTP | FACTOR_WEBAUTHN`），避免后期重写。上线后 WebAuthn 作为 **admin 角色首选因子**（TOTP 退为兜底 + 无硬件/无手机用户用，呼应 §13.1），Sync Passkey 顺带解决多设备迁移痛点。
- **per-user 限流 + 实时告警**：见 §6.4。
- **SSO / 企业 IdP**：若 admin 用户来自企业目录，可对接 OIDC / SAML，把 MFA 下沉到 IdP，本方案退为兜底。
- **密钥轮换**：`SECRETS_ENCRYPTION_KEY` 目前无轮换故事；一旦泄露需全量重加密 TOTP Secret，建议预留「按 userId 批量重加密」脚本。

## 12. 企业治理补充（上市公司合规基线）

> ⚠️ **范围分级（复核修正，防止过度建设稀释 P0 执行力）**：本系统实际是**官网 + CMS 后台**（1C2G 单机、管理员个位数），并非上市公司 ERP——原文按「世界 500 强」口径撰写，与实际资产错配。本节各项重标为三档：**[本期必做]** / **[条件触发]**（写明触发条件）/ **[不适用]**。实施者只对 [本期必做] 负责，其余**不得进入本期排期**；原合规论述保留作未来演进参考。

### 12.1 强制化策略（合规硬要求）**[已裁，见 §0.3——本节整节转为设计存档，§0 优先于本节原标注]**

> 〔§0.3 裁定〕本期以「用户管理列表加 2FA 状态列 + 线下限期催办 + 到期由超管停用账号」替代整套强制化状态机与 enrollmentToken 流程；本节保留作条件触发（管理员规模增长 / 外部合规审计硬要求）后的设计存档，勿照此实施。
当前设计为「用户自选启用」。对等保 2.0（GB/T 22239）三级/四级、ISO 27001、SOC 2 CC6.1、NIST 800-171 等框架，特权访问 MFA 须为**系统层强制**；可选启用在审计中判「部分满足」，构成上市审计硬伤。
采用分阶段强制：
1. 上线首月：opt-in 过渡，允许自助绑定（沿用现有 `twoFactorEnabled` 流程）。
2. 设 Deadline（如上线后 30 天）：所有 **`role >= admin`** 用户强制启用（复核修正：本期系统无 SERVICE/BOT 非人账号，`identityType` 过滤不引入，见 §6.3 B / §13.1 [条件触发]）；未绑定者登录被拦截并引导绑定（login 分支增 `enforcementDeadline` 配置，落第三态 `requiresEnrollment`，见 §6.3 B）。~~Deadline 与「关账日历」联动~~ **[不适用]**：本系统为官网 CMS、无财务关账周期，Deadline 避开重大发布/营销窗口即可。
   - **内联 enroll 向导（避免自 DoS 死路）**：`requiresEnrollment=true` 时前端不跳出系统，而是内联「绑定向导」：凭 `enrollmentToken`（type=`twofa_enrollment`，15m，**绑 fp**）调用 `/2fa/setup` 与 `/2fa/enable`（此两接口须接受 `enrollmentToken` 作为与「有效 Session」等价的备用鉴权，**并以 `enrollmentToken.sub` 解析用户、跳过密码重验**——密码已在 login 校验，enrollmentToken 仅作状态桥接；opt-in 路径仍保留密码校验，见 §6.3 A）。**准入硬边界（必须）**：① setup/enable 校验 `type === 'twofa_enrollment'` 白名单，拒绝 `twofa_pending`/access/refresh 冒用；② enrollmentToken **单用**（jti 走 pendingToken 同款黑名单），enable 成功即作废，防 15m 窗口内被截获后反复注册恶意设备；③ **fp 分档校验**（同 verify，admin 硬拒/其余 soft）——enrollmentToken 是账号接管级凭证，防护强度须≥pendingToken，不可裸奔（见 §6.3 B 准入边界注释）。`enable` 成功即当场签发正式令牌 + 建 Session（`twoFactorVerifiedAt=now`，呼应 §6.4）+ 返回恢复码，用户一气呵成进系统，**无独立注册入口、不依赖任何外部流程**。
   - 误区警示：旧「两态分支」下 `now>=deadline && !twoFactorEnabled` 既发不出 `pendingToken`（未启用）又该被拦截——两态无法表达第三态，结果要么仍放行（强制化形同虚设）要么直接锁死且无注册入口（全公司未注册人群集体无法登录 = 自 DoS）。第三态是 MFA 强推最常翻车点，必须显式建模。
3. 例外流程：仅「无智能手机/特殊岗位」走审批单 + break-glass，不默认豁免。

### 12.2 密钥托管与灾备（KMS / DR）**[条件触发：若引入 KMS/Vault 基础设施]**
> 复核：1C2G 单机无 KMS/Vault 基建，本期现实基线是「env 注入 + 严格文件权限 + 密钥离机备份 runbook」；下述 KMS/Vault 为升级目标，非本期阻塞项。**但 §8 的 `SECRETS_ENCRYPTION_KEY` 改必填与 fail-fast 为本期硬要求（不依赖 KMS）。**
下述密钥当前均为环境变量，不满足上市公司密钥全生命周期管理要求：`SECRETS_ENCRYPTION_KEY`（TOTP 加密，丢失即全员锁死 BCP 风险，break-glass 仅清 2FA 不解密）、`JWT_SECRET`（签发 access/refresh/pendingToken，一钥掌控全站会话）、`CAP_SECRET` / `CAP_TOKEN_SECRET`（PoW 挑战与 capToken 签名）。
- **全部**改为由 **KMS / Vault** 注入，启用 fail-fast（见 §8）。
- 明确密钥 **escrow / 备份**与恢复 runbook：托管人、恢复流程、演练频率。
- 预留 `SECRETS_ENCRYPTION_KEY` 轮换 + 按 userId 批量重加密脚本（升级为 P0，见 §11）；`JWT_SECRET` / `CAP_*` 同理须有轮换预案（并附重新签发受影响令牌的 runbook）。

### 12.3 审计留存与四眼原则**[部分本期必做 / 部分不适用]**
- **[本期必做]** 审计日志定义合理留存期（等保参考 ≥6 个月）与只追加语义；~~SOX 1–7 年 WORM~~ **[不适用]**（非上市公司 ERP）。
- **[已再降级，见 §0.3]** break-glass `force-disable`（§6.3 C）流程简化为「操作即审计」；~~双人知悉 + 24h 复核 + 强制告警~~ 与 ~~双岗/四眼 + 变更工单号~~ 在管理员个位数规模下均 **[不适用]**。

### 12.4 上线验收门禁**[本期必做·降级版]**
登录链路属重大安全变更，上线前须过 go/no-go 评审 + 内部安全自查清单（至少覆盖本文 §6.4 威胁表 + §14 纵深补强）；~~独立第三方渗透测试~~ 在当前预算/规模下降为 **[条件触发：若后台扩展为含交易/支付的业务系统]**（CapJS 方案同此，见其 §10.3）。

### 12.5 特权会话 TTL**[本期必做]**
refresh 7 天对 admin 过长（见 §6.4 头号缺口）。按角色差异化：特权角色缩短至 8–24h，降低长效令牌暴露面。

### 12.6 可观测性度量**[条件触发：有监控基础设施时]**
除 §6.4 告警外，建立 dashboard：2FA 启用覆盖率、验证失败率、恢复码使用频次、capToken 解题耗时分布——衡量方案真实有效性及支持工单影响。

## 13. ERP 特有考量（企业资源规划系统安全视角）

> ⚠️ **整节范围判定（复核修正）**：本系统是官网 + CMS（schema 为 Product/Case/News/Blog/Contact/Customer），**不是 ERP**。本节绝大部分（SoD 交易级 step-up、EDI/RPA 非人账号、关账窗口、共享工控机）在本期 **[不适用]**，仅作为「若未来接入订单/支付/多角色交易」的 **[条件触发]** 参考。

### 13.1 身份分类与非人账号强认证**[条件触发：若未来新增 API/集成账号]**
> 复核：本期系统无 SERVICE/BOT 非人身份，`identityType` 字段与强制化过滤均不引入（见 §6.3 B / §12.1）。仅当未来新增 API 集成/批处理账号时，才需按下述引入身份分类与非人强认证。
TOTP 仅适用于「人」（需扫码、每 30s 输码）。ERP 大量存在**非人身份**：API 集成、EDI、中间件、夜班批处理、RPA。§12.1 的 `role >= admin` 强制化会误伤（批处理在 Deadline 后集体登录失败→关账夜崩）且漏管（高权接口账号非 admin 角色）。
- `User` 模型增 `identityType: HUMAN | SERVICE | BOT`；2FA 强制**只对 HUMAN 生效**。
- 非人身份豁免 2FA，强制替代强认证：**mTLS + OAuth Client Credentials + 源 IP 白名单 + 窄 scope**；其密钥同样走 KMS 轮换（呼应 §12.2）。
- 此类账号本就不走浏览器登录页 → 亦不在 CapJS 范围（见 CapJS §11）。

### 13.2 SoD 交易级 step-up（职责分离 + 不可抵赖）**[不适用：无交易/审批流]**
ERP 灵魂是 SoD（同人不能既建供应商又批付款）。登录级 2FA 对「已认证会话内的高危交易」无感。须把 step-up（§6.4）下沉到**交易级**并明确清单：付款运行（payment run）、供应商银行账号变更、总账大额过账、角色/权限变更。
- **关键**：step-up MFA 证明须**绑定到该笔交易记录**（不可抵赖 / non-repudiation），而非仅刷新会话——审计员要看「这笔付款释放由谁用 MFA 确认过」，满足 SOX 可追溯性。

### 13.3 共享终端 / 轮班坐席策略**[不适用：无共享工控机/轮班坐席场景]**
ERP 后台常为**共享工控机 / 轮班坐席**：httpOnly cookie 留共享机 → 下一班可冒用；每班输码摩擦高遭业务抵制。
- 共享终端场景**禁用持久 cookie**，改短时会话 + 空闲超时 + 显式注销；或设备绑定（受管终端白名单 / device fingerprint）。
- 优先采用「step-up 仅在敏感交易触发」降低摩擦，§12.1 强制化须**区分终端类型**。

### 13.4 关账窗口规避与 break-glass 演练**[关账部分不适用；break-glass 演练保留、频率降为半年一次]**
ERP 有强业务周期（月末/年末关账），2FA 故障撞关账 = 财务事故。
- §12.1 的强制化 Deadline 须**避开关账窗口**。
- §12.3 break-glass 须**季度演练**，证明关账期可救急；并建立帮助台身份验证流程（防社工冒用 disable）+ 预期工单量预案（强制化后帮助台必被淹没，且成社工新靶点）。

### 13.5 与既有企业 IdP / ERP IAM 的关系（避免过度建设）**[条件触发：若接入企业 IdP]**
成熟 ERP（SAP / Oracle / 用友 / 金蝶）常已有中央 IdP 且自带 MFA。
- 若本 admin 属更大 IAM 一部分，**2FA 应下沉到 IdP**，本方案退为「IdP 不可用时的兜底」或仅保护 BFF 直连，避免 **MFA 碎片化**（用户管多套 TOTP、策略冲突）。实施前先确认是否已有企业 MFA（呼应 §11 SSO）。

## 14. 纵深防御补充（安全架构师复核遗留）

> 以下 6 项为上线前的「硬底线」收尾补强，严重度 🟠 中（非阻塞），但 §14.4 / §14.5 须上线前确认。

### 14.1 账号枚举卫生（Account Enumeration）
- 错误响应（用户不存在 / 密码错 / 2FA 错）须**统一文案与近似耗时**，避免时序/措辞差异泄露账号存在性。
- 不得在公开响应中**预先暴露某账号是否启用 2FA**（防攻击者先测绘「谁有 2FA」再定向钓鱼）。本设计 `requires2fa` 仅在密码校验通过后才返回，已满足；实施中须保持此顺序，不得为 UX 提前返回 2FA 状态。

### 14.2 会话并发限制〔§0.3：条件未触发前不进排期〕
限制单管理员**最大并发会话数**（如 3）；异常多地点并发即告警/踢除。与 §13.3 共享终端策略协同（共享终端本就禁用持久 cookie）。

### 14.3 口令策略 + 泄露口令检测〔§0.3：条件未触发前不进排期〕
2FA 不补偿弱口令。须叠加：① 最小长度/复杂度（或 Passphrase）；② 接入**泄露口令库检测**（如 HIBP k-匿名）阻止已泄露密码——NIST 800-63B 明确要求，与 2FA 形成「所知+所有」互补。（属 `User` 密码域既有逻辑，§6.3 校验密码处须确认其已落地。）

### 14.4 JWT 算法钉死（Alg Confusion 防护）
`jwt.verifyAsync` 必须显式 `algorithms: ['HS256']`，否则存在 `alg=none` / RS→HS 混淆攻击面。pendingToken、capToken 共用 HS256 体系，更须钉死。涉及 §6.3 B verify 验签处与 BFF 侧 JWT 校验。

### 14.5 传输安全声明
① `tzj_2fa_pending` 等 Cookie 除 httpOnly 外须置 **`Secure`** 标志；② 强制 **HSTS**；③ 禁 **TLS1.1-**。涉及 §7.1 / §8。

### 14.6 边缘 / WAF 限流（纵深最外层）〔§0.3：条件未触发前不进排期〕
应用层 `@Throttle`（§6.4）为单实例天花板。公网暴露模型（§1.1）下须在**边缘（Cloudflare / WAF / 网关）**再叠 `/auth/login` 与 `/auth/2fa/verify` 的限流与异常流量清洗，作为最外层兜底（CapJS 侧见其 §10.5）。

### 14.7 BFF 代理拓扑下的真实客户端 IP 透传（🔴 重大·所有 per-IP 机制的存活前提）

> ⚠️ **升格为两方案共同的 P0 前置工程项（复核修正：这不是未来风险，是现网正在发生的事）**：现有 `apps/api/src/common/utils/client-ip.ts` 的 `extractClientIp()` **无条件采信任意来源 `X-Forwarded-For` 的第一段**，且已被 AuditLog 与 IpBanGuard 使用——攻击者今天即可伪造 XFF 绕过 IP 封禁、污染审计源 IP；同时 Nest `ThrottlerGuard` 默认 tracker 取 `req.ip`，与 `extractClientIp` 是**两套互不一致的口径**。故本节不是新功能附注，而是独立前置任务「**统一真实 IP 解析口径**」，2FA 与 CapJS（其 §10.6）均以其为依赖、须先行落地。

本项目架构（§1、§7.1）是**浏览器只与 admin BFF 同源通信，BFF 服务端 `fetch` 转发到 NestJS**。这意味着 NestJS 看到的 `req.ip` / `req.socket.remoteAddress` **恒为 BFF 服务器 IP**，且 BFF 服务端 `fetch` 默认**不携带浏览器 `User-Agent`**。若不显式修正，下列所有 per-IP / 指纹 / 审计机制**系统性失真且不报错**：
- **per-IP 限流塌缩为全站共享桶（可被反向武器化为登录 DoS）**：§6.4 的 `/2fa/verify` 5/min/IP、§6.2 各接口限流，在 NestJS 眼里全部来自同一个 BFF IP → 攻击者打满该桶即可把**全体管理员**挡在登录外。限流从「防御」变成攻击者手里的「全站开关」。
- **fp 设备指纹全员同值（§6.3 B 失效）**：`fp = SHA-256(req.ip ‖ req.userAgent)` 中 IP 恒为 BFF IP、UA 恒为 node fetch 默认值 → 既不防异地接力（全员同值），admin 硬拒档还可能误拒。
- **AuditLog 源 IP 失真（合规硬伤）**：§12.3 审计留存、§6.4「异常 IP 的 `login_2fa_challenge`」告警的源 IP 全是 BFF IP → 等保/SOX「来源可追溯」不满足，异常 IP 告警永不触发。

**必修（前 8 轮「须配 trust proxy」只说对了一半——流量根本全部经 BFF，这不是可选项而是上述机制存活的前提）**：
1. **BFF 侧**：所有转发到 NestJS 的路由（login / verify-2fa / 2fa/*）显式附带 `X-Forwarded-For: <浏览器真实出口 IP>` 与透传原始 `User-Agent`（从 Next.js `headers()` 取 `x-forwarded-for` / `user-agent` 再向下游转发）。
2. **NestJS 侧**：`app.set('trust proxy', ...)` **只信任 BFF 来源**（按 BFF 固定内网 IP / 跳数配置，**不可** `trust proxy: true` 无条件信任任意 XFF，否则公网可伪造）。
3. **四处统一取真实 IP**：修复 `extractClientIp()`（仅当请求来自受信 BFF/代理时才采信 XFF，否则回退 socket 地址——IpBanGuard 随之一并受益）、Throttler 的 `getTracker`（默认 `req.ip`，与 extractClientIp 口径不一致，须统一）、fp 计算、AuditLog 写入，统一取解析后的真实客户端 IP（而非 `req.ip` 裸值）。
4. **测试用例（§10 补一条）**：经 BFF 完成一次登录后，AuditLog 记录的源 IP 须为**浏览器出口 IP** 而非 BFF IP；并发两浏览器不同 IP 时 per-IP 限流应各自独立计数（验证未塌缩为共享桶）。
