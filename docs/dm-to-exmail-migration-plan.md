# 邮件系统迁移方案：阿里云邮件推送 → 企业邮箱（阿里邮箱免费版）

> 版本：v1.23　|　日期：2026-08-04　|　含阶段 1/2/4/5(本地) 已执行 + DKIM 配置完成

## 1. 背景与目标

### 现状问题

| 问题 | 说明 |
|------|------|
| 收发割裂 | 发信用阿里云邮件推送（DM），收信用 QQ 邮箱（REDACTED-EMAIL），两套系统 |
| 无法回复 | DM 发信地址 service@tzjii.com 无收件箱，访客直接回复确认信必然失败（邮件中已提示"请勿直接回复"） |
| 品牌形象弱 | 对外联系邮箱是个人 QQ 邮箱，与企业官网（tzjii.com）形象不匹配 |
| DNS 复杂 | DM 需要独立的 MX/SPF/DKIM/TXT 验证记录，与收信邮箱体系无法统一 |
| 成本 | DM 按量计费，长期使用有持续费用 |
| 退信丢失 | DM 发信地址无收件箱，硬退信（收件人不存在/拒收）无处落地，坏邮箱无法被发现 |

### 目标

1. **一套邮件系统**：阿里云企业邮箱（免费版）统一收发
2. **可回复**：访客可直接回复 service@tzjii.com 的确认信
3. **品牌化**：对外联系邮箱改为 contact@tzjii.com
4. **零中断迁移**：迁移期间询盘通知不丢件
5. **DM 彻底退役**（用户决策 2026-08-03）：不保留备胎——DM 集成代码/注册/凭证/DNS 记录全部移除，不回滚

## 2. 现状分析（已核实）

### 2.1 代码链路

```
询盘提交 POST /api/v1/contact (contact.controller.ts)
  → contact.service.ts 落库 contacts 表
  → NotificationService.dispatchContactCreated(contact)   // setImmediate 异步
    → handleContactCreated()
      ├─ AliyunDmService.isAvailable()                    // 集成 aliyun-directmail 启用?
      ├─ SettingsService.getSiteNotificationSettings()    // 邮件通知开关
      ├─ 生成 jobs: staff-notify (按 notifyEmails 遍历) + auto-reply (访客确认信)
      └─ sendEmailJob() → AliyunDmService.sendMail()      // DM SingleSendMail API
  → notification_logs 表 (idempotencyKey 幂等, pending→sent/failed)
  → retryFailedNotifications @Cron(EVERY_10_MINUTES) 重试 24h 内失败
```

### 2.2 关键文件

| 文件 | 职责 |
|------|------|
| `apps/api/src/integrations/aliyun-dm.service.ts` | DM 发送实现：`isAvailable()` / `sendMail(options)`，从 IntegrationsService 读 AK/accountName/fromAlias/region |
| `apps/api/src/integrations/integration.registry.ts` | 集成注册表（slug/字段/env 兜底），后台配置表单由它驱动（**新增集成无需改后台 UI**） |
| `apps/api/src/integrations/integration.testers.ts` | 各集成「测试连接」实现 |
| `apps/api/src/integrations/integrations.module.ts` | 导出 AliyunDmService 供 NotificationModule 注入 |
| `apps/api/src/notifications/notification.service.ts` | 通知编排（注入 `aliyunDm: AliyunDmService`，仅用 isAvailable/sendMail） |
| `apps/api/src/support/chat-notification.service.ts` | **聊天离线留言 → 坐席邮件通知**（独立注入 AliyunDmService，不走 notification_logs，失败仅记日志） |
| `apps/api/src/health/health.service.ts` | `checkEmail()` 用 `isActive('aliyun-directmail')` 探活邮件依赖 |
| `apps/api/src/notifications/email/templates/contact.templates.ts` | 邮件模板（staff-notify / auto-reply），auto-reply 已动态读取站点设置联系方式 |
| `apps/api/src/settings/settings.service.ts` | `getSitePublicSettings()` 提供 contact.phone / contact.email |

### 2.3 集成注册机制（重要约束）

- 后台「集成与凭证」页面由 `INTEGRATION_REGISTRY` 驱动渲染，**新增 slug 自动出现配置卡片**，无需改 Admin UI
- 凭证通过 `IntegrationsService.resolveSecret()` 读取，DB 中 AES-256-GCM 加密存储（SECRETS_ENCRYPTION_KEY）
- env 兜底：`INTEGRATION_ENV_FALLBACK` 支持 CI/迁移注入

### 2.4 DNS 现状（tzjii.com）

| 记录 | 当前值 | 用途 |
|------|--------|------|
| MX | `5 mx01.dm.aliyun.com` | DM 回信/退信路由 |
| TXT | `v=spf1 include:spf1.dm.aliyun.com -all` | DM 发信 SPF |
| TXT | DM 域名验证串 | DM 域名验证 |
| TXT | `aliyun-cn-hangzhou._domainkey` DKIM | DM 发信签名（v1.21 实证修正：实际记录名含地域后缀，非 aliyun._domainkey） |

### 2.5 阿里云账号现状

- 当前浏览器登录态：**RAM 子用户** z****e@1336****.onaliyun.com
- ⚠️ 企业邮箱免费版申请、DNS 解析配置**必须用主账号**（页面会拒绝子用户访问）
- 主账号 ID：1336****（账号实名已认证，符合免费版申请条件）

## 3. 目标架构

```
┌────────────────────────────────────────────────┐
│           阿里云企业邮箱（免费版）               │
│  收发一体：SMTP (465) 发信 + 收件箱收信          │
│                                                │
│  service@tzjii.com  发件人（通知/确认信，可回复）│
│  contact@tzjii.com  对外联系邮箱（站点设置）     │
│  postmaster@tzjii.com 管理员（系统创建）         │
└────────────────────┬───────────────────────────┘
                     │ SMTP over TLS (smtp.qiye.aliyun.com:465)
                     │
┌────────────────────▼───────────────────────────┐
│  apps/api：ExmailSmtpService（nodemailer）      │
│  → 通知模块 / 自动回复（模板不变，链路不变）     │
└────────────────────────────────────────────────┘
```

- **DNS**：MX 指向阿里邮箱服务器；SPF 换为企业邮箱 include；DM 的验证 TXT/DKIM/SPF include 全部清理（验收后确定执行）
- **DM 集成**：**彻底退役**（用户决策）——`aliyun-dm.service.ts` 代码删除、registry/testers/module 条目移除、后台集成记录与 AccessKey 删除，不保留备胎

## 4. 方案设计

### 4.1 阿里云侧配置

#### 4.1.1 申请企业邮箱（免费版）

- 入口：`https://exmail.aliyun.com/free`（必须主账号登录）
- 绑定域名：`tzjii.com`（已有，选择"已有域名"；支持主域名或子域名）
- 配额：50 账号 / 5GB 每账号 / 大附件中转站 10G / 外部发信 2000 封/天/企业 / 收件人上限 2000 人/天/企业 / **海外邮件投递通道：中国服务器直连**
- 免费版规则：实名认证后到期自动续期 1 年；**申请后 7 天内必须完成 DNS 解析，否则服务被回收**；**单阿里云账号限 1 个免费版、单实名身份限 2 次**（本次首次申请不受限）
- 升级路径：**仅支持升级到「标准版-无限容量」**（不能直接升尊享版，需先升标准版）；**注销即清空全部数据不可恢复**
- 功能边界：不支持邮件归档、邮箱回收站、账号别名（service@/contact@ 必须为独立账号，方案已是）、API 开放平台（SMTP 不受影响）
- 风险备注：若免费版开通后 SMTP 客户端发信能力受限（以控制台实际能力为准），**不升级标准版**（用户决策 2026-08-03）——启用第 7 章 QQ SMTP 过渡路径作为既定发信通道，企业邮箱保留收信；若 SMTP 可用（大概率），一切照常
- **MX 与开通步骤的关系**：域名验证（TXT）即可开通并启用 SMTP 发信；MX 仅影响收信。若控制台开通流程强制 MX 先行才能继续，可提前切换 MX——**对 DM 零影响**（DM 发信不依赖 MX，DM 退信本就不可达），不改变「SMTP 验证通过后才停用 DM」的顺序

#### 4.1.2 DNS 记录变更（关键步骤，含顺序）

> **解析商实证**（v1.18）：NS = `dns1/dns2.hichina.com`（阿里云万网）——DNS 修改入口为**阿里云云解析控制台**（主账号登录后直接操作，无需跳转其他服务商）

| 记录 | 操作 | 目标值 |
|------|------|--------|
| TXT SPF | **先合并，验收后清理**（不可直接替换） | 过渡期：`v=spf1 include:spf1.dm.aliyun.com include:spf.qiye.aliyun.com -all`；SMTP 验收后：删 DM include，仅留企业邮箱 include（官方值已查证） |
| TXT 验证串 | 新增 | 企业邮箱域名验证记录（控制台提供） |
| DKIM | 新增 | 企业邮箱 DKIM：主机记录 `default._domainkey`（官方选择器，非 aliyun-cn-hangzhou._domainkey）——已实测 `default._domainkey.tzjii.com` 无记录，与 DM 零冲突 |
| TXT DMARC | 保持不动 | 现有 `v=DMARC1;p=none;rua=mailto:dmarc_report@service.aliyun.com`（DM 配置时自动生成）——`p=none` 监控模式不拒收，**切换期禁止改 p=quarantine**；可选后续将 rua 改到 contact@ 接收报告 |
| MX | 最后切换 | 官方值：`mx1.qiye.aliyun.com`(5)、`mx2.qiye.aliyun.com`(10)、`mx3.qiye.aliyun.com`(15) 三条（旧版 `mxn.mxhichina.com` 已废弃，勿用） |
| DM 全部记录（验证 TXT / DKIM / SPF include） | 验收后**确定清理** | 删除（DM 退役，不再保留）；DM DKIM 选择器为随机串，不占用 default._domainkey |
| CNAME（可选） | 按需 | smtp/pop3/imap/mail 的 CNAME（仅客户端配置用；程序直连 smtp.qiye.aliyun.com 不需要） |

> **过渡期策略（消除风险窗口）**：SPF 合并对 DM 发信零影响，是唯一必须最先执行的 DNS 变更；MX 切换只影响 DM 退信接收（不影响 DM 发信），因此**放到 SMTP 验证通过后与停用 DM 同一步执行**。全程不出现「DM 在发信但 SPF/DKIM 已失效」的状态。

> 附注：SPF 合并后，DM 控制台「域名验证」界面 SPF 项可能显示“值不匹配”（预期现象，DM 只识别单 include）。**不影响发信**（收件方校验的是 DNS 实际值），DM 即将退役，可忽略。

#### 4.1.3 邮箱账号与 SMTP

| 账号 | 用途 | 说明 |
|------|------|------|
| postmaster@tzjii.com | 管理员 | 系统创建，需设置密码，用于登录域管后台 |
| service@tzjii.com | 发件人 | 创建普通账号，用于 SMTP 发信；访客可回复 |
| contact@tzjii.com | 联系邮箱 | 创建普通账号，对外公布 |

每个账号开启 SMTP 服务并生成**三方客户端安全密码**（阿里邮箱机制：客户端专用密码，独立于登录密码，可单独吊销）。

### 4.2 代码改造

#### 4.2.1 新增 SMTP 邮件服务 `apps/api/src/integrations/exmail-smtp.service.ts`

```typescript
// 接口与 AliyunDmService 对齐，通知模块切换零逻辑改动
export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class ExmailSmtpService {
  isAvailable(): Promise<boolean>;          // integrations.isActive('aliyun-exmail')
  sendMail(options: SendMailOptions): Promise<void>;
  // 实现：nodemailer createTransport({
  //   host: 'smtp.qiye.aliyun.com',        // 固定值，已查证唯一可用
  //   port: 465, secure: true,              // 80/587 未开放、25 被 ECS 封禁
  //   connectionTimeout: 10_000,            // 必须设置：默认无超时会挂起发送队列
  //   socketTimeout: 15_000,
  //   auth: { user: config.accountName, pass: secret.smtpPassword },
  // }) → sendMail({ from: `"${fromAlias}" <${accountName}>`, ... })
  // 注意：catch 日志只记 host/accountName/错误码，绝不打印 smtpPassword
}
```

#### 4.2.2 集成注册（integration.registry.ts）

新增 slug `aliyun-exmail`：

- **secretFields**：`smtpPassword`（三方客户端安全密码，required，加密存储）
- **configFields**：
  - `accountName`（发件邮箱 service@tzjii.com，required）
  - `fromAlias`（发件人昵称，默认“拓之迹官网”）
  - ⚠️ **required 硬约束**（v1.15 实测）：`isActive()` 末尾要求 registry 至少一个 required 字段（integrations.service.ts:94），smtpPassword/accountName 必须标 required，否则集成永远不生效且无报错
  - ~~smtpHost / smtpPort~~：**不提供配置项**——已查证阿里邮箱 SMTP 服务器固定 `smtp.qiye.aliyun.com:465`（SSL），80/587 暂未开放、25 被 ECS 默认封禁，465 为唯一可用端口，硬编码即可
- **INTEGRATION_ENV_FALLBACK**（v1.16 补全具体键名，与 DM 命名模式一致）：`ALIYUN_EXMAIL_SMTP_PASSWORD`（secret）、`ALIYUN_EXMAIL_ACCOUNT_NAME`（config）、`ALIYUN_EXMAIL_FROM_ALIAS`（config）——生产部署可用 env 兜底注入替代后台配置（两者取一，见 4.4）
- **setupGuide**：申请免费版 → 建账号 → 域管开启三方客户端 → 生成安全密码 → 填配置 → 测试连接
- 后台集成卡片自动渲染，**无需改 Admin UI**

#### 4.2.3 测试连接（integration.testers.ts）

`aliyun-exmail` 实现：`nodemailer.createTransport(...).verify()` 探活；失败返回明确原因（认证失败/端口不通/主机不可达）。比 DM 的"凭证齐全"式测试更真实。

#### 4.2.4 通知模块切换（notification.service.ts + notifications 相关模块）

- 依赖注入：`AliyunDmService` → `ExmailSmtpService`（`isAvailable()` / `sendMail()` 接口一致，业务逻辑零改动）
- **DM 全部使用方（已全库核实，4 处）**：
  1. `notification.service.ts`（询盘通知 + 自动回复）——constructor / handleContactCreated / retryFailedNotifications 三处引用同步替换
  2. `chat-notification.service.ts`（**聊天离线留言提醒，方案初版遗漏**）——构造注入同步替换；其失败仅记日志、不走幂等体系，切换后行为不变
  3. `health.service.ts` `checkEmail()`——slug 由 `aliyun-directmail` 改为 `aliyun-exmail`，避免 DM 退役后邮件探活永远 skipped
  4. `integrations.module.ts` / registry / testers——移除 DM 条目，新增 ExmailSmtpService 注册导出
- **DM 彻底退役**（用户决策）：删除 `aliyun-dm.service.ts` 文件、registry 中 aliyun-directmail 条目（含 INTEGRATION_ENV_FALLBACK 的 ALIYUN_DM_* 键）、testers 条目、module providers/exports、后台集成记录与 AccessKey
  - **AK 独立性已核实**：DB 中无其他集成共用该 AK（baidu-ocpc=token、lingxi-llm=apiKey）；退役前在阿里云 RAM 控制台确认该 AK 仅绑定 DM 相关权限策略，**先禁用观察 7 天再彻底删除**
  - **文档一致性**（v1.11 补）：`docs/security/account-recovery-design-fix.md` §2 引用 AliyunDmService 作邮件基建——该功能标注「非目标」未实现，退役时在文档加注“邮件基建已切换为 ExmailSmtpService，本描述过时”
  - **示例文件清理**（v1.13 补）：根 `.env.example:37-41` 的 ALIYUN_DM_* 5 个示例键改为 ALIYUN_EXMAIL_*（ACCESS_KEY_ID/ACCESS_KEY_SECRET/ACCOUNT_NAME/FROM_ALIAS/REGION → SMTP_PASSWORD/ACCOUNT_NAME/FROM_ALIAS）
- 已核实：`NotificationModule` imports 了 `IntegrationsModule`，无需改模块依赖
- 后台切换（启 SMTP）的短暂窗口内 `isAvailable=false`，通知记录 failed 并由 10 分钟 cron 自动重试补发（既有幂等机制兜底，无需额外处理）

#### 4.2.5 模板文案调整（contact.templates.ts）

- 自动回复邮件底部「本邮件由系统自动发送，请勿直接回复，如有需要请使用上方联系方式。」→ 改为「如需进一步沟通，可直接回复本邮件，或拨打服务热线 **0371-58691119**。」
- HTML 版联系方式区保留（tel:/mailto: 链接），新增「直接回复」引导

#### 4.2.6 依赖

- 新增 `nodemailer` + `@types/nodemailer`（apps/api 依赖，A1 审批流程）

#### 4.2.7 测试计划

- **ExmailSmtpService 单测**（新）：mock nodemailer transport——① 断言 host=固定值/port=465/secure=true/超时参数；② 断言 from 为 accountName；③ 断言错误日志不包含 smtpPassword；④ isAvailable 跟随集成启用状态
- **notification.service 单测**（新，v1.11 修正）：现有代码库无 notification 测试文件（已核实 apps/api/src/notifications 无 *.spec.ts），新建测试 mock ExmailSmtpService 验证幂等/重试/模板行为不因注入对象变化而改变
- **chat-notification.service 单测**（新，v1.11 修正）：现有 support 模块 7 个 spec 均不覆盖 chat-notification（已核实），新建测试 mock ExmailSmtpService 验证离线留言发送与 10 分钟去抖
- **集成探活**：`verify()` 失败返回可读原因（认证失败/端口不通/主机不可达）

### 4.3 后台配置变更

| 位置 | 变更 |
|------|------|
| 集成与凭证 | 停用 `aliyun-directmail`；启用 `aliyun-exmail` 并填入 SMTP 凭证，测试连接 |
| 站点设置 → 联系方式 | 电子邮箱：`REDACTED-EMAIL` → `contact@tzjii.com`（API 侧即时生效，但 **C 端 Data Cache 按后台「官网生效速度」TTL 缓存：默认 300s，可配 0=即时/上限 86400s**，TTL 修改最长 60s 生效——已核实 site-settings.ts 两级缓存；自动同步页脚/联系页/顶栏/结构化数据/自动回复邮件；静态文案页需另行处理，见 4.6） |
| 站点设置 → 邮件通知 | 不变（收件人、自动回复开关/主题已配置） |

### 4.4 生产环境部署顺序（关键约束）

> ⚠️ **本地验证 ≠ 生产生效**：integrations 表按环境独立存储，本地配置不会同步到生产。

CI 会在代码合并后自动部署新 API 代码。若部署时生产环境未配置 `aliyun-exmail` 集成，则生产 `isAvailable=false`，**生产询盘通知将停止**（期间失败记录由 10 分钟 cron 在配置完成后自动补发，24h 内可恢复，但会漏通知）。

**必须的执行顺序：**

1. 先在**生产后台**完成 `aliyun-exmail` 配置并测试连接（或通过 env 兜底 `ALIYUN_EXMAIL_*` 注入，两者取一）
2. 再合并代码触发 CI 部署
3. 部署后在生产提交测试询盘验证（此时 DM 与 SMTP 并存，SPF 已合并，双通道均通过校验）
4. 生产验证通过后，才执行 MX 切换 + 停用 DM（阶段 5）

本地与生产共用同一套后台流程，先本地后生产，每环境都要走「配置 → 验证 → 切换」。

### 4.5 数据与兼容性

- `notification_logs` 表结构不变；历史记录保留（含 DM 发送的 sent 记录）
- 询盘 `contacts` 表不变
- 幂等重试机制不变（idempotencyKey 与模板 key 不变）
- C 端（官网）动态区域（页脚/联系页/顶栏/结构化数据）自动生效：数据源为站点设置接口（API 侧无缓存），但 **web 侧有 Next Data Cache**（`next: { revalidate: ttl }`，ttl=后台「官网生效速度」默认 300s，0=不缓存），改后台后最长 TTL 时间生效；本地 dev 环境 Next 禁用 Data Cache，与生产行为不同
- C 端**静态文案**不自动生效（见 4.6）

### 4.6 C 端静态文案更新（代码变更）

> 已核实：i18n 消息文件 **6 处**邮箱硬编码（后台站点设置无法覆盖，必须改代码）+ **API 侧默认值 1 处** + **env 示例 2 处**：

| 文件 | 位置 | 当前值 |
|------|------|--------|
| `apps/web/src/messages/{en,zh-CN,zh-TW}/pages/privacy.json` | 9. 联系我们 | 邮箱：REDACTED-EMAIL |
| `apps/web/src/messages/{en,zh-CN,zh-TW}/pages/terms.json` | 8. 联系方式 | 邮箱：REDACTED-EMAIL |
| `apps/api/src/settings/settings.defaults.ts` | 站点设置默认值（API 兜底，v1.10 补） | email 默认 REDACTED-EMAIL → contact@tzjii.com（生产/本地 DB 均已配置，实际不生效，属代码一致性更新） |
| 根目录 `.env.example` | NEXT_PUBLIC_CONTACT_EMAIL（v1.10 补） | REDACTED-EMAIL → contact@tzjii.com（apps/web/.env.example 的 sales@tzjii.com 一并修正） |

- 迁移时 i18n 6 处 + settings.defaults.ts 1 处全部改为 `contact@tzjii.com`（注意 en 为 `Email: ...` 格式）
- 兜底值（可选）：`apps/web/src/lib/site.ts`、`site-defaults.ts` 的 fallback 邮箱同步更新；`apps/web/.env.example` 中历史遗留 `sales@tzjii.com` 一并修正
- ⚠️ **生产 env 覆盖风险**：`site-settings.ts` 逻辑为 `NEXT_PUBLIC_CONTACT_EMAIL || 后台值`，且 NEXT_PUBLIC_* 为**构建时内联**变量——部署前必须检查生产 `.env.prod`（/opt/tzj）是否含 `NEXT_PUBLIC_CONTACT_EMAIL`；若有则同步改为 `contact@tzjii.com` 并**重新构建 web 镜像**（仅改 .env 不生效）
- 静态文案随 web 构建部署生效（与本次代码改造同批发布）

## 5. 实施步骤

### 阶段 0：前置（用户操作）
1. 用户在浏览器完成**阿里云主账号登录**（免费版申请与 DNS 必须主账号）

### 阶段 1：SPF 合并（安全先行，可独立执行）
2. 修改 SPF 为合并值（DM include + 企业邮箱 include），dig 校验生效
   - 此步骤对 DM 发信零影响，合并后过渡期双通道 SPF 均通过

### 阶段 2：申请与账号（与阶段 3 并行）
3. 申请企业邮箱免费版，绑定 tzjii.com（0 元）
4. 添加企业邮箱验证 TXT / DKIM（SPF 已合并，勿再动）
   - ⚠️ **手动添加记录，禁用「一键添加解析」**：一键添加会按模板覆盖 SPF，破坏已合并的双通道 SPF
5. 设置 postmaster 密码，登录域管后台；创建 service@tzjii.com、contact@tzjii.com
6. **开启三方客户端访问**：域管「三方客户端登录管理」设为允许（阿里邮箱默认禁止三方客户端）
7. 为 service@ 生成三方客户端安全密码
8. **SMTP 冒烟测试（提前暴露免费版限制）**：用本地脚本（nodemailer 或 openssl）连接 smtp.qiye.aliyun.com:465 以 service@ 发送测试邮件，确认免费版 SMTP 发信可用；若受限，立即决策升级标准版，避免后期返工

### 阶段 3：代码改造（与阶段 2 并行）
9. 安装 nodemailer 依赖；**卸载 @alicloud/dm20151123**（v1.12 补：`pnpm --filter @tzj/api remove @alicloud/dm20151123`，同步 lockfile；已核实该 SDK 仅 aliyun-dm.service.ts 引用）
10. 新增 exmail-smtp.service.ts（固定 host/port，配置 connectionTimeout/socketTimeout）；registry 注册 `aliyun-exmail`（含 setupGuide/env 兜底）
11. integration.testers.ts 增加 SMTP verify 探活
12. 注入切换（3 处）：notification.service.ts / chat-notification.service.ts / health.service.ts（slug 改 aliyun-exmail）；integrations.module.ts 注册导出（移除 DM）
13. 模板「请勿直接回复」文案调整
14. `pnpm --filter @tzj/api typecheck` + biome lint 通过

### 阶段 4：后台启用 SMTP（与 DM 并存）
15. 后台「集成与凭证」：启用 aliyun-exmail、填 SMTP 凭证、测试连接（**暂不停用 DM**）
16. 站点设置联系邮箱 → contact@tzjii.com
17. **C 端静态文案更新（4.6）**：privacy/terms 三语 6 处邮箱改为 contact@tzjii.com；检查生产 .env.prod 的 NEXT_PUBLIC_CONTACT_EMAIL（若有则改值）
18. 提交测试询盘，确认 3 封邮件全部 sent（此时 SPF 合并已生效，**SPF 双 include（DM + 企业邮箱）均通过校验**；代码已切换，实际由 SMTP 发送）

### 阶段 5：MX 切换与 DM 停用（验证通过后）
19. **生产环境先行**：生产后台配置 aliyun-exmail → 合并代码触发 CI 部署 → 生产测试询盘验证
20. MX 记录切换为企业邮箱（仅影响 DM 退信接收，不影响 DM 发信）
21. 生产/本地后台停用 `aliyun-directmail`；确认通知走 SMTP
22. dig 校验 MX/SPF；mxtoolbox 校验 SPF；**生产服务器预检 465 连通性**（openssl s_client -connect smtp.qiye.aliyun.com:465）

### 阶段 6：端到端验收与清理
23. Gmail/QQ 收件箱确认收到且不落垃圾箱
24. **直接回复** service@tzjii.com 的确认信 → 企业邮箱 webmail 能收到（验收核心收益）
25. 访客写信至 contact@tzjii.com → 能收到
26. **DM 彻底退役**：后台删除 aliyun-directmail 集成记录；RAM 控制台确认 AK 仅用于 DM 后**先禁用（观察 7 天）再删除**；DM 控制台删除发信地址（发信域名一并删除）；生产 .env.prod（/opt/tzj）残留的 ALIYUN_DM_* 变量顺手清理（registry 删除后不再读取，无害）
27. **验收通过后**：清理 SPF 中 DM include、DM 的验证 TXT/DKIM 记录；通知模块 cron 对历史 failed 无异常
28. **运维基线（免费版限制）**：无邮件归档/回收站，重要邮件定期导出备份（webmail 导出/IMAP 拉取）；确认实名自动续期生效

## 6. 验证清单

| # | 验证项 | 通过标准 |
|---|--------|---------|
| 1 | SMTP 测试连接 | 后台返回连接成功 |
| 2 | 询盘通知 | 2 封 staff-notify sent（阶段 1 SPF 合并后由 **DM 发 1 次**验证合并零影响；阶段 3 代码部署后由 **SMTP 发 1 次**验证新通道——代码切换后仅 SMTP 发信，不存在双通道并存） |
| 3 | 访客自动回复 | 1 封 auto-reply sent，主题为新设置主题 |
| 4 | 自动回复正文 | 含服务热线（tel: 链接）+ contact@tzjii.com（mailto: 链接） |
| 5 | 直接回复 | 回复确认信 → service@tzjii.com 收到 |
| 6 | 对外联系 | 写信 contact@tzjii.com → 收到 |
| 7 | SPF | 过渡期 mxtoolbox 校验双 include 通过；清理后单 include 通过 |
| 8 | 垃圾箱 | Gmail/QQ 均入收件箱（免费版海外投递为中国服务器直连，Gmail 结果用于评估海外投递质量） |
| 9 | 幂等重试 | 重复提交同询盘不重复发信；切换窗口无新增 failed |
| 10 | **C 端静态文案** | privacy/terms 三语页面邮箱均显示 contact@tzjii.com（构建部署后） |
| 11 | **C 端动态区域** | 页脚/联系页/顶栏/结构化数据显示 contact@tzjii.com（改后台后按「官网生效速度」TTL 生效：默认 5 分钟；可临时调 TTL=0 立即验证） |
| 12 | **退信追踪**（可选） | 向不存在的地址发测试信（如 no-such-user@gmail.com）→ 退信进入 service@ 收件箱（DM 时代无处落地） |

## 7. 应急与恢复（无备胎）

> 用户决策（2026-08-03）：**不保留 DM 备胎，不回滚**。切换完成后 DM 集成代码/注册/凭证/DNS 记录全部移除。

### 故障分级与恢复路径

| 故障 | 等级 | 恢复动作 | 恢复时间 |
|------|------|---------|---------|
| SMTP 凭证错误/瞬时失败（认证失败、连接超时） | 低 | 后台修正凭证 → 测试连接 → 10 分钟 cron 自动补发 24h 内 failed | 分钟级 |
| SMTP 持续故障（免费版被回收/账号封禁/域名验证失效） | 中 | **应急过渡**：临时启用 QQ 邮箱 SMTP（smtp.qq.com:465，需要授权码）作为过渡发信通道（env 注入或临时集成），随后修复企业邮箱 | 小时级 |
| 免费版长期不可用（决定放弃免费版） | 中 | 升级标准版（¥600/年，数据无缝迁移，仅升不降） | 数小时 |
| DM 恢复（仅作为最后手段，成本最高） | 高 | git 历史找回 DM 代码 → 重新配置 DM 域名验证记录（已被清理）→ 新建 AccessKey → 后台重新配置 | 2~4 小时 |

> 说明：DNS 切换后 DM 的 MX 已不可达，DM 退信收不到，但不影响 DM 发信（发信不依赖 MX）；DM 服务若未注销仍可重新绑定域名，但验证记录需全部重建。

## 8. 风险与注意事项

| 风险 | 等级 | 缓解 |
|------|------|------|
| **C 端静态文案遗漏**（privacy/terms 8 处代码 + 2 个 env 示例，含 API 侧默认值） | 中 | 4.6 节逐项核对（v1.11 全库复核后清单）；部署前检查 .env.prod；验证清单 #10/#11 兜底 |
| **改后台后 C 端显示旧值**（Data Cache TTL 生效延迟） | 低 | web 侧两级缓存：默认 5 分钟、上限 1 天；验证时临时调后台「官网生效速度」TTL=0 立即生效（v1.7 实证，v1.14 补入风险表） |
| **免费版海外投递为中国服务器直连** | 中 | 官方文档明示：海外邮件投递通道= 中国服务器直连，海外访客（Gmail/Outlook）收自动回复可能延迟/落垃圾箱；缓解：事务性邮件特征正常、验证清单 #8 用 Gmail 实测；**已决策：接受现状**（2026-08-03，不升级） |
| 生产部署先于配置导致通知中断 | **高** | 4.5 节顺序铁律：先生产后台配置/env 注入，再合并代码部署；窗口期由 cron 24h 内补发 |
| **一键添加解析覆盖 SPF** | 中 | 明确手动添加记录，禁用一键；添加后 dig 校验 SPF 合并值仍在 |
| 免费版 SMTP 发信能力受限 | 中 | 阶段 2 冒烟测试提前暴露；**已决策：不升级标准版**（2026-08-03）→ 启用第 7 章 QQ SMTP 过渡作为既定发信通道（企业邮箱保留收信）；冒烟测试通过则无影响 |
| **免费版无邮件归档/回收站** | 低 | 重要邮件定期导出备份（webmail/IMAP）；删信不可恢复需知悉 |
| **三方客户端默认禁用** | 低 | 域管开启「三方客户端登录管理」；每个账号用独立安全密码 |
| SMTP 发送挂起（无超时） | 低 | nodemailer 强制 connectionTimeout/socketTimeout；日志不打印密码 |
| 7 天内未完成 DNS 被回收 | 高 | 申请后立即配置解析（当天完成） |
| MX 切换后 DM 退信不可达 | 低 | DM 退役后无退信需求；MX 切换放到验证通过后 |
| **聊天离线通知遗漏切换**（chat-notification.service 独立使用 DM，方案初版遗漏） | **已消除** | 4.2.4 全库核实 DM 使用方 4 处，逐一同步切换；测试计划含新增单测（v1.12 修正，原无现成测试） |
| **DM 退役后无备用发信通道** | 低 | SMTP 为主通道；应急恢复路径见第 7 节（QQ SMTP 过渡或 git 恢复 DM） |
| **过渡期 DM 邮件被拒/进垃圾箱** | **已消除** | SPF 采用「先合并后清理」，过渡期 DM/SMTP 双通道均通过 SPF 校验；DKIM 选择器已实测不冲突 |
| 切换窗口通知 failed | 低 | 10 分钟 cron 自动重试补发（既有幂等机制） |
| 生产 ECS 25 端口封禁 | 低 | 465 为唯一可用端口（80/587 未开放），已硬编码 |
| 三方客户端安全密码泄露 | 中 | 与 AK 同级加密存储（AES-256-GCM）；可单独吊销 |
| 免费版 5G 容量不足 | 低 | 事务性邮件+定期清理；可升级 |
| 子用户无法操作 | 已识别 | 阶段 0 必须先登录主账号 |
| QQ 邮箱绑定历史（REDACTED-EMAIL） | 低 | 仅改站点设置字段，无数据迁移 |

## 9. 工作量评估

| 项目 | 工作量 |
|------|--------|
| 阿里云侧（申请/DNS/账号/SMTP） | 约 1 小时（浏览器操作） |
| 代码改造（SMTP 服务/注册/切换/模板 + 移除 DM 代码/注册/测试 + 新增单测×3 + 硬编码清理 8 处/env 示例 + SDK 卸载） | 约 0.75 人日 |
| 后台配置与端到端验收 | 约 1 小时 |
| 总计 | 约 1~1.5 人日（含等待解析生效时间） |

## 10. 决策点（待确认）

1. ✅ 目标方案：全部迁往企业邮箱（免费版）；**DM 彻底退役，不保留备胎**（已确认）
2. ✅ **免费版 SMTP 受限时不升级标准版**（已确认 2026-08-03）——受限则启用第 7 章 QQ SMTP 过渡作为既定发信通道，企业邮箱保留收信
3. 发件人账号固定为 service@tzjii.com，联系邮箱 contact@tzjii.com —— 是否确认？
4. ✅ **海外投递质量接受现状**（已确认 2026-08-03）——中国服务器直连，不升级；Gmail 实测结果用于评估，不再触发升级决策
5. 切换窗口（启 SMTP 的秒级窗口）由 cron 自动补发兜底，是否可接受？

---

## 附：评审修订记录

### v1.0 → v1.1（首次评审）

| 级别 | 发现 | 修订 |
|------|------|------|
| P0 | SPF「替换」导致过渡期 DM 邮件被拒，与可回滚目标矛盾 | SPF 改为「先合并后清理」；合并为唯一最先执行的 DNS 变更 |
| P1 | 实施顺序制造风险窗口 | 重排 6 阶段：SPF 合并先行 → 申请/账号与代码并行 → SMTP 与 DM 并存验证 → 最后 MX 切换+停用 DM |
| P2 | ECS 25 端口封禁未注明 | 明确 465/587；config 默认 465 |
| P2 | DKIM 冲突未核实 | 实测 `aliyun._domainkey.tzjii.com` 无记录，确认不冲突（以控制台为准） |
| P2 | 切换窗口 failed 无说明 | 注明 10 分钟 cron 自动补发兜底 |
| P3 | 「DM 记录暂留」表述不精确 | 区分可留（验证 TXT/DKIM）与不可留（SPF 被覆盖） |

### v1.1 → v1.2（终极评估）

| 级别 | 发现 | 修订 |
|------|------|------|
| P0 | **生产部署顺序**：CI 自动部署后若生产未配 aliyun-exmail，生产询盘通知停止 | 新增 4.5 节顺序铁律：先生产配置再合并代码；本地验证 ≠ 生产生效 |
| P1 | 「一键添加解析」会按模板覆盖 SPF | 明确手动添加记录、禁用一键；添加后 dig 校验 SPF 合并值 |
| P1 | 免费版 SMTP 能力留到后期才发现 | SMTP 冒烟测试提前到阶段 2（nodemailer/openssl 直连 465 发测试邮件） |
| P2 | SMTP 端口事实未查证 | 查证官方文档：80/587 未开放、25 被 ECS 封禁，**465 唯一可用**；smtpHost/Port 改为硬编码 |
| P2 | 阿里邮箱默认禁止三方客户端 | 域管开启「三方客户端登录管理」+ 每账号独立安全密码（阶段 2 新增步骤） |
| P2 | nodemailer 默认无超时可能挂起发送队列 | 强制 connectionTimeout/socketTimeout；错误日志不打印密码 |
| P2 | 免费版无邮件归档/回收站（删信不可恢复） | 运维基线：重要邮件定期导出备份 |
| P3 | 生产 465 连通性未纳入验证 | 阶段 5 增加 openssl 预检 |
| P3 | failed 无主动告警 | 列为后续可选（不阻塞本次迁移） |

### v1.2 → v1.3（深挖评估）

| 级别 | 发现 | 修订 |
|------|------|------|
| P1 | **免费版海外投递通道=中国服务器直连**（官方文档），海外访客收信质量受影响 | 风险表新增中风险行 + 决策点 6；验证清单 #8 用 Gmail 实测评估 |
| P2 | MX 参考值 `mxn.mxhichina.com` 为**旧版**阿里邮箱值 | 修正为官方当前值 `mx1/mx2/mx3.qiye.aliyun.com`（5/10/15）三条 |
| P2 | DKIM 选择器 `aliyun._domainkey` 为推测值 | 官方选择器为 **`default._domainkey`**，实测无记录，与 DM 零冲突 |
| P3 | DMARC 现状未核查 | 实测已有 `p=none`（DM 生成）；明确切换期保持 p=none 不动，可选改 rua 到 contact@ |
| P3 | 方案缺测试计划 | 新增 4.2.6：ExmailSmtpService 单测（含密码不泄日志断言）+ notification 回归 + verify 探活可读错误 |
| P3 | 免费版边界未完全核实 | 补充：仅可升级标准版-无限容量；注销清空数据；单账号限 1 个免费版；不支持账号别名/归档/回收站 |

### v1.3 → v1.4（代码级评估）

| 级别 | 发现 | 修订 |
|------|------|------|
| P1 | **「C 端无代码变更」声明被证伪**：privacy/terms 三语 6 处硬编码邮箱（i18n 静态文案），后台设置无法覆盖 | 新增 4.6 节 C 端静态文案更新清单（6 处 json + fallback 值） |
| P1 | **NEXT_PUBLIC_CONTACT_EMAIL env 覆盖后台设置**（site-settings.ts 为 env 优先）且为构建时内联变量 | 4.6 注明：部署前检查生产 .env.prod，有则改值并重建 web 镜像 |
| P3 | 「C 端即时生效」未实证 | 已核实 getSitePublicSettings 每次直查 DB **无缓存**，后台改后立即生效（4.3 表修正） |
| P3 | 章节编号缺失 4.4 | 重排 4.4 生产部署顺序 / 4.5 数据兼容 / 4.6 静态文案 |
| P3 | isActive/tester 接线未实证 | 已核实：isActive=启用+凭证齐全（配置不全自动不生效）；tester 为 async 注册制，verify() 探活接线成立 |

### v1.4 → v1.5（决策点变更：取消 DM 备胎）

| 级别 | 变更 | 修订 |
|------|------|------|
| 决策 | **取消 DM 备胎**（用户决策），DM 彻底退役、不考虑回滚 | 目标第 5 条改为 DM 彻底退役；3 章目标架构删备胎表述；4.2.4 改为删除 DM 代码/注册/测试；DNS 表改为验收后确定清理 |
| 决策 | 原决策点 4（是否清理 DM 记录）/ 6（海外投递）重排 | 决策点精简为 5 条；清理 DM 记录不再询问 |
| 结构 | 回滚方案失去基础 | 第 7 章重写为「应急与恢复（无备胎）」：故障分级（凭证/持续故障/免费版不可用/DM 恢复）与恢复路径 |
| 安全 | DM AccessKey 退役处置未明确 | 阶段 6 新增：删除后台集成记录 + 禁用/删除 DM AccessKey + 控制台删除发信地址 |
| 工作量 | DM 移除增加改造面 | 代码改造 0.5 → 0.75 人日 |

### v1.5 → v1.6（第五轮：DM 使用方全量核查）

| 级别 | 发现 | 修订 |
|------|------|------|
| P1 | **chat-notification.service.ts 独立使用 DM 发信**（聊天离线留言提醒），方案只覆盖 notification.service——DM 退役后聊天通知静默失效 | 4.2.4 改为「DM 全部使用方 4 处」清单，chat-notification 注入同步切换；测试计划加回归 |
| P2 | health.service.ts `checkEmail()` 硬编码 slug `aliyun-directmail`，DM 退役后邮件探活永远 skipped | 阶段 3 注入切换包含 health（slug 改 aliyun-exmail） |
| P3 | registry 的 INTEGRATION_ENV_FALLBACK 中 ALIYUN_DM_* 键未在退役清单 | 4.2.4 退役清单补全 env fallback 键 |

### v1.6 → v1.7（第六轮：C 端缓存策略验证）

| 级别 | 发现 | 修订 |
|------|------|------|
| P2 | **「C 端即时生效」声明不准确**：web 侧有 Next Data Cache（site-settings.ts 两级缓存：TTL 元数据 60s + 内容按后台 TTL 缓存，默认 300s，可配 0~86400s），生产改后台后最长 TTL 才生效；dev 禁用缓存与生产不同 | 4.3 表 / 4.5 数据兼容 / 验证清单 #11 修正为「按 TTL 生效（默认 5 分钟，可调 0=即时）」；验证时临时调 TTL=0 |
| P3 | DM 控制台 SPF 合并后验证状态未说明 | 4.1.2 附注：SPF 合并后 DM 控制台 SPF 项可能显示不匹配，预期现象不影响发信，可忽略 |
| P3 | admin 无按 tag 主动失效入口已核实 | 无 revalidateTag('site-settings') 调用，只能靠 TTL 或调 TTL=0——写入 4.3 表说明 |

### v1.7 → v1.8（第七轮：调用点与凭证核查）

| 级别 | 发现 | 修订 |
|------|------|------|
| 实证 | **notification.service 全文验证通过**：sendMail 仅 1 处（sendEmailJob）、isAvailable 2 处（handleContactCreated/retryFailedNotifications），方案「三处引用」表述准确；幂等/重试/24h 窗口与方案一致 | 无需修订 |
| 实证 | **DM AK 无共用**：DB 核查其他集成（baidu-ocpc=token、lingxi-llm=apiKey）非阿里云 AK；scripts/docs/infra/packages 无 DM 引用，退役范围无遗漏 | 无需修订 |
| P3 | AK 退役策略需细化 | 4.2.4 + 阶段 6：RAM 控制台确认 AK 仅用于 DM → 先禁用观察 7 天 → 再删除 |
| 信息 | 顺带发现 aliyun-captcha/amap 未配置（DB 无记录、env 无变量），联系表单当前无验证码 | 记录在案，与本次迁移无关，不阻塞 |

### v1.8 → v1.9（第八轮：开通前置与测试器核查）

| 级别 | 发现 | 修订 |
|------|------|------|
| 实证 | 开通前置已覆盖：主账号实名已认证（2.5）+ 域名验证 TXT（4.1.1）+ 阶段 2 步骤 4，无缺口 | 无需修订 |
| 实证 | INTEGRATION_TESTERS 共 5 个 tester（amap/aliyun-captcha/aliyun-directmail/lingxi-llm/baidu-ocpc），DM 条目退役清单已含 | 无需修订 |
| 实证 | registry DM 条目 secrets×2+config×3，退役清单 ALIYUN_DM_* 通配符覆盖全部 5 个 env fallback 键 | 无需修订 |
| 实证 | 4.2.3 tester 实现已写明 nodemailer verify() 真实探活（比 DM 凭证齐全式更真实），阶段 3 步骤 11 与验证清单 #1 已对应 | 无需修订 |

### v1.9 → v1.10（第九轮：发件账号与退信链路核查）

| 级别 | 发现 | 修订 |
|------|------|------|
| 实证 | 发件账号已明确：service@ 发件（可回复）、contact@ 对外（3 章架构图/4.1.3/4.2.2/决策点 3），模板 mailto 指向 contact@，两账号均建，自洽 | 无需修订 |
| P3 | 现状问题表缺「退信丢失」：DM 时代硬退信无处落地；SMTP 时代退信进 service@ 收件箱可追踪 | 1 章问题表补「退信丢失」行；验证清单补 #12 退信追踪（可选） |
| P3 | MX 与开通流程关系未注明：若阿里强制 MX 先行会卡住执行 | 4.1.1 注明：MX 先行对 DM 零影响（发信不依赖 MX、退信本就不可达），不改变「SMTP 验证通过后才停 DM」顺序 |

### v1.10 → v1.11（第十轮：硬编码邮箱全库复核）

| 级别 | 发现 | 修订 |
|------|------|------|
| P2 | **v1.4 清单遗漏 2 处**：全库 grep 复核实为 8 处代码（新增 `settings/settings.defaults.ts:91` API 侧兜底默认值 + 根目录 `.env.example:62`），v1.4 只列了 6 处 + apps/web/.env.example | 4.6 表格补 2 行；均标注为代码一致性更新（生产 DB 已配置不受影响） |
| 实证 | 邮件模板 contact.templates.ts 无硬编码邮箱（仅注释示例热线），已动态化，无遗漏 | 无需修订 |
| 实证 | 其余 15 处均为 v1.4 已覆盖项或方案文档自身表述 | 无需修订 |

### v1.11 → v1.12（第十一轮：测试依赖与文档引用复核）

| 级别 | 发现 | 修订 |
|------|------|------|
| 实证 | 全库 AliyunDmService 引用 6 处（4 使用方 + 文件自身 + module），**0 处 spec 引用**——删除 DM 不破坏测试编译；health 用 slug 字符串非类引用（v1.6 已覆盖） | 无需修订 |
| P3 | 4.2.7「回归」表述不准确：notifications/chat-notification/integrations/health 均无现成 spec（已核实，support 的 7 个 spec 均为 chat gateway/room） | 改为「新增单测」并注明已核实无现成测试；chat-notification 去抖逻辑顺带补测 |
| P3 | docs/security/account-recovery-design-fix.md §2 引用 AliyunDmService 作邮件基建（功能标注非目标未实现） | 退役清单补「文档一致性」：该文档加注邮件基建已切换、描述过时 |

### v1.12 → v1.13（第十二轮：依赖治理核查）

| 级别 | 发现 | 修订 |
|------|------|------|
| P3 | **@alicloud/dm20151123 SDK 未列入退役清单**：阶段 3 只写安装 nodemailer，无卸载 DM SDK（已核实 apps/api/package.json:41，^1.10.2，仅 aliyun-dm.service.ts 引用） | 阶段 3 步骤 9 补卸载命令（pnpm remove，同步 lockfile） |
| 实证 | @tzj/config 无 ALIYUN_DM_* 校验条目，env 键清理只需删 registry（无 schema 残留） | 无需修订 |
| P3 | 生产 .env.prod 的 ALIYUN_DM_* 残留变量未提 | 阶段 6 步骤 26 补：顺手清理（registry 删除后不再读取，无害）；DM 发信域名一并删除 |

### v1.13 → v1.14（第十三轮：收件人配置与表述核查）

| 级别 | 发现 | 修订 |
|------|------|------|
| 实证 | chat-notification 收件人复用站点设置 notifyEmails（与询盘通知共用），无硬编码；切换邮件服务不影响收件人配置 | 无需修订 |
| P3 | 根 `.env.example:37-41` 有 ALIYUN_DM_* 5 键（v1.8 只查了实际 .env，示例文件遗漏） | 退役清单补「示例文件清理」：改为 ALIYUN_EXMAIL_* 示例 |
| P3 | 验证清单 #2 / 阶段 4 步骤 18「DM 与 SMTP 并存」表述误导：代码切换后仅 SMTP 发信，不存在双通道并存 | 修正为「阶段 1 DM 验证 SPF 合并零影响 + 阶段 3 后 SMTP 验证新通道」 |
| 记录 | chat-notification html 模板中 clientEmail 未转义直接插入（既有 XSS 小风险，与迁移无关） | 记录在案，不阻塞；切换时可顺带 HTML 转义 |

### v1.14 → v1.15（第十四轮：文档内部一致性核查）

| 级别 | 发现 | 修订 |
|------|------|------|
| P3 | 风险表「C 端静态文案遗漏」仍写 6 处（v1.11 已核实 8 处代码 + 2 env 示例） | 更新为 8 处 + 2 env 示例 |
| P3 | 风险表「聊天离线通知」缓解栏仍写「测试计划含回归」（v1.12 已改新增单测） | 同步修正 |
| P3 | **v1.7 的 P2（Data Cache TTL 生效延迟）未入风险表**——验收时改后台后显示旧值易误判为未生效 | 新增风险行：按 TTL 等待或调 TTL=0 |
| P3 | 工作量表代码改造描述未含新增单测×3、硬编码 8 处清理、SDK 卸载 | 描述补全（工作量仍 0.75 人日） |

### v1.15 → v1.16（第十五轮：isActive 机制实证）

| 级别 | 发现 | 修订 |
|------|------|------|
| 实证 | isActive 完整实现（integrations.service.ts:77-95）：DB enabled=false 拦截 → required secret/config 逐字段校验 → 末尾要求至少一个 required 字段；半配置状态（缺密码）→ false → 通知跳过不产生 failed，安全 | 无需修订 |
| P3 | **required 硬约束未写明**：若 registry 无 required 字段，isActive 永远 false 且无报错（最容易被执行者漏掉导致集成静默失效） | 4.2.2 补⚠️：smtpPassword/accountName 必须标 required |
| 实证 | resolveSecret 先 DB 后 env 兜底、无 DB 记录但 env 配置视为开启，与方案 4.2.2 一致 | 无需修订 |

### v1.16 → v1.17（第十六轮：env 兜底键名核查）

| 级别 | 发现 | 修订 |
|------|------|------|
| P3 | 4.2.2 env 兜底只写「ALIYUN_EXMAIL_*」通配，具体键名未列全——执行者配置生产 env 兜底注入时需知悉确切键名（registry 的 env fallback 键名与字段 key 对应关系未明示） | 补全 3 个键名：ALIYUN_EXMAIL_SMTP_PASSWORD / ACCOUNT_NAME / FROM_ALIAS（与 DM 命名模式一致） |
| 实证 | 键名与 DM 模式（secrets→ACCESS_KEY_ID 式 / config→ACCOUNT_NAME 式）自洽 | 无需修订 |

### v1.17 → v1.18（第十七轮：全量测试面与文档面终检）

| 级别 | 发现 | 修订 |
|------|------|------|
| 实证 | docs/ 与根文档中文关键词「邮件推送/directmail/dm.console」0 处引用（除方案自身）——文档面无其他 DM 描述 | 无需修订 |
| 实证 | apps/api 无 test/ e2e 目录；16 个 spec 全量清单（roles/analytics/auth/media×4/support×7/trade-shows/users）无任何邮件相关——4.2.7「新增单测」表述正确 | 无需修订 |
| 结论 | **评估已达完备边界**：连续两轮纯实证零修订；所有关键声明均有代码/DB/DNS/文档实证背书 | 不再追加新发现；待决策点确认后开工 |

### v1.18 → v1.19（第十八轮：DNS 基线再实证）

| 级别 | 发现 | 修订 |
|------|------|------|
| 实证 | **DNS 五项现状与方案 2.4 完全一致**（2026-08-03 再 dig）：MX=5 mx01.dm.aliyun.com、SPF=单 include:spf1.dm.aliyun.com（未合并）、DMARC=p=none（_dmarc 子域）、aliyun/default._domainkey 均无记录——阶段 1 基线正确，未发生外部变更 | 无需修订 |
| P3 | 解析服务商未写明（决定阶段 1 操作入口） | 4.1.2 补：NS=dns1/dns2.hichina.com（阿里云万网），入口为阿里云云解析控制台 |
| 状态 | 浏览器当前无阿里云登录页（仅 admin 文档页）——主账号登录未完成 | 待用户重新打开登录页并登录后推进阶段 2；阶段 1（SPF 合并）不依赖登录，可先行 |

### v1.20 → v1.21（阶段 1 已执行：SPF 合并完成）

| 项目 | 结果 |
|------|------|
| 执行时间 | 2026-08-04 15:56（主账号登录后，云解析控制台手动修改） |
| 修改内容 | `@` TXT SPF 单 include → 合并值 `v=spf1 include:spf1.dm.aliyun.com include:spf.qiye.aliyun.com -all`（TTL 保持 10 分钟） |
| dig 校验 | 权威（dns1.hichina.com）/ 公共（223.5.5.5）/ 本地 三层全部返回合并值 |
| 实证修正 | v1.18 称「aliyun/default._domainkey 均无记录」——实际 DM 的 DKIM 主机名为 **`aliyun-cn-hangzhou._domainkey`**（dig 名称错误导致漏检；已确认存在，创建于 2026-08-03 19:57）；`default._domainkey` 仍无记录，与 DM 零冲突结论不变 |
| 后续 | 阶段 1 完成，对 DM 发信零影响（spf1.dm.aliyun.com include 保留）；下一步阶段 2：申请企业邮箱免费版 |

### v1.22 → v1.23（阶段 5 本地部分执行：MX 清理 + SPF 修复验证 + DKIM 配置完成）

| 项目 | 结果 |
|------|------|
| 执行 | **DM 旧 MX 清理**：云解析删除 `5 mx01.dm.aliyun.com`（与 `5 mx1.qiye.aliyun.com` 优先级冲突），记录 13→12；dig 确认 MX 仅剩 mx1/mx2/mx3.qiye.aliyun.com (5/10/15) | 完成 |
| 执行 | **QQ 退信排查**：收件箱收到 QQ 退信 `550 SPF check failed`（17:50 发往 REDACTED-EMAIL）——展开 SPF 链确认发信 IP 115.124.28.225 ∈ b.hichina.mail.aliyun.com 的 115.124.28.0/24，SPF 链完整，判定为 QQ DNS 缓存旧值（SPF 15:56 修改、退信 17:50） | 完成 |
| 执行 | **SPF 修复验证**：重发 `[SPF 修复验证]` 邮件（18:14，服务端无退信返回）→ 用户确认 QQ/Gmail 均收到 → SPF 修复验证通过 | 完成 |
| 执行 | **本地停用 aliyun-directmail**（integrations.enabled: true→false）；本地 API health email=up（代码已切 exmail） | 完成 |
| 执行 | **DKIM 配置完成**：postmaster@ 登录域管后台（qiye.aliyun.com/admin，入口即企业邮箱登录页）→ 企业定制→域名管理→域名设置→查看详情 → 获取 2048 位公钥 `v=DKIM1; k=rsa; p=...IDAQAB;` → 云解析**手动添加** `default._domainkey` TXT（未动 SPF）→ dig 权威/公共 DNS 均生效 → 域管后台 DKIM 验证状态「通过」→ 切换功能页触发服务端加签 → **mail-tester 10/10「发件人身份已验证」**（DKIM+SPF 端到端通过） | 完成 |
| 执行 | **生产服务器 465 预检**：openssl s_client 连 smtp.qiye.aliyun.com:465 成功，TLS 证书 CN=mail.aliyun.com 有效（至 2026-08-31） | 完成 |
| 发现 | 生产环境核查：integrations 表**无 aliyun-directmail 记录**（仅 baidu-ocpc/lingxi-llm）；`.env.prod` 无 ALIYUN_EXMAIL_*/ALIYUN_DM_*；容器 dist 仍为 DM 代码（aliyun-dm.service.js 在、env.validation.js 无 EXMAIL 键）→ 生产邮件集成实际处于空转状态（isActive=false，通知静默跳过） | 待阶段 5 步骤 19 |
| 发现 | 阶段 3 代码改造（env.validation/health/registry/notification 等 17 文件）**仍在本地工作区未提交**——生产部署前置条件 | 待用户确认提交推送 |
| 后续 | 阶段 5 剩余：提交推送代码→CI 部署→生产 .env.prod 补 ALIYUN_EXMAIL_* 三键→重启 api→health 验证→生产测试询盘→停用 DM（无记录则跳过）；阶段 6：直接回复/contact@ 收信验收、DM 控制台与 AK 清理、SPF 去 DM include、运维基线 | 待办 |

### v1.21 → v1.22（阶段 2/4 部分执行 + env 校验缺口修复）

| 级别 | 发现/结果 | 处理 |
|------|----------|------|
| 执行 | **阶段 2 已由用户完成**：企业邮箱免费版已申请，MX 已切换为 `mx1/mx2/mx3.qiye.aliyun.com`（dig 实证）；service@ 账号、三方客户端安全密码均可用（SMTP 冒烟测试通过，Message ID 正常返回） | 无 |
| P0 | **env.validation.ts zod 白名单缺口**：ConfigModule `validate` 返回值是 ConfigService 唯一数据源，`envSchema` 缺少 `ALIYUN_EXMAIL_SMTP_PASSWORD / ACCOUNT_NAME / FROM_ALIAS` 三键 → .env 已配置但运行时读不到 → `isActive(aliyun-exmail)=false` → 邮件探活 skipped、询盘通知静默跳过（health 显示 skipped 为症状）——方案 4.2.2 只写了 registry env 兜底，遗漏校验层同步 | 已修复：env.validation.ts 补 3 个 optional 键，重建 dist 并重启 API，health email 由 skipped → **up** |
| 执行 | 站点联系邮箱 `site.public.contact.email`：`REDACTED-EMAIL` → `contact@tzjii.com`（SQL jsonb_set） | 完成 |
| 执行 | 测试询盘（阶段 4 步骤 18）提交成功：staff-notify ×2（admin@example.com / REDACTED-EMAIL）+ auto-reply ×1（visitor-test@example.com）**全部 sent**，链路：询盘 → NotificationService → ExmailSmtpService → 企业邮箱 SMTP | 完成 |
| 实证 | `default._domainkey.tzjii.com` 无记录（10 种常见选择器全部无记录）——企业邮箱 DKIM 疑似未添加或选择器不同，待云解析控制台确认 | 待办 |
| 实证 | MX 记录存在**优先级冲突**：`5 mx01.dm.aliyun.com`（DM 旧值）与 `5 mx1.qiye.aliyun.com` 同为优先级 5 | 阶段 5 清理 DM 旧 MX |
| 后续 | 阶段 4 本地完成；下一步：阶段 5（云解析删 DM 旧 MX → 本地/生产停用 aliyun-directmail → dig 校验）、阶段 6（收件箱验收/直接回复/退信追踪；auto-reply 发给不存在的 visitor-test@example.com 预期产生退信进入 service@ 收件箱，正好验证退信落地） | 待办 |


### v1.19 → v1.20（决策点确认）

| 决策 | 结论 | 修订 |
|------|------|------|
| 决策点 2 | **不接受升级标准版**（¥600/年）——SMTP 若受限，启用第 7 章 QQ SMTP 过渡作为既定发信通道，企业邮箱保留收信 | 4.1.1 风险备注、8 章风险表、10 章决策点表同步更新 |
| 决策点 4 | **接受海外投递现状**（中国服务器直连，不升级）；Gmail 实测仅用于评估 | 10 章决策点表标记 ✅；8 章风险表缓解更新 |
| 剩余 | 决策点 3（发件人账号 service@/contact@）与 5（切换窗口 cron 兜底）仍待确认 | 不阻塞阶段 1/2 开工 |
