# 生产 MinIO → 阿里云 OSS 迁移方案

> 状态：方案评审稿（未实施）
> 日期：2026-07-31
> 复评：2026-07-31 —— 针对新增功能（营销弹窗、百度 OCPC 回传/百度统计/站长校验、灵犀、广告花费台账）重新评估：**总体结论与步骤不变**，增量影响已并入 §3.3 / §5.5 / §7 / §8 对应条目。
> 复评：2026-08-04 —— 目标桶改在**正式账号 account-b**（1336****）下新建 `tzj-prod-media`；原预置桶名 `tzj-media-static-assets`（default 主账号 1646**** 名下）已被**已彻底下线的老站 tzj.jiawen.live 存档占用**（2026-07-05 创建），旧桶弃用不动（§2.1 / §4.1）；SDK 已锁 `^3.1075.0`，§5.1 P0 改动必要性确认（2026-08-05 已实现待发布）；建议待旧站图片迁移（web-legacy-images-migration-plan，2026-08-03，P0–P2 本地完成）生产部署验收后再启动本迁移。
> 复评：2026-08-05 —— 依据仓库代码与 AWS SDK v3.1075.0 / OSS S3 兼容性核验补充：mc alias 显式 S3v4（§5.2）、ECS 同地域与内网端点连通性检查（§5.2）、反向订正防双前缀（§5.4）、归档需异地副本（§5.6）、API 公网 GET 成本行（§9）、预签名 URL 的 remotePatterns 备忘（§3.1 / §8）；**§5.1 P0 代码与 §5.4 订正脚本已实现，本地 lint/typecheck/演练通过（302 行，正向/反向归零）**。
> 执行进度：2026-08-05 —— 前置准备完成（§4.1/4.2/4.3/4.4/4.5 SDK+CORS 预检；`tzj-prod-media-staging` 测试桶已完成使命，2026-08-05 确认空桶后删除）；**§5.2 存量全量同步完成**（路线 B：mc 导出 1225 对象/617.48 MiB → ossutil 双写根路径与 `tzj-uploads-prod/` 过渡前缀，均 1225 对象，`ossutil du` 2540 对象 = 2×1270）；**§5.3 DB 备份完成**（`/opt/tzj/backups/tzj_prod-pre-oss-202608051154.dump`）；**§5.4 生产 dry-run 完成：302 行，白名单外无命中**（与本地演练一致）。剩余：§4.5 真实浏览器预签名 PUT 用例、§5.5 切换窗口（需确认后执行）。**尚未进入切换窗口。**
> 切换执行：2026-08-05 —— **§5.5 切换窗口已完成**：增量补同步（无新增对象）→ DNS `static.tzjii.com` A→CNAME（TTL 600；免费版 DNS 不允许 60，报 `QuotaExceeded.TTL`）→ DB 订正 `--apply`（302 行）→ `.env.prod` S3_* 全部切换（备份 `.env.prod.bak-20260805-preoss`）→ `deploy.sh api 47fca6e…`（健康，storage up）→ 窗口末补同步 → GitHub Var `NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://static.tzjii.com` → workflow dispatch 重建部署 web/admin/api（run 30974016086 success）。验证：DNS 解析到 OSS；新旧路径 HTTPS 均 200 `Server: AliyunOSS`；favicon / `x-oss-process` URL 200；www 首页/案例/新闻页旧前缀 0；admin login 200；`/api/v1/health` storage up；CORS 预检（www/admin origins）200；DB 正向 dry-run 0 行。**进入 7 天观察期（§5.6），MinIO 与 `STATIC_DOMAIN` 暂不清理**；待人工验收项见 §8（admin 上传/删除/水印、聊天附件真实浏览器直传、营销弹窗）。
> 收尾执行：2026-08-05 —— **观察期提前结束（用户确认稳定，明确指示不做备份）**：生产 MinIO 已彻底移除——容器 `tzj-minio-1`、卷 `tzj_miniodata`、镜像 `minio/minio` / `minio/mc`、导出目录 `/opt/tzj/oss-export`、`.env.prod` 的 `MINIO_ROOT_*`/`STATIC_DOMAIN`、compose 的 minio 服务与 gateway/acme `STATIC_DOMAIN`、api `depends_on: minio`、Makefile `infra-up`、nginx `STATIC_DOMAIN` 443 反代块全部删除。OSS 旧前缀 `tzj-uploads-prod/` 曾两度删除/恢复，最终由 **CDN 302 重定向**替代（见 §11.5），生产桶当前仅根路径 1270 对象 / 617.5 MiB。清理改动已提交仓库（含 `infra/docker/minio/cors.xml` 删除与 `apply-cors.sh` 去 mc 分支），确保后续部署不再带回 MinIO 配置。
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

代码侧已为切换做过铺垫：`.env.example` 注明"线上: 阿里云 OSS (零代码切换)"，`s3.service.ts` 注释了 Virtual Hosted Style，`infra/docker/oss/` 已预置 CORS 脚本（bucket 默认名已改为 `tzj-prod-media`、endpoint `oss-cn-beijing`；原预置名 `tzj-media-static-assets` 被旧站存档占用，见 §2.1）。

---

## 2. 目标架构

```
浏览器 ──GET──▶ https://static.tzjii.com （CNAME → OSS 自定义域名，绑定 bucket）
浏览器 ──预签名 PUT 直传──▶ https://tzj-prod-media.oss-cn-beijing.aliyuncs.com
api 容器 ──S3 API──▶ https://oss-cn-beijing.aliyuncs.com （公网端点，virtual-hosted）
迁移脚本（ECS 上）──▶ oss-cn-beijing-internal.aliyuncs.com （内网端点，免流量费、不占 3Mbps）
```

### 2.1 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Bucket | **正式账号（account-b / 1336****）下新建** `tzj-prod-media`，华北2（北京），与 ECS 同地域 | 原预置名 `tzj-media-static-assets` **不可复用**：该桶 2026-07-05 创建于 default 主账号（1646****）名下，内存已彻底下线的老站 tzj.jiawen.live 存档（cases/content/images/… 前缀与新生产同构，直接 mirror 会同名覆盖/残留垃圾）；老站已下线，旧桶弃用不动。新桶名需全局唯一 |
| 读路径域名 | 沿用 `static.tzjii.com`，DNS 从 A 记录改 CNAME 到 OSS 自定义域名 | 域名不变 → `next.config.ts` 的 `**.tzjii.com` remotePatterns 无需改；tzjii.com 已备案，满足 OSS 绑定自定义域名的要求 |
| `S3_ENDPOINT` | **公网端点** `https://oss-cn-beijing.aliyuncs.com` | 预签名 URL 的 host 来自 endpoint——若用内网端点，签出的直传/临时 URL 浏览器不可达。API 侧上传单文件 ≤10MB、频次低，走公网可接受（OSS 上行入流量免费，仅耗 ECS 出带宽） |
| URL 风格 | Virtual Hosted（`S3_FORCE_PATH_STYLE=false`） | OSS 不支持 path-style；`s3.service.ts` 的判定逻辑对 `oss-cn-beijing.aliyuncs.com` 端点天然得出 false，无需改代码 |
| 存量 URL | **数据订正**：DB 内 URL 前缀整体替换 | 自定义域名映射到 bucket 根，路径中不再有 `/tzj-uploads-prod` bucket 段，旧 URL `https://static.tzjii.com/tzj-uploads-prod/{key}` 必须改写为 `https://static.tzjii.com/{key}`（见 §5.4） |
| 权限 | **account-b（正式账号）**下新建专用 RAM 用户 + 仅限该 bucket 的自定义策略，AK/SK 写入 `.env.prod` | 最小权限；不用主账号 AK；account-b 现有 OAuth 登录态不可用于服务器端脚本 |
| 公开读 | Bucket ACL 设公开读（public-read），CORS 用现成脚本 | 与现状一致（MinIO 桶即公开读）；`s3.service.ts` 生产环境本就不在应用内设桶策略 |
| 本地 dev | 不动，继续 MinIO | dev/prod 通过环境变量切换，这正是当初统一走 S3 协议的目的 |

---

## 3. 影响面清单

### 3.1 代码改动（很少，见 §5.1）

| 文件 | 改动 | 级别 |
|------|------|------|
| `apps/api/src/storage/s3.service.ts` | S3Client 增加 `requestChecksumCalculation` / `responseChecksumValidation: 'WHEN_REQUIRED'` | **P0**（AWS SDK v3 ≥3.729 默认强制 CRC32 校验头，对 OSS 等第三方 S3 服务会报 `InvalidArgument`/签名错，必须显式关闭；对 MinIO 向下兼容无影响） |
| `infra/docker/docker-compose.prod.yml` | 观察期后：删 `minio` 服务、`miniodata` 卷、api 的 `depends_on: minio` | P1（分两步，见 §6） |
| `infra/docker/nginx/templates/tzj.conf.template` | 观察期后：删 `STATIC_DOMAIN` 的 443 server 块（模板中仅此一处引用；80 块为 `default_server` 统一 301 跳转，不含 STATIC_DOMAIN，无需改动） | P1 |
| 其余（storage.controller、seed 脚本、media-url.ts、`apps/admin/src/features/site-media.ts` 水印设置） | **零改动**——全部经 `S3_PUBLIC_DOMAIN`/`NEXT_PUBLIC_S3_PUBLIC_DOMAIN` 取值（已逐文件核对：`site-media.ts` 的 `watermarkImageKeyFromUrl` 对切换后无 bucket 段 URL 直接命中 `uploads|cms` 前缀） | — |

额外说明（已逐分支推演验证）：web/admin 的 `media-url.ts` 对新 URL（无 bucket 段）行为安全，且 `KNOWN_BUCKET_NAMES` 含 `'tzj-uploads-prod'`，会把漏订正/缓存中的旧前缀 URL 自动折叠规范成新 URL，是 DB 订正之外的自愈保险（富文本内嵌 URL 不经过它，订正仍必需）。**迁移后不得从 `KNOWN_BUCKET_NAMES` 删除 `'tzj-uploads-prod'`**。

remotePatterns 备忘：切换后 `next.config.ts` 的 `images.remotePatterns` 由 `**.tzjii.com` 覆盖公开媒体域名，无需改；聊天附件预签名 URL（host 为 `*.oss-cn-beijing.aliyuncs.com`）当前由原生 `<img>`（react-photo-view）加载，不经过 `next/image`，同样无需改——若未来改用 `next/image` 直载预签名 URL，需补该域（见 §8 验收备忘）。

### 3.2 配置改动

| 位置 | 项 | 旧值 → 新值 |
|------|-----|------------|
| ECS `.env.prod` | `S3_BUCKET` | `tzj-uploads-prod` → `tzj-prod-media` |
| | `S3_REGION` | `us-east-1` → `oss-cn-beijing` |
| | `S3_ENDPOINT` | `https://static.tzjii.com` → `https://oss-cn-beijing.aliyuncs.com` |
| | `S3_ACCESS_KEY_ID/SECRET` | MinIO 应用级 AK → account-b 下 RAM 用户 AK/SK（见 §4.2） |
| | `S3_PUBLIC_DOMAIN` | `https://static.tzjii.com/tzj-uploads-prod` → `https://static.tzjii.com` |
| | `S3_FORCE_PATH_STYLE` | `true` → `false` |
| | `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` | 同 `S3_PUBLIC_DOMAIN` |
| | `MINIO_ROOT_USER/PASSWORD` | 观察期后删除 |
| GitHub Vars | `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` | `https://static.tzjii.com`（⚠️ 构建期烘入 web/admin 镜像，改完必须**重新构建镜像**才生效，不是改 env 重启就行）——✅ 2026-08-05 已更新并随 deploy workflow 重建部署 |
| 阿里云 DNS | `static.tzjii.com` | A `REDACTED-IP` → CNAME `tzj-prod-media.oss-cn-beijing.aliyuncs.com` |

### 3.3 数据订正范围（DB 存量 URL）

前缀替换 `https://static.tzjii.com/tzj-uploads-prod` → `https://static.tzjii.com`，涉及（已对照 schema.prisma 全部 32 个 model 核对）：

- 各内容表的 `coverImage`（String）、`images`（String[]）：案例 / 新闻 / 文章 / 活动展会 / 页面
- 富文本字段内嵌 URL：`summary` / `description` / `content` / `excerpt`（seed 的 `patchContentImageUrls` 佐证富文本确实内嵌图片 URL）
- **营销弹窗（TradeShow 扩展字段，2026-07-31 新增）**：新增专用列 `popupImage`（弹窗头图 URL，留空回退 `coverImage`）与 `popupContent`（Markdown 文案，可内嵌图片 URL，留空回退 `content`），**两列均须纳入订正**；`ctaText`/`triggerMode` 等为非 URL 配置；`ctaUrl` 已废弃仅保留列，仍随 TradeShow 一并订正。注意弹窗挂全站 layout，进行中活动的头图若 404 将全站可见，订正后须重点验证（见 §8）
- **`MediaAsset.url`**：媒体库表存完整公开 URL（`key` 字段不含域名，无需动）。有 API 层兜底：`media.service.ts` 的 `toEnvUrl()` 出口统一按 `S3_PUBLIC_DOMAIN + key` 重建 url，即使订正遗漏，admin 媒体库列表也不会 404；订正仍执行以保证数据一致性（防未来移除 `toEnvUrl` / 第三方直读 DB）
- **`ChatMessage.content`**（2026-08-04 本地 tzj_dev 全库扫描实测 4 行命中）：聊天图片以 Markdown `![…](URL)` 内嵌在消息正文（`cms/` 前缀），**必须订正**，否则过渡副本删除后聊天历史图片永久 404
- **内部文档**：`InternalDocument.content` + `InternalDocumentRevision.content`（vditor 富文本，内嵌上传图片）
- **`Setting.value`（Json）**等 json/jsonb 列：可能存站点配置类媒体 URL，订正与兜底扫描均须覆盖 Json 列（见 §5.4）——含 `Integration.config`（现存百度 OCPC 等配置经核实仅含 `www.tzjii.com`，无 static 前缀 URL，但扫描仍须覆盖以防后续集成写入）
- `User.avatar`、`TradeShow.ctaUrl` / `externalUrl`（可能填了站内静态资源链接）
- ✅ **无需订正**：`ChatAttachment` / `ChatPendingUpload` 只存对象 key 不存 URL（读取时由 `S3_PUBLIC_DOMAIN` 拼接，切换后自动生效；`ChatMessage.content` 内嵌图片 URL 例外，见上）
- 可不订正（历史快照性质，不影响功能）：`AuditLog.detail`、`Visitor.traits`、Lingxi 会话消息；`AdSpendRecord` 为纯数值台账，无 URL 字段
- 其他未预见字段：执行前用全库扫描 SQL 兜底核查（见 §5.4）

---

## 4. 前置准备（不影响线上，可提前任意时间做）

1. **开通 OSS 并建 bucket**（§4.1）（在**正式账号 account-b**（RAM 用户 `z****e`，账号 1336****）下，aliyun CLI 或控制台）：
   - **新建** `tzj-prod-media`：华北2（北京）、标准存储、**公开读**、**开启版本控制**（防误删/误覆盖，成本极低；若关闭则仅靠 §5.6 归档兜底）——✅ 2026-08-05 已创建并开启版本控制（`ossutil mb --acl public-read` + `api put-bucket-versioning`）
   - ⚠️ **新桶默认 Bucket 级 Block Public Access = true**：即使 ACL 为 public-read，匿名 GET 仍会 403；已对 `tzj-prod-media` 执行 `ossutil api delete-bucket-public-access-block` 关闭（账户级默认为 false，无需处理）。staging 桶保持 private 无需处理
   - 服务端加密：可不开（媒体本为公开资源）
   - ⚠️ default 主账号（1646****）下的旧桶 `tzj-media-static-assets` / `media-static-assets` 为已下线老站遗留，**弃用不动**
2. **RAM 用户**（§4.2）：account-b 已是 RAM 用户（`z****e`），但其凭证为 OAuth 登录态，不能用于服务器端脚本——✅ 2026-08-05 已确认 z****e 已有 2 个可用 AccessKey，**决定复用** 2026-07-29 创建的 `LTAI5t****`（已存于 ECS `/opt/tzj/.env.prod.local` 的 `ALI_KEY/ALI_SECRET`，与部署凭据一致），不再新建密钥；若后续要收紧，可再建专用 RAM 用户 `tzj-oss-app`（仅编程访问，挂仅 `tzj-prod-media` 桶的 `oss:GetObject/PutObject/DeleteObject/ListObjects/HeadObject/CopyObject/GetBucketInfo` 自定义策略）
3. **CORS + 公开读**（§4.3）：⚠️ OSS 的 S3 兼容层**只覆盖数据面 API**（对象读写/预签名），`PutBucketPolicy` / `PutBucketCors` 等桶管控 API **不在 S3 兼容范围**——`apply-cors.sh` 主路径为 **ossutil v2 API 命令**（`api put-bucket-cors` / `api put-bucket-acl`，注意 v1 的 `ossutil cors --method put` / `set-acl` 在 v2 不存在；v2 需显式 `--region cn-beijing`）。公开读亦可控制台设 bucket ACL；put-bucket-cors 是**整体替换**语义，已有规则需先合并进 `cors.json`。mc 仅作数据面迁移工具。`cors.json` 已含 `localhost:3000/3001/3002` 与生产域 origin（与 `minio/cors.xml` 对齐），本地浏览器冒烟直传测试桶可直接用。✅ 2026-08-05 已对生产与 staging 桶执行并验证（get-bucket-cors 返回规则、生产 ACL public-read）
4. **自定义域名 + 证书**（§4.4）：
   - OSS 控制台为 bucket 绑定 `static.tzjii.com`（tzjii.com 已备案，可绑）——✅ 2026-08-05 已通过 API 完成：`create-cname-token` 取 token → Aliyun DNS 临时加 TXT `_dnsauth.static.tzjii.com` → `ossutil api put-cname`（`--cname-configuration file://...`，JSON 内联 `Certificate`/`PrivateKey`/`Force`）→ `list-cname` 显示 `Status: Enabled`；`curl --connect-to static.tzjii.com:443:tzj-prod-media.oss-cn-beijing.aliyuncs.com:443` 实测对象 200。所有权 TXT 已删除
   - 证书托管：已把现有 acme.sh 泛域名证书（`tzjii.com + *.tzjii.com`，覆盖 static）随 put-cname 上传，OSS 自动托管为 CAS 证书（CertId `26451242-cn-hangzhou`）。**该证书 2026-10-27 到期**：正式方案仍是 OSS 控制台一键申请的免费 DV 证书（可自动续期）；ECS 上的 acme 容器只续本机证书，不会同步到 OSS，**到期前必须完成免费证书切换**
   - 绑定后未切 DNS：`dig static.tzjii.com` 仍为 A 记录指向 ECS；正式切换在 §5.5 第 3 步
5. **S3 兼容性冒烟**（§4.5，在 dev 分支把 S3_* 指向 OSS 测试桶跑一遍；测试桶在 account-b 下新建，如 `tzj-prod-media-staging`）：
   - `S3Service` 全部 API：PutObject / GetObject / DeleteObject / CopyObject / HeadBucket / HeadObject / ListObjectsV2 / 预签名 GET / 预签名 PUT
   - 重点验证：AWS SDK v3 校验和配置（§5.1）生效后 PutObject 不报错；`S3_REGION=oss-cn-beijing` 的 SigV4 签名被 OSS 接受（若报 region 不匹配错误，按错误信息调整取值并回写本文档 §3.2）；浏览器用预签名 PUT 直传聊天附件成功（CORS 生效）
   - 预期不兼容但无害：`CreateBucket`/`PutBucketPolicy`（`ensureBucket` 仅 warn 不阻塞，且生产 NODE_ENV 下不会调 PutBucketPolicy）
   - ✅ 2026-08-05 已用 AWS SDK v3.1075.0（`requestChecksumCalculation/responseChecksumValidation: WHEN_REQUIRED`，与 §5.1 生产代码一致）对 `tzj-prod-media-staging`（公网 endpoint `https://oss-cn-beijing.aliyuncs.com`）跑通：HeadBucket / PutObject / GetObject / HeadObject / ListObjectsV2 / CopyObject / 预签名 GET / 预签名 PUT / DeleteObject；CORS 预检（OPTIONS + Origin）200；生产桶公开 GET 200。待补：真实浏览器预签名 PUT 直传（dev 前端）；**测试桶已验证为空并删除（2026-08-05）**

---

## 5. 实施步骤

### 5.1 代码改动（P0，先合入主干）

`apps/api/src/storage/s3.service.ts` 的 S3Client 初始化增加两项（AWS SDK JS v3 自 3.729 起默认 `WHEN_SUPPORTED`，会带 `x-amz-checksum-crc32` 头，OSS 不认）；**顺带更新文件头过时注释**（第 4~7 行仍写「线上: MinIO 经 nginx 反代」）：

```typescript
this.client = new S3Client({
  // ...现有配置不变
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

MinIO（dev）与 OSS（prod）均兼容此设置，可先行发布，与切换解耦。

✅ 2026-08-05 已实现（`requestChecksumCalculation` / `responseChecksumValidation` 均已加入 S3Client 初始化，文件头注释同步更新；`pnpm --filter @tzj/api lint` 无新增告警、`typecheck` 通过），并已随生产镜像 `47fca6e` 上线（容器健康）；生产 `.env` 切换仍按 §5.5 执行。

### 5.2 存量数据全量同步（MinIO → OSS，线上继续正常服务）

> 吸取 2026-07 迁移教训：**严禁**从本机经 `https://static.tzjii.com` 公网反代批量搬运（nginx 反代 + SigV4 会把吞吐压到 <1MB/s）。本次全程在 **ECS 上走 OSS 内网端点**，免流量费且不占 3Mbps 公网带宽。

在 ECS（`ssh tzj-prod-root`，仅从私网 172.23.76.208 / 公网 REDACTED-IP 操作；若本机未配置该 SSH 别名，改用 `ssh root@REDACTED-IP`）上：

```bash
# 先加载生产 env（MINIO_ROOT_* 定义于此），OSS_AK/OSS_SK 为 RAM 用户凭证，另行 export
set -a; source /opt/tzj/.env.prod; set +a

# 0) 前置连通性检查（一次性）：确认 ECS 与 OSS 同地域（华北2），内网端点解析为私网地址。
#    解析结果应为 100.x/10.x 等内网段；若解析到公网 IP，说明 ECS 不在华北2 VPC，internal 端点不可用，须先解决再迁移
getent hosts oss-cn-beijing-internal.aliyuncs.com || nslookup oss-cn-beijing-internal.aliyuncs.com
# curl 返回 403/404 即网络可达（未带 bucket 的正常响应）；000 或超时说明不可达
curl -sI -o /dev/null -w 'internal endpoint http_code=%{http_code}\n' https://oss-cn-beijing-internal.aliyuncs.com/

# 1) 摸底数据量（决定用哪条路线；系统盘仅 40G，路线 B 需确认剩余空间）
#    注：minio/mc 未锁 tag（latest），建议先拉固定版本再跑（与生产镜像「禁 latest」实践一致）
docker run --rm --network tzj_default --entrypoint /bin/sh minio/mc -c \
  "mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc du local/tzj-uploads-prod"

# 路线 A（首选）：mc 双端直连，MinIO 内网 → OSS 内网（先小批量试跑一个子目录验证兼容性）
# 双写两份：① 根路径副本（未来的正式 key）② 带 tzj-uploads-prod/ 前缀的过渡副本
# 前缀副本的作用：DNS 切到 OSS 后，DB 尚未订正 / 页面缓存中的旧 URL
# （https://static.tzjii.com/tzj-uploads-prod/{key}）仍能在 OSS 上命中，消除 404 空窗
docker run --rm --network tzj_default --entrypoint /bin/sh minio/mc -c "
  mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD &&
  mc alias set --api S3v4 oss https://oss-cn-beijing-internal.aliyuncs.com $OSS_AK $OSS_SK &&
  mc mirror --overwrite local/tzj-uploads-prod oss/tzj-prod-media &&
  mc mirror --overwrite local/tzj-uploads-prod oss/tzj-prod-media/tzj-uploads-prod"

# 若 mc 对 OSS 报 SignatureDoesNotMatch / region 相关错误：先确认 alias 的签名版本（--api S3v4），
# 再改用路线 B（ossutil 原生 S3 兼容 API，签名由 -e/-i/-k 显式指定）

# 路线 B（兜底，若 mc 对 OSS 数据面也报签名/兼容错误）：先导出到磁盘，再 ossutil 内网上传（同样双写）
#   前置：ECS 安装 ossutil v2（curl -L https://gosspublic.alicdn.com/ossutil/v2/install.sh | bash；
#         本机已有 aliyun CLI 但 ossutil 是独立工具，须单独安装；配置 AK/SK 用 -i/-k 参数即可；✅ ECS 已装 ossutil v2）
mc cp --recursive local/tzj-uploads-prod /opt/tzj/oss-export/
ossutil cp -r -u /opt/tzj/oss-export/ oss://tzj-prod-media/ \
  -e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing -i $OSS_AK -k $OSS_SK
ossutil cp -r -u /opt/tzj/oss-export/ oss://tzj-prod-media/tzj-uploads-prod/ \
  -e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing -i $OSS_AK -k $OSS_SK
```

`mc mirror --overwrite` 幂等可重跑；同步期间线上新增上传会漏，切换窗口内做**增量补跑**（§5.5 第 2 步）。

> ⚠️ 实测（2026-08-05）：**mc 对 OSS 数据面也不可用**——`mc mirror` 报 `The bucket you access does not belong to you`，`--path off` 后 `mc ls` 报 `Access Denied`（AK 有全权限，ossutil 同凭据正常）。**路线 B 已实际执行成功**：mc 导出到 `/opt/tzj/oss-export/`（1225 对象 / 617.48 MiB / 12s），ossutil v2 双写根路径与 `tzj-uploads-prod/` 前缀（各 1225 对象 / 12s）。导出目录保留待切换收尾后清理。

✅ 2026-08-05 校验：`ossutil du oss://tzj-prod-media` = 2540 对象 / 1,294,940,778 B（= 根 1270 + 前缀 1270，含 45 个目录对象）；`statics/bg_01.png` 经 `https://static.tzjii.com/...`（--connect-to OSS）与桶直连均 200 / `Server: AliyunOSS`。

**核对**：两端对象数与总大小一致（`mc du` 对比）；抽查若干对象 `curl -I` OSS 侧 200 且 content-length 一致。

### 5.3 数据库备份（订正前的回滚点）

```bash
docker exec tzj-postgres-1 pg_dump -U tzj -d tzj_prod -Fc \
  > /opt/tzj/backups/tzj_prod-pre-oss-$(date +%Y%m%d%H%M).dump
```

✅ 2026-08-05 已执行：`/opt/tzj/backups/tzj_prod-pre-oss-202608051154.dump`（373K）。

### 5.4 URL 数据订正脚本（已实现，本地演练通过）

已新增 `apps/api/prisma/scripts/rewrite-media-domain.ts`，package script：
`pnpm --filter @tzj/api prisma:rewrite-media-domain`。覆盖 §3.3 全部表/字段。

```bash
pnpm --filter @tzj/api prisma:rewrite-media-domain                      # dry-run 正向（事务内执行后回滚）
pnpm --filter @tzj/api prisma:rewrite-media-domain -- --apply            # 实际写库（正向）
pnpm --filter @tzj/api prisma:rewrite-media-domain -- --reverse          # dry-run 反向
pnpm --filter @tzj/api prisma:rewrite-media-domain -- --reverse --apply  # 实际写库（反向/回滚）
```

- 默认 `old=https://static.tzjii.com/tzj-uploads-prod`、`new=https://static.tzjii.com`；可用 `REWRITE_OLD_PREFIX` / `REWRITE_NEW_PREFIX` 覆盖（本地演练用同构的 localhost 前缀，SQL 语义与生产一致）
- 覆盖 cases/news/blogs/trade_shows（含 `popupImage`/`popupContent`/`externalUrl`/`ctaUrl`）/pages 的 coverImage·images[]·正文富文本、`users.avatar`、`media_assets.url`、`chat_messages.content`、`internal_documents`（summary/content）、`internal_document_revisions.content`、`settings.value`、`integrations.config`
- 全库兜底扫描：枚举 information_schema 的 text/varchar/json/jsonb 列，白名单外命中仅报告不订正（2026-08-04 实测命中列见 §3.3；生产执行前仍须重扫一次）
- 反向（回滚）用哨兵替换实现：先保护旧前缀、再把新前缀改回旧前缀，天然防双前缀（不依赖 LIKE 守卫），混合新旧前缀的富文本/JSON 也安全
- 默认 dry-run 在事务内真实执行 UPDATE 后回滚，输出逐表行数；`--apply` 写库
- ✅ 2026-08-05 本地 tzj_dev 演练通过：正向 302 行 → 抽查无旧前缀残留 → 反向 302 行 → 校验归零；jsonb 混合 URL 表达式单独验证通过
- ✅ 2026-08-05 生产 dry-run 通过（事务内执行后回滚）：**302 行**，命中 cases（description/coverImage/images ×49）、news（content×7 / coverImage/images ×26）、blogs（coverImage/images ×9）、pages.coverImage ×3、media_assets.url ×71、chat_messages.content ×4；**全库扫描白名单外无命中**，与本地演练一致

### 5.5 切换窗口（预计 30 分钟内，媒体读取短暂回源旧站不中断）

按序执行，每步有验证点：

1. **发布 P0 代码**（§5.1，若尚未上线）——正常 CI 流程
2. **增量补同步**：重跑 §5.2 的两条 `mc mirror --overwrite`（根路径 + 前缀副本均补，分钟级）
3. **DNS 切换**：`static.tzjii.com` A 记录 → CNAME 到 OSS 自定义域名（提前把 TTL 降到 60s）。切换后无 404 空窗：DNS 未刷新的用户打到 nginx→MinIO（在线且数据全）；已刷新的用户打到 OSS，旧前缀 URL 由 §5.2 的 `tzj-uploads-prod/` 过渡副本兜住
4. **验证 OSS 直出**：`dig static.tzjii.com` 确认 CNAME 生效后，新旧两种路径各抽查——`curl -I https://static.tzjii.com/{key}` 与 `curl -I https://static.tzjii.com/tzj-uploads-prod/{key}` 均返回 200 且 `Server: AliyunOSS`
5. **执行 DB 订正**（§5.4 正向）——新旧 URL 此刻在 MinIO / OSS 两侧均可命中，订正本身无时间压力
6. **更新 `.env.prod`**（§3.2 全部 S3_* 项）→ `bash deploy.sh api`（TAG 省略取 latest，即第 1 步刚发布的 P0 镜像；会顺带改写 `.env.prod.local` 的 `API_TAG`，如需保持 sha pin 显式传 `deploy.sh api <sha>`；流程内含 migrate deploy，无 schema 变更时 no-op）——此后新上传直写 OSS；**紧接着补跑一次 §5.2 的两条 `mc mirror --overwrite`**，把第 3~6 步之间写入 MinIO 的新对象同步进 OSS 过渡副本与根路径（该窗口内新上传不在切换前快照里，DNS 已切后旧前缀 URL 会短暂 404；窗口仅分钟级，建议窗口内暂停 admin 上传）
7. **更新 GitHub Vars** `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` → **手动 workflow_dispatch**（或 push main）触发 deploy workflow 重建 web/admin 镜像并部署——⚠️ **仅改 Vars 不会自动触发**，必须手动触发；dispatch 走 `./deploy.sh all <sha>` 全量部署（api 随之重建，与步骤 6 已切配置一致，无副作用）。NEXT_PUBLIC 值是构建期烘入的。步骤 6→7 之间 web/admin 仍烘着旧域名值（admin 水印 URL 拼接会短暂用旧前缀），同样由过渡副本兜住
8. **刷新 web 数据缓存**：web 的 fetch 缓存 `revalidate` 为 60~300s（`api.ts` / `site-settings.ts`），DB 订正后页面短时间内仍会吐旧 URL；第 7 步重建部署 web 镜像天然清空缓存，若跳过第 7 步单测订正，需重启 web 容器（`compose up -d --no-deps web`）或等缓存过期。营销弹窗为浏览器直连 API 取数（`/trade-shows/marketing/active`，不经 Next fetch 缓存），订正后立即生效，无需额外处理
9. **全链路验证**（验收清单见 §8）

### 5.6 观察期与收尾（切换后 7 天）

观察期内 MinIO 容器与 `miniodata` 卷**原样保留**（回滚保底），期间：

- 每日核对 admin 上传/删除/水印、C 端图片、聊天附件直传正常
- 监控 nginx access log 中 `STATIC_DOMAIN` 剩余流量归零（DNS 缓存耗尽）

每日观察期检查（只读，在 ECS 上执行）：

```bash
# 1) 容器与健康
docker ps --format "{{.Names}}\t{{.Status}}" | sort
curl -s https://api.tzjii.com/api/v1/health | python3 -m json.tool | grep -E '"(database|storage|email)"'

# 2) nginx STATIC_DOMAIN 剩余流量（期望趋近 0；DNS 缓存排空后应为 0）
docker logs tzj-gateway-1 --since 24h 2>&1 | grep -c static.tzjii.com || true

# 3) OSS 对象数/容量稳定（2540 对象 ≈ 1.29 GiB 基线）
set -a; source /opt/tzj/.env.prod.local; set +a
ossutil du oss://tzj-prod-media -e oss-cn-beijing-internal.aliyuncs.com \
  --region cn-beijing -i "$ALI_KEY" -k "$ALI_SECRET" | tail -6

# 4) DB 旧前缀残留抽查（期望 0）
docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -tAc \
  "SELECT count(*) FROM media_assets WHERE url LIKE '%/tzj-uploads-prod/%'"
docker exec tzj-postgres-1 psql -U tzj -d tzj_prod -tAc \
  "SELECT count(*) FROM chat_messages WHERE content LIKE '%/tzj-uploads-prod/%'"

# 5) 新旧路径双 200（任一 DNS 解析仍走 OSS）
curl -sI -o /dev/null -w 'new=%{http_code}\n' https://static.tzjii.com/statics/favicon.ico
curl -sI -o /dev/null -w 'old=%{http_code}\n' https://static.tzjii.com/tzj-uploads-prod/statics/favicon.ico
```

收尾（确认稳定后）：

1. compose 删 `minio` 服务、api 的 `depends_on: minio`、`miniodata` 卷声明、gateway 与 **acme environment 的 `STATIC_DOMAIN`**；nginx 模板删 `STATIC_DOMAIN` 的 443 server 块；`.env.prod` 删 `MINIO_ROOT_*` 与 `STATIC_DOMAIN`；Makefile `infra-up` 去掉 `minio` —— ✅ 2026-08-05 已执行并同步仓库
2. `miniodata` 卷归档 —— ⏭️ **按用户指示跳过（明确无需备份）**，卷已直接删除
3. 删除 `tzj-prod-media` 内过渡副本 `tzj-uploads-prod/` 前缀 —— ✅ 2026-08-05 曾执行（1270 对象），后恢复；最终由 CDN `host_redirect` 302 替代后**再次删除（1270 对象）**，旧 URL 经 CDN 跳转新地址，无需存储副本（见 §11.5）
4. 同步文档与示例 —— ✅ `infra/docker/.env.prod.example`（删 `STATIC_DOMAIN` / `MINIO_ROOT_*`，S3 段换 OSS 示例值）、`apply-cors.sh` 去 mc 分支、删除 `infra/docker/minio/cors.xml`；`docs/deployment-plan.md` 已不在仓库（此前清理）
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
| OSS 新桶默认 Bucket 级 Block Public Access=true，public-read 桶匿名 GET 仍 403 | 高（必现） | §4.1 已对生产桶执行 `delete-bucket-public-access-block` 并验证匿名 GET 200；新增桶先查 `get-bucket-public-access-block` |
| mc 对 OSS 的兼容性 | 中 | 桶管控 API（policy/CORS）**确定不兼容**，一律走 ossutil/控制台（§4.3）；数据面 `mc mirror` **实测也不可用**（ownership mismatch / Access Denied，§5.2 已改用路线 B 完成全量同步）；应用层用 AWS SDK 数据面 API 不受影响 |
| 富文本 URL 订正遗漏字段 | 中 | 全库文本列扫描 SQL 兜底（2026-08-04 实测 `chat_messages.content` 内嵌 Markdown 图片 URL）+ 本地演练 + 观察期内 404 监控（浏览器控制台/埋点） |
| 切换窗口内新上传 404（DNS 已切、api 未切，新对象只在 MinIO） | 低 | 窗口仅分钟级：api 切 endpoint 后立即补跑一次 mirror（§5.5 第 6 步）；窗口内暂停 admin 上传 |
| `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` 只改 Vars 忘了重建镜像 | 中 | §5.5 第 7 步显式列为独立步骤；验收清单含前端直传/展示用例 |
| 预签名 PUT 直传 CORS 不生效 | 中 | 前置准备阶段用测试桶真实浏览器验证；`ExposeHeader` 已含 ETag |
| OSS 自定义域名证书过期无人续 | 低 | 用 OSS 免费证书（自动续期），不复用 acme.sh 手动链路 |
| 公网 GET 流量费超预期 | 低 | §9 估算；如后续放量，加 CDN（CNAME 再指 CDN 即可，URL 不变） |
| ensureBucket 在 OSS 上 CreateBucket 失败刷 warn 日志 | 低 | 仅日志噪音；如碍眼，后续给 `ensureBucket` 加 `S3_SKIP_ENSURE_BUCKET` 开关（非本次必须） |
| 切换窗口撞上百度 SEM 投放期 | 低 | OCPC 回传、百度统计、站长校验、落地页均走 `www.tzjii.com`（nginx `WEB_DOMAIN` 块），与 `static.tzjii.com` 切换正交；投放素材若直链 static 图片，由 §5.2 过渡副本兜住 |

---

## 8. 验收清单（切换窗口第 9 步执行）

- [x] C 端（www.tzjii.com）：首页/案例/新闻页图片 URL 均为新前缀且实测 200（remotePatterns 命中 `**.tzjii.com`，无 400/403）
- [ ] 备忘：聊天附件预签名 URL（`*.oss-cn-beijing.aliyuncs.com`）由原生 `<img>` 加载，当前无需改 remotePatterns；若未来改用 `next/image` 直载，需在 `next.config.ts` 增加该域名
- [x] web 数据缓存已刷新（镜像重建部署），页面源码中媒体 URL 已无 `/tzj-uploads-prod` 前缀
- [x] C 端富文本内嵌图正常（案例页 `static.tzjii.com/content/…` 200，旧前缀计数 0）
- [ ] Admin：媒体上传（≤10MB）成功且返回 URL 为 `https://static.tzjii.com/...`；删除成功
- [ ] Admin 媒体库列表缩略图全部正常（`MediaAsset.url` 订正生效的直接证据）；内部文档富文本内嵌图正常
- [ ] Admin：水印处理正常（`downloadBuffer` 走 OSS 读取）
- [ ] 聊天附件：浏览器预签名 PUT 直传成功（URL host 为 `*.oss-cn-beijing.aliyuncs.com`），发送后可预览
- [x] 聊天历史 DB 数据已订正（`chat_messages.content` 4 行）；浏览器端显示留人工抽查
- [ ] 营销弹窗（如有进行中活动）：C 端任意页面弹出正常，头图（`popupImage`，留空时回退 `coverImage`）与正文（`popupContent`）内嵌图加载正常（客户端直连 API，订正即生效）
- [x] 站点 favicon 正常（`https://static.tzjii.com/statics/favicon.ico` 200；admin 重传写路径留人工抽查）
- [x] `GET /api/v1/health` 存储探针（HeadBucket）通过
- [x] `curl -I https://static.tzjii.com/{key}` 与 `.../tzj-uploads-prod/{key}`：均 200、`Server: AliyunOSS`
- [ ] 抽查百度/谷歌已收录的图片 URL（如有直链收录）可访问
- [x] ECS 容器：api/web/admin 全部 healthy（47fca6e），minio 容器仍在（观察期内保留）

---

## 9. 成本估算（华北2 标准存储，按量）

以当前数据规模（数 GB 级媒体，B2B 小站流量）估：

| 项 | 单价（约） | 月估 |
|----|-----------|------|
| 存储（<20GB） | 0.12 元/GB/月 | <3 元 |
| 公网流出（图片 GET，<30GB/月） | 0.50 元/GB | <15 元 |
| API 公网 GET（水印重烧、媒体恢复等少量请求） | 0.50 元/GB | 忽略（若未来批量重烧，可增加内部 endpoint 专用 client，免流量费） |
| 请求费 | 0.01 元/万次 | 忽略 |
| **合计** | | **≈20 元/月** |

对价换回：ECS 释放 512m 内存 + 数十 GB 磁盘空间 + 3Mbps 带宽不再被媒体挤占（C 端首屏图片加载不再受限），以及 MinIO 版本/备份运维归零。

说明：API 经公网 endpoint 上传（外网流入）免费；仅 `getObjectBuffer` 等 GET（水印重烧、媒体恢复）计外网流出，当前量级可并入上表忽略不计。

---

## 10. 后续可选优化（不在本次范围）

- **CDN**：~~`static.tzjii.com` CNAME 改指 CDN 加速域名，回源 OSS，进一步降流量单价并提升海外访问~~ ✅ 2026-08-05 已上线（见 §11），含 `www.tzjii.com` 全站 CDN
- **`x-oss-process` 服务端图片处理**：动态缩略图/格式转换/动态水印（此前评估 MinIO 不具备的能力缺口）
- **OSS 生命周期规则**：`chat/{YYYYMM}/` 前缀按月过期清理（`buildChatKey` 的目录设计本就为此预留）
- **本地 dev 存储**：继续使用 MinIO，不做更换（RustFS 方案已废弃，见 `docs/minio-to-rustfs-migration-plan.md` 头部声明）

---

## 11. CDN 上线执行记录（2026-08-05，账号 account-b）

### 11.1 加速域名与证书

| 域名 | CNAME | 源站 | HTTPS |
|------|-------|------|-------|
| `www.tzjii.com` | `www.tzjii.com.w.cdngslb.com` | `REDACTED-IP:443`（ipaddr，nginx） | 泛域名证书已上传（CDN 侧托管，2026-10-27 到期） |
| `static.tzjii.com` | `static.tzjii.com.w.cdngslb.com` | `tzj-prod-media.oss-cn-beijing.aliyuncs.com`（oss） | 同上泛域名证书（CDN 侧托管） |

- 域名归属验证 TXT（`verification.tzjii.com`）已验证通过并**已删除**
- `api.tzjii.com` / `admin.tzjii.com` / `@` **不上 CDN**：API 动态接口 + WebSocket 对缓存敏感，admin 为后台管理，保持 A 记录直连 ECS

### 11.2 域名配置（BatchSetCdnDomainConfig）

两个域名均配置：

- `forward_scheme`：`enable=on, scheme_origin=https, scheme_origin_port=443`（强制 HTTPS 回源）
- `https_origin_sni`：`enabled=on, https_origin_sni=<加速域名>`（回源 SNI 与 Host 一致）
- `https_force`：`enable=on, https_rewrite=301`（HTTP 访问 301 跳 HTTPS，与源站 nginx 行为一致）

差异项：

| 域名 | 回源 Host（`set_req_host_header`） | 缓存规则 |
|------|-----------------------------------|----------|
| www | `www.tzjii.com` | `filetype_based_ttl_set`：常见静态后缀 30 天、`swift_origin_cache_high=on`；HTML 遵循源站 `no-store` 不缓存（页面始终新鲜） |
| static | `static.tzjii.com`（OSS 自定义域名，SNI/证书匹配） | `path_based_ttl_set`：`/` 全路径 30 天（2592000s）、`swift_origin_cache_high=on`（OSS 无 Cache-Control 时按此 TTL） |

### 11.3 DNS 切换与验证

- 2026-08-05 切 DNS：`www.tzjii.com` A → CNAME CDN；`static.tzjii.com` CNAME OSS 桶域名 → CNAME CDN（TTL 600s）
- 切前预验证（`curl --resolve` 直连边缘 IP）：www 根路径 308 跳 `/zh-CN`、页面 200、`/_next/static/*` 200 且 `cache-control: public, max-age=31536000, immutable` 透传；static 对象 200、二次请求 `X-Cache: HIT`、`X-Swift-CacheTime: 2592000`、404 正常
- 切后实测：`dig` 两域名均解析到 `*.cdngslb.com`；www 页面/资源经 CDN（`Server: Tengine` + `Via` 链路）200；static `X-Cache: HIT`；HTTP 均 301 → HTTPS；HSTS/Set-Cookie/Vary 等响应头透传正常；api/admin 直连不受影响
- 缓存语义确认：www HTML 为 `no-store` 不缓存（CMS 内容更新即时可见），Next 静态资源本身带 `immutable` 1 年缓存，由 CDN 兜底

### 11.4 成本与运维注意

- CDN 按量计费（account-b 已开通）：C 端静态资源命中率高后，OSS 公网流出费用显著下降；新增 CDN 流量费按量结算
- ⚠️ 证书 2026-10-27 到期：CDN 两个域名当前用上传的泛域名证书，到期前需在 CDN 控制台/API 更新；OSS 侧（§4.4 CertId `26451242-cn-hangzhou`）同样到期，正式方案是改用 OSS 免费 DV 证书自动续期
- 资源更新策略：static 上被覆盖的存量对象最坏 30 天缓存（上传均为时间戳命名，几乎不会覆盖）；如需立即生效，用 `aliyun cdn RefreshObjectCaches`（已随插件可用）刷新对应 URL
- 回滚：将两条记录改回原值即可（www → A `REDACTED-IP`，static → CNAME `tzj-prod-media.oss-cn-beijing.aliyuncs.com`），TTL 600s

### 11.5 旧 URL 兼容：副本 → CDN 302 重定向（2026-08-05）

**背景**：迁移后收到顾客反馈——访问过旧网站的用户图片加载不出来。定位为客户端/外部渠道持有旧 URL `https://static.tzjii.com/tzj-uploads-prod/{key}`（未关闭的旧标签页、浏览器前进/后退缓存、微信/QQ 内置浏览器缓存、收藏/分享的旧链接等），而该前缀的过渡副本在收尾时已删除，实测旧 URL 404（CDN 与直连 OSS 均 404，存储层不存在）。

**第一步（应急）**：从根路径复制恢复 `tzj-uploads-prod/` 前缀（1270 对象 / 617.5 MiB，内网端点 15s），让旧 URL 立即恢复 200：

```bash
ossutil cp -r oss://tzj-prod-media/ oss://tzj-prod-media/tzj-uploads-prod/ \
  -e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing -i $ALI_KEY -k $ALI_SECRET \
  --exclude "/tzj-uploads-prod/**" -f
```

**第二步（最终方案，已上线）**：改为 CDN `host_redirect` 302 重定向，**强制用户换用新地址**，不再依赖存储副本：

```json
{
  "functionName": "host_redirect",
  "functionArgs": [
    { "argName": "regex", "argValue": "^/tzj-uploads-prod/(.+)$" },
    { "argName": "replacement", "argValue": "https://static.tzjii.com/$1" },
    { "argName": "flag", "argValue": "redirect" },
    { "argName": "rewrite_method", "argValue": "302" }
  ]
}
```

- 实测：旧 URL → `302 Location: https://static.tzjii.com/{key}`；带 `?x-oss-process=` 的旧 URL 重定向后**查询参数原样保留**；跟随跳转后 200；新路径不受影响
- 局限：仅 CDN 支持 302/303/307（无 301，图片类 URL 对 SEO 无影响）；依赖 CDN 链路，若将来去掉 CDN 需在其他层实现等价规则
- ✅ 2026-08-05 用户确认后**已删除兼容副本**（`ossutil rm -r` 1270 对象 / 4.6s）；生产桶恢复仅根路径 1270 对象 / 617.5 MiB
- ⚠️ 删除后直连 OSS 自定义域名的旧前缀 URL 为 404（预期）；**生产路径全部经 CDN**，旧 URL 一律 302 → 新地址 200
- ♻️ 桶开启了版本控制，若需回退可恢复删除标记前的版本；重定向规则在 CDN 侧，`BatchDeleteCdnDomainConfig` 可随时移除

**运维注意**：
- 302 重定向长期保留，直到旧 URL 自然淘汰（数月）后可按需移除
- 新增上传仅写根路径，无副本同步负担

### 11.6 静态资源全量上 OSS/CDN（2026-08-05）

**目标**：除动态生成的 `robots.txt`/`sitemap.xml` 外，所有静态资源统一托管 OSS（`static.tzjii.com`，CDN 30 天缓存），ECS 不再承担前端静态分发。

**改动清单**

| 层 | 改动 |
|----|------|
| 构建 | web/admin `next.config.ts` 增加 `assetPrefix`（`NEXT_PUBLIC_ASSET_PREFIX` 注入，dev 为空）；web/admin Dockerfile 增加对应 ARG/ENV |
| CI | `deploy.yml` 按 app 注入 `NEXT_PUBLIC_ASSET_PREFIX_WEB=https://static.tzjii.com/next/web`、`NEXT_PUBLIC_ASSET_PREFIX_ADMIN=https://static.tzjii.com/next/admin`（GitHub Vars） |
| 部署 | `deploy.sh` 新增 `sync_cdn_static`：滚动更新前从新镜像提取 `.next/static` + public 辅助文件 → ossutil 内网端点同步 OSS → 校验对象数 ≥ 本地文件数才放行更新 |
| 引用 | web layout 的 vditor lute prefetch / browser-support.js、admin layout 的 lute prefetch、MarkdownEditor `cdn`、聊天提示音、manifest apple-touch-icon 全部改指 `static.tzjii.com/statics/...` |

**OSS 目录布局**

| 前缀 | 内容 | Cache-Control |
|------|------|---------------|
| `next/web/_next/static/` | web 构建产物（41 文件，~2.7MB） | `public, max-age=31536000, immutable` |
| `next/admin/_next/static/` | admin 构建产物（85 文件，~4.1MB） | 同上 |
| `statics/vditor-assets/` | Vditor 编辑器资源（web/admin 同源） | `public, max-age=86400` |
| `statics/sounds/`、`statics/browser-support.js`、`statics/apple-touch-icon.png` | public 辅助资源 | `public, max-age=86400` |

**验证与回滚**
- 部署后检查页面 HTML 中 `/_next/static/` 引用已变为 `https://static.tzjii.com/next/{web|admin}/_next/static/...`，且资源 200
- 回滚 = 部署旧 sha：旧镜像未烘焙 assetPrefix，自动回落本地静态资源，无需额外操作
- ⚠️ `robots.txt`/`sitemap.xml` 为 Next 路由动态生成，保留在 ECS；浏览器自动请求的根路径 `/favicon.ico` 兜底仍由 nginx 提供（HTML 主 favicon 引用早已指向 OSS `statics/favicon.ico`）

### 11.6 补传缺失的 content 静态素材（2026-08-05）

**背景**：顾客反馈 `https://static.tzjii.com/content/gongan.png` 无法显示。排查发现对象确实不在桶中（CDN/直连 OSS 均 `NoSuchKey`），而仓库存在 `apps/web/public/media/gongan.png`。

**根因**：`resolveMediaUrl('/media/gongan.png')` 按 `STATIC_MEDIA_OBJECT_PREFIX='content'` 解析为 `content/gongan.png`，但迁移快照中该对象位于 `statics/gongan.png`（同名同大小），`content/` 下缺失。

**处置**：
- 桶内复制 `statics/gongan.png → content/gongan.png`（1403 B）
- 用仓库 `apps/web/public/media/` 与 OSS `content/` 全量比对，发现另有 9 个被代码引用但桶中缺失的素材：`alarm-highrise.png`、`fixed-tower-overview-concept.png`、`fixed-tower-series-thumb-a.png`、`case-gd-interior.png`、`case-henan-burn.png`、`case-henan-structure.png`、`case-js-module.png`、`case-js-platform.png`、`about-cn.webp`，已一并补传（12.3 MiB，内网端点）
- 其余 20 个本地存在但**未被代码/数据库引用**的 public 素材（`hero-banner-*`、`service-*`、`cert-honor-*`、`about-intro`、`story-timeline` 等）未上传
- 验证：10 个 URL 经 CDN 均 200 且 Content-Type 正确

**遗留**：桶内存在 macOS AppleDouble 垃圾对象（`content/._case-*` 等，约 10 个，极小），无引用、不影响线上，可后续清理；本地 `public/media` 与 OSS 的同步脚本（`sync-content-media`）应纳入 CI/发布流程，避免再次出现“仓库有、存储无”的漂移。
