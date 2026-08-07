# 新闻资讯全量内容优化与 AI 生图技术方案

> 日期：2026-08-06（修订：对齐封面图 / 详情页封面图已落地代码）
> 状态：待评审（数据盘点基于本地开发库 `tzj_dev`，为生产快照恢复，结论以生产复核为准）
> 范围：`apps/api`（News 数据与发布）、`apps/web`（`/zh-CN/resources/news` 列表/详情）、`apps/admin`（新闻表单）、AI 生图资产与 OSS 上传
> 关联：`docs/case-center-content-ai-enrichment-plan.md`（案例中心同构方案）、
> `docs/web-seo-assessment-and-plan.md`、
> `docs/web-image-loading-optimization.md`、
> `AGENTS.md`（生产数据唯一权威 `REDACTED-IP`，禁止直接改生产库）

## 结论先行

新闻资讯本地快照共 **26 条**（25 published + 1 draft）。内容侧仍以模板摘要、旧站 HTML、封面撞图为主；**图片字段能力已与案例对齐到「双封面」**：

| 字段 | 用途（已落地） | 现状 |
|---|---|---|
| `coverImage` | **列表封面图**（16:9）；亦作 OG / JSON-LD 分享图；未设详情封面时回退 | 26 条均有值，但约 **20 条撞同一张旧图** |
| `detailCoverImage` | **详情页宽幅封面**（约 3:1）；详情 Hero 优先用它 | Schema / Admin / C 端已通；本地 **全部为 null**（回退 `coverImage`） |
| `images[]` | 正文内嵌配图集合 | 有数据，无独立画廊 UI |

本方案给出可批量复制的执行框架：

1. **先盘点后生产**：全量清单 + 分类分层 + 撞图/模板稿/转载稿分流（阶段 A）。
2. **内容包标准化**：摘要 + Markdown 正文 + SEO + 分类/发布时间；**仍不引入**案例侧的 `highlights` / `specs`（News 无此字段，也不需要）。
3. **双封面 + 图集生图**：每条必须独立生产 `coverImage`（16:9）与 `detailCoverImage`（约 3:1，俯视/宽幅建立感），二者**不得共用同一文件**；另配 2~3 张图集并正文内嵌。
4. **主题视觉一致**：新闻按「同一主题场景/产品线」约束封面与配图（不是案例的「同一栋建筑」，但禁止跨主题拼图）。
5. **按 `category` 分批 + 验收门禁**：`company → equipment → knowledge → industry`。

> **Schema 说明**：`detailCoverImage` 已通过迁移
> `apps/api/prisma/migrations/20260806120000_add_news_detail_cover_image/migration.sql` 加入；
> Admin 表单已有「封面图 / 详情页封面图」；C 端列表已出 `coverImage`，详情 Hero 已优先 `detailCoverImage`。
> 本方案**不再**讨论「要不要加详情封面字段」——只规定如何把内容与图填满。

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
- 附：待优化新闻清单与批次验收模板

---

## 一、现状盘点

### 1.1 数据规模（本地快照实测，2026-08-06）

| 维度 | 数值 |
|---|---|
| News 总数 | 26 条（1 draft + 25 published） |
| 分类分布 | knowledge 8 / industry 7 / equipment 6 / company 5 |
| 列表封面撞图 | **20 条**共用 `images/202204/67522c66631.jpg`；全库仅约 **7** 个不同 `coverImage` |
| `detailCoverImage` | **0 / 26** 已填写（全部回退列表封面） |
| 模板摘要/正文残留 | 约 **12** 条命中「河南拓之迹 / 专业拓展器材 / 为广大客户」等 |
| SEO 空置 | 约 **20** 条缺 `seoTitle` 或 `seoDesc`（多为 `newsshow-*`） |
| 正文过短 | 约 **6** 条种子短文（去空白 &lt; 400 字） |
| 正文过长/转载风险 | 若干 `industry` 稿达 2 万+ 字 |

验收入口：

- 列表：`http://localhost:3001/zh-CN/resources/news`（行内展示 `coverImage`）
- 详情：`http://localhost:3001/zh-CN/resources/news/{slug}`（Hero = `detailCoverImage ?? coverImage`）
- API：`GET /api/v1/news`、`GET /api/v1/news/{slug}`
- Admin：新闻表单字段「封面图」「详情页封面图」

### 1.2 已落地代码（本方案依赖的事实）

| 层 | 行为 |
|---|---|
| Prisma `News` | `coverImage String?`；`detailCoverImage String?`（注释：详情页宽幅封面，与列表封面分离；未设置时 C 端回退） |
| 迁移 | `20260806120000_add_news_detail_cover_image`（生产 `migrate deploy`；本地按规范 `db push`） |
| DTO / types | `apps/api/src/news/dto/news.dto.ts`、`packages/types`、`apps/admin/src/features/types.ts` 已含字段 |
| Admin | `coverImage` 帮助文案「建议比例 16:9」；`detailCoverImage`「约 3:1；留空则默认使用封面图」；`folder=news` |
| Web 列表 | `pickCoverImage(n.coverImage)` 缩略图（`aspect-[16/9]` / md `16/10`） |
| Web 详情 | `heroImage = detailCoverImage ?? coverImage`；OG/JSON-LD 的 `image` 仍用列表封面 `coverImage` |
| Media 引用守卫 | `media-guard.service.ts` 已把新闻 `detailCoverImage` 纳入引用扫描 |

### 1.3 与案例中心的模型差异

| 能力 | Case | News（当前） |
|---|---|---|
| 列表封面 | `coverImage` | `coverImage`（**列表已出图**） |
| 详情宽幅封面 | `detailCoverImage` | `detailCoverImage`（**已对齐**） |
| 正文 | `description` | `content` |
| 亮点 / 规格 | `highlights` / `specs` | **无**（本方案不新增） |
| 分类 | `caseType` | `category`：`company` / `industry` / `knowledge` / `equipment` |
| 发布时间 | 非主轴 | `publishedAt` 为排序与 SEO 关键 |
| 置顶 | `isFeatured` | `isTop`（列表默认排序是否读 isTop 见阶段 D） |

### 1.4 标杆内容构成（对齐基准）

种子短文可作语气参考，但**字数与双封面未达标**：

| 字段 | 当前典型 | 本方案目标 |
|---|---|---|
| `summary` | 约 35~50 字，部分为模板 | 60~100 字 |
| `content` | 种子 240~350 字；迁移稿 HTML 杂乱 | 按分类窗口；干净 Markdown |
| `coverImage` | 撞图或通用塔体图 | 主题匹配 16:9 独立图 |
| `detailCoverImage` | null | 主题匹配约 3:1 独立宽幅图 |
| `images[]` | 常与封面同源 | 2~3 张主题一致配图（正文内嵌） |
| `seoTitle` / `seoDesc` | `newsshow-*` 多空 | 全部必填 |

### 1.5 现状问题

1. **列表已出图，撞图伤害被放大**：20 条共用封面，列表一眼假。
2. **详情宽幅字段空置**：Hero 全部回退列表图，宽幅构图与导航安全区未体现。
3. **摘要模板化**、**正文 HTML 脏**、**行业超长转载**、**SEO 空置**（同前版盘点）。
4. **`images[]` 未形成产品能力**：Admin 未暴露图集编辑；C 端无画廊；本期用正文内嵌承接。
5. **slug 历史**：如 `1000-projects-milestone` → `turnkey-delivery-network`，合并时保留 301。

### 1.6 语言范围

**只做中文（zh-CN）**；不扩展多语言子表；不为本方案再增 schema（`detailCoverImage` 已存在）。

---

## 二、目标与原则

### 2.1 目标

- 全部发布新闻达到「可读正文 + 列表封面 + 详情宽幅封面 + SEO 完整」。
- `/resources/news` 列表与详情均具备可分享、可辨识的视觉身份。
- 过程可批量、可复核；禁止直连生产库手改。

### 2.2 原则

| 原则 | 说明 |
|---|---|
| 真实优先，无需脱敏 | 按既有事实口径；不编造未发生交付/参数 |
| 双封面分离 | `coverImage` 与 `detailCoverImage` **独立生图、独立文件**；禁止同一 URL 填两列 |
| 新闻体裁 | 不做 `highlights`/`specs`；章节服务资讯阅读 |
| 主题视觉一致 | 封面、详情封面、图集同属一主题 |
| AI 图实拍级、无水印 | 同案例方案 |
| 转载慎用 | 超长 industry 改「摘要 + 启示」，不整篇搬运 |
| 以现有字段为锚 | 围绕 `title/category/summary/content/publishedAt` 扩写 |
| HTML → Markdown | 旧站样式标签一律清洗 |
| 数据走正规通道 | 后台或审批脚本；本地禁止 `migrate dev/reset` |

---

## 三、内容规范（每条新闻「内容包」）

### 3.1 字段级标准

| 字段 | 要求 | 示例 / key |
|---|---|---|
| `title` | 信息明确，一般 ≤ 36 字 | 互锁隔热衬里完成新一轮迭代升级 |
| `slug` | 英文 kebab，稳定后不改 | `interlock-liner-upgrade` |
| `category` | 四选一；纠偏需业务确认 | `equipment` |
| `summary` | 60~100 字；禁公司电话模板 | — |
| `content` | Markdown；字数见 3.1.1；固定章节 | — |
| `coverImage` | **列表封面** 16:9，OSS | `content/news-{slug}-hero.webp` |
| `detailCoverImage` | **详情页封面** 约 3:1，独立生图 | `content/news-{slug}-detail-hero.webp` |
| `images[]` | 2~3 张配图，与正文内嵌同源 | `content/news-{slug}-gallery-{n}.webp` |
| `seoTitle` / `seoDesc` | 约 60 / 120 字内 | — |
| `publishedAt` | 保留既有时间，不随意刷新到今天 | — |
| `author` / `isTop` / `status` | 同前；达标后 published | — |

#### 3.1.1 正文字数窗口（按 category）

| category | 目标字数（去空白） | 说明 |
|---|---|---|
| `company` | 600~900 | 事件/里程碑 |
| `equipment` | 700~1000 | 产品/器材 |
| `knowledge` | 800~1200 | 问答/指南 |
| `industry` | 600~900（改写后） | 禁止保留 2 万字转载原文 |

### 3.2 正文章节模板（Markdown）

#### A. company

```text
## 事件概述

## 关键进展

## 意义与下一步
```

#### B. equipment

```text
## 背景需求

## 方案与构成

## 适用场景

## 选型建议
```

#### C. knowledge

```text
## 问题定义

## 要点拆解

## 实践建议

## 小结
```

#### D. industry（改写稿）

```text
## 要闻摘要

## 与训练设施建设的关联

## 我们的观察
```

#### 3.2.1 排版与间距

- `##`/`###` 前后空行；禁止 `**伪标题**`；禁止 `####`+；
- 段间空行；内嵌图前后空行；
- 清洗 `style=` / `text-indent` / `微软雅黑` 等 HTML；
- 详情由 `MarkdownBody` 渲染。

校验脚本断言：标题空行、无伪标题、无模板黑名单、无 HTML 脏样式、内嵌图 ≥ 2 且 ∈ `images[]`。

### 3.3 分类纠偏（盘点用）

| 现象 | 建议 |
|---|---|
| 产品百科标成 industry | → equipment / knowledge |
| 公司简介当新闻 | 改 company 并重写，或下线 |
| 超长通稿 | industry 改写摘要，或 draft |
| 种子与 newsshow 主题重复 | 合并 + 301 |

### 3.4 事实来源与核对

| 陈述 | 来源 | 无法确认 |
|---|---|---|
| 时间/展会/政策 | 既有正文、公开报道 | 弱化或删除 |
| 产品特性/数量 | 产品资料、已发布案例 | 不写量化 |
| 客户单位 | 既有口径 | 笼统表述 |
| 转载 | 可核验出处 | 只写摘要 |

### 3.5 锚点示例（`interlock-liner-upgrade`）

| 锚点 | 值 |
|---|---|
| 标题 / 分类 | 互锁隔热衬里… / equipment |
| 摘要要点 | 隔热与可维护、单块可拆换 |
| 画面 | 燃烧室/衬里，而非景区攀岩 |

### 3.6 封面更新与缓存

- 列表：`coverImage`；详情 Hero：`detailCoverImage ?? coverImage`；
- OG/JSON-LD：当前实现用 `coverImage`（分享图与列表一致即可）；
- `revalidate: 60`：验收等 60s 或强刷；用 curl/HTML，**不用浏览器 MCP**；
- 勿把 `apps/web/src/lib/news.ts` 当线上详情数据源。

### 3.7 正文内嵌图集

| 项 | 要求 |
|---|---|
| 方式 | `content` 内 `![alt](url)`，前后空行 |
| 数量 | ≥ 2（推荐 3） |
| alt | `{标题} · {视角}（n/m）` |
| 一致 | URL ∈ `images[]` |
| 图床 | `content/news-{slug}-*.webp` |
| 不内嵌 | `coverImage` / `detailCoverImage` 不进正文 |

---

## 四、AI 生图规范

### 4.1 产出与规格

> 每条新闻：**1 张列表封面 + 1 张详情页宽幅封面 + 2~3 张配图**；
> 全部上传 OSS 并回填；配图正文内嵌；详情独立画廊本期不做。

| 用途 | 字段 | 数量 | 比例 | 最低尺寸 | 视角 |
|---|---|---|---|---|---|
| 列表封面 | `coverImage` | 1 | 16:9 | 1920×1080 | 主题主视觉，完整可读 |
| 详情页封面 | `detailCoverImage` | 1 | 约 3:1 | 1920×640 | **宽幅建立感**：优先俯视/斜俯约 45°~60° 或等价远景拉远；主题场景顶面/场地完整；**顶部约 1/4 留白**（固定导航遮挡区）；**独立生图，不与列表封面共用** |
| 配图 | `images[]` | 2~3 | 4:3 优先 | 1600×1200 | 细节 / 另一角度 / 使用场景 |

输出：WebP，单文件 &lt; 500KB（`image-compression.ts`）。

### 4.2 主题一致性（硬性）

> **一条新闻 = 一个主题视觉身份。** 列表封面、详情封面、图集必须可识别为同一主题。

#### 4.2.1 主题身份表

主题对象、材质色调、场景、光照、旧图可用性（✅/❌/⚪）。  
**撞图组旧封面默认 ❌，不参考。**

#### 4.2.2 生成方法

1. 先生成并审定 **列表封面** 为锚点；
2. **详情封面**、配图一律 `reference_image_paths` 指向该锚点（或 ✅ 旧图），只改机位/景别/画幅；
3. 详情封面提示词单独强调宽幅、俯视/远景、顶部留白（对齐案例 `detailCoverImage` 规范）；
4. 禁止把无关 `case-*` 图直接塞进新闻。

#### 4.2.3 按分类画面倾向

| category | 倾向 |
|---|---|
| company | 交付/基地外景、服务场景（无敏感标识） |
| equipment | 器材特写 + 训练中景 |
| knowledge | 清晰科目示意 |
| industry | 场景化配图；禁止伪造公文/报头 |

#### 4.2.4 禁止

- 列表/详情封面共用同一文件；
- 跨主题拼图；使用撞图旧文件作参考；
- 水印/电话/乱码字/伪官网截图；
- 伪造媒体报头或红头文件。

### 4.3 风格基准

写实工业/训练摄影；中性天空；品牌红点缀；人员仅远景剪影。

### 4.4 提示词要点

- 封面：16:9 主题主视觉；
- 详情封面：`ultra-wide establishing, suitable downward/oblique angle ~45-60° when aerial, generous empty margin in top third, subject lower in frame, no text, no watermarks`；
- 中文标语无法准确渲染则省略。

### 4.5 审核 checklist

- [ ] 与标题/摘要主题一致
- [ ] `coverImage` 与 `detailCoverImage` 为不同文件且画幅用途正确
- [ ] 详情封面顶部留白充足、主体不被「导航裁切感」顶死
- [ ] 无水印/乱码/正脸/涉密
- [ ] 配图与锚点同主题
- [ ] 非撞图重生失败品
- [ ] WebP &lt; 500KB，HEAD 200

验证：**curl / HTML / 静态资源**，不用浏览器 MCP。

### 4.6 OSS 命名与压缩

```text
content/news-{slug}-hero.webp
content/news-{slug}-detail-hero.webp
content/news-{slug}-gallery-{1..3}.webp
```

- 上传前压缩；同步 `apps/web/public/media/` 时按现有案例做法更新 `static-media-paths.ts`（追加 `/media/news-*.webp`）；
- 批次断言：无 &gt;500KB WebP；`coverImage !== detailCoverImage`。

### 4.7 规模粗估

约 20~26 条 ×（2 封面 + 2~3 配图）≈ **80~130 张**。

---

## 五、技术落地（分阶段）

### 阶段 A：盘点与分流（0.5~1 天）

表头建议：

`slug | title | category | status | contentLen | summaryTpl? | coverKey | coverReuseGroup | hasDetailCover | seo? | 建议动作`

动作：`重做` / `加厚` / `改写摘要稿` / `合并/301` / `下线 draft`。  
旧图：✅ / ❌ / ⚪（撞图组 ❌）。

### 阶段 B：内容生产（按 category）

顺序：`company → equipment → knowledge → industry`。  
样板 1 条确认后批量；脚本形态参考 `apps/api/scripts/enrich-batch-news-*.ts`。

校验：字数窗口、双封面均非空且 URL 不同、`images.length` ≥ 2、SEO、模板黑名单、HTML 残留、排版、内嵌图。

### 阶段 C：AI 生图

锚点冻结 → 列表封面 → 详情封面（参考锚点）→ 配图 → 压缩上传 → 回填三字段 → 正文内嵌。

### 阶段 D：可选代码增强（内容上线不阻塞）

| 项 | 说明 | 优先级 |
|---|---|---|
| D0 | DB + OSS + static-media-paths（必做） | P0 |
| D1 | 列表排序尊重 `isTop` | P2 |
| D2 | Admin 暴露 `images[]` | P3 |
| D3 | 详情轻量图集 | 另立项 |

> 双封面相关代码**已完成**，不在本阶段重复开发。

### 阶段 E：发布与验证

- API：双封面字段、无模板残留；
- 列表 HTML 含 `news-{slug}-hero`（或解析后的封面 URL）；
- 详情 HTML Hero 优先命中 `detail-hero`；
- OSS/本地 media HEAD 200；等 ~60s 缓存。

---

## 六、验收标准（每条新闻）

1. `summary` 非电话模板；信息完整；
2. `content` 干净 Markdown，字数落在 category 窗口；
3. **`coverImage` 与 `detailCoverImage` 均已设且为不同 OSS key**；主题匹配；非撞图；
4. `detailCoverImage` 为宽幅用途（约 3:1 产出），顶部留白可接受；
5. `images[]` ≥ 2，正文内嵌一致，alt 合规；WebP &lt; 500KB；
6. `seoTitle` / `seoDesc` 已填；
7. 校验脚本通过；curl/HTML 验收通过；
8. 无需脱敏；无虚假数据与涉密细节。

---

## 七、工作量与排期估算

| 阶段 | 内容 | 估算 |
|---|---|---|
| A | 盘点/撞图/分流 | 0.5~1 人日 |
| B | ~20 重做 + ~6 加厚 + 改写 | 3~5 人日 |
| C | ~100±30 张生图（含详情封面） | 2~3 人日 |
| D | 可选小改 | 0~1 人日 |
| E | 校验发布 | 0.5 人日 |
| **合计** | | **约 6~10.5 人日** |

相对案例批次仍更轻；因增加详情封面，生图量高于「仅单封面」旧假设。

---

## 八、风险与依赖

| 风险 | 缓解 |
|---|---|
| 只改列表封面、忘记详情封面 | 验收硬门禁：两字段均非空且 URL 不同 |
| 两字段填同一 URL「偷懒」 | 脚本断言 `coverImage !== detailCoverImage` |
| 转载版权 | industry 只写摘要稿 |
| 列表出图放大撞图问题 | 阶段 A 打标；发布集封面 key 唯一性检查 |
| HTML→MD 丢信息 | 先提要点再改写 |
| 与案例资产混淆 | 强制 `news-` 前缀 |
| 生产误操作 | 只动本地；真生产仅 `REDACTED-IP` |

依赖：已落地的 News `detailCoverImage` 全链路；`image-compression.ts`；Admin 双图上传；C 端列表/详情渲染。

---

## 附：待优化新闻清单与批次验收模板

### A. 分层（执行前刷新盘点）

**加厚（种子短文）**  
`modular-system-adoption`、`1000-projects-milestone`（注意 redirect）、`hazmat-capability-expansion`、`service-network-upgrade`、`interlock-liner-upgrade`、`fire-equipment-expo`

**优先重做（模板 + 撞图）**  
多数 `newsshow-*`（器材/知识/公司广告类）

**行业长文改写**  
`newsshow-65-37`、`newsshow-65-35`、`newsshow-65-34`、`newsshow-65-33` 等

**草稿评估**  
`newsshow-67-43`

### B. 单条验收清单

```text
[ ] slug: ________
[ ] category 正确
[ ] summary 无模板电话文案
[ ] content Markdown 合规，字数落窗
[ ] seoTitle / seoDesc 已填
[ ] coverImage = content/news-{slug}-hero.webp（非撞图）
[ ] detailCoverImage = content/news-{slug}-detail-hero.webp（独立文件）
[ ] coverImage !== detailCoverImage
[ ] images[] ≥ 2，正文内嵌一致
[ ] WebP 均 < 500KB，HEAD 200
[ ] 列表可见封面；详情 Hero 为宽幅详情封面
[ ] API + HTML curl 验收通过（等缓存）
```

### C. 与案例方案对照

| 项 | 案例 | 新闻（本修订） |
|---|---|---|
| 列表封面 | `coverImage` | `coverImage`（列表已出图） |
| 详情宽幅 | `detailCoverImage` | `detailCoverImage`（**已对齐代码**） |
| 亮点/规格 | 有 | **不做** |
| 一致性 | 同一栋建筑 | 同一主题视觉 |
| 资源前缀 | `content/case-` | `content/news-` |
| 验收 | curl/HTML，禁浏览器 MCP | 同左 |

---

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-06 | 初稿（当时按「无 detailCoverImage」裁剪） |
| 2026-08-06 | **重写**：对齐已落地的 `coverImage`（列表）+ `detailCoverImage`（详情宽幅）；列表出图；双封面独立生图与验收门禁；取消「零 schema 不做详情封面」表述（字段已加）；仍不做 highlights/specs |
