# 展会活动中心全量内容优化与 AI 生图技术方案

> 日期：2026-08-06
> 状态：待评审（数据盘点基于本地开发库 `tzj_dev`，为生产快照恢复，结论以生产复核为准）
> 范围：`apps/api`（TradeShow 数据与发布）、`apps/web`（`/zh-CN/resources/trade-shows` 列表/详情）、
> `apps/admin`（活动表单）、AI 生图资产与 OSS 上传、营销弹窗运营字段
> 关联：`docs/case-center-content-ai-enrichment-plan.md`、`docs/news-center-content-ai-enrichment-plan.md`、
> `docs/blog-center-content-ai-enrichment-plan.md`（同构方案）、
> `docs/marketing-popup-visual-redesign.md`（营销弹窗字段与视觉）、
> `docs/web-seo-assessment-and-plan.md`、`AGENTS.md`

## 结论先行

展会活动中心本地快照共 **4 条**，全部 published，但内容完整度是四个内容中心里最低的：

| 维度 | 现状 |
|---|---|
| 正文 | **3 条为空**；仅 `regional-seminar` 有 548 字正文 |
| `coverImage` | **1/4** 有值（`regional-seminar`）；其余 3 条列表显示默认占位图 |
| `detailCoverImage` | **0/4**（字段已落地，全部回退列表封面） |
| `images[]` | **0/4**，无现场/往届配图 |
| 日期 | 3 条只有 `eventDateLabel="年度展会"`，无 `startDate/endDate` |
| `externalUrl` | **0/4**（无报名/官网入口） |
| 展位号 | **0/4** |
| `eventType` | 3 exhibition + 1 **promotion**（`regional-seminar` 实为研讨会，应改 `seminar`） |
| SEO | 4/4 有值（内容重写后复核） |
| 营销弹窗 | 仅 `regional-seminar` 启用；`popupImage` 复用通用 `modular-construction.jpg`，`popupContent` 为空 |

本方案给出可批量复制的执行框架：

1. **先盘点后纠偏**：4 条全量清单 + 类型/日期/展位/外链字段核对 + 营销弹窗启用决策（阶段 A）。
2. **内容包标准化**：每条按「活动介绍」体裁生产 500~900 字 Markdown；不做案例式长文，
   也不做博客式技术指南。
3. **双封面 + 配图**：每条独立生产 `coverImage`（16:9）与 `detailCoverImage`（约 3:1 宽幅），
   另配 1~3 张现场/场景图并正文内嵌；**有真实往届现场图时实拍优先**，无实拍才用 AI 场景示意。
4. **营销弹窗分开运营**：`popupImage` / `popupContent` 独立于详情页双封面；
   未启用弹窗的展会不为了内容而启用。
5. **发布 + 验收门禁**：4 条数据量小，可一次验收；重点验证 `eventType`、日期、外链、
   Event JSON-LD 与营销弹窗回退链路。

> **Schema 说明**：`TradeShow.detailCoverImage` 已于 2026-08-06 通过迁移
> `20260806130000_add_trade_show_detail_cover_image` 加入；Admin 表单已有「封面图 / 详情页封面图」；
> C 端列表已出 `coverImage`，详情 Hero 已优先 `detailCoverImage`。
> 本方案**不再**讨论「要不要加详情封面字段」，只规定如何把内容与图填满。

---

## 目录

- 一、现状盘点（含数据模型与已落地代码）
- 二、目标与原则
- 三、内容规范（字段标准 / 正文模板 / 事实来源核对 / 营销弹窗）
- 四、AI 生图规范（双封面 + 同一展会视觉）
- 五、技术落地（盘点纠偏 / 内容生产 / 生图 / 可选增强 / 发布验证）
- 六、验收标准
- 七、工作量与排期估算
- 八、风险与依赖
- 附：待优化活动清单与单条验收模板

---

## 一、现状盘点

### 1.1 数据规模（本地快照实测，2026-08-06）

| 维度 | 数值 |
|---|---|
| TradeShow 总数 | 4 条，全部 published |
| 类型分布 | `exhibition` 3 / `promotion` 1（`regional-seminar` 应纠偏为 `seminar`） |
| 正文长度 | 3 条 **0 字**；`regional-seminar` 548 字 |
| `summary` | 19~23 字 |
| `coverImage` | 1/4 有值；3 条 null |
| `detailCoverImage` | **0/4** 已填写（全部回退列表封面） |
| `images[]` | **0/4** |
| 日期 | 3 条仅 `eventDateLabel="年度展会"`；`regional-seminar` 有 2026-07-01 ~ 2026-08-31 |
| `location` | 北京 / 上海 / 广州 / 全国 |
| `externalUrl` | 0/4 |
| `boothNumber` | 0/4 |
| SEO | 4/4 有 `seoTitle/seoDesc`（重写后复核） |
| `isFeatured` | 0/4 |
| 营销弹窗 | `regional-seminar` isMarketing=true；其余 3 条未启用 |

验收入口：

- 列表：`http://localhost:3001/zh-CN/resources/trade-shows`（网格卡片展示 `coverImage`，缺失时默认占位）
- 详情：`http://localhost:3001/zh-CN/resources/trade-shows/{slug}`（Hero = `detailCoverImage ?? coverImage`）
- API：`GET /api/v1/trade-shows`、`GET /api/v1/trade-shows/{slug}`、
  `GET /api/v1/trade-shows/marketing/active`
- Admin：活动表单「封面图 / 详情页封面图 / 弹窗头图 / 弹窗文案」等字段

### 1.2 已落地代码（本方案依赖的事实）

| 层 | 行为 |
|---|---|
| Prisma `TradeShow` | `coverImage String?`；`detailCoverImage String?`（注释：详情页宽幅封面，与列表封面分离；未设置时 C 端回退） |
| 迁移 | `20260806130000_add_trade_show_detail_cover_image`（生产 `migrate deploy`；本地按规范 `db push`） |
| DTO / types | `apps/api/src/trade-shows/dto/trade-show.dto.ts`、`packages/types`、`apps/admin/src/features/types.ts` 已含字段 |
| Admin | `coverImage`「建议比例 16:9」；`detailCoverImage`「约 3:1；留空则默认使用封面图」；营销弹窗字段已有 |
| Web 列表 | 每张卡片顶部 16:9 `coverImage`（本轮已加） |
| Web 详情 | `heroImage = detailCoverImage ?? coverImage`；OG/JSON-LD 的 `image` 仍用列表封面 `coverImage`（本轮已加） |
| Media 引用守卫 | `media-guard.service.ts` 已把展会 `detailCoverImage` 纳入引用扫描 |
| 营销弹窗 | `popupImage` 优先、留空回退 `coverImage`；`popupContent` 优先、留空回退 `content`（前端已实现） |

### 1.3 与案例/新闻/博客中心的模型差异

| 能力 | Case / News / Blog | TradeShow |
|---|---|---|
| 定位 | 交付证明 / 动态 / 技术内容 | **活动信息 + 转化**（报名、参展、到访） |
| 正文要求 | 800~1500 字 | **500~900 字**活动介绍即可 |
| 关键业务字段 | 案例/分类/阅读时长 | `eventType`、`eventDateLabel`、`startDate/endDate`、`location`、`boothNumber`、`externalUrl` |
| 图片 | 双封面 + 图集 | 双封面 + 1~3 张现场/场景图；**营销弹窗另有 `popupImage`** |
| 视觉一致性 | 同一建筑 / 同一主题 | **同一展会 / 同一品牌视觉** |
| 营销能力 | 无 | `isMarketing` / `popupImage` / `popupContent` / `ctaText` / `frequency` 等 |
| 结构化数据 | Article | **Event JSON-LD**（日期/地点） |

### 1.4 现状问题

1. **3 条占位数据**：`china-fire-expo`、`emergency-rescue-expo`、`public-safety-expo`
   正文为空、无封面、无图、无精确日期、无外链，列表只剩标题/摘要/地点，详情页内容空。
2. **类型错误**：`regional-seminar` 标题是「研讨会」，`eventType` 却是 `promotion`，
   C 端眉标会显示「促销活动」。
3. **图片全缺**：`detailCoverImage` 0/4；3 条连 `coverImage` 都没有，列表/详情均为占位图。
4. **转化链路弱**：无 `externalUrl`，无展位号；报名/官网入口只能依赖站内详情。
5. **日期不完整**：3 条仅「年度展会」无精确窗口，影响排序与 Event JSON-LD。
6. **营销弹窗运营不足**：唯一启用项 `regional-seminar` 的 `popupImage` 用通用产品图、
   `popupContent` 为空；其余 3 条是否启用弹窗未决策。
7. **图片真伪边界**：3 条大型展会无真实现场图，若用 AI 生图需明确「场景示意」而非伪造
   真实展台/展位，避免误导。

### 1.5 语言范围

**只做中文（zh-CN）**；不扩展多语言子表；不为本方案再增 schema（`detailCoverImage` 已存在）。

---

## 二、目标与原则

### 2.1 目标

- 4 条展会全部达到「信息完整 + 双封面 + 配图 + 转化入口 + SEO/Event JSON-LD 正确」。
- `/resources/trade-shows` 列表有可辨识的展会视觉，不再是空卡片。
- 营销弹窗与详情页内容分开运营，启用与否由业务决策。

### 2.2 原则

| 原则 | 说明 |
|---|---|
| 真实优先 | 不虚构展会日期、展位号、地点、主办方；无法确认的字段留空 |
| 双封面分离 | `coverImage` 与 `detailCoverImage` **独立生图、独立文件**；禁止同一 URL 填两列 |
| 同展会视觉一致 | 封面、详情封面、配图同属同一展会/同一品牌场景 |
| 实拍优先 | 有真实往届现场图时优先用实拍；无实拍才用 AI 场景示意，并在运营上不冒充真实现场 |
| 活动体裁 | 不做案例式长文，不做技术指南；正文服务「这是什么展、看什么、怎么去」 |
| 营销弹窗独立 | `popupImage`/`popupContent` 与详情页双封面分开运营；不为了弹窗而弹窗 |
| 以现有字段为锚 | 围绕 `title/eventType/summary/content/location/日期/外部链接` 扩写，不改事实口径 |
| 数据走正规通道 | 后台或审批脚本；本地禁止 `migrate dev/reset` |

---

## 三、内容规范（每条展会「内容包」）

### 3.1 字段级标准

| 字段 | 要求 | 示例 / key |
|---|---|---|
| `title` | 信息明确，一般 ≤ 36 字 | 中国国际消防设备技术交流展览会 |
| `slug` | 英文 kebab，稳定后不改 | `china-fire-expo` |
| `eventType` | 四选一且与标题一致 | `exhibition` / `seminar` / `roadshow` / `promotion` |
| `summary` | 40~80 字，一句话讲清「什么展 + 看什么」 | — |
| `content` | Markdown，500~900 字；固定章节 | 见 3.2 |
| `eventDateLabel` | 展示用文字（与精确日期可并存） | 2026 年 5 月 |
| `startDate` / `endDate` | 尽量补精确窗口；不确定时保留年份/月份 | — |
| `location` | 城市/场馆 | 北京 |
| `boothNumber` | 有展位才填 | A3-12 |
| `externalUrl` | 官网/报名链接；没有则留空走站内详情 | — |
| `coverImage` | **列表封面** 16:9，OSS | `content/trade-show-{slug}-hero.webp` |
| `detailCoverImage` | **详情页封面** 约 3:1，独立生图 | `content/trade-show-{slug}-detail-hero.webp` |
| `images[]` | 1~3 张配图，与正文内嵌同源 | `content/trade-show-{slug}-gallery-{n}.webp` |
| `seoTitle` / `seoDesc` | 约 60 / 120 字内；含展会名 + 城市 | — |
| `isFeatured` / `status` | 按运营需要；达标后 published | — |

#### 3.1.1 正文字数窗口

| 类型 | 目标字数（去空白） | 说明 |
|---|---|---|
| `exhibition` | 500~800 | 展会概况 / 展示内容 / 参观信息 |
| `seminar` / `roadshow` | 600~900 | 活动背景 / 议程 / 参与方式 |
| `promotion` | 400~700 | 活动规则 / 参与方式（如保留该类型） |

### 3.2 正文章节模板（Markdown）

#### A. exhibition

```text
## 展会概况

## 展示内容

（### 训练塔 / 燃烧室 / 专项道具，按实际展品）

## 参观信息

（时间 / 地点 / 展位号 / 报名入口）

## 邀约与联系
```

#### B. seminar / roadshow

```text
## 活动背景

## 议程与内容

## 参与方式

## 适合谁参加
```

#### 3.2.1 排版与间距规范

- `##`/`###` 前后必须有空行；禁止 `**伪标题**`；禁止 `####`+；
- 段与段之间空行；列表项之间不空行，列表前后各留空行；
- 正文内嵌图片前后各留空行；图片不紧贴标题/段落；
- 清洗 HTML 残留；详情由 `MarkdownBody` 渲染。

### 3.3 事实来源与核对

| 陈述 | 来源 | 无法确认时 |
|---|---|---|
| 展会名称/城市/场馆 | 公开展会信息、主办方公告 | 只写城市，不写场馆 |
| 日期 | 公开公告、主办方资料 | 只保留「年度展会」，不编精确日期 |
| 展位号 | 展位确认函 | 留空 |
| 展示内容 | 公司实际参展方案/展品清单 | 只写「将展示训练设施解决方案」等可验证口径 |
| 往届现场图 | 自有实拍素材 | 无实拍时用 AI 场景示意，不标注为真实现场 |

### 3.4 封面更新与缓存

- 列表：`coverImage`；详情 Hero：`detailCoverImage ?? coverImage`；
- OG/JSON-LD：当前实现用 `coverImage`；
- `revalidate: 60`：验收等 60s 或强刷；用 curl/HTML，**不用浏览器 MCP**。

### 3.5 正文内嵌配图

| 项 | 要求 |
|---|---|
| 方式 | `content` 内 `![alt](url)`，前后空行 |
| 数量 | 1~3 张 |
| alt | `{展会标题} · {视角}（n/m）` |
| 一致 | URL ∈ `images[]` |
| 图床 | `content/trade-show-{slug}-*.webp` |
| 不内嵌 | `coverImage` / `detailCoverImage` 不进正文 |

### 3.6 营销弹窗规范（仅启用项）

| 字段 | 要求 |
|---|---|
| `popupImage` | 弹窗专用横幅（建议 2:1），**不复用封面/详情封面，也不用全站通用产品图** |
| `popupContent` | 弹窗专用短文案（Markdown，建议 100~300 字）；留空回退详情正文 |
| `ctaText` | 与活动匹配（如「预约交流」「报名参会」） |
| `frequency` / `targetDevice` / `excludePages` | 按 `docs/marketing-popup-visual-redesign.md` 运营 |

---

## 四、AI 生图规范

### 4.1 产出与规格

> 每条展会：**1 张列表封面 + 1 张详情页宽幅封面 + 1~3 张配图**；
> 有真实往届现场图时优先实拍；无实拍才生成 AI 场景示意。

| 用途 | 字段 | 数量 | 比例 | 最低尺寸 | 视角 |
|---|---|---|---|---|---|
| 列表封面 | `coverImage` | 1 | 16:9 | 1920×1080 | 展会主视觉 / 展品主视觉 |
| 详情页封面 | `detailCoverImage` | 1 | 约 3:1 | 1920×640 | **宽幅建立感**：展馆/会场/训练场景全景；顶部约 1/4 留白；独立生图 |
| 配图 | `images[]` | 1~3 | 4:3 优先 | 1600×1200 | 展品细节 / 展台场景 / 交流场景（人员仅远景） |

输出：WebP，单文件 < 500KB（`image-compression.ts`）。

### 4.2 同一展会视觉（硬性）

> **一条展会 = 一个视觉身份。** 封面、详情封面、配图必须可识别为同一展会/同一品牌场景；
> 3 条大型展会不能共用同一张通用展会图。

#### 4.2.1 生成方法

1. 先有真实素材的，直接用实拍作为锚点；没有的先生成并审定 **列表封面** 为锚点；
2. 详情封面、配图以锚点为参考图生成，只改机位/景别/画幅；
3. 详情封面提示词强调宽幅、俯视/远景、顶部留白；
4. 每条资源统一 `content/trade-show-{slug}-*` 前缀。

#### 4.2.2 按类型画面倾向

| 类型 | 倾向 |
|---|---|
| `exhibition` | 展馆/展台全景、训练塔与器材展示 |
| `seminar` | 会场/研讨交流场景（人员仅远景剪影） |
| `roadshow` | 巡回活动现场/户外展示 |
| `promotion` | 活动现场（若保留该类型） |

#### 4.2.3 禁止事项

- 列表/详情封面共用同一文件；
- 3 条大型展会共用同一张图；
- 用 AI 图伪造真实展台/展位/主办方画面（无实拍时以「场景示意」口径运营）；
- 水印/电话/乱码字/伪官网截图；
- 人员正脸、真实单位标识、车牌、地图坐标。

### 4.3 风格基准

写实工业/展会摄影；中性光线；品牌红点缀；人员仅远景剪影；无真实 Logo/展位号乱码。

### 4.4 审核 checklist

- [ ] 与展会标题/类型/地点一致
- [ ] `coverImage` 与 `detailCoverImage` 为不同文件且画幅用途正确
- [ ] 详情封面顶部留白充足
- [ ] 无水印/乱码/正脸/涉密
- [ ] 配图与锚点同展会视觉
- [ ] 无实拍素材时未冒充真实现场
- [ ] WebP < 500KB，HEAD 200

验证：**curl / HTML / 静态资源**，不用浏览器 MCP。

### 4.5 OSS 命名与压缩

```text
content/trade-show-{slug}-hero.webp
content/trade-show-{slug}-detail-hero.webp
content/trade-show-{slug}-gallery-{1..3}.webp
```

- 上传前压缩（WebP q80、最长边 2560、去 EXIF）；单文件 < 500KB；
- 同步 `static-media-paths.ts`（追加 `/media/trade-show-*.webp`）；
- 批次断言：无 >500KB WebP；`coverImage !== detailCoverImage`。

### 4.6 规模粗估

4 条 ×（2 封面 + 1~3 配图）≈ **16~20 张**。

---

## 五、技术落地（分阶段）

### 阶段 A：盘点与纠偏（0.5 天）

输出 4 条活动清单，并完成以下决策：

1. `regional-seminar`：`eventType` 从 `promotion` 纠偏为 `seminar`；
2. 3 条大型展会：补齐日期、场馆、展位、外部链接所需事实（业务提供）；
3. 每条是否启用营销弹窗（`isMarketing`）；
4. 现有 `popupImage=modular-construction.jpg` 是否替换（通用产品图不符合弹窗视觉规范）；
5. `externalUrl`：有官网/报名链接则回填，无则站内详情承接。

表头建议：

`slug | title | eventType | status | contentLen | coverKey | hasDetailCover | images | start/end | externalUrl | 建议动作`

动作：`补全内容` / `纠偏类型` / `补日期` / `补外链` / `弹窗决策`。

### 阶段 B：内容生产（0.5~1 天）

先做 1 条样板（建议 `regional-seminar` 或 `china-fire-expo`）由业务确认，再补齐其余 3 条。

校验：

- 字数窗口（3.1.1）；
- `summary` 40~80 字；
- Markdown 排版（3.2.1）；
- `eventType` 与标题一致；
- `startDate/endDate` 与 `eventDateLabel` 不冲突；
- `externalUrl` / `boothNumber` 按事实填；
- 双封面均非空且 URL 不同；
- `images.length ≥ 1` 且正文内嵌一致；
- SEO 字段复核；
- 营销弹窗启用项的 `popupImage` / `popupContent` / `ctaText` 独立校验。

### 阶段 C：AI 生图 / 实拍素材

实拍优先 → 无实拍生成锚点封面 → 详情封面（参考锚点）→ 配图 → 压缩上传 → 回填三字段 → 正文内嵌。

### 阶段 D：可选代码增强（内容上线不阻塞）

| 项 | 说明 | 优先级 |
|---|---|---|
| D0 | DB + OSS + `static-media-paths`（必做） | P0 |
| D1 | Admin 暴露 `images[]` 编辑 | P3 |
| D2 | 活动表单增加「日期/外链/展位」必填校验提示 | P2 |
| D3 | 营销弹窗素材质量检查（`popupImage` 非通用素材） | P3 |

> 双封面相关代码**已完成**，不在本阶段重复开发。

### 阶段 E：发布与验证

- API：双封面字段、`eventType` 正确、日期/外链齐全；
- 列表 HTML 含 `trade-show-{slug}-hero`（或解析后的封面 URL）；
- 详情 HTML Hero 优先命中 `detail-hero`；
- Event JSON-LD 日期/地点正确；
- 营销弹窗：启用项 `popupImage` 可加载、`popupContent` 回退正常；
- OSS/本地 media HEAD 200；等 ~60s 缓存；
- `pnpm run check` + 三个 app typecheck 门禁。

---

## 六、验收标准（每条展会）

1. `eventType` 与标题/内容一致；
2. `summary` 40~80 字，信息完整；
3. `content` 干净 Markdown，字数落在类型窗口；
4. `startDate/endDate` 与 `eventDateLabel` 不冲突；无法确认的不编；
5. `externalUrl` / `boothNumber` 按事实填写（没有就留空）；
6. **`coverImage` 与 `detailCoverImage` 均已设且为不同 OSS key**；主题匹配；
7. `detailCoverImage` 为宽幅用途（约 3:1 产出），顶部留白可接受；
8. `images[]` ≥ 1，正文内嵌一致，alt 合规；WebP < 500KB；
9. `seoTitle` / `seoDesc` 已复核；
10. 营销弹窗启用项：`popupImage`/`popupContent`/`ctaText` 独立且合规；
11. 校验脚本通过；curl/HTML 验收通过；
12. 无虚假展会信息；AI 图未冒充真实现场。

---

## 七、工作量与排期估算

| 阶段 | 内容 | 估算 |
|---|---|---|
| A | 盘点/纠偏/业务决策 | 0.5 人日 |
| B | 4 条内容生产 + 审定 | 0.5~1 人日 |
| C | 16~20 张图（生成/实拍整理 + 审核 + 上传） | 0.5~1 人日（与 B 并行） |
| D | 可选小改 | 0~0.5 人日 |
| E | 发布 + 验证（含弹窗） | 0.5 人日 |
| **合计** | | **约 2~3.5 人日** |

---

## 八、风险与依赖

| 风险/依赖 | 影响 | 对策 |
|---|---|---|
| 展会日期/展位无事实来源 | 信息错误、Event JSON-LD 误导 | 阶段 A 让业务提供资料；拿不到就留空 |
| AI 图冒充真实现场 | 品牌与信任风险 | 无实拍时用「场景示意」口径；审核 checklist 强制 |
| 3 条大型展会共用一张图 | 列表视觉重复 | 每条独立锚点 + `trade-show-{slug}-` 前缀硬门禁 |
| `eventType` 错误未改 | 眉标/搜索分类错误 | 阶段 A 纠偏，验收第一条即检查 |
| 营销弹窗误启用或素材通用 | 全站打扰 / 视觉廉价 | 弹窗决策逐条确认；`popupImage` 独立运营图 |
| 生产误操作 | 数据事故 | 只动本地；真生产仅 `REDACTED-IP`；后台/审批脚本写入 |

依赖：已落地的 TradeShow `detailCoverImage` 全链路；`image-compression.ts`；Admin 双图上传；
C 端列表/详情渲染；营销弹窗现有回退链路。

---

## 附：待优化活动清单与单条验收模板

### A. 当前清单（2026-08-06 本地快照）

| slug | 标题 | eventType | 正文 | 封面 | 详情封面 | images | 日期 | 外链 | 建议动作 |
|---|---|---|---|---|---|---|---|---|---|
| `regional-seminar` | 区域消防训练设施研讨会 | promotion（应改 seminar） | 548 字 | ✅ 上传图 | ❌ | 0 | 2026-07-01~08-31 | ❌ | 纠偏类型；扩写至 ~800 字；补详情封面/配图；弹窗图替换 |
| `china-fire-expo` | 中国国际消防设备技术交流展览会 | exhibition | 空 | ❌ | ❌ | 0 | 仅「年度展会」 | ❌ | 补内容/封面/日期/配图；评估外链 |
| `emergency-rescue-expo` | 国际应急救援与安全博览会 | exhibition | 空 | ❌ | ❌ | 0 | 仅「年度展会」 | ❌ | 补内容/封面/日期/配图；评估外链 |
| `public-safety-expo` | 公共安全与防灾减灾博览会 | exhibition | 空 | ❌ | ❌ | 0 | 仅「年度展会」 | ❌ | 补内容/封面/日期/配图；评估外链 |

### B. 单条验收清单

```text
[ ] slug: ________
[ ] eventType 与标题一致
[ ] summary 40~80 字，无模板文案
[ ] content Markdown 合规，字数落窗
[ ] eventDateLabel / startDate / endDate 一致且事实可查
[ ] location / boothNumber / externalUrl 按事实填写
[ ] seoTitle / seoDesc 已复核
[ ] coverImage = content/trade-show-{slug}-hero.webp
[ ] detailCoverImage = content/trade-show-{slug}-detail-hero.webp（独立文件）
[ ] coverImage !== detailCoverImage
[ ] images[] ≥ 1，正文内嵌一致
[ ] WebP 均 < 500KB，HEAD 200
[ ] 列表可见封面；详情 Hero 为宽幅详情封面
[ ] Event JSON-LD 日期/地点正确
[ ] 营销弹窗（如启用）：popupImage/popupContent/ctaText 合规
[ ] API + HTML curl 验收通过（等缓存）
```

### C. 与案例/新闻/博客方案对照

| 项 | 案例 | 新闻 | 博客 | 展会（本方案） |
|---|---|---|---|---|
| 列表封面 | `coverImage` | `coverImage` | `coverImage` | `coverImage`（已出图） |
| 详情宽幅 | `detailCoverImage` | `detailCoverImage` | `detailCoverImage` | `detailCoverImage`（字段已落地，待填） |
| 正文目标 | 800~1200 字 | 600~1200 字 | 800~1500 字 | **500~900 字** |
| 亮点/规格 | 有 | 不做 | 不做 | **不做**（用活动字段承载） |
| 一致性 | 同一栋建筑 | 同一主题 | 同一主题/产品线 | **同一展会/品牌场景** |
| 资源前缀 | `content/case-` | `content/news-` | `content/blog-` | `content/trade-show-` |
| 特殊能力 | — | — | — | **Event JSON-LD + 营销弹窗** |
| 验收 | curl/HTML，禁浏览器 MCP | 同左 | 同左 | 同左 |

---

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-06 | 初稿：基于本地快照 4 条 published 盘点；对齐已落地的 TradeShow `detailCoverImage` 全链路、列表出图与营销弹窗字段 |
