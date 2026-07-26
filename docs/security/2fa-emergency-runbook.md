# 2FA 应急处置 Runbook

> 适用：管理后台 TOTP 两步验证（[设计](./2fa-totp-design.md)）与强制 2FA 开关（[设计](./2fa-enforcement-toggle-design.md)）。
> 前提：SSH 可登录生产服务器，能连上 PostgreSQL（`psql $DATABASE_URL`）。

## 1. 全局 kill-switch（分钟级止血）

适用场景：`SECRETS_ENCRYPTION_KEY` 注入失败、服务器时钟严重漂移、加密库回归等**全局性 2FA 故障**。

```
TWOFA_CHALLENGE_DISABLED=true
```

写入 API 环境变量后重启 `apps/api`。效果：登录挑战、refresh gating、**强制绑定守卫**同时豁免（全员回退纯密码登录）。事故排除后务必移除并重启。

## 2. 单个用户失联（丢设备且恢复码用尽）

优先走产品内通道：任一超管在后台执行「强制解除 2FA」（`POST /auth/2fa/force-disable`，操作即审计）。

超管全体失联时 SSH 改库：

```sql
-- 关闭指定用户的 2FA（字段口径对齐 TwoFactorService.clearTwoFactor；重新绑定即可恢复）
UPDATE users SET
  "twoFactorEnabled" = false,
  "twoFactorSecretEnc" = NULL,
  "twoFactorPendingSecretEnc" = NULL,
  "twoFactorPendingCreatedAt" = NULL,
  "twoFactorConfirmedAt" = NULL,
  "twoFactorLastStep" = NULL
WHERE username = '<用户名>';

-- 作废其恢复码
DELETE FROM two_factor_recovery_codes
WHERE "userId" = (SELECT id FROM users WHERE username = '<用户名>');
```

## 3. 强制 2FA 开关锁死（所有 admin 未绑定却被强制拦截）

```sql
-- 关闭「强制全员启用两步验证」开关
UPDATE settings SET value = '{"twoFactorRequired":false}' WHERE key = 'security.auth';
```

开关读取有 30s 内存缓存，改库后最迟 30s 生效；等不及可重启 `apps/api` 立即生效。
