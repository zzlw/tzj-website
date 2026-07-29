# 后台预置业务角色设计方案

> **适用对象**: TZJ 管理后台 (apps/admin + apps/api) 的 RBAC 角色体系
> **编写时间**: 2026-07-29
> **版本**: v1.2（二轮代码核验修订：删除红线收敛为「不可恢复删除」以消除矩阵与单测矛盾、补 management 客户数据范围说明、`settings.manage` 控制面列全、staff `docs.create` 附带能力明示、播种标记 upsert）
> **前提约束**: 小而美团队、公司约 50 人、后台用户 ≤ 100 人，防止过度设计、保持简洁实用
> **上游文档**: `docs/b2b-permission-system-assessment-fix.md`（权限系统评估 v9.2，8.7/10 生产就绪）

---

## 一、背景与问题

当前系统权限底座已达企业级水准（39 个原子权限 / 9 个权限组 / fail-closed 守卫 / 权限变更即时吊销会话），但**开箱只有一个 `admin` 超级管理员角色**：

- `SYSTEM_ROLE_SLUGS` 仅含 `admin`（`apps/api/src/access/permissions.ts`），旧的 `editor` / `viewer` 已废弃并从库中清理；
- 新增员工账号时，管理员要么给 admin（权限过大），要么现场手工勾选 39 个权限拼一个自定义角色（易漏、易错、口径不一）；
- 50 人团队即将批量开通后台账号，需要一套**开箱即用、符合最小权限原则**的业务角色预设。

本方案只做一件事：**预置一组贴合公司岗位的业务角色**。不动权限模型、不动守卫链、不动前端。

## 二、业内最佳实践参考

| 实践 | 来源共识 | 本方案的落地 |
|------|---------|-------------|
| 最小权限原则 (PoLP) | NIST RBAC / OWASP | 每个角色只授予岗位必需权限；**不可恢复删除**（`media.purge` 及询盘/客户/会话/工单/文档的 `*.delete`）一律不进业务角色，收敛给 admin；可回收的回收站删除仅授予运营 |
| 控制角色数量，防「角色爆炸」 | Gartner / Okta：100 人以下组织建议 5–8 个角色 | admin + 6 个业务角色，共 7 个 |
| 按岗位（job function）而非按人建角色 | NIST RBAC Level 1 | 角色对应"内容、运营、销售、客服、管理层、普通员工"六类岗位，不为个人开角色 |
| 职责分离 (SoD) | SOC 2 / ISO 27001 | 账号管理、角色管理、安全策略、集成凭证仅 admin 可操作；业务角色无任何"系统管理"组权限 |
| 预设可改不可硬编码 | Auth0 / WorkOS 产品实践 | 预置角色 `isSystem=false`，管理员可在后台微调或删除，系统**只播种一次、永不覆盖** |
| 全员基线角色 | Google BeyondCorp "default access tier" | `staff` 普通员工角色仅开放内部知识库，作为全员默认值 |

## 三、角色设计（核心交付）

### 3.1 角色总览

| # | slug | 名称 | 对应岗位 | 预计人数 | 一句话职责 |
|---|------|------|---------|---------|-----------|
| 0 | `admin` | 超级管理员 | IT / 创始团队 | 2–3 | 全部权限（现状，不变） |
| 1 | `content-editor` | 内容编辑 | 市场部内容岗 | 3–5 | 官网内容创作与发布，媒体上传 |
| 2 | `marketing-ops` | 市场运营 | 运营 / 市场负责人 | 2–3 | 内容全生命周期 + 数据分析 + 站点设置（含广告花费录入） |
| 3 | `sales` | 销售 | 销售团队 | 10–15 | 询盘跟进、客户管理（私海/公海） |
| 4 | `support` | 客服 | 客服团队 | 5–8 | 在线会话、工单处理、询盘协助 |
| 5 | `management` | 管理层 | 老板 / 总监 | 2–4 | 全业务只读驾驶舱 + 操作日志（客户列表限公海，见取舍 6） |
| 6 | `staff` | 普通员工 | 其余全员 | 10–20 | 内部知识库阅读与个人文档 |

> 人数为按 50 人公司的估算，仅用于说明角色覆盖面；实际分配由管理员在「账号管理」中操作。

### 3.2 权限矩阵

图例：✅ 授予 ｜ 空 = 不授予。权限 id 与 `PERMISSION_GROUPS` 逐一对齐。

| 权限 | content-editor | marketing-ops | sales | support | management | staff |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **内容管理** |||||||
| content.view | ✅ | ✅ |  |  | ✅ |  |
| content.create | ✅ | ✅ |  |  |  |  |
| content.edit | ✅ | ✅ |  |  |  |  |
| content.publish | ✅ | ✅ |  |  |  |  |
| content.delete |  | ✅ |  |  |  |  |
| **媒体库**（浏览已对全部登录角色开放） |||||||
| media.upload | ✅ | ✅ |  |  |  |  |
| media.delete（回收站） |  | ✅ |  |  |  |  |
| media.purge（物理删除） |  |  |  |  |  |  |
| media.replaceSite |  | ✅ |  |  |  |  |
| **询盘管理** |||||||
| contacts.view |  | ✅ | ✅ | ✅ | ✅ |  |
| contacts.manage |  |  | ✅ | ✅ |  |  |
| contacts.delete |  |  |  |  |  |  |
| **客户管理** |||||||
| customers.view |  |  | ✅ | ✅ | ✅ |  |
| customers.manage |  |  | ✅ |  |  |  |
| customers.delete |  |  |  |  |  |  |
| **运营分析** |||||||
| analytics.view |  | ✅ |  |  | ✅ |  |
| **网站安全** |||||||
| security.view / security.manage |  |  |  |  |  |  |
| **内部文档** |||||||
| docs.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| docs.create | ✅ | ✅ | ✅ |  |  | ✅ |
| docs.edit | ✅ | ✅ | ✅ |  |  | ✅ |
| docs.publish |  | ✅ |  |  |  |  |
| docs.delete / docs.manage |  |  |  |  |  |  |
| **客服与工单** |||||||
| chat.view |  |  |  | ✅ |  |  |
| chat.manage |  |  |  | ✅ |  |  |
| chat.delete |  |  |  |  |  |  |
| tickets.view |  |  |  | ✅ | ✅ |  |
| tickets.manage |  |  |  | ✅ |  |  |
| tickets.delete |  |  |  |  |  |  |
| **系统管理** |||||||
| settings.view |  | ✅ |  |  |  |  |
| settings.manage |  | ✅ |  |  |  |  |
| audit.view |  |  |  |  | ✅ |  |
| system.view |  |  |  |  | ✅ |  |
| users.manage / access.* / integrations.* |  |  |  |  |  |  |

### 3.3 关键取舍说明

1. **删除红线按「可否恢复」划线**——不可恢复删除（`media.purge` 物理清除，及 `contacts.delete` / `customers.delete` / `chat.delete` / `tickets.delete` / `docs.delete`，均为业务数据终态删除）一律不进业务角色，统一找 admin，天然形成"二人复核"。**例外**：`content.delete` 与 `media.delete` 是回收站语义（可恢复，`media.delete` 权限描述即「移入回收站」），属于「内容全生命周期」职责，仅授予 `marketing-ops`；物理清除仍走 admin 的 `media.purge`。
2. **`content-editor` 含 `content.publish`**——小团队无独立发布审批岗，编辑即发布；若未来需要审批流，管理员在后台把该角色的 publish 摘掉即可（预设可改）。
3. **`marketing-ops` 含 `settings.manage`**——站点联系方式/社媒维护和转化看板「广告花费录入」都属运营职责（`PUT /analytics/growth-settings` 要求 `settings.manage`），避免运营天天找 admin。经代码核验，`settings.manage` 的完整控制面为：官网站点公开设置（联系方式/备案/社媒）、邮件通知设置（`PUT site/notifications`，可改通知收件配置）、媒体水印设置（`PUT site/media`）、favicon 上传/删除、广告花费录入——均属站点运营范畴，明示接受；集成凭证（`integrations.*`）不在其中，红线不破。
4. **`chat.view` 仅授予 `support`，销售与管理层一律不给**——经代码核验，`chat.view` 在服务端**不是只读**：坐席 token 兑换仅要求 `chat.view`（`chat-auth.service.ts`），且 WS `send-message` 对坐席只校验会话归属、无主会话「回复即认领」（`chat.gateway.ts`），持有者事实上具备坐席回复/认领能力。管理层看客服绩效走 `analytics.view` 的「客服绩效」页（`/growth/support`），诉求不受损。后续可选加固见第七章风险表（WS 层 agent 写操作校验 `chat.manage`，独立事项、不阻塞本方案）。
5. **`support` 含 `contacts.manage` 与 `customers.view`**——客服处理会话时常需将访客升级为询盘、查客户背景，但不能改客户归属（无 `customers.manage`）。注意：无 `customers.manage` 时 `customers.view` 实际只能看到公海与本人私海（客服通常无私海客户），即「查客户背景」范围限于公海客户——按现有私海/公海模型这是刻意收敛，接受此限制。
6. **`management` 是纯只读角色 + `audit.view`/`system.view`**——满足老板"看数据、看日志、看系统状态"的诉求，且不给任何写权限，杜绝管理层账号成为高价值攻击目标。会话/客服数据经「客服绩效」「转化看板」（`analytics.view`）聚合呈现，不直接进客服控制台（见取舍 4，`chat.view` 事实为坐席能力，给了就不是纯只读）。**已知取舍（客户维度）**：无 `customers.manage` 时客户列表 scope 强制降级（`scopeWhere`：`all` → 仅本人私海），management 实际只能看到**公海客户**，非全量客户明细列表——全量客户经营数据经转化看板聚合呈现，个案明细需要时找 admin 或销售；不为此给 `customers.manage`（会连带新建/转移等写能力，破坏纯只读定位）。
7. **`staff` = `docs.view + docs.create + docs.edit`**——全员基线：读知识库、写并维护个人文档。`docs.edit` 必须随 `docs.create` 一起给：更新文档（`PUT /documents/:id`）与个人文件夹重排/移动均要求 `docs.edit`，否则「能建不能改」；服务层有归属校验（`update(id, dto, user.id, canManage)`），`docs.edit` 不会让 staff 改动他人共享文档。已知取舍：不给 `docs.delete`（红线），**文档**删除需找 admin；但 `docs.create` 附带两项能力须明示——个人**文件夹**可自删（`DELETE folders/personal/:id` 仅要求 `docs.create`，个人空间内自治，接受），以及全局标签库注册（`POST /documents/tags`，全员可造标签，存在标签污染的轻微风险，靠 admin 持 `docs.manage` 定期合并/清理兜底）。新员工入职默认给 staff，转岗再升级，符合"默认拒绝"。同理 `sales` 的 `docs.create` 也配套了 `docs.edit`。
8. **`security.*`、`integrations.*`、`users.manage`、`access.*` 不进任何业务角色**——职责分离红线，仅 admin。

## 四、技术实现方案

### 4.1 预设定义（唯一事实源）

在 `apps/api/src/access/permissions.ts` 新增常量（与 `PERMISSION_GROUPS` 同文件，享受同一份对齐规范）：

```typescript
export interface PresetRoleDef {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
}

/** 业务角色预设：仅首次启动播种，isSystem=false，管理员可改可删，系统永不覆盖。 */
export const PRESET_ROLES: PresetRoleDef[] = [
  { slug: 'content-editor', name: '内容编辑', description: '官网内容创作与发布、媒体上传', permissions: [/* 见 3.2 矩阵 */] },
  { slug: 'marketing-ops', name: '市场运营', description: '内容全生命周期、数据分析与站点设置', permissions: [/* ... */] },
  { slug: 'sales', name: '销售', description: '询盘跟进与客户管理', permissions: [/* ... */] },
  { slug: 'support', name: '客服', description: '在线会话、工单与询盘处理', permissions: [/* ... */] },
  { slug: 'management', name: '管理层', description: '全业务只读驾驶舱与操作日志', permissions: [/* ... */] },
  { slug: 'staff', name: '普通员工', description: '内部知识库阅读与个人文档', permissions: [/* ... */] },
];
```

约束：
- 每个 preset 的 `permissions` 必须通过 `assertValidPermissions`（单测强制，防止权限 id 拼错或未来重命名后漏改）；
- preset slug **不加入** `RESERVED_ROLE_SLUGS`（它们是普通可管理角色，非系统保留）；
- `PRESET_ROLES` 的 slug 之间、与 `RESERVED_ROLE_SLUGS` 之间不得冲突（单测覆盖）。

### 4.2 播种机制：一次性、不复活、不覆盖

在 `RolesService.onModuleInit` 的 `syncSystemRoles()` 之后追加 `seedPresetRoles()`：

```
seedPresetRoles():
  1. 读 Setting 表 key = 'access.presetRolesSeededAt'，已存在 → 直接返回（幂等）
  2. 逐个 preset：slug 已存在于 access_roles → 跳过（不覆盖任何现有角色）
     不存在 → create({ ..., isSystem: false })
     create 需容忍 Prisma P2002（多实例并发 onModuleInit 竞态撞 slug 唯一约束，视为已存在跳过）
  3. upsert Setting { key: 'access.presetRolesSeededAt', value: ISO 时间, group: 'access', label: '预置角色播种时间' }
     （必须 upsert 而非 create：双实例同时读不到标记会双双走到本步，create 会撞 key 唯一约束）
  4. invalidateCache() + logger.log 播种结果
```

设计理由：
- **用 Setting 打"只播一次"标记**，而不是"启动时 create-if-missing"——否则管理员删掉不需要的预设角色后，每次重启都会复活，违背"预设可改可删"的承诺。Setting KV 模式与 `growth.adSpend` 一致，零新表零迁移。
- **`isSystem=false`**——预设角色走现有 CRUD 全流程：可在后台改名/调权限（自动吊销该角色会话）/删除（有在用账号时已有保护性报错），无需任何新接口。
- **admin 系统角色逻辑完全不动**：`syncSystemRoles` 的 upsert + 废弃角色清理保持原样。

### 4.3 涉及文件清单

| 文件 | 改动 | 说明 |
|------|------|------|
| `apps/api/src/access/permissions.ts` | 修改 | 新增 `PresetRoleDef` + `PRESET_ROLES` 常量 |
| `apps/api/src/access/roles.service.ts` | 修改 | `onModuleInit` 追加 `seedPresetRoles()`（约 30 行） |
| `apps/api/src/access/roles.service.spec.ts` | 修改 | 补 3 组单测（见 5.1） |

**零改动项**：Prisma schema（复用 `AccessRole` + `Setting`）、前端（角色下拉 `listOptions` 与角色管理页自动呈现新角色）、守卫链、审计、seed.ts。

### 4.4 上线与回滚

- **dev**：API dev watch 重启即播种；`/access` 页面确认 6 个新角色与权限勾选正确。
- **生产**：随下一次部署自动播种（`onModuleInit`），无需手工 SQL、无需停机。
- **回滚**：预设角色是普通数据行——删角色即可（有在用账号会被现有保护逻辑拦截）；代码回滚不影响已播种数据。
- **存量账号迁移**：现有非 admin 账号（若有）由管理员在「账号管理」中改派新角色；HTTP 侧改派即时生效（JwtStrategy 每请求查库取 `user.role`，非 JWT 载荷）。唯一残留窗口：已兑换的坐席 chat token 内嵌旧角色，最长 15 分钟自然过期后按新角色重新兑换（`chat-auth.service.ts` 既有取舍）。

## 五、测试与验收

### 5.1 单元测试（roles.service.spec.ts）

1. `PRESET_ROLES` 静态校验：所有权限 id 合法（`assertValidPermissions` 不抛）；slug 无重复、不与 `RESERVED_ROLE_SLUGS` 冲突；均不含 `users.manage`/`access.*`/`security.*`/`integrations.*`（职责分离红线断言，防未来手滑）；不可恢复删除权限（`media.purge`、`contacts.delete`、`customers.delete`、`chat.delete`、`tickets.delete`、`docs.delete`）不出现在任何预设，可回收的 `content.delete`/`media.delete` 仅允许出现在 `marketing-ops`（删除红线断言，见取舍 1）；`chat.view` 仅允许出现在 `support`（chat.view 事实为坐席能力，见取舍 4）；含 `docs.create` 的预设必须同时含 `docs.edit`（防「能建不能改」，见取舍 7）。
2. `seedPresetRoles`：首次调用创建 6 个角色并写标记；再次调用（标记已存在）零写入。
3. slug 已被自定义角色占用时跳过该条且不报错，其余照常创建。

### 5.2 验收清单

- [ ] `pnpm --filter api exec tsc --noEmit` / `npx biome check` 通过
- [ ] jest 单测全绿（含新增 3 组）
- [ ] 重启 API 后日志出现播种记录；`/access` 页面可见 6 个新角色，`userCount=0`，均可编辑
- [ ] 用 `sales` 角色新建测试账号：能进询盘/客户，侧边栏**无**在线客服入口，且无法兑换坐席 token（`POST /support/chat-rooms/token` 返回 403）；进不了账号管理/站点设置/转化看板
- [ ] 用 `staff` 角色登录：侧边栏仅剩内部文档相关入口；能新建个人文档并**二次编辑保存**成功（验证 docs.edit 配套到位）
- [ ] 再次重启 API：角色数量不变（幂等）；删除一个预设角色后重启：不复活

## 六、明确不做（防过度设计）

| 不做项 | 理由 |
|--------|------|
| 用户多角色 / 角色继承 | 50 人规模一人一角色足够，多角色引入合并语义与调试复杂度 |
| 部门树 / 数据范围按组织架构过滤 | 客户私海/公海已有 owner 归属模型，够用 |
| 角色审批流 / 权限申请工单 | admin 直接在后台改，全程有审计日志 |
| 把预设升级为 `isSystem=true` 锁死 | 预设是起点不是枷锁，锁死会逼管理员克隆角色造成冗余 |
| 独立的"安全运维"角色 | security/integrations 操作者与 admin 是同一批人（IT 2–3 人） |
| 临时权限 / 定时过期授权 | 无此业务诉求，靠审计日志 + 及时改派覆盖 |

## 七、风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| 预设权限与岗位实际不符 | 低 | `isSystem=false` 后台随时微调，调完自动吊销会话即时生效 |
| `chat.view` 语义偏宽（查看即可当坐席） | 中 | 本方案将 `chat.view` 收敛给 support 规避；可选加固（独立事项，不阻塞）：WS 层对 agent 的 send-message/update-room-status/transfer-room 补查 `chat.manage` |
| `GET /customers/:id` 明细无 scope 校验（代码既有问题） | 中 | 持 `customers.view` 者可按 ID 读任意客户明细，与列表的私海/公海口径不一致；本方案不新增暴露面（support/management 本就授予 view），但建议独立事项修复：明细端点复用 `scopeWhere` 归属校验 |
| slug 与既有自定义角色撞名 | 低 | 播种 create-if-missing 跳过 + 单测覆盖；撞名时管理员可手工建同权限角色 |
| 未来新增权限组后预设未更新 | 中 | 预设只在首次播种时生效，新权限默认不授予任何业务角色（fail-safe，符合默认拒绝）；需要时管理员手动勾选 |
| 管理层账号被钓鱼 | 低 | management 为纯只读角色 + 可叠加强制 2FA 策略（现有能力） |
