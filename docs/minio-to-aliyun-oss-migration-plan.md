# 生产 MinIO → 阿里云 OSS 迁移方案

> 状态：方案评审稿（未实施）
> 日期：2026-07-31
> 复评：2026-07-31 —— 针对新增功能（营销弹窗、百度 OCPC 回传/百度统计/站长校验、灵犀、广告花费台账）重新评估：**总体结论与步骤不变**，增量影响已并入 §3.3 / §5.5 / §7 / §8 对应条目。
> 范围：**仅生产环境**（阿里云 ECS 单机 compose）。本地开发环境继续使用 MinIO，不在本方案范围内。
> 关联文档：`docs/deployment-plan.md`（§4 MinIO 生产化改造）、`docs/minio-to-rustfs-migration-plan.md`（另一候选方案，**已废弃**，本方案为最终采纳方案）、AGENTS.md「对象存储规范」

---

## 1. 背景与动机

### 1.1 现状

生产对象存储为**自托管 MinIO**，跑在 2C2G ECS（REDACTED-IP）的 compose 栈内：

- `minio/minio:RELEASE.2025-04-22T22-12-26Z`，仅 compose 内网 `minio:9000`，数据卷 `miniodata`
- 对外经 nginx gateway 反代为 `https://static.tzjii.com`（`STATIC_DOMAIN` server 块）
- 应用层全部收口在 `apps/api/src/storage/s3.service.ts`（`@aws-sdk/client-s3`，纯 S3 API），生产配置 `S3_FORCE_PATH_STYLE=true`
- 数据库存**绝对 URL**，前缀 `https://static.tzjii.com/tzj-uploads-prod`（含 bucket 路径段）

### 1.2 为什么换 OSS

| 维度 | 自托管 MinIO | 阿里云 OSS |
|------|-------------|-----------|
| 内存 | 512m mem_limit（2G 总内存里占 1/4，IAM 操作曾冲高被 cgroup 杀） | 0（释放 512m 给业务容器） |
| 磁盘 | 占用 40G 系统盘（ESSD Entry，无冗余） | 不占 ECS 磁盘，OSS 本身 3 副本冗余 |
| 带宽 | 媒体流量全部走 ECS 3Mbps 固定带宽，是 C 端图片加载的最大瓶颈 | 媒体流量直接从 OSS 出，不再挤占 ECS 带宽 |
| 运维 | 版本锁定、备份、nginx 反代 SigV4 踩坑（见 §7 风险）均需自维护 | 免运维，后续可平滑接 CDN / `x-oss-process` 图片处理 |
| 成本 | 隐性（磁盘/带宽/运维时间） | 显性但很小（估算见 §9） |

代码侧已为切换做过铺垫：`.env.example` 注明"线上: 阿里云 OSS (零代码切换)"，`s3.service.ts` 注释了 Virtual Hosted Style，`infra/docker/oss/` 已预置 CORS 脚本（bucket 名 `tzj-media-static-assets`、endpoint `oss-cn-beijing`）。

---

## 2. 目标架构

```
浏览器 ──GET──▶ https://static.tzjii.com （CNAME → OSS 自定义域名，绑定 bucket）
浏览器 ──预签名 PUT 直传──▶ https://tzj-media-static-assets.oss-cn-beijing.aliyuncs.com
api 容器 ──S3 API──▶ https://oss-cn-beijing.aliyuncs.com （公网端点，virtual-hosted）
迁移脚本（ECS 上）──▶ oss-cn-beijing-internal.aliyuncs.com （内网端点，免流量费、不占 3Mbps）
```

### 2.1 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Bucket | `tzj-media-static-assets`，华北2（北京），与 ECS 同地域 | `infra/docker/oss/` 已按此命名预置；OSS bucket 名全局唯一，`tzj-uploads-prod` 可能被占；同地域才有内网端点 |
| 读路径域名 | 沿用 `static.tzjii.com`，DNS 从 A 记录改 CNAME 到 OSS 自定义域名 | 域名不变 → `next.config.ts` 的 `**.tzjii.com` remotePatterns 无需改；tzjii.com 已备案，满足 OSS 绑定自定义域名的要求 |
| `S3_ENDPOINT` | **公网端点** `https://oss-cn-beijing.aliyuncs.com` | 预签名 URL 的 host 来自 endpoint——若用内网端点，签出的直传/临时 URL 浏览器不可达。API 侧上传单文件 ≤10MB、频次低，走公网可接受（OSS 上行入流量免费，仅耗 ECS 出带宽） |
| URL 风格 | Virtual Hosted（`S3_FORCE_PATH_STYLE=false`） | OSS 不支持 path-style；`s3.service.ts` 的判定逻辑对 `oss-cn-beijing.aliyuncs.com` 端点天然得出 false，无需改代码 |
| 存量 URL | **数据订正**：DB 内 URL 前缀整体替换 | 自定义域名映射到 bucket 根，路径中不再有 `/tzj-uploads-prod` bucket 段，旧 URL `https://static.tzjii.com/tzj-uploads-prod/{key}` 必须改写为 `https://static.tzjii.com/{key}`（见 §5.4） |
| 权限 | 新建 RAM 用户 + 仅限该 bucket 的自定义策略，AK/SK 写入 `.env.prod` | 最小权限；不用主账号 AK |
| 公开读 | Bucket ACL 设公开读（public-read），CORS 用现成脚本 | 与现状一致（MinIO 桶即公开读）；`s3.service.ts` 生产环境本就不在应用内设桶策略 |
| 本地 dev | 不动，继续 MinIO | dev/prod 通过环境变量切换，这正是当初统一走 S3 协议的目的 |

---

## 3. 影响面清单

### 3.1 代码改动（很少，见 §5.1）

| 文件 | 改动 | 级别 |
|------|------|------|
| `apps/api/src/storage/s3.service.ts` | S3Client 增加 `requestChecksumCalculation` / `responseChecksumValidation: 'WHEN_REQUIRED'` | **P0**（AWS SDK v3 ≥3.729 默认强制 CRC32 校验头，对 OSS 等第三方 S3 服务会报 `InvalidArgument`/签名错，必须显式关闭；对 MinIO 向下兼容无影响） |
| `infra/docker/docker-compose.prod.yml` | 观察期后：删 `minio` 服务、`miniodata` 卷、api 的 `depends_on: minio` | P1（分两步，见 §6） |
| `infra/docker/nginx/templates/tzj.conf.template` | 观察期后：删 `STATIC_DOMAIN` server 块（80 跳转块同理） | P1 |
| 其余（storage.controller、seed 脚本、media-url.ts、site-media.ts） | **零改动**——全部经 `S3_PUBLIC_DOMAIN`/`NEXT_PUBLIC_S3_PUBLIC_DOMAIN` 取值 | — |

额外说明（已逐分支推演验证）：web/admin 的 `media-url.ts` 对新 URL（无 bucket 段）行为安全，且 `KNOWN_BUCKET_NAMES` 含 `'tzj-uploads-prod'`，会把漏订正/缓存中的旧前缀 URL 自动折叠规范成新 URL，是 DB 订正之外的自愈保险（富文本内嵌 URL 不经过它，订正仍必需）。**迁移后不得从 `KNOWN_BUCKET_NAMES` 删除 `'tzj-uploads-prod'`**。

### 3.2 配置改动

| 位置 | 项 | 旧值 → 新值 |
|------|-----|------------|
| ECS `.env.prod` | `S3_BUCKET` | `tzj-uploads-prod` → `tzj-media-static-assets` |
| | `S3_REGION` | `us-east-1` → `oss-cn-beijing` |
| | `S3_ENDPOINT` | `https://static.tzjii.com` → `https://oss-cn-beijing.aliyuncs.com` |
| | `S3_ACCESS_KEY_ID/SECRET` | MinIO 应用级 AK → RAM 用户 AK/SK |
| | `S3_PUBLIC_DOMAIN` | `https://static.tzjii.com/tzj-uploads-prod` → `https://static.tzjii.com` |
| | `S3_FORCE_PATH_STYLE` | `true` → `false` |
| | `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` | 同 `S3_PUBLIC_DOMAIN` |
| | `MINIO_ROOT_USER/PASSWORD` | 观察期后删除 |
| GitHub Vars | `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` | `https://static.tzjii.com`（⚠️ 构建期烘入 web/admin 镜像，改完必须**重新构建镜像**才生效，不是改 env 重启就行） |
| 阿里云 DNS | `static.tzjii.com` | A `REDACTED-IP` → CNAME `tzj-media-static-assets.oss-cn-beijing.aliyuncs.com` |

### 3.3 数据订正范围（DB 存量 URL）

前缀替换 `https://static.tzjii.com/tzj-uploads-prod` → `https://static.tzjii.com`，涉及（已对照 schema.prisma 全部 32 个 model 核对）：

- 各内容表的 `coverImage`（String）、`images`（String[]）：案例 / 新闻 / 文章 / 活动展会 / 页面
- 富文本字段内嵌 URL：`summary` / `description` / `content` / `excerpt`（seed 的 `patchContentImageUrls` 佐证富文本确实内嵌图片 URL）
- **营销弹窗（TradeShow 扩展字段，2026-07-31 新增）**：复用 `TradeShow.coverImage` / `content`，**无新增 URL 字段**（`ctaText`/`triggerMode` 等均为非 URL 配置；`ctaUrl` 已废弃仅保留列，仍随 TradeShow 一并订正）。注意弹窗挂全站 layout，进行中活动的头图若 404 将全站可见，订正后须重点验证（见 §8）
- **`MediaAsset.url`**：媒体库表存完整公开 URL（`key` 字段不含域名，无需动），admin 媒体库列表直接消费它，**不可遗漏**
- **内部文档**：`InternalDocument.content` + `InternalDocumentRevision.content`（vditor 富文本，内嵌上传图片）
- **`Setting.value`（Json）**等 json/jsonb 列：可能存站点配置类媒体 URL，订正与兜底扫描均须覆盖 Json 列（见 §5.4）——含 `Integration.config`（现存百度 OCPC 等配置经核实仅含 `www.tzjii.com`，无 static 前缀 URL，但扫描仍须覆盖以防后续集成写入）
- `User.avatar`、`TradeShow.ctaUrl` / `externalUrl`（可能填了站内静态资源链接）
- ✅ **无需订正**：`ChatAttachment` / `ChatPendingUpload` 只存对象 key 不存 URL（读取时由 `S3_PUBLIC_DOMAIN` 拼接，切换后自动生效）
- 可不订正（历史快照性质，不影响功能）：`AuditLog.detail`、`Visitor.traits`、Lingxi 会话消息；`AdSpendRecord` 为纯数值台账，无 URL 字段
- 其他未预见字段：执行前用全库扫描 SQL 兜底核查（见 §5.4）

---

## 4. 前置准备（不影响线上，可提前任意时间做）

1. **开通 OSS 并建 bucket**（aliyun CLI 或控制台）：
   - 华北2（北京）、标准存储、**公开读**、关闭版本控制（可选开启，防误删）
   - 服务端加密：可不开（媒体本为公开资源）
2. **RAM 用户**：新建 `tzj-oss-app`，仅编程访问，挂自定义策略（仅 `tzj-media-static-assets` 桶的 `oss:GetObject/PutObject/DeleteObject/ListObjects/HeadObject/CopyObject/GetBucketInfo`），保存 AK/SK
3. **CORS + 公开读**：⚠️ OSS 的 S3 兼容层**只覆盖数据面 API**（对象读写/预签名），`PutBucketPolicy` / `PutBucketCors` 等桶管控 API 不在兼容范围——`apply-cors.sh` 的方式 A（mc 路线）预计失败。**首选控制台或 ossutil**：公开读在控制台设 bucket ACL；CORS 用 `ossutil cors --method put oss://tzj-media-static-assets infra/docker/oss/cors.json`（注意 put 是整体替换语义）。mc 仅作数据面迁移工具，不用于桶配置
4. **自定义域名 + 证书**：
   - OSS 控制台为 bucket 绑定 `static.tzjii.com`（tzjii.com 已备案，可绑）
   - 证书托管：正式方案用 OSS 控制台一键申请的免费 DV 证书（可自动续期）；也可先把现有 acme.sh 签的泛域名证书（`tzjii.com + *.tzjii.com`，覆盖 static）上传到数字证书管理服务作过渡。**注意续期**：ECS 上的 acme 容器只续本机证书，不会同步到 OSS，过渡证书到期前必须完成免费证书切换
   - 绑定后先不切 DNS，用 `curl -H 'Host: static.tzjii.com' https://tzj-media-static-assets.oss-cn-beijing.aliyuncs.com/...` 验证域名映射已生效
5. **S3 兼容性冒烟**（在 dev 分支把 S3_* 指向 OSS 测试桶跑一遍）：
   - `S3Service` 全部 API：PutObject / GetObject / DeleteObject / CopyObject / HeadBucket / HeadObject / ListObjectsV2 / 预签名 GET / 预签名 PUT
   - 重点验证：AWS SDK v3 校验和配置（§5.1）生效后 PutObject 不报错；`S3_REGION=oss-cn-beijing` 的 SigV4 签名被 OSS 接受（若报 region 不匹配错误，按错误信息调整取值并回写本文档 §3.2）；浏览器用预签名 PUT 直传聊天附件成功（CORS 生效）
   - 预期不兼容但无害：`CreateBucket`/`PutBucketPolicy`（`ensureBucket` 仅 warn 不阻塞，且生产 NODE_ENV 下不会调 PutBucketPolicy）

---

## 5. 实施步骤

### 5.1 代码改动（P0，先合入主干）

`apps/api/src/storage/s3.service.ts` 的 S3Client 初始化增加两项（AWS SDK JS v3 自 3.729 起默认 `WHEN_SUPPORTED`，会带 `x-amz-checksum-crc32` 头，OSS 不认）：

```typescript
this.client = new S3Client({
  // ...现有配置不变
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

MinIO（dev）与 OSS（prod）均兼容此设置，可先行发布，与切换解耦。

### 5.2 存量数据全量同步（MinIO → OSS，线上继续正常服务）

> 吸取 2026-07 迁移教训：**严禁**从本机经 `https://static.tzjii.com` 公网反代批量搬运（nginx 反代 + SigV4 会把吞吐压到 <1MB/s）。本次全程在 **ECS 上走 OSS 内网端点**，免流量费且不占 3Mbps 公网带宽。

在 ECS（`ssh tzj-prod-root`，仅从私网 172.23.76.208 / 公网 REDACTED-IP 操作）上：

```bash
# 先加载生产 env（MINIO_ROOT_* 定义于此），OSS_AK/OSS_SK 为 RAM 用户凭证，另行 export
set -a; source /opt/tzj/.env.prod; set +a

# 0) 摸底数据量（决定用哪条路线；系统盘仅 40G，路线 B 需确认剩余空间）
docker run --rm --network tzj_default --entrypoint /bin/sh minio/mc -c \
  "mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc du local/tzj-uploads-prod"

# 路线 A（首选）：mc 双端直连，MinIO 内网 → OSS 内网（先小批量试跑一个子目录验证兼容性）
# 双写两份：① 根路径副本（未来的正式 key）② 带 tzj-uploads-prod/ 前缀的过渡副本
# 前缀副本的作用：DNS 切到 OSS 后，DB 尚未订正 / 页面缓存中的旧 URL
# （https://static.tzjii.com/tzj-uploads-prod/{key}）仍能在 OSS 上命中，消除 404 空窗
docker run --rm --network tzj_default --entrypoint /bin/sh minio/mc -c "
  mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD &&
  mc alias set oss https://oss-cn-beijing-internal.aliyuncs.com $OSS_AK $OSS_SK &&
  mc mirror --overwrite local/tzj-uploads-prod oss/tzj-media-static-assets &&
  mc mirror --overwrite local/tzj-uploads-prod oss/tzj-media-static-assets/tzj-uploads-prod"

# 路线 B（兜底，若 mc 对 OSS 数据面也报签名/兼容错误）：先导出到磁盘，再 ossutil 内网上传（同样双写）
mc cp --recursive local/tzj-uploads-prod /opt/tzj/oss-export/
ossutil cp -r -u /opt/tzj/oss-export/ oss://tzj-media-static-assets/ \
  -e oss-cn-beijing-internal.aliyuncs.com -i $OSS_AK -k $OSS_SK
ossutil cp -r -u /opt/tzj/oss-export/ oss://tzj-media-static-assets/tzj-uploads-prod/ \
  -e oss-cn-beijing-internal.aliyuncs.com -i $OSS_AK -k $OSS_SK
```

`mc mirror --overwrite` 幂等可重跑；同步期间线上新增上传会漏，切换窗口内做**增量补跑**（§5.5 第 2 步）。

**核对**：两端对象数与总大小一致（`mc du` 对比）；抽查若干对象 `curl -I` OSS 侧 200 且 content-length 一致。

### 5.3 数据库备份（订正前的回滚点）

```bash
docker exec tzj-postgres-1 pg_dump -U tzj -d tzj_prod -Fc \
  > /opt/tzj/backups/tzj_prod-pre-oss-$(date +%Y%m%d%H%M).dump
```

### 5.4 URL 数据订正脚本（先写好、评审、在本地库演练）

新增 `apps/api/prisma/scripts/rewrite-media-domain.ts`（或纯 SQL），逻辑：

```sql
-- 以案例表为例，其余表同构；实际以 schema.prisma 全量核对生成
UPDATE "Case" SET
  "coverImage"  = replace("coverImage",  :old, :new),
  "images"      = ARRAY(SELECT replace(x, :old, :new) FROM unnest("images") AS x),
  "summary"     = replace("summary", :old, :new),
  "description" = replace("description", :old, :new)
WHERE "coverImage" LIKE :old || '%'
   OR :old || '/' = ANY(SELECT left(x, length(:old)+1) FROM unnest("images") x)
   OR "summary" LIKE '%' || :old || '%'
   OR "description" LIKE '%' || :old || '%';
```

- `:old = 'https://static.tzjii.com/tzj-uploads-prod'`，`:new = 'https://static.tzjii.com'`（参数化，脚本必须支持**反向执行**用于回滚）
- 覆盖 §3.3 全部表/字段（含 `MediaAsset.url`、内部文档及其修订版、`Setting.value` 等 Json 列）；执行前跑兜底扫描 SQL 确认无遗漏——⚠️ 扫描必须同时覆盖两类列：information_schema 枚举的 text/varchar 列（直接 LIKE）**和 json/jsonb 列（`col::text LIKE`）**，只扫文本列会漏掉 `Setting.value`
- 先在本地 tzj_dev 副本演练：执行 → 抽查富文本渲染 → 反向执行 → diff 归零

### 5.5 切换窗口（预计 30 分钟内，媒体读取短暂回源旧站不中断）

按序执行，每步有验证点：

1. **发布 P0 代码**（§5.1，若尚未上线）——正常 CI 流程
2. **增量补同步**：重跑 §5.2 的两条 `mc mirror --overwrite`（根路径 + 前缀副本均补，分钟级）
3. **DNS 切换**：`static.tzjii.com` A 记录 → CNAME 到 OSS 自定义域名（提前把 TTL 降到 60s）。切换后无 404 空窗：DNS 未刷新的用户打到 nginx→MinIO（在线且数据全）；已刷新的用户打到 OSS，旧前缀 URL 由 §5.2 的 `tzj-uploads-prod/` 过渡副本兜住
4. **验证 OSS 直出**：`dig static.tzjii.com` 确认 CNAME 生效后，新旧两种路径各抽查——`curl -I https://static.tzjii.com/{key}` 与 `curl -I https://static.tzjii.com/tzj-uploads-prod/{key}` 均返回 200 且 `Server: AliyunOSS`
5. **执行 DB 订正**（§5.4 正向）——新旧 URL 此刻在 MinIO / OSS 两侧均可命中，订正本身无时间压力
6. **更新 `.env.prod`**（§3.2 全部 S3_* 项）→ `bash deploy.sh api`（仅重启 api，读取新 endpoint）
7. **更新 GitHub Vars** `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` → 触发 deploy workflow **重建 web/admin 镜像**并部署（NEXT_PUBLIC 值是构建期烘入的）。步骤 6→7 之间 web/admin 仍烘着旧域名值（admin 水印 URL 拼接会短暂用旧前缀），同样由过渡副本兜住
8. **刷新 web 数据缓存**：web 的 fetch 缓存 `revalidate` 为 60~300s（`api.ts` / `site-settings.ts`），DB 订正后页面短时间内仍会吐旧 URL；第 7 步重建部署 web 镜像天然清空缓存，若跳过第 7 步单测订正，需重启 web 容器（`compose up -d --no-deps web`）或等缓存过期。营销弹窗为浏览器直连 API 取数（`/trade-shows/marketing/active`，不经 Next fetch 缓存），订正后立即生效，无需额外处理
9. **全链路验证**（验收清单见 §8）

### 5.6 观察期与收尾（切换后 7 天）

观察期内 MinIO 容器与 `miniodata` 卷**原样保留**（回滚保底），期间：

- 每日核对 admin 上传/删除/水印、C 端图片、聊天附件直传正常
- 监控 nginx access log 中 `STATIC_DOMAIN` 剩余流量归零（DNS 缓存耗尽）

收尾（确认稳定后）：

1. compose 删 `minio` 服务、api 的 `depends_on: minio`、`miniodata` 卷声明、gateway environment 的 `STATIC_DOMAIN`；nginx 模板删 `STATIC_DOMAIN` 的 443 server 块（模板中仅此一处引用）；`.env.prod` 删 `MINIO_ROOT_*` 与 `STATIC_DOMAIN`；`infra/docker/Makefile` 的 `up -d --no-deps postgres minio acme gateway` 目标去掉 `minio`（否则目标直接报错）
2. `miniodata` 卷先 `docker run --rm -v tzj_miniodata:/data alpine tar czf` 归档一份到 OSS `_backup/` 前缀，再删除卷（**删除动作需用户当次确认**）
3. 删除 OSS 内的过渡副本 `tzj-uploads-prod/` 前缀（先确认 nginx `STATIC_DOMAIN` 流量归零、且 OSS 访问日志中该前缀无近 7 天请求；**删除动作需用户当次确认**）
4. 同步文档与示例：`docs/deployment-plan.md` §4 与 S3 环境变量段、AGENTS.md「对象存储规范」生产行、`.env.example` 注释、`infra/docker/.env.prod.example`（删 `STATIC_DOMAIN` / `MINIO_ROOT_*`，S3 段换 OSS 示例值）
5. acme 无需处理：现有证书为泛域名 `tzjii.com + *.tzjii.com`（`infra/docker/acme/issue.sh`），继续服务 web/admin/api，没有独立的 static 条目可移除；`static.tzjii.com` 的 HTTPS 改由 OSS 侧证书承担（§4.4）

---

## 6. 回滚方案

| 阶段 | 回滚动作 | 耗时 |
|------|---------|------|
| DNS 已切、DB 未订正 | DNS 改回 A 记录即可（TTL 60s） | 分钟级 |
| DB 已订正、env 已切 | ① DNS 改回 A 记录；② §5.4 脚本反向执行；③ `.env.prod` 恢复旧 S3_* + `deploy.sh api`；④ GitHub Vars 恢复 + 重建前端镜像 | <1 小时 |
| 观察期后（MinIO 已删） | 不可快速回滚（需从归档恢复 MinIO），故收尾动作必须等满观察期 | — |

切换窗口内 MinIO 持续在线、数据只增不删，任意时点回滚均无数据丢失；窗口期间新上传到 OSS 的对象需 `mc mirror oss→local` 反向补一次。

---

## 7. 风险与对策

| 风险 | 等级 | 对策 |
|------|------|------|
| AWS SDK v3 默认校验和导致 OSS 请求失败 | 高（必现） | §5.1 P0 代码改动，dev 冒烟先行验证 |
| mc 对 OSS 的兼容性 | 中 | 桶管控 API（policy/CORS）**确定不兼容**，一律走 ossutil/控制台（§4.3）；数据面 `mc mirror` 先小批量试跑，失败则路线 B（磁盘中转 + ossutil）兜底；应用层用 AWS SDK 数据面 API 不受影响 |
| 富文本 URL 订正遗漏字段 | 中 | 全库文本列扫描 SQL 兜底 + 本地演练 + 观察期内 404 监控（浏览器控制台/埋点） |
| `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` 只改 Vars 忘了重建镜像 | 中 | §5.5 第 7 步显式列为独立步骤；验收清单含前端直传/展示用例 |
| 预签名 PUT 直传 CORS 不生效 | 中 | 前置准备阶段用测试桶真实浏览器验证；`ExposeHeader` 已含 ETag |
| OSS 自定义域名证书过期无人续 | 低 | 用 OSS 免费证书（自动续期），不复用 acme.sh 手动链路 |
| 公网 GET 流量费超预期 | 低 | §9 估算；如后续放量，加 CDN（CNAME 再指 CDN 即可，URL 不变） |
| ensureBucket 在 OSS 上 CreateBucket 失败刷 warn 日志 | 低 | 仅日志噪音；如碍眼，后续给 `ensureBucket` 加 `S3_SKIP_ENSURE_BUCKET` 开关（非本次必须） |
| 切换窗口撞上百度 SEM 投放期 | 低 | OCPC 回传、百度统计、站长校验、落地页均走 `www.tzjii.com`（nginx `WEB_DOMAIN` 块），与 `static.tzjii.com` 切换正交；投放素材若直链 static 图片，由 §5.2 过渡副本兜住 |

---

## 8. 验收清单（切换窗口第 9 步执行）

- [ ] C 端（www.tzjii.com）：首页/案例/新闻详情图片全部正常，`next/image` 无 400/403（remotePatterns 命中 `**.tzjii.com`）
- [ ] web 数据缓存已刷新（镜像重建部署 / 重启 web 容器），页面源码中媒体 URL 已无 `/tzj-uploads-prod` 前缀
- [ ] C 端富文本内嵌图正常（订正生效的直接证据）
- [ ] Admin：媒体上传（≤10MB）成功且返回 URL 为 `https://static.tzjii.com/...`；删除成功
- [ ] Admin 媒体库列表缩略图全部正常（`MediaAsset.url` 订正生效的直接证据）；内部文档富文本内嵌图正常
- [ ] Admin：水印处理正常（`downloadBuffer` 走 OSS 读取）
- [ ] 聊天附件：浏览器预签名 PUT 直传成功（URL host 为 `*.oss-cn-beijing.aliyuncs.com`），发送后可预览
- [ ] 营销弹窗（如有进行中活动）：C 端任意页面弹出正常，头图与正文内嵌图加载正常（客户端直连 API，订正即生效）
- [ ] 站点 favicon 正常（`statics/favicon.ico` 经 S3 上传，admin 站点设置重传一次验证写路径）
- [ ] `GET /api/v1/health` 存储探针（HeadBucket）通过
- [ ] `curl -I https://static.tzjii.com/{key}` 与 `.../tzj-uploads-prod/{key}`：均 200、`Server: AliyunOSS`、正确 Content-Type
- [ ] 抽查百度/谷歌已收录的图片 URL（如有直链收录）可访问
- [ ] ECS `docker stats`：api 正常，minio 容器仍在但无新流量

---

## 9. 成本估算（华北2 标准存储，按量）

以当前数据规模（数 GB 级媒体，B2B 小站流量）估：

| 项 | 单价（约） | 月估 |
|----|-----------|------|
| 存储（<20GB） | 0.12 元/GB/月 | <3 元 |
| 公网流出（图片 GET，<30GB/月） | 0.50 元/GB | <15 元 |
| 请求费 | 0.01 元/万次 | 忽略 |
| **合计** | | **≈20 元/月** |

对价换回：ECS 释放 512m 内存 + 数十 GB 磁盘空间 + 3Mbps 带宽不再被媒体挤占（C 端首屏图片加载不再受限），以及 MinIO 版本/备份运维归零。

---

## 10. 后续可选优化（不在本次范围）

- **CDN**：`static.tzjii.com` CNAME 改指 CDN 加速域名，回源 OSS，进一步降流量单价并提升海外访问
- **`x-oss-process` 服务端图片处理**：动态缩略图/格式转换/动态水印（此前评估 MinIO 不具备的能力缺口）
- **OSS 生命周期规则**：`chat/{YYYYMM}/` 前缀按月过期清理（`buildChatKey` 的目录设计本就为此预留）
- **本地 dev 存储**：继续使用 MinIO，不做更换（RustFS 方案已废弃，见 `docs/minio-to-rustfs-migration-plan.md` 头部声明）
