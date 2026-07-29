# 技术方案：登录支持邮箱/手机号 + 验证器 App 绑定教程

> 状态：v3 已按二轮评审意见修订（未实施）
> v3 修订：username 白名单同样下沉 service（DTO `@Matches` 会误伤回填未变的存量违规用户名，seed 超管即邮箱形态）；去重 SQL 加 `(updatedAt, id)` 并列兜底；写入路径补 `prisma/seed.ts`；标注 schema 变更需 A1 审批
> v2 修订：迁移改 `--create-only` 两步走并修正 SQL 顺序（清洗 → 去重 → 建索引）；新增 username 白名单防锁户 DoS；phone 格式校验下沉 service（存量非标值放行）
> 范围：`apps/api`（auth / users 模块）、`apps/admin`（登录页 / 设置页 / 强制绑定页）
> 关联规范：AGENTS.md（A1/A2 职责边界、Constitutional Rules）、CONVENTIONS.md

---

## 一、需求

1. **多标识登录**：管理后台登录同时支持「用户名 / 邮箱 / 手机号」三种标识 + 密码。
2. **验证器 App 教程**：所有提示绑定/使用「验证器 App（如 Microsoft Authenticator）」的位置，都提供可展开的图文教程（安装、扫码、常见问题）。

---

## 二、现状盘点

### 2.1 登录链路

```
apps/admin/src/app/login/page.tsx        （表单：username + password）
  → POST {BASE_PATH}/api/auth/login       （BFF：apps/admin/src/app/api/auth/login/route.ts，透传）
    → POST {API_BASE}/auth/login          （NestJS：AuthController.login → AuthService.login）
       prisma.user.findUnique({ where: { username } })   ← 仅支持用户名
```

- `LoginDto`（`apps/api/src/auth/dto/auth.dto.ts`）：`username`（2~64 字符）+ `password`。
- 登录失败统一文案「用户名或密码错误」（防枚举），失败计数 → 锁定（`LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_DURATION_MIN`）。
- 2FA 已启用时返回 `requires2fa + pendingToken` 预鉴权态，前端进入第二步验证码环节。

### 2.2 User 模型（`apps/api/prisma/schema.prisma`）

| 字段 | 约束 | 现状问题 |
|------|------|---------|
| `username` | `@unique` | — |
| `email` | `String? @unique` | 已唯一，但**写入路径未统一小写归一化**（登录按 email 精确匹配会因大小写 miss） |
| `phone` | `String?` | **无唯一约束**，且创建/更新用户、`PATCH /auth/me` 均不查重、不做格式归一化 |

### 2.3 「验证器 App」提示位置（共 4 处界面）

| # | 位置 | 现状 |
|---|------|------|
| 1 | `apps/admin/src/app/login/page.tsx` 2FA 第二步 | 文案「请输入验证器 App 中的 6 位动态码」，无任何指引 |
| 2 | `apps/admin/src/components/settings/TwoFactorCard.tsx` 未启用态描述 | 「使用验证器 App（如 Microsoft Authenticator）生成动态码…」，无教程 |
| 3 | `apps/admin/src/components/settings/TwoFactorEnrollWizard.tsx` 扫码步骤 | 仅「1. 用验证器 App 扫描二维码」，未说明去哪下载、怎么添加账户 |
| 4 | `apps/admin/src/app/enroll-2fa/page.tsx` 强制绑定页 | 复用向导（同 #3），首次被强制绑定的用户最需要教程 |

---

## 三、需求 1 设计：多标识登录

### 3.1 总体原则

- **单输入框自适应**：登录表单保持一个「账号」输入框，用户输入用户名 / 邮箱 / 手机号均可，后端自动识别，不增加「切换登录方式」的 Tab（管理后台用户量小，交互从简）。
- **接口向后兼容**：HTTP 字段名维持 `username` 不变（BFF、测试、现有脚本零改动），仅放宽语义为「登录标识」。
- **防枚举口径不变**：无论哪种标识 miss，统一返回「账号或密码错误」。

### 3.2 标识识别与查找策略（确定性优先级）

在 `AuthService` 新增私有方法 `findUserByIdentifier(identifier: string)`，按以下顺序**串行精确查找**，命中即返回（避免 `OR` 查询在「A 的用户名 = B 的手机号」时产生歧义）：

```
1. username 精确匹配（findUnique）              ← 完全保留现有行为，优先级最高
2. 若包含 '@'：email 匹配（归一化为小写后 findUnique）
3. 若为手机号形态（/^1\d{10}$/，归一化后）：phone 匹配（findUnique）
```

- 归一化工具集中在新文件 `apps/api/src/common/utils/identifier.ts`：
  - `normalizeEmail(v)`：`trim().toLowerCase()`；
  - `normalizePhone(v)`：去空格/连字符，剥离 `+86` / `86` 前缀，输出 11 位大陆手机号；不符合形态返回 `null`（当前业务仅大陆手机号，国际号码不在本期范围，文档化即可）。
- 后续锁定、失败计数、2FA 挑战、审计逻辑**全部不变**（均基于查到的 `user` 实体）。
- 审计增强：`login_failed` / `login` 的 audit 保持现状即可；如需记录登录标识类型，可在后续迭代往 `AuditLog` 扩展，不在本期。

#### 3.2.1 标识碰撞与锁户 DoS 防护

现状 `username` 仅有长度校验（2~64 字符），可含 `@`、可为纯 11 位数字。多标识登录后，若「A 的 username = B 的邮箱/手机号」，B 输错密码时失败计数会记到 A 头上——攻击者知道任意用户的邮箱/手机号即可定向触发他人锁户。处置：

- **新建/改名收紧（校验下沉 service，DTO 不加 `@Matches`）**：白名单 `/^(?!1\d{10}$)[A-Za-z0-9_.-]+$/`——排除 `@`（杜绝与 email 碰撞）与纯 11 位手机号形态（杜绝与 phone 碰撞）。**不能放 DTO 层**：`UpdateUserDto` 继承 `CreateUserDto`，而 `UserEditor` 编辑表单会回填并原样提交 username，DTO 校验无法区分「改名」与「回填未变」——存量违规用户名会导致编辑任何字段（改昵称、解锁）直接 400。与 phone 同策略（3.4）：`UsersService.create`、及 `update` 时「username 值相对现库发生变化」才校验白名单，失败抛 `BadRequestException('用户名仅限字母、数字、_ . -，且不能为 11 位手机号形态')`，**值未变化原样放行**；
- **存量豁免**：既有用户名不强制改名（登录优先级 username 第一，行为与现在完全一致）。注意 **seed 默认超管的 username 本身就是邮箱形态**（`prisma/seed.ts` 默认取 `SEED_ADMIN_USERNAME`，缺省值含 `@`）——存量豁免不是理论边界而是必然命中项，上述「值未变化放行」是超管账号可继续编辑的前提；上线前用只读 SQL 预检存量 username 与全表 email/phone 的碰撞量，有碰撞则人工改名；
- 不采用「按标识类型分开计数」方案——复杂度不成比例，白名单已从源头杜绝新增碰撞。

### 3.3 数据层变更（Prisma）

```prisma
model User {
  ...
  phone String? @unique   // 新增唯一约束
}
```

**迁移必须用 `--create-only` 两步走**（直接 `migrate dev --name` 会生成纯 DDL 并立即应用，自定义清洗/去重 SQL 无处注入；生产库有重复数据时 `migrate deploy` 直接失败）：

```bash
pnpm --filter @tzj/api exec prisma migrate dev --create-only --name user-identifier-login
# 手工编辑生成的 migration.sql：在 Prisma 生成的唯一索引 DDL 之前插入下方清洗/去重 SQL
pnpm --filter @tzj/api exec prisma migrate dev   # 应用（开发库允许破坏性操作）
```

迁移 SQL **顺序必须是「清洗 → 去重 → 建索引」**——先去重后清洗会因归一化制造新重复（如 `+8613800138000` 与 `13800138000` 清洗后相同），照样撞唯一索引：

```sql
-- ① email：先按 lower(email) 去重再统一小写。
--    注意顺序不可反：现有 unique(email) 是大小写敏感的，直接 lower() 清洗会自撞唯一约束。
--    去重比较必须用 (updatedAt, id) 复合序：批量导入/seed 同刻写入时 updatedAt 并列，
--    仅比较 updatedAt 会两行都保留，建唯一索引照样失败
UPDATE "User" u SET email = NULL
WHERE email IS NOT NULL AND EXISTS (
  SELECT 1 FROM "User" x
  WHERE lower(x.email) = lower(u.email) AND x.id <> u.id
    AND (x."updatedAt", x.id) > (u."updatedAt", u.id)
);
UPDATE "User" SET email = lower(email) WHERE email IS NOT NULL AND email <> lower(email);

-- ② phone：清洗（去空格/连字符、剥 +86 前缀）；非 ^1\d{10}$ 形态的存量值（座机/国际号）原样保留
UPDATE "User" SET phone = regexp_replace(phone, '[\s-]', '', 'g') WHERE phone IS NOT NULL;
UPDATE "User" SET phone = regexp_replace(phone, '^\+?86(?=1\d{10}$)', '') WHERE phone IS NOT NULL;

-- ③ phone：按清洗后的值去重（同值保留 updatedAt 最新的一条，其余置 NULL；
--    同样用 (updatedAt, id) 复合序兜底并列）
UPDATE "User" u SET phone = NULL
WHERE phone IS NOT NULL AND EXISTS (
  SELECT 1 FROM "User" x
  WHERE x.phone = u.phone AND x.id <> u.id
    AND (x."updatedAt", x.id) > (u."updatedAt", u.id)
);

-- ④ Prisma 生成的唯一索引 DDL 保持在最后
-- CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
```

- Postgres 对 nullable 唯一列天然允许多行 `NULL`，存量无手机号用户不受影响；
- 非标形态的存量 phone（座机/国际号）**保留原值不置空**：`normalizePhone` 无法归一化它们 → 不参与登录匹配，但仍可正常展示/编辑（配合 3.4 的校验下沉策略）；
- 生产部署（schema 存在滞后，走正规 `migrate deploy`）：上线前用只读 SQL 预检三类冲突量——email 大小写重复、phone 清洗后重复、username 与 email/phone 碰撞（见 3.2.1）。

### 3.4 写入路径统一治理（保证登录可命中）

所有 email/phone 写入口统一走归一化 + 查重，否则唯一约束会以 500（P2002）而非业务错误暴露：

| 入口 | 改动 |
|------|------|
| `UsersService.create` / `update` | email 已有 `assertEmailAvailable`，补充：① 写入前 `normalizeEmail` / `normalizePhone`；② 新增 `assertPhoneAvailable(phone, excludeId?)`，冲突抛 `ConflictException('手机号已被使用')` |
| `AuthService.updateProfile`（`PATCH /auth/me`） | 同上：email 归一化（现有查重保留），phone 归一化 + 查重（**当前完全没有 phone 查重，是必须补的洞**）。注意保持现有 truthy 判断语义（空串/undefined 均视为「不更新」），归一化改造不得顺手改变清空行为 |
| phone 格式校验 | **不加 DTO 层 `@Matches`**——`UpdateUserDto` 继承 `CreateUserDto`，DTO 层收紧会让存量非标手机号（座机/国际号）在编辑表单回填原值提交时直接 400。校验下沉 service：create、或 update 时「phone 值相对现库发生变化」才要求 `normalizePhone` 成功，失败抛 `BadRequestException('手机号格式不正确')`；**值未变化原样放行**。`PATCH /auth/me` 同策略 |
| username 白名单 | 校验下沉 service（见 3.2.1，与 phone 同策略）：create、或 update 时「username 值相对现库发生变化」才校验；`user.dto.ts` **不加** `@Matches`（编辑表单回填存量违规用户名会被 DTO 层误伤） |
| `prisma/seed.ts` | email 写入前 `normalizeEmail`（现状直接取 `SEED_ADMIN_USERNAME` 原值，含大写时会绕过归一化治理） |
| 存量数据 | 见 3.3 迁移 SQL（清洗 → 去重 → 建索引，email 与 phone 均覆盖） |

### 3.5 DTO 与接口文档

`LoginDto.username`：

- 校验放宽为 `@MinLength(2)` / `@MaxLength(128)`（与系统 email 上限 128 对齐），错误文案与 Swagger 描述改为「登录账号（用户名 / 邮箱 / 手机号）」。
- 失败文案统一改为「**账号或密码错误**」（`AuthService.login` 中的 `UnauthorizedException`）。

### 3.6 前端（apps/admin）

- `login/page.tsx`：
  - Label「用户名」→「账号」，placeholder「用户名 / 邮箱 / 手机号」；
  - `autoComplete="username"` 保留（浏览器凭据管理兼容三种形态）；
  - BFF `api/auth/login/route.ts` 仅改兜底文案「请输入用户名和密码」→「请输入账号和密码」，其余透传逻辑零改动。
- 设置页「个人资料」的手机号输入增加同款格式提示（提交时由 API 校验兜底）。

### 3.7 明确不做（本期边界）

- ❌ 手机验证码（OTP 短信）登录——无短信通道，且管理后台账号由管理员开设，密码 + TOTP 已满足安全要求；
- ❌ 邮箱/手机号验证（verify）流程——字段由管理员/本人在后台维护，视为可信；
- ❌ `apps/web`（C 端）——C 端无账号体系，不涉及。

---

## 四、需求 2 设计：验证器 App 教程

### 4.1 组件方案

新增共享客户端组件 `apps/admin/src/components/settings/AuthenticatorGuide.tsx`（纯静态内容，无 API 依赖——登录页处于未认证态，必须可独立渲染）：

```tsx
// 两种形态，复用同一份教程内容 <AuthenticatorGuideContent />
export function AuthenticatorGuideDialog({ trigger }: { trigger?: ReactNode })
  // Dialog 形态：默认 trigger 为「如何使用验证器 App？」文字链接（HelpCircle 图标 + 下划线样式）
export function AuthenticatorGuideCollapsible()
  // Collapsible 形态：内嵌在向导中，默认收起
```

组件全部取自 `@tzj/ui` 现有导出（`Dialog` / `Collapsible` / `Alert`），不新增 `packages/ui` 组件、不新增 npm 依赖（无需 A1 审批）。

### 4.2 教程内容（单一事实来源，写在 `AuthenticatorGuideContent` 内）

1. **什么是验证器 App**：基于 TOTP 标准，每 30 秒生成一个 6 位动态码，离线可用、不依赖短信。
2. **安装（任选其一，均免费）**：
   - Microsoft Authenticator —— iOS App Store / 各安卓应用商店搜索「Microsoft Authenticator」；
   - Google Authenticator；
   - 其他兼容 TOTP 的 App（1Password、Bitwarden、华为「花瓣密码」等）。
3. **添加账户三步**：打开 App → 「添加账户 / +」→ 选择「扫描二维码」对准页面二维码；无法扫码时选「手动输入」，粘贴页面展示的密钥（选择「基于时间」类型）。
4. **使用**：登录输完密码后，打开 App 找到「TZJ Admin」条目，输入当前显示的 6 位数字（30 秒刷新，输入超时换下一个码重试）。
5. **常见问题**：
   - 验证码总是错误 → 检查手机系统时间是否为「自动同步」（TOTP 依赖时间一致）；
   - 换手机 → 旧手机可用时先在新设备重新扫码（到「设置 → 安全」重新绑定）；旧手机不可用时用**恢复码**登录后重新绑定；
   - 手机丢失且无恢复码 → 联系超级管理员重置。

> 文案遵循 admin 现状（中文硬编码，与全站一致）；教程属静态帮助内容，不含任何密钥/敏感信息。

### 4.3 四处接入点

| # | 位置 | 接入形态 |
|---|------|---------|
| 1 | `login/page.tsx` 2FA 第二步 | CardDescription 下方加 `AuthenticatorGuideDialog`（文字链「找不到验证码？查看使用教程」）。Dialog 形态不占登录卡片空间 |
| 2 | `TwoFactorCard.tsx` 未启用态 | 描述文案后追加 `AuthenticatorGuideDialog`（「查看教程」链接） |
| 3 | `TwoFactorEnrollWizard.tsx` 第一步（输密码） | 表单上方放 `AuthenticatorGuideCollapsible`「第一次使用？先看教程准备好验证器 App」，让用户在生成 15 分钟有效期的二维码**之前**完成安装 |
| 4 | `TwoFactorEnrollWizard.tsx` 第二步（扫码） | 「1. 用验证器 App 扫描二维码」旁加 Dialog 链接「不知道怎么扫？」；#4 强制绑定页 `/enroll-2fa` 复用向导自动获得 |

约束：向导两种形态（compact / full）下 Collapsible 均需正常折叠，遵循既有 `WIZARD_STYLES` 差异集中定义模式；默认收起，避免视觉跳动（UI 布局稳定性规范）。

---

## 五、变更文件清单

### apps/api（A2 职责范围；schema 变更除外，见表内标注）

| 文件 | 变更 |
|------|------|
| `prisma/schema.prisma` | `phone` 加 `@unique`（按 AGENTS.md 所有权矩阵属「A2 提议, A1 审批」，**实施前需 A1 批准**） |
| `prisma/migrations/xxx_user_identifier_login/` | 清洗 → 去重 → 唯一索引（`--create-only` 手工编辑，见 3.3） |
| `prisma/seed.ts` | email 写入前小写归一化（3.4） |
| `src/common/utils/identifier.ts` | 新增 `normalizeEmail` / `normalizePhone` |
| `src/auth/auth.service.ts` | `login` 改用 `findUserByIdentifier`；`updateProfile` 补 phone 查重 + 归一化；错误文案 |
| `src/auth/dto/auth.dto.ts` | `username` 校验/文档放宽 |
| `src/users/users.service.ts` | `assertPhoneAvailable` + 归一化；phone / username 值变化时的格式校验与白名单校验（3.2.1、3.4）；`findAll` 搜索 OR 补 `phone` |

> `profile.dto.ts` / `user.dto.ts` 均无需改动（phone 格式校验与 username 白名单均下沉 service）。

### apps/admin（A2 职责范围）

| 文件 | 变更 |
|------|------|
| `src/components/settings/AuthenticatorGuide.tsx` | 新增教程组件（Dialog / Collapsible 双形态） |
| `src/app/login/page.tsx` | 账号输入框文案；2FA 步骤接教程 |
| `src/app/api/auth/login/route.ts` | 兜底文案 |
| `src/components/settings/TwoFactorCard.tsx` | 描述后接教程链接 |
| `src/components/settings/TwoFactorEnrollWizard.tsx` | 两步各接一处教程 |

不涉及：`packages/types`（`MeResult` 等无字段增删）、`turbo.json`、根配置、新 npm 依赖。

---

## 六、测试计划

### 单元测试（apps/api，Jest + ts-jest 既有套件）

- `auth.service.spec`：
  - 用户名 / 邮箱（含大写输入）/ 手机号（含 `+86`、空格形态）登录成功；
  - 三种标识均 miss → 统一「账号或密码错误」；
  - 优先级：构造「用户 A 的 username = 用户 B 的 phone」数据（仅存量可能出现，新建已被 3.2.1 白名单阻止），确认命中 A——作为存量碰撞回归用例；
  - 邮箱/手机号登录同样触发失败计数、锁定、2FA 挑战；
- `users.service.spec`：phone 重复创建/更新 → `ConflictException`；归一化后写入值断言；username 白名单（service 层：新建含 `@` / 纯 11 位数字 → 400；update 回填未变化的存量违规用户名——如 seed 超管邮箱形态——放行，改名为违规值 → 400）；update 时 phone 值未变化 → 放行存量非标值，值变化且非法 → `BadRequestException`。

### 手动 UAT（apps/admin）

1. 三种标识分别登录成功/失败提示一致；
2. 2FA 用户经邮箱登录 → 进入验证码步骤 → 教程 Dialog 可打开；
3. 设置页未启用 2FA：卡片描述教程链接、向导第一步 Collapsible、第二步扫码 Dialog；
4. `/enroll-2fa` 强制绑定页教程可用；
5. 个人资料保存重复手机号 → 业务报错而非 500。

### 回归

- `pnpm turbo lint typecheck test`（Biome + strict + 既有测试）；
- refresh / logout / 会话管理 / 2FA enable-disable-regenerate 全链路不受影响（登录后逻辑零改动）。

---

## 七、风险与回滚

| 风险 | 缓解 |
|------|------|
| 生产库存量重复 email/phone 导致迁移失败 | 迁移 SQL 按「清洗 → 去重 → 建索引」顺序内置处理（3.3），部署前只读 SQL 预检冲突量 |
| 去重 SQL 因 `updatedAt` 并列漏删（批量导入/seed 同刻写入） | 去重比较用 `(updatedAt, id)` 复合序兜底（3.3） |
| `lower(email)` 清洗自撞现有唯一约束 | 先按 `lower(email)` 去重、再统一小写（顺序不可反，见 3.3） |
| 标识碰撞锁户 DoS（A.username = B.email/phone，B 的失败计数打到 A） | 新建/改名白名单（service 层，禁 `@`、禁纯 11 位手机号形态）+ 上线前预检存量碰撞并人工改名（3.2.1） |
| 存量非标手机号（座机/国际号）被格式校验卡死编辑 | 校验下沉 service，值未变化原样放行；存量值保留不置空，仅不参与登录（3.4） |
| 存量违规用户名（seed 超管即邮箱形态）被白名单卡死编辑 | 白名单同样下沉 service、值未变化放行（3.2.1）；登录优先级 username 第一，登录行为与现在完全一致 |
| 教程内容后续更新 | 单一内容组件 `AuthenticatorGuideContent`，改一处全站生效 |

回滚：需求 1 后端改动集中在 `login` 入口一个私有方法，revert 即恢复；唯一索引回滚仅需 drop index（无数据破坏）。需求 2 为纯 UI 增量，可独立回滚。
