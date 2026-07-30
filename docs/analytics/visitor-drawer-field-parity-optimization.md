# 访客详情抽屉信息补齐优化方案（表格 ↔ 抽屉字段对齐）

**日期**: 2026-07-30
**状态**: 待评审
**问题来源**: 访客中心「按访客」表格展示的多项信息（来源渠道明细、兼容性、入口页、最后访问 IP 等）在访客详情抽屉中缺失或弱化，用户下钻后反而丢失上下文。
**适用前提**: 小而美团队（后台用户 ≤ 100 人），防止过度设计、保持简洁实用。

---

## 一、现状与差异分析

### 1.1 相关代码位置

| 层 | 文件 | 说明 |
|----|------|------|
| 表格列定义 | `apps/admin/src/components/visitors/PeopleVisitorLens.tsx`（`buildPeopleColumns`） | 「按访客」lens 14 列 |
| 设备共享列 | `apps/admin/src/components/analytics/device-columns.tsx` | 设备/系统/浏览器/兼容性/访问软件 5 列 |
| 抽屉容器 | `apps/admin/src/features/chat/components/VisitorProfileSheet.tsx` | 三 tab：浏览行为/询盘/聊天记录 |
| 浏览行为面板 | `apps/admin/src/components/analytics/VisitorActivityTimeline.tsx` | `TechInfoBar` + `NetworksSection` + `SessionItem` |
| 前端类型 | `apps/admin/src/features/analytics.ts` | `AnalyticsVisitorRow` / `AnalyticsVisitorActivity` |
| 后端接口 | `apps/api/src/analytics/analytics.service.ts`（`getVisitorActivity` / `buildVisitorTechInfo` / `resolveVisitorIdentity`） | GET `analytics/visitor-activity` |
| 兼容性判定 | `apps/admin/src/lib/browser-support.ts`（`classifyBrowserSupport`） | 前端纯函数，三态徽标 |
| CSV 导出 | `apps/admin/src/features/analytics-export.ts` | 证明 UTM/gclid/入口页数据在行数据中已存在 |

### 1.2 字段差异清单（表格有 → 抽屉状态）

| # | 字段 | 表格展示 | 抽屉现状 | 数据是否已在 visitor-activity 响应中 | 缺口类型 |
|---|------|---------|---------|----------------------------------|---------|
| 1 | 兼容性徽标 | ✅ 三态徽标（支持/不支持/未知） | ❌ 仅显示浏览器名+版本 | ✅（browser/browserVersion 已返回，判定是前端纯函数） | **纯前端渲染缺失** |
| 2 | 入口页 landingPath | ✅ 等宽字体截断显示 | ❌ 无 | ⚠️ techInfo 未含；可从首个会话第一条 view 推导 | 前端可推导 / 后端补返二选一 |
| 3 | 最后访问 IP | ✅ 明文+脱敏兜底，可下钻 | ⚠️ 仅在「历史网络/地区」间接可见 | ✅（networks 首条即最近 IP） | 前端展示口径问题 |
| 4 | 最近活跃时段副行 | ✅ 相对时间 + 时段（凌晨/上午…） | ❌ 只有相对时间 | ✅（lastSeenAt 已返回） | 纯前端渲染缺失 |
| 5 | 识别时间 identifiedAt | ✅（CSV 导出含） | ❌ identity 块只有 identified 布尔 | ❌ 后端查了但未透出 | **后端补 1 个字段** |
| 6 | UTM 五参数 + gclid | ⚠️ 表格 UI 也未展示（仅 CSV 导出） | ❌ 无 | ❌ 接口完全未返回 | 后端补返 + 前端新增区块 |
| 7 | 来源渠道 | ✅ 渠道标签 + 引荐域名副行 | ✅ 已有「来源」项（渠道 · 引荐域名） | ✅ | **无缺口**（截图中显示"直接访问"是该访客渠道确实为 direct） |
| 8 | 转化状态 / 身份详情 / PV / 关键页 | ✅ | ✅ 头部与 TechInfoBar 已覆盖 | ✅ | 无缺口 |

> 说明：截图中用户感知的「来源渠道没有」，实际是抽屉已有「来源」项但该访客渠道为直接访问；真正的信息缺口是上表 #1~#6。本方案顺带将「来源」区块升级为完整的渠道归因区（含 UTM），一并消除感知落差。

---

## 二、优化方案

### 原则

- 抽屉是表格的「放大镜」：表格每一列的信息，抽屉中必须能找到，且更详细。
- 零新依赖、零新表；只在现有接口响应上追加字段（向后兼容，仅新增不修改）。
- 复用现有组件与纯函数（`classifyBrowserSupport`、`formatTimeOfDay`、`CopyableIp`），不引入新 UI 模式。

### P0 — 纯前端补齐（改 1 个文件，无后端改动）

改动文件：`apps/admin/src/components/analytics/VisitorActivityTimeline.tsx`

1. **兼容性**：`TechInfoBar` 新增「兼容性」项，复用 `classifyBrowserSupport(browser, browserVersion)` + `BROWSER_SUPPORT_LABELS`，徽标样式与 `device-columns.tsx` 保持一致（可将徽标渲染小函数提取到 `browser-support.ts` 或 device-columns 导出复用，避免两处样式漂移）。
2. **最近访问时段**：「最近访问」值追加时段副注，复用 `PeopleVisitorLens` 中的时段格式化逻辑（若该函数目前是模块私有，提升到 `features/analytics.ts` 共享）。
3. **入口页（推导版）**：`TechInfoBar` 新增「入口页」项，取 `sessions` 按时间最早会话的第一条 view 的 path；无会话数据时显示 `—`。等宽字体 + 截断，与表格列口径一致。
4. **最后访问 IP 显式化**：「历史网络 / 地区」区块标题行右侧或首条标注「最近」，并在 `TechInfoBar` 新增「最后访问 IP」项（取 `networks[0]`，即最近网络），使用 `CopyableIp` 可复制。networks 为空（IP 抽屉场景传 undefined）时不渲染该项。

### P1 — 后端补返 + 前端渠道归因区块

后端改动：`apps/api/src/analytics/analytics.service.ts`

1. `getVisitorActivity` 响应新增 `attribution` 块（首触口径，与列表行一致）：

   ```ts
   attribution: {
     utmSource: string | null;
     utmMedium: string | null;
     utmCampaign: string | null;
     utmContent: string | null;
     utmTerm: string | null;
     gclid: string | null;
     landingPath: string | null; // 首触入口页，后端权威值（P0 的前端推导随即退役）
   }
   ```

   数据来源与列表查询同源（首触会话记录），无需新查询模式，仅在现有首触取值处多带几个字段。
2. `resolveVisitorIdentity` 透出 `identifiedAt: string | null`（该值已查询，只是未放入返回对象）。

前端改动：

1. `apps/admin/src/features/analytics.ts`：`AnalyticsVisitorActivity` 类型追加 `attribution` 与 `identity.identifiedAt`（可选字段，兼容旧响应）。
2. `VisitorActivityTimeline.tsx`：
   - `TechInfoBar` 的「入口页」改用 `attribution.landingPath`（无值时回退 P0 推导逻辑）。
   - `TechInfoBar` 下方新增可折叠「渠道归因」小区块（默认折叠，样式对齐 `SessionItem` 折叠头）：仅当存在任一 UTM 参数或 gclid 时渲染，逐项列出非空参数；全空则整块不渲染，避免直接访问型访客看到一排 `—`。
3. `VisitorProfileSheet.tsx` 头部：已识别徽标追加识别时间 tooltip 或副文本（`identifiedAt` 存在时显示「已识别 · 7月28日」）。

### 不做的事（防过度设计）

- ❌ 不为抽屉新建独立接口或 GraphQL 式字段选择——直接在现有响应追加。
- ❌ 不在表格中新增 UTM 列（表格已 14 列，UTM 留给 CSV 导出与抽屉详情）。
- ❌ 不做归因模型切换（首触/末触）——维持全站首触口径。
- ❌ 不改「按 IP」lens 的 ip-activity 接口（本次仅对齐人物抽屉；IP 抽屉复用同一 Timeline 组件，新增区块对 undefined 数据自动不渲染，天然兼容）。

---

## 三、实施拆分与工时

| 阶段 | 内容 | 改动文件 | 预估 |
|------|------|---------|------|
| P0 | 兼容性徽标、时段副注、入口页推导、最后 IP 显式化 | `VisitorActivityTimeline.tsx`（+ 小函数提升） | 0.5 天 |
| P1-后端 | attribution 块 + identifiedAt 透出 | `analytics.service.ts` | 0.5 天 |
| P1-前端 | 类型追加、渠道归因折叠区块、识别时间展示 | `analytics.ts` / `VisitorActivityTimeline.tsx` / `VisitorProfileSheet.tsx` | 0.5 天 |

合计约 1.5 人天。P0 可独立上线，P1 前后端需同 PR 或后端先行。

---

## 四、验收标准

1. 表格任意一行「查看详情」打开抽屉后，该行 14 列信息在抽屉内均可找到（含兼容性、入口页、最后 IP、来源渠道+引荐域名）。
2. 带 UTM 参数访问的访客（可用 `?utm_source=test` 自造数据）抽屉出现「渠道归因」区块且参数正确；直接访问型访客不出现该区块。
3. IP 抽屉（按 IP lens 下钻）不报错、不出现空的归因/网络区块。
4. 已识别访客头部显示识别时间；匿名访客不显示。
5. `pnpm lint` + TypeScript strict 通过；visitor-activity 响应旧字段结构不变（仅新增），admin 旧版本前端可正常消费。

---

## 五、所有权与合规

- 前端改动均在 `apps/admin/src/**`，后端在 `apps/api/src/analytics/**` —— A2 职责范围，无需 A1 审批。
- 不新增 npm 依赖、不改共享类型包 `packages/types`、不涉及 schema 迁移。
- IP 明文展示沿用现有内部后台口径（`NetworksSection` 既有行为），不扩大 PII 暴露面；CSV 导出白名单不变。
