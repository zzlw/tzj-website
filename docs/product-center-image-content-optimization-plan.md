# 产品中心图文优化技术方案

> 日期：2026-08-06（2026-08-07 修订：区块级配图与视觉密度）
> 状态：本地实施完成（2026-08-07；盘点基于本地代码与静态资源，无后台、无数据库依赖）
> 范围：`apps/web` 产品中心全部页面（`/towers` + 13 产品线 + 子页，共 **24 个路由**）、
> 静态媒体资产、i18n 文案、`product-catalog.ts` 单一数据源、SEO/OG 与性能
> 关联：`docs/case-center-content-ai-enrichment-plan.md`（AI 生图规范可复用）、
> `docs/news-center-content-ai-enrichment-plan.md`、`docs/blog-center-content-ai-enrichment-plan.md`、
> `docs/trade-shows-center-content-ai-enrichment-plan.md`（内容中心方案，用于对比）、
> `docs/web-image-loading-optimization.md`、`docs/web-seo-assessment-and-plan.md`、`AGENTS.md`

## 结论先行

产品中心与案例/新闻/博客/展会内容中心**有本质区别**：它不依赖后台维护、没有 API、没有
数据库、没有 Admin 表单，全部内容来自三处静态代码：

1. `apps/web/src/lib/product-catalog.ts` —— 13 条产品线的 id/序号/标题/链接/卡片图/描述；
2. `apps/web/src/messages/{zh-CN,zh-TW,en}/pages/*.json` —— 24 个页面的三语文案；
3. `apps/web/public/media` + OSS/MinIO —— 图片与视频资产（经 `static-media-paths.ts` 登记）。

这意味着「图文优化」= 一次代码 + 静态资产改造，不需要任何内容后台操作。

本地盘点结论：

| 维度 | 现状 |
|---|---|
| 页面规模 | 4 大板块、13 条产品线、24 个路由（含 hub、系列、定制、对比页） |
| 页面级图片 | 35 个唯一 `/media/*` 素材；其中 **10 个被 2+ 页面共用**（`burn-room.webp` 被 6 页使用） |
| 产品线卡片图 | 13 条线仅 **12 个唯一文件**；`galvanized-stair.webp` 同时用于「07 消防模拟」和「13 训练器械」 |
| 图片主题匹配 | 多条产品线使用通用塔体照片（`tower-hamilton/macon/denver/ocean-springs/eastside` 等），与产品内容不对应 |
| 缺图页面 | `/modular-tower/vs-containers`、`/burn-rooms/comparison` 无页面主图；`/towers` 仅靠卡片图 |
| **区块视觉密度** | **多页大量模块仅图标/纯文字**（场景道具、配置、适用单位、交钥匙、相关链接等），即使换了 hero 仍显「空」 |
| 视频 | 3 个 hero 视频本地 public 缺失，但 **MinIO 已确认全部可访问（HTTP 200）**；只需压缩、时长与 poster 复核 |
| SEO/OG | 24 个产品页 `createPageMetadata` 均未传 `image`，OG/Twitter 全部回退默认 `og-default.jpg` |
| 文案 | 三语文案集中在 24 个页面 JSON；最短页面（`towers.json` 约 300 字）信息量明显不足 |

> **2026-08-07 教训（海事样板）**：若方案只规定「hero + card + 顶部 3 张细节」，执行会停在
> 「主图替换完成」，但用户感知仍是「后面整页没图」。根因是方案**未把区块级配图写成硬门禁**。
> 本修订把「页面视觉密度」升为与主图同等约束，防止再出现同类偏差。

本方案给出：

1. **先盘点后替换**：建立「页面 × 素材 × 建议动作」清单，先清重复/错配，再补缺图。
2. **静态资产单一数据源**：所有新图进入 `product-catalog.ts` / 页面常量 + `static-media-paths.ts`，
   不新增后台、不改 DB、不加 API。
3. **图文标准（页面级 + 区块级）**：除 hero/card/OG 外，按区块定义「必须配图 / 允许图标 /
   全站共用组件」；产品线主图一律独立，禁止跨线共用。
4. **AI 实拍级生图为主**：当前无真实产品素材，本期以 AI 生成实拍级工业图为主；
   后续有真实交付/工厂实拍素材时再替换，并保持同一产品线视觉身份。
5. **性能与 SEO 门禁**：WebP < 500KB、视频压缩、OG 图逐页配置、typecheck/biome/curl 验收；
   **视觉密度门禁**见 3.1.1 / 第五章。

---

## 目录

- 一、现状盘点（页面矩阵 / 静态数据源 / 图片 / 文案 / SEO）
- 二、目标与原则（无后台边界）
- 三、图文与转化规范（页面分层 / 图片规格 / 命名 / 文案矩阵 / 复用红线 / 资产注册表 / 转化优化）
- 四、技术落地（盘点替换 / 身份表与生图 / 注册表接入 / 自动化验证 / 影响面回归）
- 五、验收标准
- 六、工作量与排期估算
- 七、风险与依赖
- 附：产品页面与素材清单、单页验收模板

---

## 一、现状盘点

### 1.1 页面矩阵（24 个路由）

#### A. 训练塔与建筑（10 页）

| 路由 | 页面类型 | 主要图片现状 |
|---|---|---|
| `/towers` | 产品中心 hub | 无页面主图；依赖 13 条产品线卡片图 |
| `/fixed-tower` | 产品线 overview | hero 视频 + 静态图；关联案例图 |
| `/fixed-tower/series` | 子页 | hero 视频 + 路径图 |
| `/fixed-tower/custom` | 子页 | hero 视频 + 定制图 |
| `/fixed-tower/climbing-tower` | 产品线 03 | 单图 `tower-hamilton.jpg` |
| `/modular-tower` | 产品线 overview | hero 视频 + 模块图 |
| `/modular-tower/series` | 子页 | M/O/D/X 系列图 |
| `/modular-tower/custom` | 子页 | 定制图 |
| `/modular-tower/vs-containers` | 对比页 | **无页面主图**，纯文字表格 |
| `/education-center` | 产品线 04 | 单图 `tower-macon.jpg` |

#### B. 实火与燃烧训练（5 页）

| 路由 | 页面类型 | 主要图片现状 |
|---|---|---|
| `/burn-rooms` | 家族 hub | hero 视频 + 衬里/改造图 |
| `/burn-rooms/liner` | 产品线 05 | 衬里图 + `burn-room.webp` |
| `/burn-rooms/comparison` | 对比页 | **无页面主图**，纯文字表格 |
| `/burn-rooms/cfbt` | 产品线 06 | 单图 `burn-room.webp`（与多页共用） |
| `/burn-rooms/fire-simulation` | 产品线 07 | 单图 `tower-chino.jpg`（主题不符） |

#### C. 专项场景训练（6 页）

| 路由 | 页面类型 | 主要图片现状 |
|---|---|---|
| `/specialized-training` | 家族 hub | 3 张节目卡片图 |
| `/accessories/maritime` | 产品线 08 | 海事三张现场图 |
| `/accessories/tactical` | 产品线 09 | 单图 `tactical.jpg` |
| `/accessories/hazmat` | 产品线 10 | 单图 `hazmat-trailer.webp` |
| `/specialized-training/rope-rescue` | 产品线 11 | 单图 `tower-denver.jpg`（主题不符） |
| `/specialized-training/psychological` | 产品线 12 | 单图 `tower-ocean-springs.jpg`（主题不符） |

#### D. 训练器械与道具（3 页）

| 路由 | 页面类型 | 主要图片现状 |
|---|---|---|
| `/accessories` | 家族 hub | hero `tower-eastside.jpg`（主题偏塔体） |
| `/accessories/fitness-equipment` | 子页 | 单图 `galvanized-stair.webp`（主题不符） |
| `/accessories/competition` | 子页 | 单图 `tower-prairieville.jpg`（主题不符） |

### 1.2 静态数据源（无后台边界）

| 数据源 | 内容 | 变更方式 |
|---|---|---|
| `apps/web/src/lib/product-catalog.ts` | 13 条产品线 id/序号/标题/链接/卡片图/描述；影响 MegaMenu、ProductLineNav、`/towers` 网格、首页产品区 | 代码 PR |
| `apps/web/src/messages/{zh-CN,zh-TW,en}/pages/*.json` | 24 个页面三语文案 | 代码 PR |
| `apps/web/src/lib/static-media-paths.ts` | 全站静态媒体清单（MinIO/OSS 同步依据） | 新增资产必须登记 |
| `apps/web/public/media` + OSS/MinIO | 图片/视频源文件 | 压缩后入库 |
| `apps/web/src/lib/routes.ts` + sitemap | 路由与收录 | 不改路由则不动 |

**边界**：不做 Admin 字段、不做 DB 迁移、不做 API 白名单、不做种子脚本；
一切内容变更走 `apps/web` 代码与静态资产。

### 1.3 图片现状

#### 1.3.1 页面级共用（35 个唯一素材，10 个被复用）

| 素材 | 被多少页面使用 | 主要页面 |
|---|---:|---|
| `/media/burn-room.webp` | 6 | burn-rooms hub、liner、cfbt、fixed-tower 相关推荐等 |
| `/media/ft-path-custom.png` | 3 | fixed-tower、custom、series |
| `/media/ft-path-standard.png` | 3 | fixed-tower、custom、series |
| `/media/case-henan-hero.png` | 2 | fixed-tower 相关案例、custom |
| `/media/fixed-tower.mp4` | 2 | fixed-tower、custom |
| `/media/ft-overview-detail.png` | 2 | fixed-tower、series |
| `/media/galvanized-stair.webp` | 2 | fire-simulation、fitness-equipment |
| `/media/hazmat-trailer.webp` | 2 | hazmat 页、specialized hub |
| `/media/maritime-astoria.jpg` | 2 | maritime 页、specialized hub |
| `/media/tactical.jpg` | 2 | tactical 页、specialized hub |

#### 1.3.2 产品线卡片图（13 条线、12 个唯一文件）

| 线 | 卡片图 | 问题 |
|---|---|---|
| 01 固定训练塔 | `ft-overview-detail.png` | 可作产品图，建议升级清晰度 |
| 02 模块化训练塔 | `modular-hero.jpg` | 通用模块图，可接受 |
| 03 公安武警攀登楼 | `tower-hamilton.jpg` | 通用塔体照片，非攀登楼 |
| 04 科普教育馆 | `tower-macon.jpg` | 通用塔体照片，非教育馆 |
| 05 燃烧室 · 互锁衬里 | `burn-room.webp` | 与 6 个页面共用 |
| 06 CFBT | `series-highrise.png` | 与产品主题弱相关 |
| 07 消防模拟 | `galvanized-stair.webp` | **与 13 训练器械共用** |
| 08 海事训练 | `maritime-astoria.jpg` | 可用，建议独立化 |
| 09 战术训练 | `tactical.jpg` | 可用，建议独立化 |
| 10 危化品训练 | `hazmat-trailer.webp` | 可用，建议独立化 |
| 11 山岳绳索救援 | `tower-denver.jpg` | 通用塔体照片，非绳索救援 |
| 12 心理拓展 | `tower-ocean-springs.jpg` | 通用塔体照片，非心理拓展 |
| 13 训练器械与道具 | `galvanized-stair.webp` | **与 07 消防模拟共用** |

#### 1.3.3 缺图/主题错配页

- 无页面主图：`/towers`（依赖卡片）、`/modular-tower/vs-containers`、`/burn-rooms/comparison`；
- 主题错配：`tower-*` 通用塔体图大量出现在攀登楼、教育馆、绳索救援、心理拓展等页面；
- hero 视频源：`fixed-tower.mp4`、`modular-tower.mp4`、`burn-room.mp4` 本地 public 不存在，
  但 MinIO `content/*.mp4` 已验证 HTTP 200；**无需再确认是否存在**，只需压缩/时长/poster 复核；
- 现有 `fixed-series.mp4` 约 2.1MB，需按视频压缩标准复核。

### 1.4 文案现状

- 三语文案集中在 24 个页面 JSON；本地 zh-CN 合计约 1.85 万字符；
- 最短页面：`towers.json`（约 300 字符）、`specialized-training.json`（约 420）、
  `modular-tower-custom.json`（约 500）、`modular-tower-series.json`（约 575）；
- 现有结构大多有 hero/overview/features/specs/CTA，但**信息密度与产品说服力不均衡**，
  部分页面以通用表述为主，缺少「适用对象、选型差异、交付能力」。

### 1.5 SEO / 性能现状

- 24 个产品页 `createPageMetadata` 均未传 `image`，OG/Twitter 图片全部回退默认 `og-default.jpg`；
- 产品详情页已注入 `productJsonLd`，但 OG 图与页面主图未联动；
- 图片走 `MediaImage` + `oss-image-loader`，本地/生产压缩链路已具备；
- 页面级图片 `quality` 与 `sizes` 基本合理，主要问题在**素材本身**而非加载机制；
- `/towers`、`/fixed-tower`、`/modular-tower`、`/burn-rooms` 已在 sitemap 中优先（0.9/0.8）；
  子页 0.7/0.8，结构合理。

---

## 二、目标与原则

### 2.1 目标

- 24 个产品路由全部具备「主题匹配的主图 + 完整的三语文案 + 独立 OG 图」；
- 13 条产品线卡片图互不共用，且与页面主图形成同一视觉身份；
- 产品中心成为纯静态、可审计、可复用的代码资产，不引入后台维护负担；
- 图片全部过压缩管线，视频按规格收敛，LCP/CLS 不回退。

### 2.2 原则

| 原则 | 说明 |
|---|---|
| 无后台、无 DB | 不改 Admin/API/Prisma；内容只进 `apps/web` 代码与静态资产 |
| 单一数据源 | 13 条产品线以 `product-catalog.ts` 为准；页面文案以 i18n JSON 为准 |
| 主图独立 | 每条产品线的 hero/card 图独立文件，禁止跨线共用 |
| 主题匹配 | 图必须能直接说明该产品线（攀登楼不能配普通塔体、教育馆不能配训练塔） |
| AI 实拍级 | 当前无实拍，本期以 AI 生成实拍级工业图为主；有真实素材后优先替换 |
| 同一产品视觉 | 同一条产品线的 card/hero/详情图共享建筑身份、材质、色调、光照 |
| 三语同步 | zh-CN / zh-TW / en 文案与 alt 同步更新，不出现单语缺失 |
| 性能门禁 | WebP < 500KB、视频 H.264 ≤1080p、OG 图 1200×630、typecheck/biome 全绿 |

---

## 三、图文与转化规范

### 3.1 页面分层与图片角色

| 层级 | 页面 | 图片角色（最低集） |
|---|---|---|
| 产品中心 hub | `/towers` | 家族横幅 + 13 线卡片图 |
| 家族 hub | `/fixed-tower` 等 4 个 hub | hero + 1~2 张场景图 + 子线卡片图（均有图） |
| 产品线 overview | 13 条线首页 | **见 3.1.1 区块配图矩阵**（不止顶部 hero） |
| 子页（series/custom/vs/comparison/liner 等） | 各子页 | 对比/结构主图 ≥1 + 关键对比维度配图（见 3.1.2） |

> **硬性定义**：验收「有没有图」必须以**滚动整页的区块**为单位，不能只看首屏 hero。
> 「hero/card/OG 齐了」≠「产品页图文优化完成」。

#### 3.1.1 产品线 overview 区块配图矩阵（硬门禁）

以 `/accessories/maritime` 等产品线页为模板，把常见区块分成三类：

| 类型 | 含义 | 要求 |
|---|---|---|
| **P0 必须配图** | 缺图即验收失败 | 该区块至少 1 张主题匹配照片（非纯图标） |
| **P1 建议配图** | 默认要做；业务确认可降级 | 有图优先；降级须在盘点表写明理由 |
| **P2 允许无独立图** | 可用图标/表格/全站共用组件 | 不得用「没写就要配」反推；也不得把 P0 降成 P2 |

**产品线 overview 默认矩阵**（名称随页面 JSON 略有差异，按语义对齐）：

| 区块（语义） | 典型标题例 | 级别 | 配图要求 | 推荐数量 |
|---|---|---|---|---:|
| Hero 主视觉 | 页面顶部大图 | **P0** | 16:9 主题主视觉；可与 PageHero 文案上下叠或独立宽幅 | 1 |
| 建立感/概述旁图 | 「为什么需要…」「问题定义」旁 | **P0** | 文案旁至少 1 张场景图，或紧随其后的图集 ≥3 | 1 或图集 3 |
| 能力/场景矩阵 | 「海事训练场景」「场景道具」「核心能力」 | **P0** | **禁止纯图标卡作为最终态**；每项一张产品/场景图，或「大图 + 3~6 项带图卡」 | 与条目数一致，或 ≥4 张代表图 |
| 参数/配置 | 「典型配置」「规格」 | **P0** | 参数表旁或上方至少 1 张综合体/结构示意 | 1 |
| 适用对象 | 「谁在使用」 | **P0** | **必须** 1 张「谁在用」图 + 标签；景别须聚焦队伍/作业，**禁止再拍一张与 hero/config 同构图的综合体外景**；版式优先图文并排，勿做成第二条全宽 hero | 1 |
| 更多能力列表 | 「更多道具」清单 | **P0** | 有独立卖点则配 1 张集合图；纯补充列表至少 1 张相关场景/道具图 | 1 |
| 关联案例 | 「相关案例」 | **P0** | 2~3 张真实案例卡（封面来自案例中心）；**无匹配案例则整块不展示**，不得用产品图冒充案例 | 2~3 |
| 交钥匙/服务闭环 | `ProcessBand`「从构想到落成」 | **P0** | **左图 + 右时间轴 + 区尾 CTA**（非图标卡网格）；主图默认 `shared/process-turnkey`，可 `processImage` 覆盖；极密页可用 `compact`（仅时间轴） | 1 |
| 相关内容/延伸了解 | `RelatedLinks` | **P1** | 链到其他产品线时用**目标线 card 图**作缩略图（从 catalog 读）；无图则保持文字卡 | 0~3（复用 card） |
| StatBand / 公司实力 | 数据条 | **P2** | 全站共用，不配产品专属图 | 0 |
| CTA | 页尾咨询 | **P2** | 不强制配图；文案具体即可 | 0 |

> **2026-08-07 教训补丁**：用户仍会滚动到「适用单位 / 交钥匙」并感知「这两块没图」。
> 故将二者从 P1/P2 **升为 P0**；`ProcessBandI18n` 默认挂 shared 主图，全站凡引用该组件的页面同步受益。

**视觉密度下限（产品线 overview）**：

1. 首屏以下，用户继续滚动时，**连续纯文字/纯图标区块不得超过 1 个**；
2. 整页「带照片的内容区块」≥ **6 个**（hero、能力矩阵、配置示意、适用单位、交钥匙、案例或更多道具）；
3. 能力/场景矩阵若条目 ≥4，不得整区只有 Lucide 图标；
4. 「适用单位」「交钥匙」缺图即验收失败（不得再以「标签云 / 共用组件」为由跳过）；
5. 验收时截图或 curl HTML：P0 区块均能命中对应 `/media/product/...` URL（交钥匙可命中 `shared/process-turnkey`）。

#### 3.1.2 其他页面类型的区块密度

| 页面类型 | P0 最低集 |
|---|---|
| 家族 hub | hero + 每条子线卡片均有图（来自 catalog） |
| 对比/选型页 | 对比主图 + 决策清单区可不配图 + 对比后 CTA |
| 系列/定制子页 | hero + ≥2 张路径/结构图 |
| `/towers` hub | 可选家族横幅；13 线卡片图齐全即可 |

### 3.2 图片规格

| 用途 | 比例 | 最低尺寸 | 格式 | 说明 |
|---|---|---|---|---|
| hero 主视觉 | 16:9 | 1920×1080 | WebP | `preload/eager`；顶部安全区（固定导航遮挡） |
| 产品线卡片图 | 4:3 | 1200×900 | WebP | 与 hero 同一视觉身份，可裁剪 |
| 能力/场景卡图 | 4:3 | 1200×900 | WebP | 对应「场景道具」等条目，一文一图 |
| 详情/结构图 | 4:3 或 1:1 | 1600×1200 | WebP | 材质/结构/工艺；可作概述旁图或图集 |
| 配置示意 | 4:3 或 16:9 | 1600×900 | WebP | 「典型配置」旁的综合体/剖面/组合示意 |
| 对比页主图 | 16:9 | 1600×900 | WebP | 对比主体同框或分栏示意 |
| OG/Twitter 图 | 约 1.91:1 | 1200×630 | WebP/JPG | 每页独立，与 hero 同视觉身份 |
| 案例卡封面 | 沿用案例 | — | — | **只引用案例中心已有封面**，不在产品方案重生「假案例图」 |
| 视频 | 16:9 | ≤1080p | MP4 H.264 | 时长 <30s，配 poster（hero 图） |

压缩门禁：上传前走 `image-compression.ts`（WebP q80、最长边 2560、去 EXIF），
单文件 < 500KB；视频走 H.264 + AAC，目标 < 3MB/30s。

### 3.3 命名规范

```text
代码侧（页面/常量引用）：
/media/product/{family}/{line}-hero.webp              # 页面 hero
/media/product/{family}/{line}-card.webp              # 产品线卡片
/media/product/{family}/{line}-og.webp                # OG（可从 hero 裁切）
/media/product/{family}/{line}-detail-{n}.webp        # 概述旁图 / 顶部图集
/media/product/{family}/{line}-feature-{slug}.webp    # 能力/场景矩阵条目图
/media/product/{family}/{line}-config.webp            # 典型配置示意
/media/product/{family}/{line}-extra.webp             # 更多道具集合图
/media/product/{family}/{line}-users.webp             # 适用单位建立感图
/media/product/{family}/{line}-process.webp           # 可选：覆盖全站交钥匙主图
/media/product/{family}/{line}-compare.webp           # 对比页主图
/media/product/shared/process-turnkey.webp            # 全站 ProcessBand 默认主图

OSS/MinIO 侧（resolveMediaUrl 自动映射，/media/x → content/x）：
content/product/{family}/{line}-*.webp
content/product/shared/process-turnkey.webp
```

示例：

```text
/media/product/specialized/maritime-hero.webp
/media/product/specialized/maritime-feature-bridge.webp
/media/product/specialized/maritime-feature-hatch.webp
/media/product/specialized/maritime-config.webp
/media/product/specialized/maritime-users.webp
/media/product/shared/process-turnkey.webp
/media/product/burn/cfbt-hero.webp
```

> 不采用 `tower-hamilton.jpg` 这类无业务语义的名字；旧资产可保留，但不再作为产品主图。
> `feature-{slug}` 的 slug 与 i18n 条目稳定 id 对齐（如 `bridge` / `hatch` / `ship-door`），
> 便于三语 alt 与断言脚本扫描。

### 3.4 文案规范

每个页面 JSON 至少包含：

| 字段 | 要求 |
|---|---|
| `meta.title/description` | 含产品名 + 核心卖点；三语同步 |
| `hero.title/description` | 一句话定位 + 2~3 句价值 |
| `overview` | 产品是什么、解决什么问题、适合谁 |
| `features` | 3~6 条能力点，每条有量化信息 |
| `specs` / `programs` | 有则保留，无则补结构 |
| `cta` | 与产品匹配的咨询动作 |

产品线文案模板（overview 页，以 3.7.4 决策路径为准）：

```text
## 客户是谁与问题
（给谁看 + 他们训练/建设中的具体痛点）

## 我们的方案
（产品如何解决，含结构/科目/场景）

## 参数与证据
（层数/荷载/材料/寿命/工期，用表格承载；全部有出处）

## 与其他方案对比
（标准 vs 定制、模块化 vs 集装箱、实火 vs 模拟等）

## 交付与服务保障
（设计 → 制造 → 安装 → 培训 → 年检 → 维保）

## 下一步
（主 CTA：获取报价 / 预约勘察 / 下载资料）
```

#### 3.4.1 页面文案矩阵（zh-CN 当前字符 → 目标）

| 路由 | 当前 | 目标 | 说明 |
|---|---:|---:|---|
| `/towers` | ~300 | 800~1200 | hub：家族总览 + 13 线导览 |
| `/fixed-tower` | ~870 | 1400~1800 | 产品线 overview 样板页 |
| `/fixed-tower/series` | ~1270 | 1000~1400 | 已达标，微调 |
| `/fixed-tower/custom` | ~640 | 1000~1400 | 补定制流程 |
| `/fixed-tower/climbing-tower` | ~730 | 1000~1400 | 补适用对象/科目 |
| `/modular-tower` | ~1220 | 1400~1800 | 已接近，补分期案例 |
| `/modular-tower/series` | ~580 | 1000~1400 | 补系列差异 |
| `/modular-tower/custom` | ~500 | 1000~1400 | 补定制流程 |
| `/modular-tower/vs-containers` | ~790 | 1000~1400 | 对比页样板 |
| `/education-center` | ~690 | 1000~1400 | 补教学场景 |
| `/burn-rooms` | ~1000 | 1400~1800 | 补衬里技术数据 |
| `/burn-rooms/liner` | ~620 | 1000~1400 | 补选型对比 |
| `/burn-rooms/comparison` | ~590 | 1000~1400 | 补选择建议 |
| `/burn-rooms/cfbt` | ~770 | 1000~1400 | 补科目/安全边界 |
| `/burn-rooms/fire-simulation` | ~730 | 1000~1400 | 补模拟技术差异 |
| `/specialized-training` | ~420 | 800~1200 | hub：3 条线导览 |
| `/accessories/maritime` | ~1080 | 1000~1400 | 文案已近窗口；**须按 3.1.1 补区块配图**（能力矩阵/配置/案例） |
| `/accessories/tactical` | ~890 | 1000~1400 | 补科目矩阵 |
| `/accessories/hazmat` | ~900 | 1000~1400 | 补处置流程 |
| `/specialized-training/rope-rescue` | ~690 | 1000~1400 | 补场景/标准 |
| `/specialized-training/psychological` | ~690 | 1000~1400 | 补项目/安全 |
| `/accessories` | ~1270 | 1200~1600 | 已达标，微调 |
| `/accessories/fitness-equipment` | ~660 | 1000~1400 | 补器械参数 |
| `/accessories/competition` | ~650 | 1000~1400 | 补竞赛科目 |

> 字符数为 zh-CN 页面 JSON 全部字符串值之和（含 meta/hero/sections），用于相对排序；
> 目标字数按「hub < 产品线 overview < 家族 hub」分层设定。

#### 3.4.2 样板页（先做 1 页确认「图文密度」，再批量）

> 样板验收必须同时过：**文案决策路径** + **3.1.1 区块配图矩阵**。
> 仅完成 hero/card 的样板视为**未完成**，不得据此批量铺开。

**样板：`/accessories/maritime`（专项产品线 overview，当前试点）**

| 区块 | 文案目标 | 配图目标（对齐 3.1.1） |
|---|---|---|
| hero | 标题 ≤20 字 + 描述 60~80 字；回答三问 | P0：`maritime-hero` |
| 问题/方案概述 | 2~3 段决策路径开篇 | P0：旁图或顶部图集 ≥3（`detail-*`） |
| 海事训练场景（能力矩阵） | 4~6 条，每条含可感知场景信息 | **P0：条目图文卡**（`feature-*`），禁止最终态纯图标 |
| 更多道具 | 补充清单 | P0：`maritime-extra` 集合图 |
| 典型配置 | 参数表 + 定制说明 | P0：`maritime-config` 示意 |
| 适用单位 | 标签 + 建立感图 | P0：`maritime-users`（禁止仅标签） |
| 相关案例 | 2~3 个真实案例 | P0：案例封面；无匹配则隐藏整块 |
| 交钥匙 ProcessBand | 步骤 + 主图 | P0：默认 `shared/process-turnkey`（可 `processImage` 覆盖） |
| 相关内容 RelatedLinks | 链到固定塔/模块化等 | P1：复用目标线 card 缩略图 |
| CTA | 「获取方案与报价」等具体动作 | P2 |

**对照样板（后续）：`/fixed-tower`、`/modular-tower/vs-containers`**

固定塔按既有丰富模块执行 3.1.1；对比页按 3.1.2 + 3.7.8，不要求能力矩阵满图，但必须有对比主图与决策清单。

### 3.5 复用红线

1. 产品线 hero/card 图**禁止跨线共用**（先解决 `galvanized-stair.webp` 等共用）；
2. 通用 `tower-*` 塔体照片不得作为攀登楼/教育馆/绳索/心理拓展的主图；
3. `burn-room.webp` 只允许作为 burn-rooms 家族背景/相关图，不作为 CFBT 专属主图；
4. 案例图（`case-*`）只用于「相关案例」区块，不冒充产品图；
5. 页面主图与 OG 图必须同源（可不同尺寸），不允许页面一张、分享另一张。

### 3.6 资产注册表（单一数据源）

为避免图片常量继续散落在各 `page.tsx`，本方案要求把产品图片收进注册表：

```ts
// apps/web/src/lib/product-catalog.ts（扩展 ProductLine）
export type ProductLine = {
  id: string;
  index: number;
  navKey: string;
  title: string;
  href: string;
  image: string;                 // 兼容字段：4:3 卡片图（等同 cardImage）
  heroImage?: string;            // 16:9 hero；未设置时回退 image
  ogImage?: string;              // 1200×630；未设置时回退 heroImage
  detailImages?: string[];       // 概述旁图 / 顶部图集
  featureImages?: Record<string, string>; // 能力矩阵：featureId → /media/product/...
  configImage?: string;          // 典型配置示意
  extraImage?: string;           // 更多道具集合图
  usersImage?: string;           // 适用单位建立感图
  processImage?: string;         // 覆盖全站交钥匙主图；未设用 shared/process-turnkey
  relatedCaseSlugs?: string[];   // 关联案例 slug（2~3）；无匹配则页面不渲染案例块
  description: string;
  family: ProductFamilyId;
};
```

- 非产品线页面（`/towers`、`/modular-tower/vs-containers`、`/burn-rooms/comparison`）
  新增 `apps/web/src/lib/product-images.ts` 承接页面主图，避免直接散落常量；
- 各 `page.tsx` 从 `product-catalog.ts` / `product-images.ts` 读取图片，不再维护
  `IMAGE / HERO_IMAGE` 局部常量；能力矩阵从 `featureImages` 取图，禁止页面写死旧 `/media/*.jpg`；
- `ProcessBandI18n` **默认**挂 `/media/product/shared/process-turnkey.webp`；产品线可传 `processImage`；
- `productJsonLd` 的 `image` 同步使用 `heroImage`；
- `createPageMetadata` 的 `image` 同步使用 `ogImage ?? heroImage`；
- `RelatedLinks` 若展示缩略图，一律读目标产品线 `image/card`，不另造一套图；
- 新增资产必须登记 `static-media-paths.ts`，否则 CI/同步断言失败。

### 3.7 转化优化规范（本期不做埋点）

> **范围边界**：本期不做埋点、不做数据追踪、不采集行为指标。转化效果以业务侧
> 聊天记录、电话记录、询盘表单和人工抽样复核为准；后续如需量化，再单独立项。

#### 3.7.1 页面转化结构（每个产品页必含）

```text
① Hero 价值主张（给谁 + 解决什么 + 为什么选我们 + 主 CTA）
② 信任锚点（资质/标准/真实参数）
③ 核心能力与方案
④ 对比/选型（有对比页的用决策工具）
⑤ 真实案例 / 服务承诺
⑥ 异议处理（常见问题、工期、预算、售后）
⑦ 转化收口（主 CTA + 电话 + 询盘入口）
```

#### 3.7.2 信任层（产品线页 5 类全配，hub/子页至少 3 类）

工业客户决策周期长，光有产品图不会下单。**每个产品线页至少包含以下 5 类信任块**：

| 信任块 | 内容 | 现状基线 | 本期要求 |
|---|---|---|---|
| 资质与标准 | NFPA、GB、ISO、检测报告等 | 各产品页基本未展示 | 能放什么放什么，**不能编**；无真实资质就不写 |
| 数据与参数 | 层数、荷载、材料、寿命、维护周期、工期 | 仅部分页面有零散参数 | **每条产品线建事实参数表**，用表格承载，全部来自事实清单 |
| 交付案例 | 每条产品线挂 2~3 个真实案例卡 | **只有固定塔做了**（henan/gd/js）；其余 12 条线缺失 | 阶段 A 建立「产品线 ↔ 案例」映射，每条线至少 2~3 个真实案例；无匹配案例的先不硬塞 |
| 服务承诺 | 设计 → 制造 → 安装 → 培训 → 年检 → 维保闭环 | `ProcessBand` 已在部分页面出现 | 所有产品线页统一展示该闭环，与后台/运营口径一致 |
| 公司实力 | 成立年份、已交付项目数、服务网络、覆盖行业 | StatBand 只有 2018 / 13 / 6 / 4，太弱 | 升级 StatBand：补充已交付项目数、服务网络、覆盖行业等**可核对数字**；数值需业务确认，不虚报 |

> 案例映射示例：`henan-fire-rescue` / `guangdong-cfbt` → CFBT 与固定塔；`shanxi-mine-rescue` → 危化品/矿山场景；
> 其余产品线在阶段 A 盘点时逐条打标，避免出现「消防案例挂到海事产品页」的错配。

#### 3.7.3 CTA 策略（复用现有三级智能分流）

项目已实现「设备检测 + 坐席可用性」分流（`apps/web/src/features/chat/use-book-consult-chat.ts` +
`@tzj/device` + `AgentPhoneProvider`），产品页**主 CTA 直接复用 `BookConsultButton`，不重造**：

```text
① 有坐席在线（online + away > 0）→ 打开聊天面板，自动发送产品场景化消息
② 无坐席 + 手机（isDialableMobile，排除平板/桌面）+ 电话可用 → 直接 tel: 拨号
③ 其余情况（桌面/平板/无电话/接口失败）→ 降级 /contact 询盘表单（预填产品主题），作为最终兜底
```

> 该分流与营销弹窗 `MarketingPopup.onCta`、聊天挂件 `ChatWidget.tryDialInstead` 同口径：
> `online + away` 都为 0 才算无人；away 坐席仍持有存活连接可接消息。

每个产品页至少 3 个转化触点，且不是同一个按钮重复三次：

| 触点 | 形式 | 位置 |
|---|---|---|
| 主 CTA | `BookConsultButton`（三级智能分流） | hero 下方、核心参数后、页尾 |
| 显式电话 | `tel:` 直拨（复用站内电话） | hero 后、对比表后，每页 1~2 次 |
| 询盘表单 | 跳 `/contact` 并预填产品主题 | 核心能力后、页尾；同时也是主 CTA「无人在线且不可拨号」时的兜底 |

CTA 文案具体化：

```text
❌ 预约咨询
✅ 获取报价
✅ 预约工程师勘察
✅ 下载产品资料
✅ 不确定选哪个？让工程师帮你判断
```

#### 3.7.4 文案转化框架（替代纯产品手册语气）

**硬性要求**：每个产品线页正文按「客户决策路径」组织，而不是「产品说明书」组织；
旧的「产品定位 / 核心能力 / 适用场景 / 选型定制」模板仅作字段参考，不再作为正文结构。

```text
客户是谁 + 他们的问题
→ 我们的方案怎么解决
→ 参数与证据
→ 和别的方案比
→ 交付与服务保障
→ 现在就联系
```

Hero 必须回答三问：

1. 这是给谁看的（消防队/公安/院校/企业专职队）；
2. 能解决什么具体问题（训练科目、安全、成本、工期）；
3. 为什么选拓之迹（标准、案例、一体化交付、售后）。

同时维护「事实与数据清单」：所有量化信息（层数、工期、寿命、价格区间）必须有来源；
禁止使用「专业、高品质、行业领先」等无证据的空词；**宁缺毋滥**——无法确认出处的
量化信息一律不写（尤其是价格区间、寿命、交付工期）。

#### 3.7.5 SEO 意图映射

给 **24 个页面**各定 1 个主关键词 + 2~3 个长尾词，H1 / meta / 正文小节 / OG 围绕该意图；
避免所有页面共用「训练设施解决方案」式表述。口径参考 `docs/baidu-promotion-strategy-2026.md`
与 `docs/web-seo-assessment-and-plan.md`，执行前再由业务复核：

| 页面 | 主关键词 | 长尾示例 |
|---|---|---|
| `/towers` | 训练塔厂家 | 训练塔价格、消防训练设施厂家、训练塔报价 |
| `/fixed-tower` | 消防训练塔 | 消防训练塔厂家、钢结构训练塔定制、双窗训练塔 |
| `/fixed-tower/series` | 标准训练塔系列 | 部队训练塔、标准消防训练塔、训练塔规格 |
| `/fixed-tower/custom` | 定制训练塔 | 训练塔定制厂家、消防训练塔设计方案、非标训练塔定制 |
| `/fixed-tower/climbing-tower` | 攀登楼训练设施 | 武警攀登塔、公安攀登楼、攀岩墙训练设施 |
| `/modular-tower` | 模块化训练塔 | 模块化训练塔厂家、集装箱训练设施、可移动训练塔 |
| `/modular-tower/series` | 模块化训练塔系列 | 模块化训练塔型号、标准模块化训练塔、模块化训练塔配置 |
| `/modular-tower/custom` | 模块化训练塔定制 | 模块化训练塔定制厂家、模块化训练基地规划、训练塔分期建设 |
| `/modular-tower/vs-containers` | 模块化训练塔 vs 集装箱 | 集装箱改造训练塔、模块化训练塔对比、集装箱训练设施 |
| `/burn-rooms` | 真火训练设施 | 燃烧训练室、消防燃烧训练室、真火训练设备 |
| `/burn-rooms/liner` | 互锁隔热衬里 | 燃烧室衬里、隔热衬里厂家、燃烧室内衬更换 |
| `/burn-rooms/comparison` | 燃烧室衬里对比 | 互锁衬里 vs 浇注料、燃烧室衬里选型、隔热衬里方案 |
| `/burn-rooms/cfbt` | CFBT 训练设施 | CFBT 训练室、烟火特性训练设施、真火训练室 |
| `/burn-rooms/fire-simulation` | 消防模拟训练设施 | 模拟灭火训练、烟热训练室、消防模拟训练系统 |
| `/specialized-training` | 专项训练设施 | 消防专项训练设施、应急救援训练设施、特种训练场景 |
| `/accessories/maritime` | 海事训练设施 | 船舶消防训练、海事消防训练基地、船火训练设施 |
| `/accessories/tactical` | 战术训练设施 | 公安战术训练、CQB 训练设施、破门突入训练 |
| `/accessories/hazmat` | 危化品训练设施 | 危化品应急处置训练、堵漏洗消训练、危化品演练设施 |
| `/specialized-training/rope-rescue` | 绳索救援训练设施 | 山岳救援训练、高空救援训练、绳索救援训练设备 |
| `/specialized-training/psychological` | 心理拓展训练设施 | 拓展训练器材厂家、心理行为训练、心理训练设施 |
| `/accessories` | 训练器械与道具 | 消防训练器材、训练道具厂家、训练设施配套 |
| `/accessories/fitness-equipment` | 体能训练器械 | 抗眩晕设备、体能拓展器械、体能训练器材厂家 |
| `/accessories/competition` | 消防竞赛训练设施 | 消防比武训练器材、竞赛训练设施、比武训练塔 |
| `/education-center` | 消防科普教育馆 | 安全体验馆、科普教育馆建设、院校消防实训基地 |

#### 3.7.6 真实性：当前以 AI 实拍级生图为主

> **现状**：暂无可用真实产品图片，本期产品 hero / card / OG / detail 以 AI 生图为主；
> 后续如有真实交付/工厂实拍素材，优先替换并保持同一产品线视觉身份。

素材优先级（有素材时）：

```text
真实交付/工厂实拍 > 工程渲染图 > AI 实拍级生图
```

**硬性要求（升为人工审核项，不再是原则性表述）：**

1. AI 图必须达到**实拍级工业摄影**标准：光影、透视、材质、结构比例符合物理规律；
   无塑料感、对称伪影、异常重复纹理、乱码文字等明显 AI 味；
2. AI 图**可用于 hero/card/OG 营销主图**，但页面文案不得出现「实景拍摄 / 现场照片 /
   客户现场实拍」等不实表述；
3. 同一条产品线的 card / hero / OG / detail 必须共用同一视觉身份
   （结构、材质涂装、场景、光照方向）；
4. 图上层数、尺寸、配置等参数必须与文案一致；
5. 审核 checklist 增加「AI 味」硬性项：**任一明显 AI 痕迹即退回重做**。

#### 3.7.7 移动端与性能

- 电话触点必须是一键 `tel:`，按钮尺寸满足移动端点按；
- 移动端 CTA 不遮挡聊天挂件，不强制全屏浮层；
- 性能预算明确：LCP < 2.5s、CLS < 0.1、INP < 200ms（作为验收门禁，不计埋点）。

#### 3.7.8 对比/选型页 = 决策工具

> 适用页：`/modular-tower/vs-containers`、`/burn-rooms/comparison`，以及 series / custom /
> liner 等承担「选型」任务的页面。**对比表只是素材，不是终点**。

每个对比/选型页必须包含：

1. **选型建议 / 决策清单**：用「什么情况选 A，什么情况选 B」的句式给结论，
   而不是只罗列差异：

   ```text
   ✅ 预算有限、场地多变、想分期建设 → 选模块化训练塔
   ✅ 高层实战训练、固定场地、长期高频使用 → 选固定训练塔
   ✅ 追求极致真实火场、具备安全管理条件 → 选 CFBT 实火
   ✅ 教学/常态化练兵、安全与成本优先 → 选消防模拟训练设施
   ```

2. **客户最关心的三个对比维度必含**：预算、工期、扩展性；
   安全、维护、寿命等按产品补充。数据来自事实清单；没有价格/工期依据时写
   「需按场地方案评估」，不编数字；
3. **对比后的直接 CTA**：表格/决策清单下方立即出现
   「不确定选哪个？让工程师 10 分钟内帮你判断」，复用 `BookConsultButton`
   三级分流（在线聊天 → 手机拨号 → 询盘表单兜底），并预填对比场景消息；
4. 决策清单与对比表结论一致，不能出现「表里五五开、建议里却一边倒」的矛盾。

---

## 四、技术落地

### 阶段 A：资产盘点与替换计划（1 天）

产出 `docs/product-center-image-audit.md`（或本方案附录表）：

`页面 | 当前素材 | 主题匹配 | 建议动作（保留/替换/新增） | 目标 key`

**首批必须处理的共用/错配**：

| 项 | 现状 | 动作 |
|---|---|---|
| 07 消防模拟 vs 13 训练器械 | 共用 `galvanized-stair.webp` | 各自独立主图 |
| CFBT | 用 `burn-room.webp` | 独立 CFBT 主图 |
| 攀登楼/教育馆/绳索/心理 | 通用 `tower-*` | 按产品主题替换 |
| fitness/competition | 用塔体/楼梯图 | 替换为器械/竞赛场景图 |
| vs-containers / comparison | 无主图 | 新增对比主图 |
| hero 视频 | 本地 public 缺失，MinIO 已验证 200 | 压缩/时长/poster 复核；不达标则退化静态 hero |

### 阶段 B：素材生产（与 A 并行）

- **产品身份表（每条产品线先冻结）**：产品结构、材质涂装、场景、光照、旧图处置
  （✅ 可用参考 / ❌ 作废 / ⚪ 无图），复用 `docs/case-center-content-ai-enrichment-plan.md`
  4.2.1 格式；同一条产品线的 card/hero/detail/**feature/config** 全部以身份表为准；
- **按 3.1.1 列清单再生图**：每条产品线至少产出  
  `hero + card + og + detail×3 + feature×N（N=能力条目）+ config×1`；  
  另列 `relatedCaseSlugs`（引用案例中心，不重生假案例图）；
- **实拍优先（有则用）**：从产品资料、工厂实拍、案例交付图整理可用素材；
  当前无真实素材时，本期以 AI 生图为主；
- **AI 实拍级生图**：复用 `docs/case-center-content-ai-enrichment-plan.md` 的
  「实拍级工业摄影、无水印、同视觉身份、参考图派生」规范，并额外要求**无 AI 味**；
- **AI 图可作营销主图**：hero/card/OG/feature 允许使用 AI 图，但页面文案不得出现
  「实景拍摄 / 现场照片 / 客户现场实拍」等不实表述；画面参数必须与文案一致；
- 每张图产出 2~3 候选 → 自动初筛 → 人工审核（主题匹配 / 结构一致 / 无乱码水印 /
  **无 AI 味**）→
  压缩 → 上传 OSS/MinIO → 登记 `static-media-paths.ts`。

### 阶段 C：代码接入

1. `product-catalog.ts`：扩展 `ProductLine`（含 `featureImages/configImage/extraImage/usersImage/processImage/relatedCaseSlugs`），
   更新 13 条产品线数据；
2. 新建 `product-images.ts`：承接 `/towers`、vs-containers、comparison 等非产品线页面主图；
3. 各页面 `page.tsx`：改为从注册表读取图片；**能力矩阵改为图文卡**；配置/更多道具/适用单位挂图；
   案例区挂 `relatedCaseSlugs`；移除散落常量；
4. `ProcessBand` / `ProcessBandI18n`：支持 `image`，**默认 shared/process-turnkey**；
5. `createPageMetadata`：逐页传 `ogImage ?? heroImage`，消除默认 OG；
6. `productJsonLd`：`image` 同步使用 `heroImage`；
7. i18n JSON：按 3.4 / 3.4.1 / 3.4.2 补齐三语文案与图片 alt（含 feature/users/process alt）；
8. `static-media-paths.ts`：登记全部新资产（含 shared）；
9. `routes.ts` / sitemap：路由不变则不动；
10. **样板未过 3.1.1 视觉密度门禁前，禁止批量改其余产品线页面结构。**

### 阶段 D：性能与验证

- 新增 `scripts/audit-product-media.mjs`，阶段 D 与 CI 均执行：
  - 引用完整性：扫描 24 个产品页 `page.tsx` 与 `product-catalog.ts` 的全部 `/media/*`，
    必须存在于 `static-media-paths.ts` 且 MinIO HEAD 200；
  - 唯一性：13 条产品线卡片图互不相同；
  - 黑名单：产品主图不得命中 `tower-*`、`burn-room.webp`、`galvanized-stair.webp`；
  - OG：24 个产品路由 `openGraph.images` 不等于默认 `og-default.jpg`；
  - **区块密度**：产品线 overview 的 HTML 须命中 `feature-` 或等价能力图 URL，
    且命中 `config` 示意（若 catalog 声明了 `configImage`）；禁止「仅有 hero + 顶部图集」
    即判定通过；
  - 压缩：`find apps/web/public/media -name '*.webp' -size +500k` 任一命中即失败；
  - 视频：H.264、≤1080p、≤30s、poster 存在；
- 页面验证：curl 每个产品路由 200，HTML 含 `/media/product/...-hero` **以及**
  该页 P0 区块对应 URL；
- 质量门禁：`pnpm run check` + 三个 app typecheck；
- 视觉抽检：同产品线 card/hero/OG/feature 为同一视觉身份；**整页滚动抽检无「大段纯图标荒漠」**。

#### 4.5 影响面与回归清单

`product-catalog.ts` 与图片注册表改动会同步影响以下 surface，阶段 D 必须逐项回归：

| surface | 影响 | 回归方式 |
|---|---|---|
| 首页 `ProductMatrixSection` | 13 线卡片图 | 首页 200 + 卡片图加载 |
| MegaMenu / 移动端手风琴 | 13 线图（若有）与链接 | 导航渲染无 404 |
| `ProductLineNav` | 产品线标识/相关线 | 抽查 5 个产品页 |
| `/towers` 网格 | 13 线卡片图 | 全量 200 |
| 产品详情 `productJsonLd` | image 字段 | metadata 检查 |
| 分享（OG/Twitter） | 24 页 OG | OG 断言 |

---

## 五、验收标准

1. 24 个产品路由均有主题匹配的主图；`tower-*` 不再作为产品线主图；
2. 13 条产品线卡片图互不共用，且与 hero/OG 同视觉身份；
3. `burn-room.webp` / `galvanized-stair.webp` 等共用素材已从产品主图位置移除；
4. `/modular-tower/vs-containers`、`/burn-rooms/comparison` 已有对比主图；
5. 24 页 OG 图均为页面专属，不再回退默认图；
6. 三语文案按模板补齐，页面 JSON 均含 meta/hero/overview/features/cta；
7. 新增资产全部登记 `static-media-paths.ts`，本地/OSS 可访问；
8. WebP < 500KB、视频规格合规、性能预算达标（LCP < 2.5s、CLS < 0.1、INP < 200ms，以可测手段为准）；
9. 无后台/DB/API 改动；`pnpm run check` + typecheck 全绿；
10. curl/HTML 验收通过，产品中心所有页面 200；
11. 13 条产品线卡片图互不相同，且无 `tower-*` / `burn-room.webp` / `galvanized-stair.webp` 黑名单；
12. 图片注册表已接入，页面不再散落 `IMAGE/HERO_IMAGE` 常量（或已集中到 `product-images.ts`）；
13. `productJsonLd` 与 OG 图均与 `heroImage` 同源；
14. `audit-product-media.mjs` 全绿，首页/MegaMenu/ProductLineNav/towers 回归通过；
15. 每个产品页 hero 回答「给谁看 / 解决什么问题 / 为什么选我们」三问；
16. 每个产品页 ≥3 个转化触点（场景化聊天 / 电话 / 询盘入口）；主 CTA 复用现有三级分流（在线聊天 → 手机拨号 → 询盘表单兜底），CTA 文案具体；
17. 每个产品线页信任层齐全（标准 / 参数 / 案例 / 服务 / 公司实力）：≥2~3 个真实案例卡、参数表来自事实清单、公司实力数字经业务确认；
18. 正文按 3.7.4 决策路径组织（客户与问题 → 方案 → 证据 → 对比 → 服务 → 下一步），不再使用旧产品手册模板；事实与数据清单过审，无空词，无法确认出处的量化信息一律不写；
19. 24 个产品页 SEO 主词 + 长尾词映射完成（见 3.7.5），H1/meta/正文/OG 围绕意图，无共用模板表述；
20. 本期不做埋点，不以行为指标验收；以业务聊天/电话/询盘记录与人工抽样复核为准。
21. AI 图通过「实拍级」审核：无 AI 味（光影/透视/材质/结构一致）、无乱码/水印、同产品线视觉身份一致、页面不声称实拍。
22. 对比/选型页含「什么情况选 A / 什么情况选 B」决策清单、预算/工期/扩展性三维度、对比后 CTA（如「让工程师 10 分钟内帮你判断」）；决策清单与对比表结论一致。
23. **区块视觉密度（3.1.1）通过**：产品线 overview 的 P0 区块均有主题匹配照片；能力/场景矩阵非纯图标最终态；**适用单位与交钥匙必须有图**；整页带照片内容区块 ≥6；连续纯文字/纯图标区块 ≤1。
24. **样板未过 23 前不得批量**：以 `/accessories/maritime` 为密度样板，业务确认后再铺开其余产品线。
25. **`ProcessBandI18n` 全站默认主图存在**：HTML 含 `process-turnkey`（或产品线 `processImage`）；禁止仅步骤图标。

---

## 六、工作量与排期估算

资产总量估算（含区块级 feature/config）：

| 类型 | 约数 |
|---|---:|
| card / hero / og | 13 × 3 ≈ 39 |
| detail 图集 | 13 × 3 ≈ 39 |
| feature 能力卡 | 13 × 4~6 ≈ 52~78 |
| config 配置示意 | ≈ 13 |
| 对比/子页主图 | ≈ 10~15 |
| **合计唯一图** | **约 150~185 张** |

AI 生成按每张 2~3 候选 ≈ **350~500 次生成**；WebP 压缩后总存储约 **80~120MB**。  
案例卡封面复用案例中心，不计入上述生图量。

| 阶段 | 内容 | 估算 |
|---|---|---|
| A | 资产盘点/替换计划（含 3.1.1 区块打标） | 1~1.5 人日 |
| B | 素材生产 + 转化文案（身份表 + feature/config 生图 + 事实清单） | 6~9 人日（与 A 并行） |
| C | 代码接入（注册表/图文卡改造/metadata/i18n + 转化触点） | 2~3.5 人日 |
| D | 自动化断言（含密度门禁）+ 影响面回归 + 全量验证 | 1~1.5 人日 |
| **合计** | | **约 10~15.5 人日** |

建议批次：`burn 家族 → specialized 家族 → accessories 家族 → towers 家族 → 全局 OG/文案收尾`。

---

## 七、风险与依赖

| 风险/依赖 | 影响 | 对策 |
|---|---|---|
| 无真实产品素材 | 只能 AI 生成，真实感风险 | 本期以 AI 实拍级生图为主；无 AI 味审核门禁，后续实拍替换 |
| AI 图跨线撞脸 | 产品线视觉重复 | 每条线独立锚点 + `product/{family}/{line}-` 命名硬门禁 |
| 视频压缩不达标 | 流量/加载变差 | MinIO 源已验证 200；复核编码/时长/poster，不达标退化静态 hero |
| AI 图有「AI 味」/冒充实拍 | 产品信任风险 | 实拍级标准 + 身份表 + 参数一致性 + 审核签字；AI 图可作营销主图，但页面不声称实拍 |
| 改 `product-catalog.ts` 影响全局 | 首页/MegaMenu/towers 同步变化 | 先跑 typecheck + 页面抽检 |
| OG 图漏配 | 分享图仍回退默认 | 验收加 OG 断言 |
| 静态媒体清单漏登记 | 生产环境图片 404 | 新增资产必须同步 `static-media-paths.ts` |
| 与内容中心素材混用 | 产品页出现案例/新闻图 | `product/` 前缀 + 复用红线 |
| **只换 hero/card，区块仍纯图标** | 用户感知「没怎么改」 | **3.1.1 P0 硬门禁 + 验收 23/24**；样板未过不批量 |
| 能力矩阵条目过多导致生图爆炸 | 工期失控 | 矩阵条目默认 4~6；超过 6 的合并为「代表图 + 清单」P1 策略 |
| 无匹配案例仍硬塞案例块 | 假案例/错配风险 | `relatedCaseSlugs` 为空则**不渲染**案例区 |

依赖：`image-compression.ts`、`oss-image-loader`、`static-media-paths.ts`、
`product-catalog.ts`、三语 i18n JSON；无 API/DB/Admin 依赖。

---

## 附：产品页面与素材清单、单页验收模板

### A. 首批替换清单（建议执行顺序）

| 产品线/页面 | 当前素材 | 目标素材 |
|---|---|---|
| 03 攀登楼 | `tower-hamilton.jpg` | `/media/product/towers/climbing-hero.webp` + `climbing-card.webp` |
| 04 教育馆 | `tower-macon.jpg` | `/media/product/towers/education-hero.webp` + `education-card.webp` |
| 06 CFBT | `burn-room.webp` | `/media/product/burn/cfbt-hero.webp` + `cfbt-card.webp` |
| 07 消防模拟 | `galvanized-stair.webp` | `/media/product/burn/fire-simulation-hero.webp` + `-card.webp` |
| 11 绳索救援 | `tower-denver.jpg` | `/media/product/specialized/rope-rescue-hero.webp` + `-card.webp` |
| 12 心理拓展 | `tower-ocean-springs.jpg` | `/media/product/specialized/psychological-hero.webp` + `-card.webp` |
| 13 训练器械 | `galvanized-stair.webp` | `/media/product/accessories/accessories-card.webp` |
| fitness | `galvanized-stair.webp` | `/media/product/accessories/fitness-hero.webp` |
| competition | `tower-prairieville.jpg` | `/media/product/accessories/competition-hero.webp` |
| vs-containers | 无 | `/media/product/modular/modular-vs-containers-hero.webp` |
| comparison | 无 | `/media/product/burn/liner-comparison-hero.webp` |

> 目标素材在代码中引用 `/media/product/...`，OSS/MinIO key 为 `content/product/...`（映射规则见 3.3）。

### B. 单页验收清单

```text
[ ] 路由：________
[ ] 主图主题与产品线匹配（无 tower-* 通用图）
[ ] hero/card/OG 为同一视觉身份
[ ] hero 16:9、card 4:3、OG 1200×630
[ ] WebP < 500KB；视频（如有）H.264 ≤1080p ≤30s
[ ] —— 区块视觉密度（3.1.1）——
[ ] P0：hero 有图
[ ] P0：概述旁图或顶部图集 ≥3
[ ] P0：能力/场景矩阵为图文卡（非纯图标最终态）
[ ] P0：典型配置有 config 示意
[ ] P0：更多道具有 extra 集合图
[ ] P0：适用单位有 users 建立感图（禁止仅标签）
[ ] P0：交钥匙 ProcessBand 有主图（shared/process-turnkey 或 processImage）
[ ] P0：相关案例 2~3 张；无匹配则整块隐藏（不硬塞）
[ ] P1：RelatedLinks 复用目标线 card 缩略图
[ ] 整页带照片内容区块 ≥6；连续纯文字/纯图标区块 ≤1
[ ] —— 文案与转化 ——
[ ] hero 回答三问（给谁 / 解决什么 / 为什么选我们）
[ ] ≥3 个转化触点；主 CTA 复用三级分流（在线聊天 → 手机拨号 → 询盘表单兜底）
[ ] 信任层齐全：参数表有事实来源、公司实力数字经业务确认
[ ] 事实与数据清单过审，无空泛宣传词
[ ] 正文按决策路径组织（客户与问题 → 方案 → 证据 → 对比 → 服务 → 下一步）
[ ] SEO 主词 + 长尾词映射完成
[ ] AI 图实拍级审核通过（无 AI 味 / 乱码 / 水印；同线视觉身份一致；页面不声称实拍）
[ ] 对比/选型页含决策清单 + 预算/工期/扩展性 + 对比后 CTA（结论与对比表一致）
[ ] 三语文案含 meta/hero/overview/features/cta；feature/users/process alt 三语同步
[ ] metadata 已传 image，OG 非默认图
[ ] 新资产已登记 static-media-paths.ts
[ ] curl 200 + HTML 含 hero / feature / config / users / process-turnkey（按本页 P0）URL
[ ] typecheck + biome + pnpm run check 全绿
```

### B2. 海事样板状态（2026-08-07 二次补齐后）

| 区块 | 状态 | 说明 |
|---|---|---|
| hero + 顶部 3 detail | ✅ | 保持 |
| 能力矩阵「海事训练场景」 | ✅ | 6 张 feature 图文卡 |
| 更多道具 | ✅ | `maritime-extra` |
| 典型配置 | ✅ | `maritime-config` |
| 适用单位 | ✅ | `maritime-users` + 标签 |
| 相关案例 | ✅（隐藏） | 暂无海事专项案例，整块不渲染 |
| 交钥匙 ProcessBand | ✅ | 全站默认 `shared/process-turnkey` |
| RelatedLinks | ✅ | 复用目标线 card |

### B3. 全量落地进度（2026-08-07）

| 批次 | 范围 | 状态 |
|---|---|---|
| 共享拼装 | `product-line-page.ts` / `ProductLineMedia` / `product-images.ts` | ✅ |
| 专项剩余 | hazmat / rope-rescue / psychological | ✅ 满配 |
| 配件 | accessories hub + fitness + competition | ✅ |
| 燃烧 | burn hub / liner / cfbt / fire-simulation / comparison | ✅ |
| 塔类 | fixed/modular/climbing/education + series/custom/vs-containers | ✅ |
| Hub 收尾 | `/towers` + `/specialized-training` 家族横幅与 catalog 卡图 | ✅ |
| 验收 | curl/HTML 抽检 P0 hero URL；本地 MinIO + `public/media/product/*` | ✅ |

### C. 与内容中心方案对照

| 项 | 案例/新闻/博客/展会 | 产品中心（本方案） |
|---|---|---|
| 数据来源 | 后台/API/DB | **纯静态代码 + i18n + 静态资产** |
| 维护方式 | Admin 表单 | **代码 PR** |
| 详情封面 | `detailCoverImage` | hero 主视觉（同一机制不适用） |
| 图集 | `images[]` + 正文内嵌 | 页面静态结构图/场景图 |
| 一致性 | 同一建筑/主题 | **同一产品线视觉身份** |
| 资源前缀 | `content/case-`/`news-`/`blog-`/`trade-show-` | `content/product/{family}/{line}-` |
| 验收 | curl/HTML，禁浏览器 MCP | curl/HTML + OG/性能断言 |

---

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-06 | 初稿：盘点 24 个产品路由、35 个页面素材、13 条产品线卡片图；明确无后台静态化优化路径 |
| 2026-08-06 | 修订：补资产注册表、`/media ↔ content` 映射、逐页文案矩阵与样板页、产品身份表、影响面回归清单、自动化断言与成本估算 |
| 2026-08-07 | 修订：新增 3.7 转化优化规范（信任层 / CTA / 文案框架 / SEO 意图 / 真实性优先级 / 移动端性能）；**明确本期不做埋点**，验收以业务记录与人工抽检为准 |
| 2026-08-07 | 细化 3.7.2 信任层：资质标准、事实参数表、每条产品线 2~3 个真实案例、服务闭环、升级公司实力 StatBand；验收同步收紧 |
| 2026-08-07 | 3.7.3 CTA 对齐现有实现：主 CTA 复用 `use-book-consult-chat` 三级分流（在线聊天 → 手机拨号 → 询盘表单兜底），与营销弹窗/聊天挂件同口径 |
| 2026-08-07 | 3.4/3.7.4 文案改为「帮客户做决策」路径：客户与问题 → 方案 → 证据 → 对比 → 服务 → 下一步；Hero 三问 + 事实与数据清单「宁缺毋滥」 |
| 2026-08-07 | 3.7.5 SEO 意图映射补全 24 页主词 + 长尾词，口径对齐百度投放与 SEO 评估文档 |
| 2026-08-07 | 3.7.6 明确「无实拍，以 AI 实拍级生图为主」：AI 图可作营销主图，但无 AI 味为硬性审核项，页面不声称实拍 |
| 2026-08-07 | 新增 3.7.8 对比/选型页决策工具：选型建议清单、预算/工期/扩展性三维度、对比后 CTA；验收同步收紧 |
| 2026-08-07 | **根因修订（海事样板反馈）**：新增 **3.1.1 区块配图矩阵**（P0/P1/P2）与视觉密度门禁；扩展 ProductLine（`featureImages`/`configImage`/`relatedCaseSlugs`）；样板改为 maritime；验收 23/24；资产估算上调至 150~185 张；明确「仅 hero/card 不算完成、样板未过不批量」 |
| 2026-08-07 | **二次补丁**：适用单位 / 交钥匙 / 更多道具 **升为 P0**；`ProcessBandI18n` 默认 `shared/process-turnkey`；ProductLine 增 `usersImage`/`extraImage`/`processImage`；密度下限 ≥6；验收 25；海事样板差额清零 |
| 2026-08-07 | **景别防重复**：适用单位图禁止与 hero/config 同为综合体外景；须聚焦队伍/作业；版式优先图文并排，不作第二条全宽 hero |
| 2026-08-07 | **ProcessBand 改版**：全站改为「左图 + 右编号时间轴 + 预约交钥匙咨询 CTA」；去掉 6 宫格图标卡；支持 `compact`；禁止再做成第二条 21:9 hero + 卡片网格 |
| 2026-08-07 | **全量落地**：按 3.1.1/3.1.2 完成剩余约 22 路由图文；资产统一 `/media/product/{family}/{line}-*`；海事/战术为样板后分 5 批铺开；`/towers` 与 `/specialized-training` 补家族横幅与 OG；B2 样板状态保持，新增 B3 进度表 |
