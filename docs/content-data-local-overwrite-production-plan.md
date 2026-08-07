# 内容数据本地覆盖生产方案（2026-08-07）

> 状态：**已执行完成（2026-08-07，镜像 tag `4a91756`）**。
> 用户指示：案例管理、新闻管理、博客管理、活动（展会）管理、法务页面，**一律以本地库为准，直接覆盖线上，线上对应内容全部删除**。
> 已确认决策：① 走方案 A（提交迁移 + 代码一起发布）；② OSS 走本地覆盖线上（`content/` 全量替换，注意 baseurl 替换）；③ 执行窗口由用户发令触发，不预设时间（见 §1.1）；④ 提交范围 = 全量提交当前工作区；⑤ media_assets 的 `content/` 孤儿记录彻底删除；⑥ 新媒体补登记到 Admin 媒体库（Phase 5.6）；⑦ **以本地 MinIO `content/` 为唯一主源，OSS 为生产同步副本，`public/media` 降级为冗余暂存**。
> 生产唯一事实：真生产 `ssh root@REDACTED-IP`；废弃服务器 `REDACTED-IP` 严禁使用。
> 关联文档：`docs/content-media-launch-plan-2026-08-07.md`。

---

## 1. 结论先行

本次是一次**受控的全量替换**：对 `cases / news / blogs / trade_shows / pages` 五张内容表，先 `DELETE` 生产全部行，再 `INSERT` 本地全部行。生产独有行按用户指示一并删除，不做逐条保留。OSS 侧同步以**本地 MinIO `content/` 为唯一主源**（MinIO 已包含全部被引用文件，完整性核对见 Phase 2.5），替换 `content/` 前缀下的全部对象；`public/media` 仅作为冗余暂存，不再作为主源。

前置事实：

1. **生产 `blogs`、`trade_shows` 缺少 `detailCoverImage` 列**，本地数据带该列，同步前必须先补列（与仓库两个手写迁移 SQL 完全一致，幂等）。
2. **已选定方案 A**：提交两个迁移目录与当前代码变更 → push `main` → `deploy.sh all <sha>` 自动 `migrate deploy` 补列。
3. **备份已生成**：`/opt/tzj/backups/tzj_prod-pre-content-replace-20260807165444.dump`（416K，仅存档，本方案不考虑回滚）。
4. **OSS 必须同步**：以本地 MinIO `content/` 为主源（当前 840 个对象，已含全部被引用文件）；生产 `content/` 前缀当前 179 个对象；DB 内容引用 `content/...` 相对 key，不同步媒体则替换后页面图片大量 404。**所有数量执行前需重新清点，以实时数字为准**。

### 1.1 什么是“执行窗口”

执行窗口 = **我们约定好的一个具体时间段**（例如某天凌晨 02:00–04:00），在这段时间内一口气完成：OSS `content/` 替换 → 数据库五表替换 → 线上验证。

为什么要约定窗口：

- OSS 删除/上传和 DB 替换期间，线上可能出现短暂的新旧内容/图片混杂或个别 404；
- 因此选择访问量最低的时段，并保证窗口内连续做完，不在中途停手；
- 窗口开始前必须完成备份，窗口结束后才算发布完成。

本方案**不预设日期**：由用户说“开始”后触发执行；开始前先复核备份与准备状态（Phase 1），再按 Phase 2→6 连续完成。

---

## 2. 范围

### 2.1 替换表（DELETE 全量 + INSERT 本地全量）

| 表 | 本地模型 | 说明 |
|----|----------|------|
| `cases` | Case | 案例管理 |
| `news` | News | 新闻管理 |
| `blogs` | Blog | 博客管理 |
| `trade_shows` | TradeShow | 活动/展会管理 |
| `pages` | Page | 法务页面（`privacy-*` / `terms-*`，另有 about/contact/service 占位页） |

### 2.2 不触碰

`contacts`、`customers`、`page_views`、`visitors`、`settings`、`users`、`integrations`、`chat_*`、`ad_spend_records` 等业务表一律不动；`media_assets` 的 `content/` 前缀先删孤儿记录（Phase 5.5）、再按 MinIO 主源补登记（Phase 5.6），其他前缀保留。

### 2.3 OSS 替换范围（已确认：本地覆盖线上）

| 前缀 | 动作 | 说明 |
|------|------|------|
| `content/` | **先清空全部线上对象，再上传 MinIO 主源全量（已确认顺序）** | 主源 = MinIO `content/`（当前 840 个对象，含 `wechat.jpg`、`douyin.jpg`、hazmat 产品图等 17 个 `public/media` 已缺失但被引用的文件） |
| `next/web`、`next/admin` | 保留 | `deploy.sh` 每次部署自动同步 `_next/static`，删除会整站 CSS/JS 404 |
| `statics/vditor-assets`、`statics/browser-support.js`、`statics/sounds` | 保留 | `deploy.sh` 自动同步 |
| `uploads/`、`videos/`、`trade-shows/`、`images/` 等 | 保留 | 后台/用户上传及历史媒体，不在本地 `public/media` 范围内 |

> ⚠️ **不做全桶清空**：桶里同时托管部署产物与用户上传文件，全桶删除会立刻打挂线上。已按用户最新指示确认范围 = `content/` 前缀（“先清空 content/ 再上传”），`next/`、`statics/`、`uploads/`、`chat/` 等前缀保留。

### 2.5 MinIO 主源与 public/media 的关系（已确认原则）

- **MinIO = 唯一主源**：所有静态资源（`content/`）以本地 MinIO 为准；
- **public/media = 冗余暂存**：其中 823 个文件与 MinIO 重复；原 25 个废弃文件经全仓库核对**无任何引用**，已执行删除（备份于 `/tmp/tzj-unreferenced-media-20260807/`），不作为上线源；
- 当前差异（2026-08-07 实测+清理后）：MinIO 840 个 vs public/media 823 个；**MinIO 已包含全部被引用文件**（数据库 453 个 `content/` 引用缺失 0；代码/静态注册表引用的 `wechat.jpg`、`douyin.jpg`、hazmat 产品图 17 个文件均在 MinIO）；
- MinIO 独有的 17 个文件**全部被引用**（保留）；原 2 个无引用对象（`alarm-highrise.jpg`、`tower-titusville.jpg`）**已删除**，对应本地 `media_assets` 2 行孤儿记录同步删除；
- **主源规模 = MinIO 当前 840 个对象；不需要把 public/media 的任何文件补进 MinIO**；
- `public/media` 剩余 823 个文件与 MinIO 重复，整个目录的删除时机：上线验证通过后、MinIO 完整并建议先归档，再由用户确认删除。

### 2.4 baseurl 替换规则（已确认）

1. 本地文件上传映射：`/media/x` → `https://static.tzjii.com/content/x`；
2. DB 文本/数组字段：`https://static.tzjii.com/tzj-uploads-prod/` → `https://static.tzjii.com/`（实测 `caseshow-52-32.coverImage` 命中旧前缀）；
3. DB 中的 `content/...` 相对 key 原样保留（C 端 `resolveMediaUrl` 统一解析到 `https://static.tzjii.com/content/...`）；
4. 本地数据 0 条命中 `localhost:9000`，无需处理（生成时仍保留兜底规则）；
5. 构建期 `NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://static.tzjii.com` 已配置，方案 A 部署时随镜像注入，无需人工改。

---

## 3. 现状基线（2026-08-07 只读实测）

| 表 | 本地行数 | 生产行数 | 生产独有（将删除） | 本地独有（将新增） |
|----|---------|---------|--------------------|--------------------|
| `cases` | 52 | 52 | 无 | 无 |
| `news` | 26 | 26 | `1000-projects-milestone` | `turnkey-delivery-network` |
| `blogs` | 9 | 9 | 无 | 无 |
| `trade_shows` | 4 | 5 | `firefighter-tribute-august-2026` | 无 |
| `pages` | 9 | 9 | 无 | 无（内容完全一致） |

内容分叉摘要：

- **博客**：生产 9 条与本地 slug 一致，但生产正文普遍更短（如 `burn-room-temperature` 生产 175 字符 vs 本地 987 字符，本地含图集 Markdown），本地明显是富化后版本。
- **新闻**：生产部分行正文比本地更长（如 `newsshow-65-33` 生产 23807 字符 vs 本地 649），且生产/本地各有一条独有行；按用户指示仍以本地全量覆盖。
- **案例**：52 条 slug 一致；其中约 14 条生产已是富化内容（长度与本地吻合），其余约 38 条生产仍是旧版，本次统一替换为本地。
- **法务页**：本地与生产 9 条完全一致，替换后无可见差异，按用户指示仍纳入全量替换（会产生新 ID，无业务影响）。

---

## 4. Schema 前置

生产 `_prisma_migrations` 最新两条为 case / news 的 `detailCoverImage` 迁移；`blogs`、`trade_shows` 两列缺失。仓库已有对应迁移：

- `apps/api/prisma/migrations/20260806130000_add_trade_show_detail_cover_image/migration.sql`
- `apps/api/prisma/migrations/20260806140000_add_blog_detail_cover_image/migration.sql`

两条 SQL 均为：

```sql
ALTER TABLE "trade_shows" ADD COLUMN IF NOT EXISTS "detailCoverImage" TEXT;
ALTER TABLE "blogs"      ADD COLUMN IF NOT EXISTS "detailCoverImage" TEXT;
```

**已选定：方案 A（标准发布路径）。**

1. 提交两个迁移目录及当前工作区代码变更（含 legacy 产物 5 处变更）；
2. push `main` 触发 `deploy.yml`；
3. 由 `deploy.sh all <sha>` 的 `migrate deploy` 自动补列；
4. 部署成功后再执行本文 §6 的 OSS 替换与数据替换。

> 方案 B（仅数据同步、手工补列）已弃用，不再执行。

---

## 5. 变更集生成规则

从本地库 `tzj_dev` 导出 SQL，规则固定：

1. **表顺序**：`cases → news → blogs → trade_shows → pages`。
2. **每张表**：
   - `DELETE FROM "<table>";`
   - 逐行 `INSERT INTO "<table>" (...) VALUES (...);`
3. **列处理**：
   - 内容四表排除外键审计列 `createdById`、`lastOperatorId`（本地用户 ID 在生产不存在，直接不写入，结果为 NULL）；`createdBy` / `lastOperator` 文本列保留。
   - `pages` 无外键列，全列写入。
4. **URL 规范化**（写入前对文本/数组字段统一处理）：
   - `https://static.tzjii.com/tzj-uploads-prod/` → `https://static.tzjii.com/`（实测 `caseshow-52-32.coverImage` 命中旧前缀）；
   - `http://localhost:9000/tzj-uploads-dev/` → 相对 key（当前 0 命中，仅作兜底）；
   - 其余 `content/...` 相对 key 原样保留（C 端 `resolveMediaUrl` 可解析）。
5. **事务**：整个变更集包在 `BEGIN; ... COMMIT;` 内，应用时开启 `ON_ERROR_STOP=1`，任一步失败整批不生效（事务原子性）。
6. **不修改**任何序列/自增（ID 均为 CUID，无序列）。

---

## 6. 执行步骤（待确认执行窗口后执行）

### Phase 0：确认

- [x] 执行方式：方案 A。
- [x] OSS：`content/` 全量本地覆盖 + baseurl 替换。
- [x] 执行窗口：由用户发令触发，不预设日期；说“开始”后才进入 Phase 2。
- [x] 执行顺序：**先清空 `content/` 再上传**（已确认，接受窗口内短暂缺图）。

### Phase 1：备份复核

```bash
ssh root@REDACTED-IP 'ls -lh /opt/tzj/backups/tzj_prod-pre-content-replace-*.dump'
```

建议同时下载一份到本机或 OSS 私有位置存档。

### Phase 2：代码 + 迁移发布（方案 A）

1. 本地质量门禁：`pnpm run check`、`pnpm run typecheck`、`pnpm run build` 全部通过；
2. 提交范围：**全量提交（已确认）**，即提交当前工作区全部变更；
   - 必含：两个迁移目录、`apps/web/public/legacy/` 增删文件、`apps/web/src/generated/legacy-css.ts`；
   - 其余为当前工作区业务变更（约 250 个文件）；执行前用 `git status` + `git diff --stat` 人工复核，确认无 `.env`/密钥/无关文件；`zhengshu/` 为空目录不会入库；
   - 不使用最小提交方式。
3. push `main`，确认 `deploy.yml` 构建 web/admin/api 三镜像成功；
4. 确认 ECS 侧 `deploy.sh all <sha>`：migrate → CDN 静态同步 → 滚动更新 → smoke 全绿；
5. 核对生产已出现 `blogs`、`trade_shows` 的 `detailCoverImage` 列；
6. **deploy 成功后立即连续执行 Phase 3–5，不留间隔**（新前端 + 旧数据只允许短暂存在）。

### Phase 2.5：核对 MinIO 主源完整性（执行窗口前）

目的：确认 MinIO `content/` 已是完整主源（当前 840 个对象），**无需补传 public/media**：

- 数据库 453 个 `content/` 引用在 MinIO 中缺失数 = 0；
- 代码/静态注册表引用的 `wechat.jpg`、`douyin.jpg`、hazmat 产品图等 17 个文件均在 MinIO；
- `public/media` 原独有的 25 个文件经全仓库核对无任何引用（DB / 代码 / i18n JSON / 静态注册表），**已删除**（备份于 `/tmp/tzj-unreferenced-media-20260807/`），不补传、不作为上线源。

```bash
# 1) MinIO content/ 对象数（当前 840，执行时以实时为准）
docker exec tzj_minio_dev sh -c 'mc ls -r local/tzj-uploads-dev/content/ | grep -cv "/$"'

# 2) 数据库 453 个 content/ 引用在 MinIO 中缺失数应为 0（本地脚本核对）
# 3) 代码/静态注册表引用的 17 个 MinIO 独有文件存在性核对
```

> 结论：MinIO 即主源，后续 Phase 3/5.6 全部以 MinIO 为准；`public/media` 不再参与上线。

### Phase 3：OSS `content/` 替换（执行窗口内）

**已确认执行顺序：先清空 `content/` 全部对象，再上传 MinIO 主源全量。** 两步之间不停顿；窗口内旧页面图片会短暂 404（已接受）。最终 `content/` 与 MinIO 主源 `content/` 一一对应。

```bash
# 1) MinIO 主源 → 容器内暂存 → docker cp 到本机 → rsync 到 ECS（保留目录结构）
docker exec tzj_minio_dev sh -c 'rm -rf /tmp/minio-content && mc mirror --overwrite local/tzj-uploads-dev/content /tmp/minio-content'
docker cp tzj_minio_dev:/tmp/minio-content/. /tmp/minio-content/
rsync -avz --delete /tmp/minio-content/ root@REDACTED-IP:/opt/tzj/media-upload/content/

# 2) ECS：清空 content/（版本控制下历史版本仍可恢复）
ssh root@REDACTED-IP 'cd /opt/tzj && set -a && . .env.prod.local && set +a && \
  ossutil rm oss://tzj-prod-media/content/ -r -f \
    -e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing \
    -i "$ALI_KEY" -k "$ALI_SECRET"'

# 3) ECS：立即上传 MinIO 主源全量（清空后不要停顿，缩短缺图窗口）
ssh root@REDACTED-IP 'cd /opt/tzj && set -a && . .env.prod.local && set +a && \
  ossutil cp -r -u /opt/tzj/media-upload/content/ oss://tzj-prod-media/content/ \
    -e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing \
    -i "$ALI_KEY" -k "$ALI_SECRET" --cache-control "public, max-age=2592000"'

# 4) 校验：content/ 对象数应与 MinIO 主源实时清点数一致（当前 840，以实时为准）
ssh root@REDACTED-IP 'cd /opt/tzj && set -a && . .env.prod.local && set +a && \
  ossutil du oss://tzj-prod-media/content/ -e oss-cn-beijing-internal.aliyuncs.com \
    --region cn-beijing -i "$ALI_KEY" -k "$ALI_SECRET"'

# 5) CDN 刷新（覆盖的稳定 key 会被 30 天 TTL 缓存）
阿里云 CDN 控制台「刷新预热」→ 目录刷新 `https://static.tzjii.com/content/`（或使用 `aliyun cdn RefreshObjectCaches`）。
```

> **已确认**：采用“先清空后上传”，窗口内旧页面图片会短暂 404（用户已接受）；`ossutil sync --delete` 一步到位仅作为备选，未采用。上传后必须复核 `content/hero.mp4`、`content/burn-room.mp4`（本地 16MB 新版覆盖生产 38MB 旧版）与 `content/og-default.jpg` 的 ETag（og-default 本地/生产 ETag 已一致，复核即可）。

### Phase 4：生成 DB 变更集

生成方式（固定、可审计）：

1. 本地导出：
   ```bash
   docker exec tzj_postgres_dev pg_dump -U tzj_admin -d tzj_dev \
     --data-only --column-inserts \
     --table=cases --table=news --table=blogs --table=trade_shows --table=pages \
     > /tmp/tzj-content-raw.sql
   ```
2. 后处理：
   - 每张表前插入 `DELETE FROM "<table>";`；
   - 内容四表 INSERT 中把 `createdById` / `lastOperatorId` 置为 NULL（本地用户 ID 生产不存在）；
   - 文本/数组字段执行 §5 的 baseurl 替换；
   - 用 `BEGIN;` / `COMMIT;` 包裹，应用时 `ON_ERROR_STOP=1`。
3. 生成后校验：INSERT 行数 = 本地行数（52 / 26 / 9 / 4 / 9）；人工抽查敏感字段、生产独有行确实不包含；
4. 先在本地临时库或事务中 dry-run 一遍，再进入 Phase 5。

### Phase 5：应用 DB 变更集

```bash
ssh root@REDACTED-IP "docker exec -i tzj-postgres-1 psql -U tzj -d tzj_prod -v ON_ERROR_STOP=1" < /tmp/tzj-content-sync-20260807.sql
```

### Phase 5.5：清理 media_assets 孤儿记录（已确认）

```bash
# 删除前确认数量（当前生产实测 41 条）
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \"select count(*) from media_assets where key like 'content/%';\""

# 彻底删除 content/ 前缀媒体库记录（OSS 对象已在 Phase 3 清空重建，这些记录全部失效）
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \"DELETE FROM media_assets WHERE key LIKE 'content/%';\""

# 删除后立即确认：content/ 前缀记录应为 0
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \"select count(*) from media_assets where key like 'content/%';\""
```

### Phase 5.6：按 MinIO 主源补登记到 Admin 媒体库（已确认）

把 MinIO 主源（`content/`，当前 840 个对象，以实时清点为准）批量写入 `media_assets`，让 Admin 媒体库能看到新文件。

登记字段（固定）：

- `id`：`'ma_' || md5(key)`（确定性 ID，重复执行不产生重复行）；
- `key`：`content/<media 相对路径>`；
- `url`：`https://static.tzjii.com/content/<media 相对路径>`；
- `filename`：原文件名；
- `mimeType`：按扩展名映射（jpg/png/webp/mp4 等，与 `sync-content-media.ts` 的 MIME_MAP 一致）；
- `size`：MinIO 对象大小（`mc stat` / `mc ls --json` 读取）；
- `folder`：`content`；
- `createdAt` / `updatedAt`：`now()`；
- `width` / `height` / `alt` / `uploadedById` / `watermarked` 等：不写入（留空/默认）。

生成与执行：

```bash
# 本地生成 INSERT SQL（遍历 MinIO 主源对象清单，逐对象计算 key/url/filename/mimeType/size）
# 产物：/tmp/tzj-media-register.sql，使用 ON CONFLICT (key) DO UPDATE 保证幂等

# 应用到生产
ssh root@REDACTED-IP "docker exec -i tzj-postgres-1 psql -U tzj -d tzj_prod -v ON_ERROR_STOP=1" < /tmp/tzj-media-register.sql
```

### Phase 6：验证

```bash
# 行数与本地一致
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \"select (select count(*) from cases) cases, (select count(*) from news) news, (select count(*) from blogs) blogs, (select count(*) from trade_shows) trade_shows, (select count(*) from pages) pages;\""

# detailCoverImage 覆盖：blogs 9/9、trade_shows 4/4
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \"select (select count(*) from blogs where \\\"detailCoverImage\\\" is not null) blogs_detail, (select count(*) from trade_shows where \\\"detailCoverImage\\\" is not null) ts_detail;\""

# 生产独有行已删除 / 本地独有行已新增
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \"select slug from news where slug in ('1000-projects-milestone','turnkey-delivery-network'); select slug from trade_shows where slug='firefighter-tribute-august-2026';\""

# 外键审计列应为空
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \"select (select count(*) from cases where \\\"createdById\\\" is not null or \\\"lastOperatorId\\\" is not null) bad_cases, (select count(*) from news where \\\"createdById\\\" is not null or \\\"lastOperatorId\\\" is not null) bad_news, (select count(*) from blogs where \\\"createdById\\\" is not null or \\\"lastOperatorId\\\" is not null) bad_blogs, (select count(*) from trade_shows where \\\"createdById\\\" is not null or \\\"lastOperatorId\\\" is not null) bad_ts;\""

# media_assets 的 content/ 新登记数应与 MinIO 主源实时清点数一致（当前 840，以实时为准）
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \"select count(*) from media_assets where key like 'content/%';\""
```

线上抽查：案例/新闻/博客/活动列表与详情、法务页 `/privacy` `/terms`，Admin 对应列表与编辑页可打开。

---

## 7. 风险与注意

1. **OSS 媒体缺图（最高风险）**：DB 替换后，若 `content/...` 对象未同步，C 端大量图片 404。**已确认**本次一并执行：`content/` 全量本地覆盖 + baseurl 替换（§2.3 / §2.4 / §6 Phase 3）。
2. **ID 全部变更**：五张表行 ID 由生产旧 CUID 变为本地 CUID。站内 URL 均按 slug/路径，不受影响；Admin 通过 API 按 ID 操作，替换后以新 ID 为准。
3. **审计字段置空**：`createdById` / `lastOperatorId` 写入为 NULL，`createdBy` / `lastOperator` 文本保留；后台“创建人/最后操作人”关联展示可能变为空。
4. **生产独有行删除不可逆**：`1000-projects-milestone`（新闻）、`firefighter-tribute-august-2026`（活动）会按用户指示删除；本方案不考虑回滚。
5. **法务页无可见差异**：本地与生产 `pages` 完全一致，替换仅是“按指示执行全量覆盖”，内容不变。
6. **Schema 与迁移一致性**：已选方案 A，两条迁移由 `deploy.sh` 的 `migrate deploy` 统一记录，无手工补列。
7. **禁止全桶清空**：OSS 桶还托管 `next/`、`statics/`、`uploads/` 等部署与用户数据，只允许替换 `content/` 前缀。
8. **执行窗口内短暂不一致**：OSS 与 DB 替换完成前，线上可能出现新旧内容/图片混杂；窗口内连续完成，不中断。
   - 已确认接受“先清空 content/ 再上传”导致的短暂缺图；清空后立即上传，缩短窗口。
9. **禁止操作**：不执行 `migrate dev/reset`、`DROP DATABASE`、`TRUNCATE`；不触碰五张表以外的数据；不使用 `REDACTED-IP`。
10. **media_assets 孤儿记录（已确认彻底删除 + 补登记）**：生产 `media_assets` 现有 41 条 `content/` 前缀记录；OSS 清空重建后全部失效。Phase 5.5 删除旧记录，Phase 5.6 按 MinIO 主源补登记（当前 840 个，以实时为准），Admin 媒体库 `content/` 分类最终展示新文件清单。

---

## 8. 待确认事项

- [x] 执行方式：方案 A（提交迁移 + 代码，标准 deploy）。
- [x] 提交范围：**全量提交当前工作区**（已确认）。
- [x] OSS：`content/` 全量本地覆盖，baseurl 替换，保留 `next/`、`statics/`、`uploads/` 等前缀。
- [x] 执行窗口：由用户发令触发，不预设时间；开始前复核备份，预计全程 30–60 分钟。
- [x] 执行顺序：**先清空 `content/` 再上传**（已确认，接受短暂缺图）。
- [x] media_assets 孤儿记录：**彻底删除 `content/` 前缀记录**（已确认，Phase 5.5）。
- [x] media_assets 补登记：**Phase 5.6 按 MinIO 主源登记全部对象**（已确认）。
- [x] 主源原则：**本地 MinIO `content/` 为唯一主源**（已确认；MinIO 已含全部被引用文件，Phase 2.5 仅核对完整性，不补传废弃文件）。
- [ ] `public/media` 删除：上线验证通过后、MinIO 完整并建议先归档，再由用户确认是否删除（默认先保留）。

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-08-07 | 初版：五张内容表全量本地覆盖生产；含基线、Schema 前置、生成规则、执行/验证/回滚清单 |
| 2026-08-07 | 定稿：确认方案 A；新增 OSS `content/` 全量本地覆盖与 baseurl 替换规则；补充“执行窗口”说明 |
| 2026-08-07 | 终极评估修订：媒体基线改为执行前实时清点（当前 859/235M）；回滚命令修正为“先 DELETE + data-only”；锁定提交范围与质量门禁；落地 DB 变更集生成方式；补充 media_assets 副作用与 OSS 回滚说明 |
| 2026-08-07 | 确认 OSS 执行顺序：先清空 `content/` 再上传（接受短暂缺图）；同步更新 Phase 0/3/9 与风险说明 |
| 2026-08-07 | 按用户要求去掉回滚：删除 §7 回滚方案及相关风险说明，本方案不考虑回滚；备份仅存档 |
| 2026-08-07 | 确认提交范围 = 全量提交当前工作区；确认 media_assets `content/` 孤儿记录彻底删除（新增 Phase 5.5） |
| 2026-08-07 | 确认 OSS 范围 = `content/` 前缀（不做全桶清空）；新本地媒体暂不补登记到 Admin 媒体库，执行后如需要再补 |
| 2026-08-07 | 确认 Phase 5.6：本次一并补登记本地媒体到 Admin 媒体库（字段：id/key/url/filename/mimeType/size/folder） |
| 2026-08-07 | 原则修订：以本地 MinIO `content/` 为唯一主源；新增 Phase 2.5 补全 MinIO（848∪842≈867）；Phase 3/5.6 改以 MinIO 为准；`public/media` 降级为导入暂存，删除需上线后另行确认 |
| 2026-08-07 | 复核修正：MinIO 缺失的 25 个 public/media 文件全部无引用（废弃），不补传；MinIO 842 个对象已含全部被引用文件；Phase 2.5 改为“核对完整性”，主源规模 867→842 |
| 2026-08-07 | 执行删除无引用资源：本地 media 25 个废弃文件移至 `/tmp/tzj-unreferenced-media-20260807/` 并移除；MinIO 删除 2 个无引用对象（`alarm-highrise.jpg`、`tower-titusville.jpg`）；本地 `media_assets` 同步删除对应 2 行；主源 842→840，`public/media` 848→823 |
| 2026-08-07 | **上线执行完成**：本地 amd64 构建 api/web/admin 推送 ACR（`4a91756`）；`deploy.sh` 部署成功（两条迁移已应用）；OSS `content/` 清空重建 840 对象 + CDN 刷新完成；五表数据本地覆盖（52/26/9/4/9，封面 9/4）；`media_assets` 41 条孤儿删除 + 840 条补登记；线上页面/API/图片全部 200 |
