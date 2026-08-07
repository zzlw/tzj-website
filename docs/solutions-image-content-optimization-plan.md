# 解决方案图文优化技术方案

> 日期：2026-08-07
> 状态：已落地（2026-08-07：6 方案专属 hero/card/OG/场景图、hub OG、信任条、内嵌真实案例、电话/询盘 CTA、SEO tagline 与三语文案均已接入并验证；事实与数据清单、StatBand 数字升级待业务提供出处后补充）
> 范围：`apps/web` 解决方案全部页面（`/solutions` hub + 6 个行业方案详情，共 **7 个路由**）、
> 静态媒体资产、i18n 文案、`solutions.ts` 单一数据源、SEO/OG 与转化
> 关联：`docs/product-center-image-content-optimization-plan.md`（同构方案）、
> `docs/case-center-content-ai-enrichment-plan.md`（案例与生图规范）、
> `docs/web-image-loading-optimization.md`、`docs/web-seo-assessment-and-plan.md`、`AGENTS.md`

## 结论先行

解决方案与产品中心一样是**纯静态代码维护**：没有后台、没有 API、没有数据库。内容来自
`apps/web/src/lib/solutions.ts`（6 个方案的 slug/图标/图片/推荐产品/案例分类）+ 三语
`solutions.json`（name/tagline/intro/focus/recommended/programs）+ 页面 JSON。

本地盘点结论：

| 维度 | 现状 |
|---|---|
| 页面规模 | `/solutions` hub + 6 个详情页（fire-rescue / police / military / mine-rescue / education / enterprise） |
| 图片 | 6 个方案各 1 张通用塔体图（`tower-*`），**全部与产品中心/全站素材共用**，没有行业场景辨识度 |
| 图片复用 | hub 卡片与详情 hero 用同一张图；无详情图集/场景图 |
| 文案 | 每个方案有 tagline / intro / focus / recommended / programs，结构完整但偏「产品清单」，缺决策路径与信任证据 |
| SEO/OG | hub 用默认 OG；详情 `generateSeo` 传了通用塔体图，非方案专属 |
| 转化 | 只有 `BookConsultButton`；无电话/询盘入口、无资质信任层、无内嵌案例 |
| 静态边界 | 无后台维护；改文案/图片走代码 PR |

本方案给出：

1. **先盘点后替换**：6 个方案逐一定义「行业场景视觉身份」，替换通用塔体图，hub/detail 拆分卡片图与 hero。
2. **静态资产单一数据源**：扩展 `SOLUTION_META`（`cardImage/heroImage/ogImage/detailImages`），
   页面从数据源读取，不再散落常量。
3. **内容按客户决策路径组织**：复用产品中心 3.7 规范——客户是谁与问题 → 方案 → 证据 →
   推荐产品 → 案例 → 服务 → 下一步。
4. **信任层与转化触点**：资质信任条、真实案例、参数事实、聊天/电话/询盘三级 CTA；本期不做埋点。
5. **SEO 意图映射**：6 个方案各定主词 + 长尾词，H1/meta/正文/OG 围绕意图。

---

## 目录

- 一、现状盘点（页面矩阵 / 静态数据源 / 图片 / 文案 / SEO / 转化）
- 二、目标与原则
- 三、图文与转化规范（视觉身份 / 图片规格 / 命名 / 文案 / 信任层 / CTA / SEO）
- 四、技术落地（盘点替换 / 生图 / 代码接入 / 验证）
- 五、验收标准
- 六、工作量与排期估算
- 七、风险与依赖
- 附：方案清单与单页验收模板

---

## 一、现状盘点

### 1.1 页面矩阵（7 个路由）

| 路由 | 页面类型 | 主要图片现状 |
|---|---|---|
| `/solutions` | 解决方案 hub | 6 张通用塔体卡片图 |
| `/solutions/fire-rescue` | 消防救援 | hero `tower-wylie.jpg`（通用） |
| `/solutions/police` | 公安武警 | hero `tower-hamilton.jpg`（通用） |
| `/solutions/military` | 部队 | hero `tower-titusville.jpg`（通用） |
| `/solutions/mine-rescue` | 矿山救援 | hero `tower-eastside.jpg`（通用） |
| `/solutions/education` | 院校教育 | hero `tower-macon.jpg`（通用） |
| `/solutions/enterprise` | 企业与园区 | hero `tower-chino.jpg`（通用） |

### 1.2 静态数据源（无后台边界）

| 数据源 | 内容 | 变更方式 |
|---|---|---|
| `apps/web/src/lib/solutions.ts` | 6 个方案 slug / icon / image / 案例分类 / 推荐产品 href | 代码 PR |
| `apps/web/src/lib/i18n/solutions.ts` | 从 `solutions.*` 读三语文案并组装 Solution 对象 | 代码 PR |
| `apps/web/src/messages/{locale}/solutions.json` | 每个方案的 name/tagline/intro/focus/recommended/programs | 代码 PR |
| `apps/web/src/messages/{locale}/pages/solutions.json` | hub 文案 | 代码 PR |
| `apps/web/src/messages/{locale}/pages/solutionDetail.json` | 详情页共享标签 | 代码 PR |
| `apps/web/src/lib/static-media-paths.ts` | 静态媒体清单 | 新增资产必须登记 |

**边界**：不做 Admin 字段、不做 DB 迁移、不做 API；内容与图片全部走代码。

### 1.3 图片现状

- 6 张 `SOLUTION_META.image` 全部为通用塔体照片，与产品中心、首页、案例等共用；
- hub 卡片和详情 hero 使用**同一张图**，详情页没有行业场景图；
- 无 `ogImage`：hub 回退默认图，详情 OG 用通用塔体图；
- 无图集/场景图/剖面图，方案页无法让客户「一眼看到自己的行业场景」。

### 1.4 文案现状

- 每个方案有完整结构（tagline/intro/focus/recommended/programs），信息量够；
- 但 intro/focus 偏「产品能力描述」，缺少「客户任务 → 场景 → 证据」的决策路径；
- 无事实与数据清单（层数、工期、交付项目、标准），无内嵌真实案例；
- recommended 只列产品名 + 一句描述，无「什么情况选它」。

### 1.5 SEO / 转化现状

- hub：`createPageMetadata` 未传 image，OG 为默认图；
- 详情：`generateSeo` 传 `solution.image`（通用图），关键词未按行业细分；
- 转化：只有 `BookConsultButton`；无电话/询盘/资质信任条/内嵌案例；
- 详情页有 `StatBandI18n` + `ProcessBandI18n`，但 StatBand 数字太弱、无解决方案专属证据。

---

## 二、目标与原则

### 2.1 目标

- 7 个页面全部具备「行业场景主图 + 决策型文案 + 信任层 + 三级 CTA + 专属 OG」；
- 6 个方案互不共用主图，且与产品中心素材区分；
- 客户浏览后能快速判断「这个方案是不是给我这种单位做的」并产生咨询动作。

### 2.2 原则

| 原则 | 说明 |
|---|---|
| 无后台、无 DB | 不改 Admin/API/Prisma；只动 `apps/web` 代码与静态资产 |
| 单一数据源 | 6 个方案以 `solutions.ts` + i18n 为准 |
| 行业场景优先 | 消防方案配火场/训练塔场景，公安配攀登/战术，矿山配巷道/救援等 |
| 主图独立 | 6 个方案 hero/card 互不共用，不直接复用产品中心主图 |
| 实拍优先、AI 实拍级 | 有真实行业场景图优先实拍；无实拍用 AI 实拍级生图，禁止 AI 味与冒充实拍 |
| 决策型文案 | 复用产品中心 3.7.4：客户与问题 → 方案 → 证据 → 对比 → 服务 → 下一步 |
| 信任与转化 | 资质信任条、真实案例、参数事实、聊天/电话/询盘三级 CTA |
| 本期不做埋点 | 不以行为指标验收，以业务记录与人工抽检为准 |

---

## 三、图文与转化规范

### 3.1 视觉身份（每方案一张「身份表」）

生图/实拍前先冻结：

| 维度 | 示例（fire-rescue） |
|---|---|
| 客户场景 | 消防救援训练基地 / 实战化火场 |
| 画面主体 | 多层训练塔 + 燃烧室 + 训练场 |
| 环境特征 | 消防站/训练基地、地面标识、安全围界 |
| 人员 | 仅远景训练剪影，无正脸/单位标识 |
| 光照与风格 | 中性天空、写实工业摄影 |
| 旧图处置 | 当前通用塔体图 ❌ 作废，不参考 |

### 3.2 图片规格与命名

```text
代码侧：
/media/solution/{slug}-hero.webp            # 详情 hero（16:9）
/media/solution/{slug}-card.webp            # hub 卡片（16:10）
/media/solution/{slug}-og.webp              # OG（1200×630）
/media/solution/{slug}-detail-{n}.webp      # 场景/结构图（4:3）

OSS/MinIO 侧（resolveMediaUrl 自动映射）：
content/solution/{slug}-hero.webp
content/solution/{slug}-card.webp
content/solution/{slug}-og.webp
content/solution/{slug}-detail-{n}.webp
```

压缩：WebP、单文件 < 500KB；详情 hero 建议 1920×1080；OG 1200×630。

### 3.3 页面结构（决策路径）

每个方案详情页按以下顺序：

```text
① Hero：给谁看 + 解决什么问题 + 为什么选拓之迹
② 行业痛点/任务背景（intro）
③ 方案能力（focus）
④ 参数与证据（事实清单，有出处）
⑤ 推荐产品（什么情况选哪个）
⑥ 真实案例（2~3 个，按 caseType 映射）
⑦ 服务与保障（交钥匙闭环）
⑧ 转化收口（聊天 / 电话 / 询盘）
```

### 3.4 文案要求

- 禁止把 6 个方案写成同一套「综合训练解决方案」模板；
- `intro` 第一段写客户任务与痛点，第二段写方案如何解决；
- `focus` 每条有具体能力或数据，不写空词；
- `recommended` 补「什么情况选它」；
- 建立「事实与数据清单」：项目数、服务网络、标准、工期等必须有出处，无法确认不写。

### 3.5 信任层（复用产品中心 3.7.2）

每个方案页至少包含：

- 资质信任条（ISO 9001 / 14001 / 45001 / 五星售后，链到 `/why-us/certification`）；
- 真实案例 2~3 个（按 `caseType` 从案例中心拉取，如 fire-rescue → fire 案例）；
- 服务承诺（设计 → 制造 → 安装 → 培训 → 年检 → 维保）；
- 公司实力数字（成立年份、交付项目数、服务网络，需业务确认）。

### 3.6 CTA 策略（复用现有三级分流）

- 主 CTA：`BookConsultButton`，预填方案场景化消息；
- 显式电话：`tel:` 直拨，hero 后 / 页尾各一次；
- 询盘：跳 `/contact` 并预填方案主题；也是无人在线且不可拨号时的兜底；
- 与产品中心同口径：在线聊天 → 手机拨号 → 询盘表单。

### 3.7 SEO 意图映射

| 方案 | 主关键词 | 长尾示例 |
|---|---|---|
| fire-rescue | 消防救援训练设施 | 消防训练基地建设、消防救援训练塔 |
| police | 公安武警训练设施 | 特警攀登楼、战术训练设施定制 |
| military | 部队训练设施 | 军事训练塔、部队综合训练场 |
| mine-rescue | 矿山救援训练设施 | 矿山应急救援训练、井下救援训练 |
| education | 院校消防实训基地 | 高校消防实训室、校园安全体验馆 |
| enterprise | 企业消防训练设施 | 园区应急训练、企业专职消防队建设 |

### 3.8 真实性

- 优先真实行业场景实拍；无实拍时 AI 实拍级生图；
- AI 图不得有塑料感/乱码/水印，不得冒充「某客户现场」；
- 同方案 card/hero/OG 为同一视觉身份。

---

## 四、技术落地

### 阶段 A：盘点与替换计划（0.5 天）

产出 6 方案清单：`slug | 当前图 | 目标图 | 案例映射 | SEO 主词 | 建议动作`。

### 阶段 B：素材生产（1~2 天）

- 每个方案冻结身份表；
- 实拍整理或 AI 实拍级生图：hero + card + OG + 2~3 张场景图；
- 压缩 WebP → 上传 MinIO → 登记 `static-media-paths.ts`。

### 阶段 C：代码接入（1~2 天）

1. `solutions.ts`：`SOLUTION_META` 扩展 `cardImage/heroImage/ogImage/detailImages`，替换 6 组图；
2. 详情页 hero 用 `heroImage`，hub 卡片用 `cardImage`，metadata 用 `ogImage`；
3. `solutions.json`：按 3.3/3.4 重写三语文案；
4. 详情页增加：资质信任条、真实案例卡、显式电话、询盘入口；
5. `static-media-paths.ts` 登记全部新资产；
6. 保留 `solutionCasesHref` 案例跳转，并在页面内嵌 2~3 个案例卡。

### 阶段 D：验证

- curl 7 个路由 200，hub/detail 图片分别命中 `card` / `hero`；
- OG 断言：7 页 openGraph.images 非默认图；
- 三语文案无原始 key、无「综合解决方案」模板残留；
- `pnpm run check` + typecheck；
- 人工抽检：同方案 hero/card/OG 同一视觉身份。

---

## 五、验收标准

1. 6 个方案 hero/card/OG 互不共用，且不是通用塔体图；
2. 每个方案 hero 回答「给谁 / 解决什么 / 为什么选我们」；
3. 每个方案页有资质信任条 + 2~3 个真实案例 + 服务承诺；
4. 每页 ≥3 个转化触点（聊天 / 电话 / 询盘），主 CTA 复用三级分流；
5. 6 个方案 SEO 主词 + 长尾词映射完成；
6. 图片 WebP < 500KB，MinIO 200；
7. 三语同步，无硬编码中文；
8. 无后台/DB/API 改动；`pnpm run check` + typecheck 全绿。

---

## 六、工作量与排期估算

资产估算：6 方案 ×（hero + card + OG + 2~3 场景图）≈ **30~40 张**；
AI 候选 2~3 倍 ≈ **80~120 次生成**；WebP 后约 **20~40MB**。

| 阶段 | 内容 | 估算 |
|---|---|---|
| A | 盘点/身份表/案例映射 | 0.5 人日 |
| B | 素材生产（实拍/AI + 审核压缩上传） | 1~2 人日 |
| C | 代码接入（数据源/页面/文案/信任层/CTA） | 1~2 人日 |
| D | 验证与回归 | 0.5 人日 |
| **合计** | | **约 3~5 人日** |

---

## 七、风险与依赖

| 风险/依赖 | 影响 | 对策 |
|---|---|---|
| 无行业实拍素材 | 只能 AI 生成，真实感风险 | AI 实拍级标准 + 身份表 + 审核 |
| 6 方案共用素材 | 视觉重复、行业感弱 | 每方案独立命名 + 黑名单断言 |
| 案例映射错配 | 消防方案挂到公安案例 | 阶段 A 按 caseType 逐条打标 |
| 文案同质化 | 失去行业说服力 | 每方案独立 SEO 意图与痛点 |
| 生产误操作 | 数据事故 | 只动本地；真生产仅 `REDACTED-IP` |

依赖：`solutions.ts`、三语 `solutions.json`、`static-media-paths.ts`、MinIO/OSS、
`image-compression.ts`；无 API/DB/Admin。

---

## 附：方案清单与单页验收模板

### A. 当前清单（2026-08-07）

| slug | 方案 | 当前图 | caseType | 建议动作 |
|---|---|---|---|---|
| fire-rescue | 消防救援 | `tower-wylie.jpg` | fire | 火场/训练基地场景 |
| police | 公安武警 | `tower-hamilton.jpg` | police | 攀登/战术场景 |
| military | 部队 | `tower-titusville.jpg` | military | 综合训练场/越障场景 |
| mine-rescue | 矿山救援 | `tower-eastside.jpg` | enterprise | 巷道/救援训练场景 |
| education | 院校教育 | `tower-macon.jpg` | school | 教学实训/科普场景 |
| enterprise | 企业与园区 | `tower-chino.jpg` | enterprise | 园区应急/专职队场景 |

### B. 单页验收清单

```text
[ ] slug: ________
[ ] hero/card/OG 独立且行业场景匹配
[ ] hero 回答三问
[ ] 文案按决策路径组织，非统一模板
[ ] 事实与数据清单有出处
[ ] 2~3 个真实案例（按 caseType）
[ ] 资质信任条 + 服务承诺
[ ] ≥3 个转化触点（聊天 / 电话 / 询盘）
[ ] SEO 主词 + 长尾词映射完成
[ ] WebP < 500KB，MinIO 200
[ ] 三语无原始 key / 无硬编码中文
[ ] curl 200 + typecheck + pnpm run check
```

---

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-07 | 初稿：盘点 7 个解决方案路由、6 张通用塔体图；对齐产品中心图文与转化规范，明确静态无后台边界 |
| 2026-08-07 | 落地：AI 实拍级素材 19 张 → 33 个 WebP（hero/card/OG/场景图，均 <250KB，MinIO `content/solution/`）；`SOLUTION_META` 扩展 image/heroImage/ogImage/detailImages 单一数据源；hub OG 专属；6 详情页接入资质信任条、内嵌真实案例卡（按 caseType 拉取）、场景配图、电话/询盘/聊天三级 CTA；tagline 嵌入 SEO 主词、recommended 补「什么情况选它」、三语同步；已登记 `static-media-paths.ts`；curl 21 路由、OG 断言、typecheck/biome 全通过 |
