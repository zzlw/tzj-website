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

优先走产品内通道：任一超管在后台用户列表行操作执行「强制解除 2FA」（`POST /auth/2fa/force-disable`，操作即审计）。

超管全体失联时 SSH 执行 break-glass 脚本（含清 2FA + 重置密码 + 撤会话 + 审计，取代旧版手写 SQL，避免字段口径漂移）：

```bash
pnpm --filter @tzj/api exec tsx scripts/reset-admin-credentials.ts \
  --username <用户名> --clear-2fa
```

若只需解除 2FA 不想动密码，仍应优先走产品内通道；脚本定位是最后手段（重置密码必然发生）。

## 3. 强制 2FA 开关锁死（所有 admin 未绑定却被强制拦截）

```sql
-- 关闭「强制全员启用两步验证」开关
UPDATE settings SET value = '{"twoFactorRequired":false}' WHERE key = 'security.auth';
```

开关读取有 30s 内存缓存，改库后最迟 30s 生效；等不及可重启 `apps/api` 立即生效。

## 4. 超管忘记密码 / 密码 + 2FA 双丢（break-glass）

适用场景：唯一（或全体）启用状态超管被锁在门外，产品内互助通道（用户列表「重置密码」/「强制解除 2FA」）无人可执行。设计见 [account-recovery-design.md §4.4](./account-recovery-design.md)。

```bash
# 仅重置密码（随机 16 位强密码，stdout 只打印一次）
pnpm --filter @tzj/api exec tsx scripts/reset-admin-credentials.ts --username <用户名>

# 密码 + 2FA 双丢：追加清空 2FA 绑定与恢复码
pnpm --filter @tzj/api exec tsx scripts/reset-admin-credentials.ts --username <用户名> --clear-2fa
```

脚本行为（单事务）：重置密码（bcrypt cost 12，与线上口径一致）+ 清登录锁定 + 撤销全部会话 + 写审计（`break_glass_credential_reset`）；目标账号处于停用状态时仅警告不自动激活。可选 `--password <指定新密码>`，但明文会留在 shell history，优先用随机生成。

事后动作：提醒用户登录后立即自行改密；若清了 2FA 且全局强制开关开启，下次登录会被引导重新绑定。
