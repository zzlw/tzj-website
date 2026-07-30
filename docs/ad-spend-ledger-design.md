# 广告花费台账设计方案（分平台分时段录入 → 百度营销 API 自动同步）

> 状态：待评审（三评收敛，可开工）· 2026-07-30
> 关联：`docs/baidu-sem-migration-guide.md`（P1-1 OCPC 回传）、`docs/lingxi-ai-report-design.md` §13（百度侧闭环数据）

---

## 1. 背景与问题

转化看板（`/growth/conversions`）的「录入广告花费」目前是 **Phase1 全局单值**：

- 存储：Setting KV `growth.adSpend`（`growth-metrics.service.ts`），一个数字，改一次覆盖一次；
- 计算：`询盘成本 = 全局花费 ÷ 所选区间内广告询盘数`。

两个实际痛点（用户主要投百度，实测确认）：

1. **口径错配**：看板日期选「近 7 天」时，分母（广告询盘）是区间值、分子（花费）是不知何时录入的累计值，算出的询盘成本无参考价值。灵犀（AI 投放报告）在 M2 实测中正因数据纪律**拒绝**用这条全期 ¥5000 计算期间 CPL——看板自己却在硬算，两处口径互相矛盾。
2. **无渠道归属**：百度搜索、微信朋友圈等多平台花费混在一个数字里，无法回答「百度的询盘成本划算吗」。

## 2. 目标与非目标

**目标（本期 = 升级 1）**

- 花费从「全局单值」升级为**台账**：一条记录 = 某平台在某日期区间的一笔投放金额；
- 看板与灵犀按**查询区间聚合真实花费**，询盘成本分子分母口径对齐；
- 表结构直接兼容升级 2（百度营销 API 分日自动同步），届时零迁移。

**非目标（本期不做）**

- ❌ 百度营销 API 对接（依赖开发者资质审核，见 §9 演进预留）；
- ❌ 分计划/分单元/分关键词粒度（平台级足够，映射站内 `utm_campaign` 属 API 阶段议题）；
- ❌ 新增权限点（复用 `analytics.view` 读 / `settings.manage` 写，与现状一致）。

## 3. 数据模型

新增 Prisma model（`apps/api/prisma/schema.prisma`，走 `prisma migrate dev` 产出迁移文件）：

```prisma
// ═══════════════════════════════════════════
// 广告花费台账（分平台分时段；手工录入 + 未来 API 同步共用）
// ═══════════════════════════════════════════
model AdSpendRecord {
  id          String   @id @default(cuid())
  // 平台标识：baidu / google / wechat / other（应用层常量约束，不用 DB enum 便于扩平台）
  platform    String
  // 记账区间（日历日，无时区语义，含首尾；运算口径见设计决策「时间口径」）；单日记录 periodStart == periodEnd
  periodStart DateTime @db.Date
  periodEnd   DateTime @db.Date
  // 金额（元，两位小数）
  spend       Decimal  @db.Decimal(12, 2)
  // 来源：manual（手工）/ baidu_api（升级 2 预留）
  source      String   @default("manual")
  note        String?
  createdBy   String? // 操作人 userId（API 同步为 null）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([platform, periodStart])
  @@index([periodStart, periodEnd])
  @@map("ad_spend_records")
}
```

**设计决策**

| 决策 | 选择 | 理由 |
|---|---|---|
| 记账粒度 | 任意日期区间（非强制分日/分月） | 手工录入自然（一条记录 = 一次账单/一个月消费）；API 同步落单日记录，同一张表 |
| 平台字段 | String + 应用层常量 | 加平台不必迁移；常量定义见 §6 types |
| 金额类型 | `Decimal(12,2)` | 账目数据不用浮点；服务层出入口转 number（保留两位）返回前端 |
| 重叠校验 | **同 platform + 同 source** 区间相交 → 409 拒绝 | 防重复记账；纯应用层校验（已知限制：并发写入有竞态，单管理员低频场景可接受；如需根治用 Postgres `EXCLUDE USING gist` + daterange）。交互预期：录了整月后想修正某天只能编辑原记录，不能另补单日记录 |
| 时间口径 | 区间与天数运算**统一在 `YYYY-MM-DD` 字符串（UTC 日）层面**进行 | `@db.Date` 存 UTC 零点而现有 `parseRange` 是本地时区整日，直接比较 Date 对象必现 ±1 天误差；服务层提供 `toYmd` 归一化后再算重叠 |
| 删除策略 | 硬删（无 `deletedAt`） | 有 `settings.manage` 门槛；全局 `AuditInterceptor` 会记录写操作（谁/何时/resourceId）。本期将 `analytics` 加入 `DETAIL_RESOURCES` 白名单，但其能力有限：detail 仅记 `changedFields` 字段名不含值，DELETE 无 body 无 detail——**删除的金额无法事后追溯**，作为已知限制接受（v1 不做 service 层手写审计）。副作用已排除：`collect/identify` 为匿名端点，拦截器只记已登录用户，访客打点不会因白名单被记录 |
| 旧 KV 迁移 | **不自动迁移** | 旧值无时间归属，机器迁移必错口径。上线后 KV 停止参与计算；生产那条累计值由运营手工转录成带区间的记录。开发库数据不重要（可 reset） |

## 4. 聚合口径（核心算法）

服务层新增 `sumAdSpend(range): Promise<{ byPlatform: Array<{ platform, spend }>; total: number }>`：

1. 查询与 `range` **相交**的全部记录：`periodStart <= range.to AND periodEnd >= range.from`；
2. 每条记录按**天数比例分摊**进查询区间：
   `贡献 = spend × (重叠天数 ÷ 记录总天数)`（整日粒度，两端含；天数运算在 `YYYY-MM-DD` 归一化后进行，见 §3 时间口径决策）；
3. **v1 聚合不做 source 去重**（本期只有 manual，重叠已被 409 挡住）。manual 与 baidu_api 跨 source 重叠的去重规则（API 优先、manual 扣除重叠天数后按剩余分摊）实现复杂度不低，**留待升级 2 开工前单独评审**，不在本期预埋半成品逻辑；
4. 按平台汇总后 `round2`，总计为各平台之和。

**分摊是近似**：跨区间查询时（如录了整月、查某一周）按均匀日花费假设分摊。这是手工月度记账下能做到的最优口径，且远优于现状的「全期累计 ÷ 期间询盘」；分日精确值靠升级 2 的 API 同步解决。报告与工具输出中必须声明该近似（看板 hint 见 §7，灵犀见 §8）。

## 5. API 设计（apps/api）

挂在现有 `AnalyticsController`（`/api/v1/analytics`）下，实现放 `GrowthMetricsService`（或拆 `AdSpendService`，若超 200 行则拆）：

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/analytics/ad-spend?from&to` | `analytics.view` | 返回 `{ items, byPlatform, total }`：区间相交的记录列表（按 periodStart 倒序）+ §4 聚合结果；`from/to` 缺省时后端默认**近 365 天**（与前端默认一致） |
| POST | `/analytics/ad-spend` | `settings.manage` | 新增记录；DTO 校验（见下）；重叠冲突 409（错误信息含冲突记录的平台与区间） |
| PUT | `/analytics/ad-spend/:id` | `settings.manage` | 编辑（platform/区间/金额/备注）；同样做重叠校验（排除自身） |
| DELETE | `/analytics/ad-spend/:id` | `settings.manage` | 硬删 |

**DTO 校验**（class-validator，与现有 `UpdateGrowthSettingsDto` 风格一致）：

- `platform`：`@IsIn(AD_PLATFORMS)`（baidu/google/wechat/other）；
- `periodStart` / `periodEnd`：`YYYY-MM-DD`，`periodEnd >= periodStart`，且 `periodEnd` 不得晚于今天（不允许预录未来花费）。「今天」按**服务器本地日期**判定（与现有 `parseRange` 一致），若用 UTC 会在每日 0–8 点（东八区）误拒录入昨日记录；
- `spend`：`>= 0`，最多两位小数，上限 `9_999_999.99`；
- `note`：可选，`@MaxLength(200)`。

创建时 `createdBy` 取 `req.user.id`（升级 2 的 API 同步写 `null`）。

**响应双口径说明**：GET 的 `items` 是原始记录金额（可能含查询区间外部分），`byPlatform/total` 是分摊后聚合值，两者之和**不一定相等**——管理对话框只展示原始记录列表（不显示聚合合计），聚合值仅供看板与灵犀使用，避免被当成对不上账的 bug。

**联动修改**

- `getConversionMetrics`：第 4 步改为 `const { total } = await this.sumAdSpend(range)`，`adSpend` 返回区间聚合值，`inquiryCost = total / adInquiries`——口径错配就此消除；响应新增 `adSpendByPlatform` 字段（前端与灵犀共用）；
- 台账任何写操作后 `this.cache.clear()`（沿用现有 T+1 缓存失效策略）；
- 审计：`audit.interceptor.ts` 的 `DETAIL_RESOURCES` 白名单加入 `analytics`（能力与局限见 §3 删除策略决策）；
- **下线旧端点**：`GET/PUT /analytics/growth-settings` 删除，`AD_SPEND_SETTING_KEY` 常量与读写方法删除（KV 行留在库里不再读取）；`UpdateGrowthSettingsDto` 删除。

## 6. 共享类型（packages/types，需 A1 审批——均为新增）

`packages/types/src/entities/ad-spend.ts`（**type-only**，遵循 entities 层惯例，admin 可安全 `import type`）：

```ts
export type AdPlatform = 'baidu' | 'google' | 'wechat' | 'other';
export type AdSpendSource = 'manual' | 'baidu_api';

export interface AdSpendRecord {
  id: string;
  platform: AdPlatform;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  spend: number; // 元
  source: AdSpendSource;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdSpendSummary {
  byPlatform: Array<{ platform: AdPlatform; spend: number }>;
  total: number;
}
```

**值常量归位**：`AD_PLATFORMS` 数组放 `packages/types/src/dto/ad-spend.ts`（dto 层允许值导出，API 的 `@IsIn` 校验引用）；admin 侧**不导入该常量**，自定义带中文名的 UI 常量（`baidu → 百度` 等），维持 admin 对 types 的 type-only 边界。

## 7. 前端设计（apps/admin）

**转化看板改造**（`growth/conversions/page.tsx`）

- 「录入广告花费」按钮 → 「管理广告花费」，打开 **AdSpendManagerDialog**（替换现有 `AdSpendDialog`，旧组件删除）；
- 询盘成本卡 hint：`区间内录入花费 ÷ 广告询盘`；广告转化率卡 hint 的花费显示区间聚合值；
- 「付费渠道」区块下新增一行分平台花费小字（有数据时显示，如 `百度 ¥3,200 · 微信 ¥800`，来自 `adSpendByPlatform`）。

**AdSpendManagerDialog**（`components/growth/AdSpendManagerDialog.tsx`）

- 上半部：记录列表（平台徽标 + 区间 + 金额 + 来源 + 备注 + 编辑/删除），默认加载最近 12 个月（`from = 今天 - 365d`）；删除走 `ConfirmDialog`（`confirmLabel="删除"`）；
- 下半部：新增/编辑表单——平台 Select（百度/Google/微信/其他）+ `DateRangePicker` + 金额 Input + 备注；提交后 `invalidateQueries(['growth'])` 让看板即时重算；
- 409 重叠冲突用 `notifyError` 展示后端返回的冲突详情；
- 快捷入口：表单提供「整月」快捷选择（选月份自动填首末日），照顾按月记账的主流习惯。

**features/growth.ts**：删除 `useGrowthSettings` / `useUpdateGrowthSettings`（及 `GrowthSettings` 接口），新增 `useAdSpendRecords(params)` / `useCreateAdSpend` / `useUpdateAdSpend` / `useDeleteAdSpend`（react-query 惯例同现有 hooks）；本地 `ConversionMetrics` 接口（非 @tzj/types）新增 `adSpendByPlatform` 字段。

## 8. 灵犀工具升级（apps/api/src/lingxi）

- `get_ad_spend` 定义改为接受 `RANGE_PROPS`，描述更新：
  `「所选期间分平台广告花费（台账按天分摊聚合，跨区间记录为均匀分摊近似）」`；
- 返回 `{ byPlatform, total, note: '含分摊近似说明' }`，`summary` 形如 `期间广告花费 ¥4,000（百度 ¥3,200 / 微信 ¥800）`；
- `get_conversion_metrics` 工具无需改入参，但其 `adSpend`/`inquiryCost` 会随服务层自动变为区间口径——工具描述补一句「花费为期间台账分摊值」，`data` 透传新增的 `adSpendByPlatform`；
- `prompts.ts` 数据纪律相应调整：**期间花费可用于计算期间 CPL/ROI**，但输出需注明「花费为台账分摊口径」；无台账记录时明确说「该期间未录入广告花费」，禁止沿用旧的全期累计话术；
- dataRef 溯源卡片自动携带（工具结果统一管道，无需改前端）。

**行为变更提示**：M2 验收过的「拒绝用全期花费硬算期间 CPL」行为将**反转**为「用分摊花费实算并声明口径」，属预期内升级，需在 §10 步骤 4 做回归确认。

## 9. 升级 2 预留：百度营销 API 自动同步（本期不实现）

前置：dev2.baidu.com 开发者资质审核通过 + 投放账户授权（运营侧并行推进）；建议先落地 `baidu-sem-migration-guide.md` P1-1（OCPC 回传），否则百度侧报告无转化数据。

- 新增 `BaiduMarketingModule`：每日 Cron 拉取**前日分日账户消费**，写 `AdSpendRecord`（`platform='baidu', source='baidu_api', periodStart=periodEnd=当日`）；幂等：同日重跑先删后插；
- 凭证（API Key/Token）走后台集成中心（同 LLM Key 模式），不进 env；
- 开工前先评审**跨 source 去重规则**（见 §4 第 3 条：建议方向为 API 优先、manual 扣除重叠天数后按剩余分摊），确保切换期 manual 月度记录与 API 分日记录并存不双算；
- **只接报告只读接口**，不接投放管理类接口（改价/暂停），与灵犀「工具全只读」纪律一致。

## 10. 实施清单与里程碑

| 步骤 | 内容 | 验收 |
|---|---|---|
| 1 后端 | Prisma model + `migrate dev` 迁移、CRUD 端点 + DTO + 重叠校验、`sumAdSpend` 聚合、conversion-metrics 接入、审计白名单加 `analytics`、旧端点/KV 逻辑下线 | Swagger 可见 4 端点；重叠 409；`check-permissions.mjs` 通过；询盘成本随区间变化 |
| 1b 单测 | `sumAdSpend` 分摊算法 jest 单测（仓内已有 `.spec.ts` 惯例）：区间完全包含/部分重叠/仅相切一天/不相交、单日记录、跨月含闰月、多平台汇总、`YYYY-MM-DD` 归一化（验 ±1 天陷阱）、重叠校验命中/擦边 | `pnpm --filter @tzj/api test` 通过（注：CI 不跑 jest，属本地验证项） |
| 2 类型 | `@tzj/types` 新增 entity/DTO 导出 | 全仓 typecheck 通过 |
| 3 前端 | AdSpendManagerDialog、看板卡片口径更新、features hooks 替换 | 录一条百度月度记录 → 看板选该月，询盘成本 = 该记录 ÷ 当月广告询盘；选无记录区间显示 ¥0 |
| 4 灵犀 | `get_ad_spend` 区间化 + `get_conversion_metrics` 描述补口径 + prompts 纪律更新 | 问「近两周百度询盘成本」→ 报告用期间分摊花费实算 CPL 并声明口径；**回归**：旧「全期累计，拒算 CPL」话术不再出现；无记录区间回答「未录入」而非 ¥0 |
| 5 验证 | typecheck + biome + api/admin build + 浏览器实测 | 全绿 |

单次交付（一个 PR），预计新增/改动 ~16 文件。影响面已扫描确认：`adSpend`/`inquiryCost`/`growth-settings` 全仓引用仅限本方案已覆盖的 6 个源文件（admin：conversions/page · features/growth · AdSpendDialog；api：analytics.controller · growth-metrics.service · lingxi-tools.service），仪表盘等其他模块零引用，旧端点下线无连带风险。

## 11. 风险与边界

| 风险 | 缓解 |
|---|---|
| 分摊近似被误读为精确值 | 看板 hint、灵犀报告、工具 note 三处都声明口径；升级 2 分日数据落地后自然消除 |
| 手工漏录导致 CPL 虚低 | 区间无记录时看板显示 ¥0 并弱提示「该区间未录入花费」；灵犀明确说「未录入」而非报 0 成本 |
| 旧 KV 值被遗忘 | 上线说明中提示运营将生产累计值手工转录；KV 不再参与任何计算，无脏数据风险 |
| Decimal 序列化 | 服务层统一 `Number(record.spend)` 转换后出参，Prisma Decimal 不直接进 JSON |
