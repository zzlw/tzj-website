# 博客中心全量内容优化与 AI 生图技术方案

> 日期：2026-08-06
> 状态：待评审（数据盘点基于本地开发库 `tzj_dev`，为生产快照恢复，结论以生产复核为准）
> 范围：`apps/api`（Blog 数据与发布）、`apps/web`（`/zh-CN/resources/blog` 列表/详情）、
> `apps/admin`（博客表单）、AI 生图资产与 OSS 上传
> 关联：`docs/case-center-content-ai-enrichment-plan.md`（案例中心同构方案）、
> `docs/news-center-content-ai-enrichment-plan.md`（新闻中心同构方案）、
> `docs/web-seo-assessment-and-plan.md`、`docs/web-image-loading-optimization.md`、
> `AGENTS.md`（生产数据唯一权威 `REDACTED-IP`，禁止直接改生产库）

## 结论先行

博客中心本地快照共 **9 条**（8 published + 1 draft）。与案例/新闻相比，博客是「技术指南 /
设计理念」体裁，数据量小但内容完成度最低：

| 维度 | 现状 |
|---|---|
| 正文长度 | **全部偏短**：163~515 字（去空白），不足以支撑「训练塔规划指南」「年检指南」类主题 |
| `coverImage` | 9/9 有值，但全部来自**全站通用素材**（`/media/*`、`images/*`），与产品页/解决方案页同图；其中 `burn-room.webp` 被 2 条博客共用 |
| `detailCoverImage` | **0/9**（字段已落地，全部回退列表封面） |
| `images[]` | 9/9 仅 1 张且与封面同文件；**正文无内嵌图** |
| `readTime` | 与正文明显不匹配（如 515 字标「8 分钟」，220 字标「1 分钟」） |
| SEO | 9/9 有 `seoTitle/seoDesc`，但内容重写后需复核关键词 |
| 草稿 | `burn-room-temperature`（163 字）待业务决策 |

本方案给出可批量复制的执行框架：

1. **先盘点后生产**：9 条全量清单 + 内容分层 + 草稿决策（阶段 A），产出物直接可执行。
2. **内容包标准化**：按 `category` 定义字数窗口与章节模板，扩写至 800~1500 字；
   复用 API 自动摘要/阅读时长逻辑，不做 `highlights`/`specs`。
3. **双封面 + 图集生图**：每条独立生产 `coverImage`（16:9）与 `detailCoverImage`
   （约 3:1 宽幅），另配 2~3 张图集并正文内嵌；资源统一 `content/blog-{slug}-*`，
   不再复用全站通用素材。
4. **主题视觉一致**：按「同一主题/产品线」约束封面与配图（不是案例的「同一栋建筑」，
   但禁止跨主题拼图）。
5. **分批发布 + 验收门禁**：先 1 条样板确认，再按分类铺开；验收包含 readTime 校正与
   静态源/DB 对齐。

> **Schema 说明**：`Blog.detailCoverImage` 已于 2026-08-06 通过迁移
> `20260806140000_add_blog_detail_cover_image` 加入；Admin 表单已有「封面图 / 详情页封面图」；
> C 端列表已出 `coverImage`，详情 Hero 已优先 `detailCoverImage`。
> 本方案**不再**讨论「要不要加详情封面字段」，只规定如何把内容与图填满。

---

## 目录

- 一、现状盘点（含数据模型与已落地代码）
- 二、目标与原则
- 三、内容规范（字段标准 / 正文模板 / 事实来源核对）
- 四、AI 生图规范（双封面 + 主题一致性）
- 五、技术落地（盘点分流 / 内容生产 / 生图 / 可选增强 / 发布验证）
- 六、验收标准
- 七、工作量与排期估算
- 八、风险与依赖
- 附：待优化博客清单与批次验收模板

---

## 一、现状盘点

### 1.1 数据规模（本地快照实测，2026-08-06）

| 维度 | 数值 |
|---|---|
| Blog 总数 | 9 条（8 published + 1 draft） |
| 分类分布 | `training_facility` 2 / `practice` 2 / `industry` 2 / `burn_room` 2（含 1 draft）/ `modular` 1 |
| 正文长度 | 163~515 字（去空白），全部未达指南类文章标准 |
| 封面 | 9/9 有值；`burn-room.webp` 被 2 条共用；全部为全站通用素材 |
| `detailCoverImage` | **0 / 9** 已填写（全部回退列表封面） |
| `images[]` | 9/9 仅 1 张，且与 `coverImage` 同文件 |
| 正文内嵌图 | **0** |
| `readTime` | 与正文明显不匹配 |
| SEO | 9/9 有值（重写后复核） |
| 精选 | `plan-fire-training-tower` |
| 草稿 | `burn-room-temperature`（`burn_room`，163 字） |

验收入口：

- 列表：`http://localhost:3001/zh-CN/resources/blog`（精选大卡 + 网格卡片均展示 `coverImage`）
- 详情：`http://localhost:3001/zh-CN/resources/blog/{slug}`（Hero = `detailCoverImage ?? coverImage`）
- API：`GET /api/v1/blogs`、`GET /api/v1/blogs/{slug}`
- Admin：博客表单字段「封面图」「详情页封面图」

### 1.2 已落地代码（本方案依赖的事实）

| 层 | 行为 |
|---|---|
| Prisma `Blog` | `coverImage String?`；`detailCoverImage String?`（注释：详情页宽幅封面，与列表封面分离；未设置时 C 端回退） |
| 迁移 | `20260806140000_add_blog_detail_cover_image`（生产 `migrate deploy`；本地按规范 `db push`） |
| DTO / types | `apps/api/src/blogs/dto/blog.dto.ts`、`packages/types`、`apps/admin/src/features/types.ts` 已含字段 |
| Admin | `coverImage` 帮助文案「建议比例 16:9」；`detailCoverImage`「约 3:1；留空则默认使用封面图」；`folder=blog` |
| Web 列表 | 精选大卡 + 网格卡片均渲染 `pickCoverImage(p.coverImage)`（本轮已加） |
| Web 详情 | `heroImage = detailCoverImage ?? coverImage`；OG/JSON-LD 的 `image` 仍用列表封面 `coverImage`（本轮已加） |
| Media 引用守卫 | `media-guard.service.ts` 已把博客 `detailCoverImage` 纳入引用扫描 |
| API 服务 | 更新 `content`/`excerpt` 时自动重算 `readTime`（`estimateReadTime`）与摘要；批量脚本需走同一逻辑 |

### 1.3 与案例/新闻中心的模型差异

| 能力 | Case | News | Blog（当前） |
|---|---|---|---|
| 定位 | 工程交付证明 | 公司/行业动态 | **技术指南 / 设计理念** |
| 列表封面 | `coverImage` | `coverImage`（列表已出图） | `coverImage`（列表已出图） |
| 详情宽幅封面 | `detailCoverImage` | `detailCoverImage`（已填） | `detailCoverImage`（字段已落地，**未填**） |
| 亮点/规格 | `highlights` / `specs` | 无 | **无**（用正文结构承载，不新增） |
| 分类 | `caseType` | `category`：company/industry/knowledge/equipment | `category`：training_facility/burn_room/modular/practice/industry |
| 发布时间 | 非主轴 | 主轴 | 排序与 SEO 关键 |
| 精选/置顶 | `isFeatured` | `isTop` | `isFeatured`（列表首页首屏精选大卡） |
| 视觉一致性 | 同一栋建筑 | 同一主题 | **同一主题/产品线** |
| 资源前缀 | `content/case-` | `content/news-` | `content/blog-`（本方案目标） |

### 1.4 静态源与 DB 的关系

- `apps/web/src/lib/blog.ts` 静态种子共 9 条，与 DB 9 条 slug 一致（DB 为 8 published + 1 draft）。
- 该文件只服务 seed、`static-media-paths.ts` 与静态资源清单，**不是线上博客列表/详情数据源**；
  改它不会让 `/resources/blog` 内容变化，也会与 DB 分叉。
- 本方案新增媒体资产时同步 `static-media-paths.ts`（追加 `/media/blog-*.webp`），但**不**通过
  修改 `blog.ts` 来改线上数据。

### 1.5 现状问题

1. **正文过短**：9 条全部 <600 字，`plan-fire-training-tower` 作为精选也只有 515 字，
   撑不起「从目标到落地的完整指南」标题。
2. **封面全站通用**：`burn-room.webp / modular-hero.jpg / tower-wylie.jpg / tower-eastside.jpg /
   galvanized-stair.webp / modular-construction.jpg / maritime-astoria.jpg / hazmat-trailer.webp`
   同时出现在产品目录、解决方案、新闻种子等位置；列表出图后博客与产品页视觉重复，
   且 `burn-room.webp` 被 2 条博客共用。
3. **详情宽幅字段空置**：Hero 全部回退列表图，宽幅构图与导航安全区未体现。
4. **图集未形成能力**：`images[]` 只有封面单张，正文无内嵌图；Admin 未暴露图集编辑。
5. **readTime 失真**：当前值来自种子/旧字段，与正文长度不匹配，影响阅读预期与 SEO 展示。
6. **草稿未决**：`burn-room-temperature` 需要业务决定「补全发布」或「下线」。
7. **缺少内容规划**：8 篇已发布文章彼此孤立，未按「规划→选型→维护→训练实践→行业观察」
   形成知识体系。

### 1.6 语言范围

**只做中文（zh-CN）**；不扩展多语言子表；不为本方案再增 schema（`detailCoverImage` 已存在）。

---

## 二、目标与原则

### 2.1 目标

- 全部发布博客达到「指南级正文 + 列表封面 + 详情宽幅封面 + 图集内嵌 + SEO/readTime 准确」。
- `/resources/blog` 形成可识别的技术内容体系，而不是产品页素材的复读。
- 过程可批量、可复核；草稿有明确结论；禁止直连生产库手改。

### 2.2 原则

| 原则 | 说明 |
|---|---|
| 真实优先 | 按既有事实口径扩写；不编造参数、不虚构客户/项目 |
| 指南体裁 | 不做 `highlights`/`specs`；用结构化正文承载知识 |
| 双封面分离 | `coverImage` 与 `detailCoverImage` **独立生图、独立文件**；禁止同一 URL 填两列 |
| 主题视觉一致 | 封面、详情封面、图集同属一主题；禁止跨主题拼图 |
| 不复用通用素材 | 博客封面/图集不再使用 `/media/*` 产品图或其它模块默认图 |
| AI 图实拍级、无水印 | 同案例/新闻方案 |
| 以现有字段为锚 | 围绕 `title/category/excerpt/content/publishedAt` 扩写，不改事实口径 |
| readTime 自动 | 重写后走 API 自动估算，不手工填写 |
| 数据走正规通道 | 后台或审批脚本；本地禁止 `migrate dev/reset` |

---

## 三、内容规范（每篇博客「内容包」）

### 3.1 字段级标准

| 字段 | 要求 | 示例 / key |
|---|---|---|
| `title` | 信息明确，一般 ≤ 36 字 | 如何规划一座实战火场训练塔 |
| `slug` | 英文 kebab，稳定后不改 | `plan-fire-training-tower` |
| `category` | 五选一；纠偏需业务确认 | `training_facility` |
| `excerpt` | 60~100 字；禁模板/电话文案 | 见 3.3 锚点 |
| `content` | Markdown；字数见 3.1.1；固定章节 | — |
| `coverImage` | **列表封面** 16:9，OSS | `content/blog-{slug}-hero.webp` |
| `detailCoverImage` | **详情页封面** 约 3:1，独立生图 | `content/blog-{slug}-detail-hero.webp` |
| `images[]` | 2~3 张配图，与正文内嵌同源 | `content/blog-{slug}-gallery-{n}.webp` |
| `seoTitle` / `seoDesc` | 约 60 / 120 字内；重写后复核 | — |
| `readTime` | **由 API 自动估算**，不手工填 | — |
| `publishedAt` | 保留既有时间，不随意刷新 | — |
| `isFeatured` / `status` | 精选保留；达标后 published | — |

#### 3.1.1 正文字数窗口（按 category）

| category | 目标字数（去空白） | 说明 |
|---|---|---|
| `training_facility` | 1000~1500 | 规划 / 选型 / 年检指南 |
| `burn_room` | 900~1300 | 技术原理 / 维护 / 选型 |
| `modular` | 900~1300 | 对比 / 分期 / 扩展 |
| `practice` | 900~1300 | 训练科目 / 场景设计 |
| `industry` | 800~1200 | 行业观察 / 趋势解读（改写稿） |

> 参考：当前 9 条正文 163~515 字，全部需要加厚；`plan-fire-training-tower` 作为精选应达到
> 1500 字左右，成为博客中心的标杆长文。

### 3.2 正文章节模板（Markdown）

#### A. training_facility

```text
## 问题定义

## 决策要点

（子项用 ###：训练目标 / 场地评估 / 塔型选型 / 预算与分期）

## 落地建议

## 小结
```

#### B. burn_room

```text
## 工作原理

## 关键特性

## 维护与选型

## 小结
```

#### C. modular

```text
## 对比背景

## 核心差异

（材料 / 结构 / 扩展性 / 全生命周期成本）

## 适用场景

## 选型建议
```

#### D. practice

```text
## 训练痛点

## 场景设计

## 组训建议

## 小结
```

#### E. industry（改写稿）

```text
## 要闻摘要

## 与训练设施建设的关联

## 我们的观察
```

#### 3.2.1 排版与间距规范

- `##`/`###` 前后必须有空行；禁止 `**伪标题**`；禁止 `####`+；
- 段与段之间空行；列表项之间不空行，列表前后各留空行；
- 正文内嵌图片前后各留空行；图片不紧贴标题/段落；
- 清洗 `style=` / `text-indent` / 字体标签等 HTML 残留；
- 详情由 `MarkdownBody` 渲染；校验脚本断言标题空行、无伪标题、无模板黑名单、无 HTML 脏样式。

### 3.3 锚点字段示例（以 `plan-fire-training-tower` 为例）

| 锚点 | 值（现有记录） |
|---|---|
| 标题 | 如何规划一座实战火场训练塔：从目标到落地的完整指南 |
| 分类 | training_facility |
| 摘要要点 | 训练目标拆解、场地评估、塔型选型、预算与分期建设 |
| 画面 | 训练塔 / 训练场地规划场景，而非产品页局部特写 |

- 扩写时围绕「从目标到落地」的决策流程展开，章节间保持递进；
- 生图时画面必须是「训练塔 + 场地 + 规划/建设语境」，不得用产品目录同图。

### 3.4 事实来源与核对

| 陈述 | 来源 | 无法确认时 |
|---|---|---|
| 训练科目/设施类型 | 既有正文、产品资料、已发布案例 | 不写量化参数 |
| 维护周期/检测项 | 年检服务资料、既有案例 | 弱化或删除 |
| 行业趋势/政策 | 可核验的公开来源 | 只写摘要 |
| 对比结论 | 既有技术资料 | 标注适用边界 |

### 3.5 封面更新与缓存

- 列表：`coverImage`；详情 Hero：`detailCoverImage ?? coverImage`；
- OG/JSON-LD：当前实现用 `coverImage`（分享图与列表一致即可）；
- `revalidate: 60`：验收等 60s 或强刷；用 curl/HTML，**不用浏览器 MCP**；
- 勿把 `apps/web/src/lib/blog.ts` 当线上详情数据源。

### 3.6 正文内嵌图集

| 项 | 要求 |
|---|---|
| 方式 | `content` 内 `![alt](url)`，前后空行 |
| 数量 | ≥ 2（推荐 3） |
| alt | `{标题} · {视角}（n/m）` |
| 一致 | URL ∈ `images[]` |
| 图床 | `content/blog-{slug}-*.webp` |
| 不内嵌 | `coverImage` / `detailCoverImage` 不进正文 |

---

## 四、AI 生图规范

### 4.1 产出与规格

> 每篇博客：**1 张列表封面 + 1 张详情页宽幅封面 + 2~3 张配图**；
> 全部上传 OSS 并回填；配图正文内嵌；详情独立画廊本期不做。

| 用途 | 字段 | 数量 | 比例 | 最低尺寸 | 视角 |
|---|---|---|---|---|---|
| 列表封面 | `coverImage` | 1 | 16:9 | 1920×1080 | 主题主视觉，完整可读 |
| 详情页封面 | `detailCoverImage` | 1 | 约 3:1 | 1920×640 | **宽幅建立感**：优先俯视/斜俯约 45°~60° 或等价远景拉远；主题场景顶面/场地完整；**顶部约 1/4 留白**（固定导航遮挡区）；**独立生图，不与列表封面共用** |
| 配图 | `images[]` | 2~3 | 4:3 优先 | 1600×1200 | 细节 / 另一角度 / 使用场景 |

输出：WebP，单文件 < 500KB（`image-compression.ts`）。

### 4.2 主题一致性（硬性）

> **一篇博客 = 一个主题视觉身份。** 列表封面、详情封面、图集必须可识别为同一主题；
> 禁止把 `/media/*` 产品图、其它模块默认图直接塞进博客。

#### 4.2.1 主题身份表

主题对象、材质色调、场景、光照、旧图可用性（✅/❌/⚪）。
当前 9 条封面均为全站通用素材 → **默认 ❌，不参考**（可作产品细节参考，但不得直接复用）。

#### 4.2.2 生成方法

1. 先生成并审定 **列表封面** 为锚点；
2. **详情封面**、配图一律以锚点为参考图生成，只改机位/景别/画幅；
3. 详情封面提示词单独强调宽幅、俯视/远景、顶部留白（对齐案例/新闻 `detailCoverImage` 规范）；
4. 每篇资源统一 `content/blog-{slug}-*` 前缀，禁止跨主题复用。

#### 4.2.3 按分类画面倾向

| category | 倾向 |
|---|---|
| `training_facility` | 训练塔全景、场地规划、建设/年检场景 |
| `burn_room` | 燃烧室/衬里特写 + 训练中景 |
| `modular` | 模块化钢构、分期建设、扩展对比 |
| `practice` | 科目训练场景（人员仅远景剪影） |
| `industry` | 场景化配图；禁止伪造公文/报头 |

#### 4.2.4 禁止事项

- 列表/详情封面共用同一文件；
- 使用 `/media/*` 产品图或其它模块默认图作为博客封面；
- 跨主题拼图；同篇内光照/场景冲突；
- 水印/电话/乱码字/伪官网截图；
- 伪造媒体报头或红头文件。

### 4.3 风格基准

写实工业/训练摄影；中性天空；品牌红点缀；人员仅远景剪影；无真实单位名称、Logo、车牌、
地图坐标等可识别信息。

### 4.4 提示词要点

- 封面：16:9 主题主视觉；
- 详情封面：`ultra-wide establishing, suitable downward/oblique angle ~45-60° when aerial,
  generous empty margin in top third, subject lower in frame, no text, no watermarks`；
- 中文标语无法准确渲染则省略。

### 4.5 审核 checklist

- [ ] 与标题/摘要主题一致
- [ ] `coverImage` 与 `detailCoverImage` 为不同文件且画幅用途正确
- [ ] 详情封面顶部留白充足、主体不被「导航裁切感」顶死
- [ ] 无水印/乱码/正脸/涉密
- [ ] 配图与锚点同主题
- [ ] 未使用 `/media/*` 通用素材
- [ ] WebP < 500KB，HEAD 200

验证：**curl / HTML / 静态资源**，不用浏览器 MCP。

### 4.6 OSS 命名与压缩

```text
content/blog-{slug}-hero.webp
content/blog-{slug}-detail-hero.webp
content/blog-{slug}-gallery-{1..3}.webp
```

- 上传前压缩（WebP q80、最长边 2560、去 EXIF）；单文件 < 500KB；
- 同步 `static-media-paths.ts`（追加 `/media/blog-*.webp`）；
- 批次断言：无 >500KB WebP；`coverImage !== detailCoverImage`。

### 4.7 规模粗估

9 条 ×（2 封面 + 2~3 配图）≈ **45~70 张**。

---

## 五、技术落地（分阶段）

### 阶段 A：盘点与分流（0.5 天）

表头建议：

`slug | title | category | status | contentLen | readTime | coverKey | coverReuseGroup | hasDetailCover | seo? | 建议动作`

动作：`重写加厚` / `改写对比稿` / `补全发布` / `下线`。

**必须产出两个决策**：

1. `burn-room-temperature`（draft，163 字，`burn-room.webp`）：补全发布或下线；
2. `apps/web/src/lib/blog.ts` 与 DB 的 9 条 slug 对齐确认（当前一致），后续新增内容只写 DB，
   静态文件仅用于 seed/资源清单。

### 阶段 B：内容生产（按 category）

顺序：`training_facility → burn_room → modular → practice → industry`。

每类先做 1 条样板并由业务确认，再批量铺开；脚本形态参考
`apps/api/scripts/enrich-batch-news-remaining.ts`（新建 `enrich-blog-*.ts`）。

校验：

- 字数窗口（3.1.1）；
- `excerpt` 60~100 字；
- Markdown 排版（3.2.1）；
- `images.length ≥ 2` 且正文内嵌一致；
- 双封面均非空且 URL 不同；
- SEO 字段复核；
- 模板黑名单 / HTML 残留；
- `readTime` 由 API 自动重算（或脚本显式调用 `estimateReadTime`）。

### 阶段 C：AI 生图

锚点冻结 → 列表封面 → 详情封面（参考锚点）→ 配图 → 压缩上传 → 回填三字段 → 正文内嵌。

### 阶段 D：可选代码增强（内容上线不阻塞）

| 项 | 说明 | 优先级 |
|---|---|---|
| D0 | DB + OSS + `static-media-paths`（必做） | P0 |
| D1 | 验证 `readTime` 自动重算链路（API 已实现） | P1 |
| D2 | Admin 暴露 `images[]` 编辑 | P3 |
| D3 | 详情轻量图集 | 另立项 |

> 双封面相关代码**已完成**，不在本阶段重复开发。

### 阶段 E：发布与验证

- API：双封面字段、无模板残留、`readTime` 合理；
- 列表 HTML 含 `blog-{slug}-hero`（或解析后的封面 URL）；
- 详情 HTML Hero 优先命中 `detail-hero`；
- OSS/本地 media HEAD 200；等 ~60s 缓存；
- `pnpm run check` + 三个 app typecheck 门禁。

---

## 六、验收标准（每篇博客）

1. `content` 干净 Markdown，字数落在 category 窗口；
2. `excerpt` 60~100 字，无模板/电话文案；
3. **`coverImage` 与 `detailCoverImage` 均已设且为不同 OSS key**；主题匹配；非 `/media/*` 通用素材；
4. `detailCoverImage` 为宽幅用途（约 3:1 产出），顶部留白可接受；
5. `images[]` ≥ 2，正文内嵌一致，alt 合规；WebP < 500KB；
6. `seoTitle` / `seoDesc` 已复核；
7. `readTime` 与正文匹配（API 自动估算）；
8. `burn-room-temperature` 已有结论（发布或下线）；
9. 校验脚本通过；curl/HTML 验收通过；
10. 无需脱敏；无虚假数据与涉密细节。

---

## 七、工作量与排期估算

| 阶段 | 内容 | 估算 |
|---|---|---|
| A | 盘点/草稿决策/静态源对齐 | 0.5 人日 |
| B | 9 条 ×（扩写 1~1.5h + 审定） | 2~3 人日 |
| C | 9 条 × 5~7 张（生成+审核+上传） | 1~2 人日（与 B 并行） |
| D | 可选小改（readTime 验证 / Admin images[]） | 0~1 人日 |
| E | 发布 + 全量验证 | 0.5 人日 |
| **合计** | | **约 4~7 人日** |

相对案例/新闻更轻，但内容为指南类长文，人工审定权重高于批量改写。

---

## 八、风险与依赖

| 风险/依赖 | 影响 | 对策 |
|---|---|---|
| 正文扩写后与产品资料冲突 | 技术内容可信度 | 以现有字段为锚 + 事实清单；拿不准不写 |
| 封面继续用通用素材 | 列表视觉重复、一眼假 | 硬门禁：非 `content/blog-*` 即失败 |
| AI 图跨图不一致 | 主题观感受损 | 锚点 + 参考图生成 + 逐图比对 |
| `readTime` 失真未修 | 阅读预期与 SEO 展示异常 | 重写后走 API 自动估算并校验 |
| 静态源/DB 分叉 | 误改 `blog.ts` 以为线上生效 | 方案明确静态文件角色；验收检查 slug 对齐 |
| 草稿决策悬置 | 页面少一篇内容 | 阶段 A 输出决策，业务一次拍板 |
| 生产误操作 | 数据事故 | 只动本地；真生产仅 `REDACTED-IP`；后台/审批脚本写入 |

依赖：已落地的 Blog `detailCoverImage` 全链路；`image-compression.ts`；Admin 双图上传；
C 端列表/详情渲染。

---

## 附：待优化博客清单与批次验收模板

### A. 当前清单（2026-08-06 本地快照）

| slug | 标题 | 分类 | 状态 | 正文（去空白） | readTime | 封面 key | 建议动作 |
|---|---|---|---|---|---|---|---|
| `plan-fire-training-tower` | 如何规划一座实战火场训练塔 | training_facility | published | 515 字 | 8 分钟 | `tower-wylie.jpg` | 加厚至 ~1500 字，保留精选 |
| `interlock-liner-durability` | 互锁隔热衬里，为什么更耐用 | burn_room | published | 277 字 | 6 分钟 | `burn-room.webp` | 加厚至 ~1000 字 |
| `modular-scalability` | 模块化训练系统的“可成长性” | modular | published | 226 字 | 5 分钟 | `modular-hero.jpg` | 加厚至 ~1000 字 |
| `hazmat-realistic-training` | 危化品训练场景如何更贴近实战 | practice | published | 241 字 | 7 分钟 | `hazmat-trailer.webp` | 加厚至 ~1000 字 |
| `steel-vs-masonry-tower` | 钢结构训练塔 vs 砌体训练塔 | industry | published | 190 字 | 6 分钟 | `galvanized-stair.webp` | 改写对比稿至 ~900 字 |
| `tower-annual-inspection` | 训练塔年检：你需要知道的关键点 | training_facility | published | 243 字 | 5 分钟 | `tower-eastside.jpg` | 加厚至 ~1100 字 |
| `modular-vs-containers` | 模块化系统为什么优于集装箱改造 | industry | published | 220 字 | 1 分钟 | `modular-construction.jpg` | 改写对比稿至 ~900 字 |
| `maritime-training` | 海事训练：把船舶火场搬上陆地 | practice | published | 212 字 | 6 分钟 | `maritime-astoria.jpg` | 加厚至 ~1000 字 |
| `burn-room-temperature` | 燃烧室温度控制与热成像训练 | burn_room | **draft** | 163 字 | 5 分钟 | `burn-room.webp` | **业务决策：补全发布或下线** |

### B. 单篇验收清单

```text
[ ] slug: ________
[ ] category 正确
[ ] excerpt 60~100 字，无模板文案
[ ] content Markdown 合规，字数落窗
[ ] seoTitle / seoDesc 已复核
[ ] coverImage = content/blog-{slug}-hero.webp（非 /media/* 通用素材）
[ ] detailCoverImage = content/blog-{slug}-detail-hero.webp（独立文件）
[ ] coverImage !== detailCoverImage
[ ] images[] ≥ 2，正文内嵌一致
[ ] WebP 均 < 500KB，HEAD 200
[ ] readTime 与正文匹配（API 自动估算）
[ ] 列表可见封面；详情 Hero 为宽幅详情封面
[ ] API + HTML curl 验收通过（等缓存）
```

### C. 与案例/新闻方案对照

| 项 | 案例 | 新闻 | 博客（本方案） |
|---|---|---|---|
| 列表封面 | `coverImage` | `coverImage`（已出图） | `coverImage`（已出图） |
| 详情宽幅 | `detailCoverImage` | `detailCoverImage`（已填） | `detailCoverImage`（字段已落地，待填） |
| 亮点/规格 | 有 | 不做 | **不做** |
| 一致性 | 同一栋建筑 | 同一主题 | **同一主题/产品线** |
| 资源前缀 | `content/case-` | `content/news-` | `content/blog-` |
| 验收 | curl/HTML，禁浏览器 MCP | 同左 | 同左 |

---

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-06 | 初稿：基于本地快照 9 条（8 published + 1 draft）盘点；对齐已落地的 Blog `detailCoverImage` 全链路与列表出图 |
