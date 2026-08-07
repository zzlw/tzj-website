# 图文内容优化上线技术方案（2026-08-07）

> 适用范围：当前工作区未提交变更（web 全站图文内容优化、Blog/TradeShow 详情页封面字段、站点电话/社媒设置、OSS 静态资源，以及本地已完成的内容补全数据）。
> 生产唯一事实：**真生产 `ssh root@REDACTED-IP`**；废弃服务器 `REDACTED-IP` 严禁用于数据同步/备份/部署/验证。
> 关联文档：`docs/product-center-image-content-optimization-plan.md`、`docs/solutions-image-content-optimization-plan.md`、`docs/trade-shows-center-content-ai-enrichment-plan.md`、`docs/blog-center-content-ai-enrichment-plan.md`、`docs/minio-to-aliyun-oss-migration-plan.md`。

## 结论先行

本次上线的两个**阻断项**：

1. **数据库 Schema 同步**：`blogs`、`trade_shows` 各新增一个可空列 `detailCoverImage`，已有两条手写迁移（`20260806130000` / `20260806140000`），当前是**未跟踪文件**，必须先提交，否则 CI 构建的 API 镜像不会携带迁移，生产 `migrate deploy` 会漏掉新列。
2. **OSS 静态资源同步**：本地 `apps/web/public/media/` 共 863 个媒体文件（约 299MB，含本次新增与少量覆盖），该目录被 `.gitignore` 排除，**不会进入 CI 构建的镜像**；必须在发布窗口内上传到阿里云 OSS 桶 `tzj-prod-media`（公开域名 `https://static.tzjii.com`，走 CDN），否则上线后大量页面缺图。

其余为常规发布：代码合并 → CI 构建/扫描 → `deploy.sh all <sha>` 自动执行迁移、CDN 静态产物同步、滚动更新与冒烟测试。

---

## 1. 发布范围（当前工作区变更）

| 模块 | 变更内容 | 是否影响生产 |
|------|----------|--------------|
| `apps/web/**` | 产品线/方案/案例/新闻/博客/展会/关于我们等页面图文重构；新增 `ProductLineMedia`、`CertificationGrid` 等组件；`static-media-paths.ts` 登记全站媒体清单 | 是（依赖 OSS 资源） |
| `apps/api` | `Blog` / `TradeShow` 新增 `detailCoverImage`（DTO + MediaGuard 引用保护）；站点设置支持 `phoneAlt` / `primaryPhone` / 社媒复制模式 `copyHint` | 是（需要 Schema 同步） |
| `apps/admin` | Blog/TradeShow 表单新增「详情页封面图」；站点设置页新增电话二、主电话、社媒触发方式配置 | 是 |
| `apps/api/scripts` | 一次性内容补全/媒体上传脚本已从工作区移除，不进入本次发布 | 内容数据同步改走 SQL 变更集（见 §5） |
| `infra/docker/.env.prod.example` | 新增阿里企业邮箱 SMTP 兜底变量 | 生产 `.env.prod` 需补齐 |
| 迁移文件 | `20260806130000_add_trade_show_detail_cover_image`、`20260806140000_add_blog_detail_cover_image` | **必须随代码提交** |

> ⚠️ `apps/web/public/legacy/` 下生成的 legacy CSS/JS 产物在工作区有增删（`detect.*.js`、`legacy.*.css`），CI 的 `Verify legacy CSS artifacts` 会做 `git diff --exit-code`，这些产物也必须一并提交。

---

## 2. 生产部署拓扑（事实基准）

- 服务器：ECS `REDACTED-IP`，部署目录 `/opt/tzj`，Docker Compose 管理 `postgres / api / web / admin / turbo-cache / gateway / acme`。
- 数据库：PostgreSQL 15（容器 `tzj-postgres-1`），库 `tzj_prod`，用户 `tzj`；生产历史与仓库 `prisma/migrations/` 一致，只允许 `prisma migrate deploy`。
- 对象存储：阿里云 OSS 桶 `tzj-prod-media`（公开读、开启版本控制），自定义域名 `https://static.tzjii.com`（CDN 加速，`/` 路径 TTL 30 天），OSS 内网端点 `oss-cn-beijing-internal.aliyuncs.com`。
- CI/CD：push `main` 触发 `deploy.yml`（docs 变更不触发）→ 构建 web/admin/api 三镜像推 ACR → SSH 到 ECS 执行 `./deploy.sh all <sha>`：先 `migrate deploy`，再同步 `_next/static`/`vditor-assets` 到 OSS，滚动更新，最后全量冒烟。
- 媒体 URL 规范：页面/组件以 `/media/x` 引用，`resolveMediaUrl` 统一映射为 `https://static.tzjii.com/content/x`；数据库富文本可存相对 key（`content/...`）或绝对 URL，均由前端解析兜底。

---

## 3. 数据库 Schema 同步（重点）

### 3.1 Schema 变更

```prisma
model Blog {
  // ...
  detailCoverImage String?  // 详情页宽幅封面，未设置回退 coverImage
}

model TradeShow {
  // ...
  detailCoverImage String?  // 同上
}
```

两条迁移 SQL（均为可空 `TEXT`，`ADD COLUMN IF NOT EXISTS`，非破坏性）：

```sql
ALTER TABLE "trade_shows" ADD COLUMN IF NOT EXISTS "detailCoverImage" TEXT;
ALTER TABLE "blogs"      ADD COLUMN IF NOT EXISTS "detailCoverImage" TEXT;
```

### 3.2 上线前本地核对

本地开发库已通过 `prisma db push` 具备新列（当前实测 `blogs` 9/9、`trade_shows` 4/4 已填 `detailCoverImage`）。核对命令：

```bash
docker exec tzj_postgres_dev psql -U tzj_admin -d tzj_dev -c \
  "select table_name, column_name from information_schema.columns where table_name = 'blogs' or table_name = 'trade_shows' and column_name = 'detailCoverImage';"
```

### 3.3 生产执行方式（禁止 migrate dev / reset）

生产**只走** `deploy.sh` 内置的 `prisma migrate deploy`，本地禁止 `prisma migrate dev / reset / db push --accept-data-loss`。

标准发布顺序：

1. 提交迁移文件与代码，push `main`（或 PR 合并）。
2. CI 构建 API 镜像（`COPY . .` 会携带 `prisma/migrations/`）。
3. 部署时 `deploy.sh all <sha>` 自动执行：

```bash
# 服务器上（deploy.sh 内部完成，无需手工执行）
cd /opt/tzj && ./deploy.sh all <sha>
```

4. 迁移后核对：

```bash
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \
  'select migration_name, finished_at from _prisma_migrations order by finished_at desc limit 4;'"

ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \
  \"select table_name, column_name from information_schema.columns where table_name in ('blogs','trade_shows') and column_name = 'detailCoverImage';\""
```

### 3.4 迁移前备份（必须）

```bash
ssh root@REDACTED-IP 'mkdir -p /opt/tzj/backups && \
  docker exec tzj-postgres-1 pg_dump -U tzj -d tzj_prod -Fc \
  > /opt/tzj/backups/tzj_prod-pre-content-$(date +%Y%m%d%H%M).dump'
```

备份文件保留在 `/opt/tzj/backups/`，同时建议下载一份到本机/异地存储（OSS 私有桶或本地），作为回滚数据源。

---

## 4. 阿里云 OSS 静态资源上线（重点）

### 4.1 资源事实

- 本地 `apps/web/public/media/`：863 个文件 / 299MB，含产品（238）、方案（33）、资源（23）、Why Us（14）、案例/新闻/博客/展会图集与视频等。
- 目录被 `.gitignore:123` 排除 → CI checkout 无这些文件 → **生产镜像里没有**。
- 目标映射规则：`/media/x` → `https://static.tzjii.com/content/x`；本地 `public/media/product/...` → OSS `content/product/...`（其余目录同理）。
- 生产桶已存在存量对象（1270 个/约 617MB，2026-08-05 OSS 迁移完成），本次是**增量补传 + 少量覆盖**（如 `content/hero.mp4`、`content/og-default.jpg` 可能变更）。

### 4.2 推荐上传路径（走 ECS 内网端点，避免公网流量/带宽瓶颈）

```bash
# 1) 本机：把 media 目录同步到 ECS 暂存目录
rsync -avz apps/web/public/media/ root@REDACTED-IP:/opt/tzj/media-upload/content/

# 2) 本机：根级公开文件（若有）按 resolveMediaUrl 规则同步（/og-default.jpg → content/og-default.jpg）
rsync -avz apps/web/public/og-default.jpg root@REDACTED-IP:/opt/tzj/media-upload/

# 3) ECS：使用 .env.prod.local 中的 ALI_KEY/ALI_SECRET（勿明文写入历史）
ssh root@REDACTED-IP 'cd /opt/tzj && set -a && source .env.prod.local && set +a && \
  ossutil cp -r -u /opt/tzj/media-upload/content/ oss://tzj-prod-media/content/ \
    -e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing \
    -i "$ALI_KEY" -k "$ALI_SECRET" --cache-control "public, max-age=2592000"'

# 4) ECS：根级文件（仅同步上一步实际存在的文件；favicon 等已由历史迁移落在 statics/）
ssh root@REDACTED-IP 'cd /opt/tzj && set -a && source .env.prod.local && set +a && \
  for f in og-default.jpg; do \
    ossutil cp -f "/opt/tzj/media-upload/$f" "oss://tzj-prod-media/content/$f" \
      -e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing \
      -i "$ALI_KEY" -k "$ALI_SECRET" --cache-control "public, max-age=2592000"; \
  done'
```

> 若嫌 rsync 到 ECS 麻烦，也可以在本机用公网端点直传 OSS（约 300MB，视带宽而定）；不建议在服务器上用公网 `static.tzjii.com` 反代批量搬运（历史教训：吞吐 <1MB/s）。

### 4.3 上传后校验

```bash
# 对象数与抽查（内网端点）
ssh root@REDACTED-IP 'cd /opt/tzj && set -a && source .env.prod.local && set +a && \
  ossutil du oss://tzj-prod-media/ -e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing \
    -i "$ALI_KEY" -k "$ALI_SECRET"'

# 公网/CDN 抽查（应 200 且 Server: AliyunOSS 或 CDN）
curl -sI https://static.tzjii.com/content/product/towers/hub-hero.webp
curl -sI https://static.tzjii.com/content/blog-plan-fire-training-tower-hero.webp
curl -sI https://static.tzjii.com/content/trade-show-regional-seminar-detail-hero.webp
curl -sI https://static.tzjii.com/content/hero.mp4
```

### 4.4 CDN 缓存刷新（关键）

覆盖写入的稳定 key（hero 视频、`og-default.jpg`、案例/新闻封面等）会被 CDN 按 30 天 TTL 缓存。上传完成后，必须对**变更过的具体路径**执行 CDN 刷新（阿里云 CDN 控制台「刷新预热」或 `aliyun cdn RefreshObjectCaches`），否则线上可能继续看到旧图。

建议统一刷新路径前缀（文件数量少时逐条刷新，量大同前缀可用目录刷新）：

```text
https://static.tzjii.com/content/
https://static.tzjii.com/statics/
```

### 4.5 与现有同步脚本的注意点

- `prisma:sync:static-media`（`sync-content-media.ts`）对嵌套路径存在 key 拍平问题：`/media/product/towers/hub-hero.webp` 会被写成 `content/hub-hero.webp` 而不是 `content/product/towers/hub-hero.webp`。**本次不建议直接全量跑该脚本**，优先使用 §4.2 的 ossutil 目录同步（目录结构天然正确）。
- 若后续要补 `media_assets` 媒体库登记，先修复该脚本的 key 生成逻辑（保留子目录）再执行；本次 `media_assets` 缺新文件不影响 C 端与后台展示（后台媒体库仅作为资源管理/引用保护）。

---

## 5. 内容数据同步（Schema 之外的“数据上线”）

本地库中已完成的 AI 内容补全（案例 52、新闻 26、博客 9、展会 4）**不会随代码部署自动到生产**。上线前需确认生产内容基线，并按以下任一方式同步。

### 5.1 先确认生产现状

```bash
ssh root@REDACTED-IP "docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -c \
  'select (select count(*) from blogs) blogs_total, (select count(*) from blogs where \"detailCoverImage\" is not null) blogs_detail, (select count(*) from trade_shows) ts_total, (select count(*) from trade_shows where \"detailCoverImage\" is not null) ts_detail;'"
```

若生产已由历史 enrich 脚本覆盖、仅缺新列值：优先用 Admin 后台逐条补图，或写按 slug 的 SQL 回填，不整表覆盖。

### 5.2 方案 A（推荐）：按 slug 导出 SQL 变更集

一次性 enrich 脚本已移出工作区，因此内容同步采用**可审计的 SQL 变更集**：从本地库导出受影响行（`blogs / news / trade_shows / cases` 的正文、SEO、图片字段），生成 `UPDATE ... WHERE slug = ...` 语句，人工 review 后在生产 psql 中执行。

```bash
# 本地导出示例（最终交付物应为一个 .sql 变更集，逐条 UPDATE）
docker exec tzj_postgres_dev pg_dump -U tzj_admin -d tzj_dev \
  --data-only --table=blogs --table=news --table=trade_shows --table=cases \
  > /tmp/tzj-content-change-set.sql
```

> 注意：`pg_dump --data-only` 是全表数据，生产若存在本地快照没有的行会产生主键冲突/覆盖。**不要直接整表导入**；应只挑选本次变更的 slug 生成 UPDATE。优点：可审计、可回滚、不触碰生产无关数据。

### 5.3 方案 B（可选）：恢复脚本后在生产执行

若决定保留脚本化方式，需先把 enrich 脚本重新提交进仓库（随 API 镜像发布），并在 ECS 上用一次性容器/SSH 隧道执行；脚本按 slug 更新既有行、slug 缺失抛错，具备幂等性。当前工作区脚本已删除，**不要依赖已不存在的文件**。

> 无论哪种方案：**先备份；先在 staging/本地对照验证脚本幂等性；绝不整表覆盖生产**（本地库是快照+内容源，不是询盘/浏览等业务表的权威源）。

---

## 6. 配置与环境变量

### 6.1 生产 `.env.prod` 增量

参考 `infra/docker/.env.prod.example` 新增：

```dotenv
ALIYUN_EXMAIL_SMTP_PASSWORD=<生产密钥，从密钥管理取，勿提交>
ALIYUN_EXMAIL_ACCOUNT_NAME=service@tzjii.com
ALIYUN_EXMAIL_FROM_ALIAS=拓之迹官网
```

若后台「集成与凭证」已维护 SMTP，env 仅作兜底，可不填密码。修改 `.env.prod` 后需 `docker compose ... up -d api`（或随下次部署）生效。

### 6.2 GitHub Vars / 构建期变量

- `NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://static.tzjii.com` 已于 2026-08-05 切换并重建镜像，本次无需变更。
- `NEXT_PUBLIC_ASSET_PREFIX_WEB/ADMIN` 指向 OSS `_next/static`，`deploy.sh` 每次部署自动同步并校验，无需人工处理。
- 站点电话/社媒设置无需 Schema：`settings.defaults.ts` 提供 `phoneAlt` / `primaryPhone` 默认值，Admin 保存后覆盖。

---

## 7. 发布执行清单

### Phase 0：提交前（本机）

- [ ] `pnpm run check`（Biome）、`pnpm run typecheck`、`pnpm run build` 通过。
- [ ] `apps/web/public/legacy/` 生成产物与 `src/generated/legacy-css.ts` 一并提交（CI 有 diff 校验）。
- [ ] **提交两个迁移目录** `apps/api/prisma/migrations/20260806130000_*`、`20260806140000_*`。
- [ ] 本地 DB 已 `prisma db push` 验证新列与 API/Admin 联调通过。
- [ ] 检查 `.env` / 密钥未进入 diff；`git status` 无敏感文件。

### Phase 1：OSS 资源（发布窗口前）

- [ ] §4.2 上传 `media/**` → `content/**`（含覆盖文件）。
- [ ] §4.3 对象数与公网 HEAD 抽查通过。
- [ ] §4.4 对变更路径做 CDN 刷新。

### Phase 2：数据（发布窗口内，先备份）

- [ ] §3.4 生产 `pg_dump` 备份完成并存档。
- [ ] 确认生产内容基线（§5.1），选择 §5.2/§5.3 执行内容同步。
- [ ] 执行后核对 `detailCoverImage` 覆盖率与关键 slug 正文。

### Phase 3：代码发布

- [ ] push `main`（或 PR 合并），确认 `deploy.yml` 构建三镜像成功、Trivy 无 CRITICAL/HIGH 阻断项。
- [ ] 确认 ECS 侧 `deploy.sh all <sha>`：migrate → CDN 静态同步 → 滚动更新 → smoke_test 全绿。
- [ ] 若需手工重放：`Actions → Deploy ECS (SSH)`，service=`all`，tag=`<sha>`。

### Phase 4：线上验证

- [ ] `/api/v1/health` 正常，日志无 Prisma/存储报错。
- [ ] `_prisma_migrations` 记录两条新迁移，`blogs`/`trade_shows` 新列存在。
- [ ] 抽样页面：产品线、方案详情、案例/新闻/博客/展会列表与详情、Why Us、资源页。
- [ ] 图片全部 200（SSR HTML 中媒体 URL 为 `https://static.tzjii.com/content/...`）。
- [ ] Admin：Blog/TradeShow 编辑页可上传/保存「详情页封面图」；站点设置可保存电话二/主电话/社媒复制。
- [ ] 媒体删除保护：删除被 `detailCoverImage` 引用的对象时 MediaGuard 正确报引用。
- [ ] 旧内核兼容：`LEGACY_CSS_ENABLED` 行为符合预期（本次 legacy 产物有更新）。
- [ ] 事务邮件（询盘通知/自动回复）走通一次，确认 SMTP 配置生效。

---

## 8. 回滚方案

| 对象 | 回滚动作 | 说明 |
|------|----------|------|
| 应用（web/admin/api） | `./deploy.sh <service> <上一个成功 sha>` | 镜像保留最近 3 个版本，旧 tag 随时可拉 |
| 数据库 Schema | **不回滚列** | 新列可空、无默认值，对旧代码完全兼容；保留列避免重复部署 |
| 数据库数据 | `pg_restore` 发布前备份（§3.4） | 内容同步前必须备份；只恢复受影响表或整库由人工确认 |
| OSS 对象 | 版本控制兜底 + CDN 刷新 | 桶已开启版本控制，覆盖可恢复历史版本；CDN 刷新旧路径或等 TTL |
| 内容脚本 | 方案 B 的 SQL 变更集天然可逆；方案 A 需备份回滚 | 脚本本身幂等更新，重复执行不会累积 |

---

## 9. 风险与注意事项

1. **迁移未提交**：两个迁移目录当前是 untracked，直接 push 会漏掉；Phase 0 必须显式 `git add` 提交。
2. **媒体不进镜像**：`public/media` 被 gitignore，CI 构建镜像不含图片；漏传 OSS = 上线即缺图。
3. **CDN 缓存**：稳定 key 覆盖后 30 天 TTL 会命中旧缓存，必须刷新变更路径。
4. **同步脚本 key 拍平**：`sync-content-media.ts` 对嵌套路径生成错误 key，本次禁用全量执行，后续修复。
5. **生产库安全**：任何脚本对生产执行前先备份；禁止 `migrate dev/reset`、`drop/truncate`；不要从废弃服务器 `REDACTED-IP` 拉任何数据。
6. **密钥**：SMTP 密码、OSS AK/SK、数据库密码只进 `.env.prod(.local)` / 密钥管理，严禁入 git。
7. **文档不触发部署**：`deploy.yml` 对 `docs/**` 与 `*.md` 忽略，纯文档提交不会发布。

---

## 10. 后续改进建议（Backlog）

- 修复 `sync-content-media.ts`：key 保留子目录（`content/<webPath 相对 media 的路径>`），并支持 `--dry-run`。
- 补跑 `media_assets` 登记，使 Admin 媒体库覆盖全部新资源。
- 沉淀「按 slug 导出内容变更集」工具，替代临时脚本直连生产库。
- 为生产 `pg_dump` 加定期任务（cron/云备份），发布前自动留存最近 N 份。
- 内容同步脚本增加 `--dry-run` 与产出 SQL 两种模式，降低生产执行风险。

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-08-07 | 初版：覆盖 Schema 同步、OSS 资源上线、内容数据同步、发布/回滚/验证清单 |
