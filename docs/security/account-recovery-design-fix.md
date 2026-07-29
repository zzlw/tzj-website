# 账号恢复：忘记密码与 2FA 令牌丢失 — 技术方案

> 状态：待评审（本文档只做方案设计，不含代码变更）
> 修订：v2 —— 评审补缺：① `reset-password` 缺 admin 角色约束，持 `users.manage` 的非 admin 可重置超管密码完成提权（G5/§4.3）；② 密码重置不清登录锁定字段（G6/§4.3/§4.4）
> 修订：v3 —— 三轮评审集成链路核实：① G6 降级为中（列表已有「解锁」行操作可作 workaround，但隐蔽易漏）；② BFF 为无白名单透明代理，S2 零 BFF 改动；③ 行操作形态修正为 icon 按钮排（非菜单）
> 修订：v4 —— ① 修正「旧会话立即失效」不实表述：access token 无状态（jwt.strategy 不查 session 表），撤会话仅切断刷新链路，旧 access token 最长 15 分钟内自然过期；② 补齐两端点 DTO 契约（`ResetUserPasswordDto` / `TwoFactorForceDisableDto`）
> 修订：v4.1 —— 一致性终审：§5 S1 内容补齐 G5/G6（此前滞留 v1 口径）、「菜单项」用词统一为按钮、UAT 编号重排、改动量修正为约 320 行
> 修订：v5 —— 评审补缺（G5 威胁模型闭环）：同权限（持 `users.manage` 的非 admin）提权路径不止 reset-password——create 可直建 ADMIN 账号、update 可将任意用户（含自己）role 升为 admin / 对 ADMIN 目标写 `lockedUntil`/`isActive`、remove 可删非最后一名 ADMIN；§4.3 第 3 条升级为 service 层统一敏感操作校验（四端点同口径）；§6 补用例与 update 测试陷阱说明；改动量修正为约 360 行
> 修订：v5.1 —— 复评修正：① 「禁自改 role」对 admin 也生效，修正「admin 行为不变」的不实表述（唯一存量收紧，有意为之）；② §7 补相邻提权面边界声明（`access.manage` 可间接绕回 G5，属 RBAC 治理专项）
> 修订：v5.2 —— 相邻提权面已修复核实（roles.service 四项声称全部对上代码 + 42 测试全绿）；同时修正 G4 事实：全局 `AuditInterceptor` 对 reset-password 已有泛化审计（action=create/resource=users），但与「新建用户」不可区分——G4 收窄为「缺专属语义审计」，§4.3 第 2 条同步说明与拦截器的共存关系
> 第一约束：小而美团队、后台用户 ≤ 100 人，防止过度设计、保持简洁实用
> 关联文档：`2fa-totp-design.md`、`2fa-enforcement-toggle-design.md`、`2fa-emergency-runbook.md`

---

## 1. 问题场景

| # | 场景 | 当前结局 |
|---|------|----------|
| P1 | 普通用户忘记密码 | 无自助通道；管理员**可以**通过编辑表单改密，但入口隐蔽、语义不对（「编辑用户」≠「重置密码」） |
| P2 | 用户丢失 2FA 设备，恢复码还在 | ✅ 已覆盖：登录第二步支持恢复码（一次一密，10 个） |
| P3 | 用户丢失 2FA 设备 + 恢复码也丢了 | 后端有 `POST /auth/2fa/force-disable`（超管强制解除），**但 Admin UI 无任何入口**，只能 curl 或 SSH 改库 |
| P4 | 唯一/最后一名超管忘记密码（或双丢） | **完全锁死**：`reset-password` 禁止自重置、无人可互救；runbook 只覆盖 2FA 改库，密码的 bcrypt hash 无法手写 SQL 生成 |

## 2. 现状盘点（代码事实）

**已具备的能力（无需重复建设）**

- `POST /users/:id/reset-password`（`users.service.ts`，DTO `ResetUserPasswordDto { password, actorPassword? }`）：管理员重置他人密码；目标是 ADMIN 时要求操作者输入自己的当前密码（`actorPassword`）复核；重置后撤销目标全部会话。禁止自重置。
  ⚠️ 会话撤销的真实语义：`jwt.strategy` 不查 session 表，access token 无状态（TTL 15m）——撤销仅切断 refresh 刷新链路，旧 access token **最长 15 分钟内仍有效**后自然过期。这是无状态 JWT 的既有标准权衡，本方案不加 per-request session 校验（过度设计），但所有文案/断言按此口径表述。
- `PATCH /users/:id` 的 `password` 字段：编辑表单改密（也会撤销会话），与上一条**语义重复**，且目标为 ADMIN 时**不要求** `actorPassword`——存在绕过复核的口子。
- `POST /auth/2fa/force-disable`（`two-factor.controller.ts` `@Roles('admin')`，DTO `TwoFactorForceDisableDto { targetUserId, password }`）：超管凭自己密码强制解除任意用户 2FA，操作即审计（`2fa_force_disabled`）。
- 恢复码体系完整：生成/校验/一次一密/剩余预警/重新生成（`two-factor.service.ts`）。
- 应急兜底：`TWOFA_CHALLENGE_DISABLED` kill-switch + SSH 改库 runbook（仅覆盖 2FA 字段）。
- 用户列表已有「解锁」行操作（`PATCH /users/:id` 传 `lockedUntil: null`）；触发锁定时后端已将 `failedLoginAttempts` 归零，解锁语义自洽。
- Admin BFF（`/api/bff/[...path]`）为无白名单透明代理（含 401 自动刷新与 IP/UA 透传），`reset-password` / `force-disable` 前端直接可达，**无需新增 BFF 路由**。
- 邮件基建：`AliyunDmService`（notification 模块）可发邮件——但见 §3 非目标。

**缺口**

| # | 缺口 | 严重度 |
|---|------|--------|
| G1 | 重置密码 / 强制解除 2FA 在 Admin UI 均无入口（用户列表行操作没有这两项） | 高（P1/P3 的日常通道） |
| G2 | 唯一超管锁死无兜底：runbook 无「忘密码」章节，SQL 无法生成 bcrypt hash | 高（P4） |
| G3 | 两条改密路径并存，编辑表单路径绕过 ADMIN 目标的 `actorPassword` 复核 | 中 |
| G4 | 密码重置缺**专属语义审计**（v5.2 修正事实：全局 `AuditInterceptor` 已对 `POST /users/:id/reset-password` 自动落泛化审计，但记录为 `action=create/resource=users`，与「新建用户」不可区分，且 detail 因敏感字段过滤为空；对比 2FA 有专属 action `2fa_force_disabled`） | 中 |
| G5 | **`reset-password` 无 admin 角色约束，且同一威胁模型在 create/update/remove 同样成立（v5 补缺）**：controller 仅 `@RequirePermissions('users.manage')`，`actorPassword` 是操作者自己的密码（防会话劫持，不防越权）——持 `users.manage` 的非 admin 角色可：① 重置超管密码后登录其账号；② `POST /users` 直接创建 ADMIN 账号（create 仅校验 role slug 存在）；③ `PATCH /users/:id` 把任意用户（含自己）role 升为 admin（仅降级方向查 last-admin），或对 ADMIN 目标写 `lockedUntil`/`isActive: false`；④ `DELETE` 删除非最后一名 ADMIN。四条路径须一次堵全，只堵 reset-password 形同虚设；本方案把入口做进 UI 会放大该口子，必须先堵 | 高 |
| G6 | **重置密码不清登录锁定**：`auth.service.ts` 登录先查 `lockedUntil`，但 `resetPassword` 不重置 `lockedUntil`——「忘密码→试错触发锁定→管理员重置」后用户仍被拦。既有 workaround：列表「解锁」按钮可手动清除，但重置流程不会提示还需这一步，隐蔽易漏 | 中 |

## 3. 目标与非目标

**目标**

- G-A 每个问题场景都有**明确、可执行、最短路径**的恢复通道（产品内优先，SSH 兜底）。
- G-B 复用全部既有后端能力，新增代码集中在「UI 入口 + 一个 CLI 脚本 + 审计补齐」。
- G-C 所有恢复操作留审计痕迹。

**非目标（防过度设计的明确决策）**

| 不做 | 理由 |
|------|------|
| 邮件自助找回密码（reset link） | 内部后台、账号由管理员开设、≤100 人且彼此认识——「找管理员」比「查邮件」更快；自助找回需要 token 表、防枚举、限流、邮件模板、链接过期处理一整套，是本方案里性价比最低的路径。团队规模增长到管理员互助成为负担时再立项 |
| `mustChangePassword` 首登强制改密 | 需要加字段 + 登录流程分支 + 前端拦截页；小团队信任模型下，用「重置后请立即自行修改密码」的提示语 + 规约替代 |
| WebAuthn / SMS 等第二通道 | 规模不匹配 |
| 双人复核（four-eyes）流程 | `actorPassword` 复核 + 审计已是该规模的合理强度，与既有 force-disable 的设计决策一致 |

## 4. 方案设计

### 4.1 恢复路径分层总览

```
忘密码/丢2FA
  ├─ L0 自助：丢 2FA 设备 → 登录第二步输恢复码 → 事后在设置中重新绑定（现状已有，零改动）
  ├─ L1 管理员互助（产品内，日常主通道）：
  │     ├─ 重置密码   → 用户列表行操作「重置密码」→ POST /users/:id/reset-password
  │     └─ 解除 2FA   → 用户列表行操作「强制解除 2FA」→ POST /auth/2fa/force-disable
  └─ L2 break-glass（SSH，唯一超管锁死）：
        └─ CLI 脚本重置密码 + 可选清 2FA + 撤销会话 + 审计 → runbook 收口
```

### 4.2 Admin UI：用户列表补两个行操作（G1）

位置：`apps/admin/src/components/users/` 下新增两个对话框组件，挂在用户列表操作列的 **icon 按钮排**（对齐既有「解锁/编辑/删除」形态，非下拉菜单；建议 `KeyRound` / `ShieldOff` 图标 + title 提示），页面守卫 `users.manage` 已覆盖；接口调用走既有 BFF 透明代理，无需新增路由。

**「重置密码」对话框（`ResetPasswordDialog`）**

- 表单：新密码输入框 + 「生成随机密码」按钮（前端 `crypto.getRandomValues` 生成 16 位，字符集固定含小写+大写+数字以稳过 `IsStrongPassword`——其阈值为 8–128 位且 ≥2 类字符（小写/大写/数字，特殊符号不强制）+ 弱口令黑名单；明文只展示这一次，附「复制」按钮，由管理员线下转交）。
- 目标用户是 ADMIN 时追加「您的当前密码」字段（对应 DTO `actorPassword`，与后端既有校验对齐）；且**仅当前用户角色为 admin 时对 ADMIN 目标行渲染该按钮**（与 §4.3 第 3 条的后端硬校验对齐，前端只是遮蔽）。
- 成功后提示：「密码已重置；其登录态将在 15 分钟内全部失效（刷新链路已切断）；请提醒用户登录后立即修改密码」。
- 对自己隐藏该按钮（后端本就禁止自重置）。

**「强制解除 2FA」对话框（`ForceDisable2faDialog`）**

- 仅对 `twoFactorEnabled === true` 的行显示（列表数据已含该字段）；仅当前用户角色为 admin 时渲染（后端 `@Roles('admin')` 硬约束）。
- 表单：操作者自己的密码 + 红色警示文案（「解除后该用户可仅凭密码登录，请先线下核实身份」；若全局强制 2FA 开启，补充说明其下次登录会被引导重新绑定）。
- 成功后行内 2FA 状态即时刷新。

**身份核实规约（写入对话框文案，不做系统流程）**：执行前须通过当面/视频/内部 IM 等第二渠道确认申请人身份，禁止仅凭邮件/聊天文字请求操作。

### 4.3 后端加固（G3 / G4 / G5 / G6，小改动）

1. **收敛改密入口**：`UpdateUserDto` 移除 `password` 字段，**并同步删除 `users.service.ts` update 中的 password 分支**（注意：全局 ValidationPipe 当前 `whitelist: false`，只删 DTO 字段拦不住多余 payload，service 不再读取才是真正的防线）；`UserEditor` 编辑态移除密码输入框（新建态保留；编辑态 `lockedUntil` 锁定/解锁字段保留不受影响）；改密统一走 `reset-password` 单一入口。消除 ADMIN 目标绕过 `actorPassword` 的口子，语义也更清晰。
2. **补专属审计**：`resetPassword` 成功后写 `auditLog`（`action: 'user_password_reset'`, `resource: 'users'`, `resourceId: 目标ID`），口径对齐 `TwoFactorService.audit`。与全局 `AuditInterceptor` 的泛化条目（`action=create`）共存属预期行为：专属条目提供语义可检索性，泛化条目提供 IP/UA/traceId 全量上下文，不做去重（与 2FA force-disable 现状一致，其本就双条）。
3. **堵提权口子（G5，v5 升级为统一校验）**：service 层新增私有方法 `assertAdminActor(actorId)`（查库校验 actor 记录 `role === 'admin'`，不依赖装饰器），在四处敏感路径同口径调用，否则 403：
   - `resetPassword`：目标为 ADMIN 时；`actorPassword` 复核保留（两者职责不同：一防越权、一防会话劫持）；
   - `create`：`dto.role === 'admin'` 时（controller 需将 `@CurrentUser` 透传给 service，现签名缺 actor 参数）；
   - `update`：目标为 ADMIN，或 `dto.role` 变更为 `admin` 时；另**禁止修改自己的 role**（`id === actorId` 且 role 变更 → 400，同时堵住经自定义高权角色的横向提权）；
   - `remove`：目标为 ADMIN 时（last-admin 校验保留）。

   `force-disable` 已有 `@Roles('admin')`，不受影响。admin 操作者行为基本不变，**唯一存量收紧是「自改 role」对 admin 也禁止**（现状仅 last-admin 校验；收紧后 admin 自降级需由另一名 admin 操作，防误操作自锁，与既有「不能停用/删除自己」同一设计哲学）。
4. **重置即解锁（G6）**：`resetPassword` 落库时同步 `failedLoginAttempts: 0, lockedUntil: null`——重置密码语义上必然包含「让用户能用新密码登录」，免去「重置后还要手动点解锁」的隐蔽第二步（既有解锁按钮保留，覆盖「不改密码只解锁」场景）。
5. 不改 `force-disable`（已审计、已复核，保持现状）。

### 4.4 break-glass CLI 脚本（G2，P4 的唯一解）

新增 `apps/api/scripts/reset-admin-credentials.ts`（tsx 运行，环境变量加载方式对齐既有清理脚本）：

```
pnpm --filter @tzj/api exec tsx scripts/reset-admin-credentials.ts \
  --username <用户名> [--clear-2fa] [--password <指定新密码>]
```

行为（单事务）：

1. 按 username 定位用户，不存在则报错退出。
2. 生成 16 位随机强密码（未指定 `--password` 时），**stdout 打印一次**；bcrypt cost 12 落库（与线上口径一致）。优先使用随机生成——`--password` 明文会留在 shell history，仅限特殊场景。
3. `--clear-2fa` 时：按 `TwoFactorService.clearTwoFactor` 同口径清空 6 个 2FA 字段 + 删除全部恢复码。
4. 同步清 `failedLoginAttempts: 0, lockedUntil: null`（G6 同口径）；若目标 `isActive === false` 则打印警告并继续（不自动激活——启用与否是管理决策，脚本不越界）。
5. 撤销该用户全部会话（`session.revokedAt`）。
6. 写 `auditLog`（`action: 'break_glass_credential_reset'`，`userId: null`，detail 记录目标与是否清 2FA）——SSH 场景无操作者身份，userId 置空但必须留痕（已核实 schema：`AuditLog.userId` 为可空字段 `String?`，无需改表）。

同步更新 `2fa-emergency-runbook.md`：新增「§4 超管忘记密码 / 双丢」章节指向该脚本，并把 §2 中「超管全体失联」的手写 SQL 替换为脚本调用（脚本能生成 bcrypt hash，SQL 做不到；2FA 清理两者等价，收敛到脚本减少口径漂移）。

### 4.5 治理规约（零代码）

- **保持 ≥2 名启用状态的超管**互为备份（系统硬约束是 ≥1，`assertNotLastAdmin`；第 2 名靠规约）。这是把 P4 从「概率事件」降为「极小概率事件」的最便宜手段。
- 可选增强（本期不做，列此备查）：用户管理页在检测到仅 1 名启用超管时显示提醒条。

## 5. 实施拆分

| 阶段 | 内容 | 涉及文件 |
|------|------|----------|
| S1 后端 | §4.3 全部：收敛双改密入口（G3）+ 补审计（G4）+ **统一敏感操作校验 `assertAdminActor` ×4（G5，优先合入）** + 重置即解锁（G6） | `users.service.ts`、`users.controller.ts`（create 透传 actor）、`users/dto/user.dto.ts` |
| S2 前端 | 两个行操作对话框 + UserEditor 编辑态去密码框 | `components/users/ResetPasswordDialog.tsx`（新增）、`ForceDisable2faDialog.tsx`（新增）、`UserEditor.tsx`、users 列表页 |
| S3 脚本 | break-glass CLI + runbook 更新 | `apps/api/scripts/reset-admin-credentials.ts`（新增）、`docs/security/2fa-emergency-runbook.md` |
| S4 验证 | 见 §6 | — |

S1/S2/S3 相互独立，可任意并行；总量约 360 行。G5 修复建议随 S1 优先合入（线上既存口子，与 UI 是否上线无关）。

## 6. 测试计划

**后端（Jest）**

- `resetPassword`：成功路径写入 `user_password_reset` 审计；目标 ADMIN 无 `actorPassword` 时 400（既有行为回归）；**非 admin 操作者（持 users.manage）对 ADMIN 目标重置 → 403（G5）**；重置后 `failedLoginAttempts === 0 && lockedUntil === null`（G6）。
- **G5 统一校验（v5）**：非 admin 操作者（持 users.manage）——`create` role=admin → 403；`update` 将他人 role 改为 admin → 403；`update` 对 ADMIN 目标写 `lockedUntil`/`isActive` → 403；`remove` ADMIN 目标 → 403；任意操作者（含 admin）修改自己的 role → 400。admin 操作者其余场景全部放行（回归，确认除自改 role 外无存量行为变更）。
- `update`：payload 携带 `password` 字段时密码不变、会话不被撤销（防线在 service 不再读取该字段，**不依赖 whitelist**——全局 ValidationPipe 当前为 `whitelist: false`）。**测试陷阱（v5）**：payload 须仅含 `password`，不得夹带 role/isActive 变更——`roleOrActiveChanged` 路径本就会撤会话，混入会使「不撤会话」断言假阳性。

**手动 UAT**

1. 超管 A 重置普通用户 B 密码 → B 的刷新链路即时切断（旧 access token ≤15 分钟内自然过期），新密码可登录；审计日志出现记录。
2. 超管 A 重置超管 C 密码 → 必须输入 A 自己的密码；输错拒绝。
3. B（普通用户）连续输错密码触发锁定 → A 重置密码 → B 立即用新密码登录成功（不再提示锁定）。
4. B 启用 2FA 后丢设备：先用恢复码登录（L0）；恢复码用尽后由 A 在 UI 强制解除（L1）→ B 仅凭密码可登录，若全局强制 2FA 开启则被引导重新绑定。
5. 脚本演练（本地）：`--clear-2fa` 重置唯一超管 → 打印新密码可登录、2FA 已清、刷新链路已切断、审计留痕。
6. 编辑用户表单不再出现密码字段；新建用户仍可设初始密码。

**卡口**：`pnpm check` + 四包 typecheck + api 单测。

## 7. 风险与对策

| 风险 | 对策 |
|------|------|
| 管理员知晓临时密码 | 重置即撤销全部会话（刷新链路即时切断，旧 access token ≤15m 自然过期）+ 提示语要求用户立即自行改密；小团队信任模型下不上 `mustChangePassword`（见 §3） |
| 社工冒充申请重置 | 对话框内置身份核实规约文案；ADMIN 目标/admin 角色赋值需操作者 admin 角色（G5 统一硬校验）+ `actorPassword` 复核；全程审计可追溯 |
| break-glass 脚本被滥用 | 前提是已拿到服务器 SSH 权限（等价于拿到一切）；脚本相比手写 SQL 反而**增加**了审计留痕 |
| 移除编辑表单密码字段影响存量习惯 | 行操作「重置密码」入口更显眼，一次性沟通即可；service 不再读取 password 字段，旧前端残留请求无副作用 |
| 相邻提权面：`access.manage` 可编辑自定义角色权限集，持该权限的非 admin 可给自身角色加 `users.manage` 间接绕回 G5 | **已修复**：`roles.service.ts` 的 create/update/remove 均在 service 层查库硬校验操作者 `role === 'admin'`（含 isActive），否则 403；单测覆盖非 admin 拦截 + admin 回归（roles.service.spec.ts）；前端 access 页对非 admin 遮蔽写操作按钮（仅遮蔽，后端是防线）；写操作成功后由全局 AuditInterceptor 自动审计（access 属 DETAIL_RESOURCES） |
