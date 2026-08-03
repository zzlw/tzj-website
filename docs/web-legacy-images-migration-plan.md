# 旧站图片资产迁移至新 C 端网站：事情经过与技术方案

> 日期：2026-08-03
> 状态：P0–P2 本地实施完成（2026-08-03），待生产部署与验收
> 影响范围：www.tzjii.com（apps/web）、MinIO 桶 `tzj-uploads-prod`、`tzj_prod` 数据库内容表
> 旧站备份目录：`/Users/gavin/Documents/tzj/www.tzjii.com`
> 注：OSS 迁移（`tzj-media-static-assets`）暂不执行，当前生产仍为 MinIO。

---

## 一、事情经过

### 1.1 业务反馈

业务方反馈：**新的 C 端网站很多页面缺少图片**。表现为：

- 工程案例 / 新闻资讯列表里大量条目显示同一张图；
- 部分页面（如「我们的故事」「团队」「资质认证」）整页无图；
- 产品页图片与中文站实际业务不符（沿用英文品牌 trainingtowers.com 素材）。

### 1.2 排查经过（2026-08-03）

1. **盘点旧站备份**：`/Users/gavin/Documents/tzj/www.tzjii.com` 为线上旧站的静态镜像
   （249 个 HTML + `statics/` 3.2MB 模板图 79 张 + `uploads/` 53MB 内容图 698 张，
   按 `uploads/images/{YYYYMM}/` 分 21 个月目录）。
2. **梳理新站媒体链路**：确认 apps/web 的图片不随应用部署，生产实际从
   MinIO 桶 `tzj-uploads-prod` 提供（经 nginx 反代为 `static.tzjii.com`）：
   - 页面静态媒体 `/media/*` → MinIO `content/*`（由 `prisma:sync:static-media` 从
     `apps/web/public/media/` 上传；该目录被 gitignore，不进版本库）；
   - 案例 / 新闻 / 博客 / 展会等内容封面来自数据库 `coverImage` / `images` 字段，
     指向 MinIO `images/{YYYYMM}/`、`cases/` 等前缀。
3. **查数据库（本地 tzj_dev，为生产快照恢复）**，发现封面图高度集中：
   - `cases` 52 条中 **45 条**封面同为 `images/202204/abe3f86ad8a.jpg`；
   - `news` 26 条中 **20 条**封面同为 `images/202204/67522c66631.jpg`；
   - 内容 slug（`caseshow-52-32`、`newsshow-64-26` 等）与旧站页面一一对应，
     说明此前迁移脚本只搬了正文与图集（`images[]` 数组 5 张均正确），
     **封面图用了统一兜底图，没有逐条映射**。
4. **比对 MinIO `content/` 前缀**（`mc ls` 或 `curl -I` 对比 ETAG），发现占位复制问题：
   - `hero.mp4` / `fixed-tower.mp4` / `burn-room.mp4` / `modular-tower.mp4` / `why.mp4`
     5 个 key 的 ETAG 完全相同（均为同一份 38.8MB 视频）；
   - `mission.mp4` / `fixed-series.mp4` / `louisville-case.mp4` / `whp-hero.mp4`
     4 个 key 同为一份 2.2MB 视频；
   - **`tower-wylie.jpg` 的 ETAG 与 `og-default.jpg` 相同** —— 这张图被
     cases/news/首页快捷入口多处引用，实际显示的是全站 OG 兜底图。
5. **扫描新站代码引用**：`apps/web/src` 共引用 36 个 `/media/*` 路径，其中
   8 个本地 `public/media/` 缺失（`hero.mp4`、`why.mp4`、`tower-ocean-springs.jpg` 等）；
   MinIO 中虽存在但多为第 4 条所述的占位副本。
6. **验证旧站素材可映射性**：
   - 从旧站 `caselist-*.html` 列表页提取到 **46 组「案例 → 真实缩略图」一一对应关系**
     （46 张互不相同），而数据库 45 条重复封面完全可以据此逐条修正；
   - 从 `newslist-*.html` 提取到 20 组「新闻 → 缩略图」映射；
   - 从 `prolist-*.html` 提取到 125 组「产品 → 缩略图」映射（全部不重复）；
   - 旧站 `uploads/images/` 全部月份目录早已批量同步到生产 MinIO（抽样
     `images/202011/1606556506338740.jpg` 存在），**本次无需重新上传内容图，
     主要工作是"重新接线"**。

### 1.3 结论：「缺图」的四个真实成因

| # | 成因 | 表现 | 严重度 |
|---|------|------|--------|
| P0-A | 迁移时内容封面未逐条映射，用了统一兜底图 | 45/52 案例、20/26 新闻封面同图 | 高 |
| P0-B | MinIO `content/` 多个媒体是同一文件的占位副本（含 `tower-wylie.jpg` = `og-default.jpg`） | 多处显示同一张兜底图 / 同一段视频 | 高 |
| P1 | 静态页面素材沿用英文品牌（trainingtowers.com），与中文站业务不符；`why-us/team`、`why-us/certification`、`towers` 等页面几乎无图 | 页面观感"缺图"、图文不符 | 中 |
| P2 | 本地 `public/media/` 缺 8 个被引用文件（开发环境破图；生产由 MinIO 兜住但多为占位图） | 本地开发破图 | 低 |

---

## 二、旧站资产盘点

### 2.1 目录结构

```
www.tzjii.com/
├── statics/images/          79 个模板图（3.2MB）：logo、banner、关于我们、荣誉资质、服务承诺
├── uploads/images/{YYYYMM}/ 698 张内容图（53MB）：产品图、案例实拍、新闻配图（2020-07 ~ 2026-06）
├── prolist-{35,44,46,47,72,73,74,75,76,77}.html   产品分类页
├── proshow-{分类}-{id}.html                       产品详情页（约 150 个）
├── caselist-{36,52,53,54,55,56,57}.html           案例分类页（部队/消防/公安/景区/学校/企业）
├── caseshow-{分类}-{id}.html                      案例详情页（约 46 个）
├── newslist-{39,64,65,66,67}.html                 新闻分类页（公司/行业/拓展/器材知识）
├── page-{38,40,41,58~63}.html                     服务承诺/关于我们/联系我们/方案规划
└── index.html                                     首页（3 张轮播 banner，1920×500）
```

### 2.2 可直接复用的素材（按用途）

| 用途 | 旧站来源 | 数量 | 备注 |
|------|----------|------|------|
| 案例真实封面 | `caselist-*.html` 列表缩略图 | 46 张（全部唯一） | 已提取 slug→图映射 |
| 新闻真实封面 | `newslist-*.html` 列表缩略图 | 20 张 | 已提取 slug→图映射 |
| 产品实拍图 | `prolist-*.html` / `proshow-*.html` | 125 张缩略图 + 详情页图集 | 按 10 个分类归档 |
| 首页轮播图 | `uploads/images/202605/273c48571ce.jpg`、`202605/922d2741b4c.jpg`、`202606/7a358709935.jpg` | 3 张 1920×500 | 实拍大图，可作首页 Hero 兜底/轮播 |
| 关于我们 | `statics/images/about_img.jpg`、`about_linian_img01/02.jpg`、`guanyu_jieshao.jpg` | 4 张 | 对应 why-us/story |
| 荣誉资质 | `statics/images/hj1~hj6.png`、`hj7.jpg`、`zizhirongyu.jpg` | 8 张 | 对应 why-us/certification |
| 发展历程 | `statics/images/licheng.jpg` | 1 张 | 对应 why-us/story 时间线 |
| 服务承诺 | `statics/images/fuwu1~3.jpg`、`shouhou1~3.jpg` | 6 张 | 对应 contact / 服务区块 |

不迁移：logo（新站已有品牌标识）、`n_bottom_*`/`phone*`/`jiantou` 等旧模板装饰图、
`bg_*.jpg` 旧站背景纹理（与新站 Rosenbauer 工业风设计语言不符）。

---

## 三、旧站 → 新站位置映射表

### 3.1 数据库内容（cases / news）— 修封面，不搬文件

内容图已在 MinIO `images/{YYYYMM}/` 下，仅需把 `coverImage` 更新为各条目真实缩略图：

- `cases.coverImage`：按 §1.2-6 提取的 46 组映射逐条更新
  （如 `caseshow-52-75` → `images/202605/03487a1ebd9.jpg`）；
  剩余 7 条（seed 演示数据 `henan-fire-rescue` 等）另行处理或保留；
- `news.coverImage`：按 20 组映射更新；5 条 seed 新闻不动。
- blogs / tradeShows 经排查封面无集中兜底问题，不在本次修正范围。
- URL 统一写 `S3_PUBLIC_DOMAIN` 绝对 URL（当前生产为
  `https://static.tzjii.com/tzj-uploads-prod/images/…`）；
  与现有行保持一致（`resolveMediaUrl` 会做归一化，但入库保持绝对 URL 规范）。

### 3.2 静态页面素材 — 补进 `apps/web/public/media/`

| 新站页面 | 现状 | 补入素材（旧站来源） |
|----------|------|---------------------|
| 首页 Hero | `hero.mp4` 为占位副本 | 旧站 3 张轮播实拍图改作静态图 Hero 或轮播（`202605/273c48571ce.jpg` 等） |
| `/fixed-tower`（固定训练塔） | 英文品牌图 | `prolist-73` 钢结构训练塔实拍（如 `202101/19ab883e7fc.jpg` 等 138 张中选优） |
| `/fixed-tower/climbing-tower`（攀登楼） | 英文图 | `prolist-44` 公安武警攀登楼实拍 |
| `/education-center`（科普教育馆） | 英文图 | `prolist-46` 科普教育馆实拍 |
| `/burn-rooms/cfbt` | `alarm-highrise.jpg` | `prolist-72` CFBT 设施实拍 |
| `/burn-rooms/fire-simulation` | 英文图 | `prolist-75` 消防模拟设施实拍 |
| `/accessories/competition` | 英文图 | `prolist-76` 竞赛类设施实拍 |
| `/accessories/fitness-equipment` | 英文图 | `prolist-47` 体能抗眩晕器械实拍 |
| `/specialized-training/rope-rescue` | 英文图 | `prolist-74` 山岳绳索设施实拍 |
| `/specialized-training/psychological` | 英文图 | `prolist-77` 心理拓展设施实拍 |
| `/why-us/story` | 仅 2 处媒体引用 | `about_img.jpg`、`about_linian_img01/02.jpg`、`licheng.jpg` |
| `/why-us/certification` | 0 图 | `hj1~hj7`、`zizhirongyu.jpg` 荣誉墙 |
| `/why-us/team` | 0 图 | 待业务提供团队照片（旧站亦无，**待办：需业务方指定负责人与截止日期**） |
| `/solutions/*` | 图标为主 | 从对应产品分类选 1 张主图（消防救援→73/75、院校→46、景区拓展→77 等） |
| `/cases`、`/resources/news` 页头 | 通用图 | 可用旧站首页 banner 图 |

命名规范：`{页面语义}-{序号}.jpg`（如 `fixed-tower-cn-01.jpg`、`cert-honor-01.jpg`），
与现有 `media/` 命名风格一致；旧站哈希文件名不落新站目录。

### 3.3 MinIO 占位副本处理（content/ 前缀）

| 对象 | 处理 |
|------|------|
| `tower-wylie.jpg`（= og-default.jpg） | 替换为真实照片后 `--force` 重传 |
| `tower-ocean-springs.jpg` / `tower-prairieville.jpg` / `tower-titusville.jpg` | 同上，换真实图 |
| `hero.mp4` 等 5 个同片视频 | 短期：poster 图兜底不影响观感；中期：业务提供真实视频或改静态图方案 |
| `og-default.jpg`（2.4MB） | 顺带压缩至 ≤300KB（web-seo-assessment 已立 P2-9 项） |

---

## 四、技术方案

### 4.1 总体原则

1. **不重新上传内容图**：旧站 `uploads/images/` 已在 MinIO，本次只改数据库 URL 与
   补充静态页素材，避免产生重复对象；
2. **生产媒体只从 MinIO 服务**：仓内 `public/media/` 不进 git，任何新增图片必须经
   `prisma:sync:static-media` 上传后才算生效（参考 docs/web-seo-assessment-and-plan.md P2-9 教训）；
3. **数据库操作遵守工作流规范**：本地 `tzj_dev` 为生产快照恢复的真实业务数据，
   禁止 `migrate reset` 等破坏性操作；封面修正走一次性幂等脚本（upsert by slug）；
4. **生产为唯一事实源**（REDACTED-IP）：本地验证通过后，脚本在生产环境再执行一次，
   禁止使用废弃服务器 REDACTED-IP。

### 4.2 阶段 P0：修数据库封面（半天）

新增一次性脚本 `apps/api/prisma/fix-content-covers.ts`（仿 seed 脚本形态，tsx 运行）：

1. 内置两张映射表（本次调研已从旧站 HTML 提取，写成 TS 常量）：
   - `CASE_COVER_MAP: Record<string /*slug*/, string /*MinIO 绝对 URL*/>`（46 条）
   - `NEWS_COVER_MAP: Record<string, string>`（20 条）
2. 逐条 `prisma.case.update / prisma.news.update` where slug 精确匹配，设 `coverImage`
   为映射值；脚本幂等，可重跑；
3. **必须实现 `--dry-run`**：仅打印 diff（当前值 → 新值），不写库；
4. 运行前先比对「线上后台实际显示」与查询结果（生产环境铁律第 2 条）；
5. 本地验证 → 生产执行 → 后台抽查列表页封面是否逐条不同。

交付物：脚本（含 `--dry-run`）+ 映射表 + 执行记录。

### 4.3 阶段 P1a：选图与压缩转码（1 天）

1. **选图**：按 §3.2 映射表从旧站 `uploads/images/` 挑选（每页 1~4 张主图，优先
   202603~202606 新拍图，其次 2021/2020 年图）；
2. **压缩转码**：统一转 WebP（照片类）/ 保留 PNG（图标、荣誉扫描件），
   单图 ≤500KB，宽度 ≥1600px 的压到 1600；`sips` 处理 JPEG/PNG 缩放，
   `cwebp`（需 `brew install webp`）转 WebP，产出写入 `apps/web/public/media/`；
3. 新增文件会被 `prisma:sync:static-media` 自动上传并在 `media_assets` 表登记，
   进入 Admin 媒体库管理视野。

### 4.4 阶段 P1b：接线、i18n 与同步（1~2 天）

1. **接线**：
   - 产品线封面：更新 `apps/web/src/lib/product-catalog.ts` 的 `image` 字段；
   - 案例/新闻 seed 演示数据：更新 `lib/cases.ts`、`lib/news.ts` 的 `image`；
   - 解决方案：更新 `lib/solutions.ts` 的 `SOLUTION_META.image`；
   - 页面区块（why-us/story、certification 等）：在对应 page/section 组件新增
     `MediaImage` 引用；
   - 新增路径会自动进入 `lib/static-media-paths.ts` 的收集逻辑（`collectSiteStaticMediaPaths`
     已聚合上述模块），无需手工维护清单；
2. **同步**：`pnpm --filter @tzj/api prisma:sync:static-media`（本地 MinIO 验证）→
   生产环境执行同命令（指向生产 MinIO `tzj-uploads-prod`）；
3. **i18n**：新增图片的 alt 文案走 `messages/{locale}/*.json`，三语（zh-CN / zh-TW / en，
   按现有语言集）补齐。

### 4.5 阶段 P2：占位副本与开发环境一致性（随 P1b 顺带）

1. `public/media/` 缺失的 8 个引用文件：P1 换图后引用自然消除；确需保留的
   （如 `tower-ocean-springs.jpg`）从 MinIO 拉回本地一份，保证开发/生产一致；
2. 用真实图替换 `tower-wylie.jpg` 等占位副本后，`prisma:sync:static-media --force`
   按 key 重传（脚本已支持 `keys` + `force` 参数）；
3. `og-default.jpg` 压缩至 ≤300KB 后重传（合并 SEO 计划 P2-9）。

### 4.6 验收标准

**C 端前台**
- [ ] `/cases` 列表 52 条封面中，旧站迁移条目（46 条）逐条不同且与旧站一致；
- [ ] `/resources/news` 列表迁移条目（20 条）封面逐条不同；
- [ ] 首页、13 条产品线页、why-us 四页、solutions 六页均无破图、无明显图文不符；
- [ ] 生产 MinIO `content/` 中不再存在 ETAG 相同的占位副本（视频除外，单独跟进）；
- [ ] Lighthouse/手测：新增图片均 ≤500KB，列表页 LCP 图片可正常懒加载。

**Admin 后台**
- [ ] `/cases` 管理列表：46 条旧站迁移封面逐条不同（与前台一致）；
- [ ] `/news` 管理列表：20 条旧站迁移封面逐条不同；
- [ ] 媒体库中可见 P1 新增的 `content/` 素材记录。

**缓存验证**
- [ ] 替换后的占位副本（`tower-wylie.jpg` 等）curl 生产 URL 确认为新文件（ETAG 变化）；
- [ ] 若 CDN 层有缓存，确认 PURGE 或 TTL 过期后新图生效。

### 4.7 风险与回滚

| 风险 | 缓解 |
|------|------|
| 封面脚本误写生产 | 脚本仅按 slug 精确匹配更新，**必须先 `--dry-run` 打印 diff 确认无误**；生产执行前备份 `cases`/`news` 两表（pg_dump 单表） |
| 旧站图片版权/水印 | 旧站为我方自有站点，素材自有；迁移前人工抽查有无第三方水印 |
| MinIO 重复上传产生孤儿对象 | 只新增 `content/` 对象与改 DB URL，不删旧对象；清理另行立项 |
| 本地与生产媒体不一致 | 一切以 `prisma:sync:static-media` 上传结果为准，验收直接 curl 生产 URL |

---

## 五、实施顺序

1. 评审本文档，确认 §3.2 选图映射与优先级；
2. P0：封面修正脚本（`--dry-run` → 本地验证 → 生产执行）；
3. P1a：选图、压缩转码（1 天）；
4. P1b：接线、i18n、同步 MinIO（1~2 天，可按页面分批提交）；
5. P2：占位副本替换与 og 图压缩；
6. 线上抽查验收（§4.6），业务确认。

## 附录：本次调研的取证命令（可复现）

```bash
# 旧站图片引用统计
grep -rhoE '(src|href)="[^"]*\.(jpg|jpeg|png|webp|gif)[^"]*"' /Users/gavin/Documents/tzj/www.tzjii.com --include="*.html" | sort | uniq -c | sort -rn

# 新站引用与本地文件差集
grep -rhoE '/media/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|mp4)' apps/web/src | sort -u

# 数据库封面集中度
psql ... -c 'SELECT "coverImage", count(*) FROM cases GROUP BY 1 ORDER BY 2 DESC;'

# MinIO 占位副本识别（ETAG 相同即同一文件）
# 方式 A：通过 mc 直接查桶内对象（推荐，不受 nginx 反代影响）
mc ls --recursive prod/tzj-uploads-prod/content/ | grep -E '(hero|tower-wylie|og-default)' | sort -k3

# 方式 B：通过 curl 查生产 URL（需确认 nginx 透传 ETAG）
for key in hero.mp4 fixed-tower.mp4 tower-wylie.jpg og-default.jpg; do
  curl -sI "https://static.tzjii.com/tzj-uploads-prod/content/$key" | grep -i etag
done

# 旧站案例列表缩略图提取（macOS 需 ggrep：brew install grep）
ggrep -oP '<a href="caseshow-[^"]+"[^>]*>.*?<img src="([^"]+)"' /Users/gavin/Documents/tzj/www.tzjii.com/caselist-*.html | sort
```
