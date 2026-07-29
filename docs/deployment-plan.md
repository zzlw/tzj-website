# TZJ 生产部署方案（GitHub + GitHub Actions + 阿里云 ECS + MinIO）

> 状态：设计定稿，待实施
> 适用规模：小而美（总用户 < 100，管理员个位数），单机部署，强调低运维、高 ROI
> 关联文件：`infra/docker/`（compose / nginx / acme / deploy.sh）、`.github/workflows/`

---

## 1. 方案总览

| 维度 | 选型 | 说明 |
|------|------|------|
| 代码仓库 | GitHub（private） | 单一事实源，main 为发布分支 |
| CI/CD | GitHub Actions | 复用现有 `ci.yml` + `deploy.yml`，云效 Flow 退役为备用 |
| 镜像仓库 | 阿里云 ACR 个人版（北京） | 免费；ECS 同地域内网拉取快，GitHub Runner 跨境推送可接受 |
| 服务器 | 阿里云 ECS 单机（已购，`REDACTED-IP`） | 规格与系统见 §2 |
| 静态/媒体存储 | **MinIO（ECS 自托管容器）** | 替代 OSS；S3 兼容协议，仅需 1 处小改（forcePathStyle 显式开关，见 §4.3） |
| 数据库 | PostgreSQL 15（容器） | compose 内置，数据落 volume；**redis 从生产 compose 移除**（API 实际未使用，见 §4.6） |
| 网关 | Nginx 1.27（容器） | 按域名反代 web / admin / api / 静态资源 |
| HTTPS | acme.sh（容器，DNS-01） | Let's Encrypt 通配符证书，自动续期（已有 `infra/docker/acme`） |

### 生产架构

```
GitHub push(main) ──► GitHub Actions ──► 构建 3 镜像 ──► 推送 ACR
                                              │
                                              ▼ SSH
                    ┌──────────── 阿里云 ECS（单机）────────────┐
                    │  nginx gateway :80/:443                    │
                    │   ├─ www.tzjii.com    → web:3000         │
                    │   ├─ admin.tzjii.com  → admin:3000       │
                    │   ├─ api.tzjii.com    → api:4000         │
                    │   └─ static.tzjii.com → minio:9000       │
                    │  postgres:5432 (volume: pgdata)            │
                    │  minio:9000   (volume: miniodata)          │
                    │  acme.sh      (volume: acme-data)          │
                    └────────────────────────────────────────────┘
```

---

## 2. 服务器选型（操作系统 + 规格）

### 操作系统：Ubuntu 24.04 LTS 64 位（推荐）

| 候选 | 结论 | 理由 |
|------|------|------|
| **Ubuntu 24.04 LTS** | ✅ 采用 | Docker 官方一等公民支持；内核 6.8，社区资料最多；LTS 支持到 2029-04，覆盖项目全生命周期；团队排障成本最低 |
| Alibaba Cloud Linux 3 | 备选 | 阿里云原生优化、免费技术支持，但 CentOS 系生态（dnf/yum），Docker 安装走阿里源，社区资料少于 Ubuntu |
| Debian 12 | 备选 | 稳定但软件包偏旧，无明显优势 |
| CentOS / Anolis | ❌ 不用 | CentOS 已停维；不引入额外学习成本 |

### ECS 实例（已购，地域：华北2-北京 cn-beijing）

| 项 | 实际值 | 说明 |
|----|--------|------|
| 实例规格 | **ecs.e-c1m1.large（2 vCPU / 2 GiB）** | 经济型 e 系列。6 个常驻容器（pg + minio + api + web + admin + nginx），2C2G 偏紧 → **必须开 2G swap（§6.1），并给容器设置内存上限（见下方「2C2G 内存预算」）** |
| 公网 IP | `REDACTED-IP` | 固定公网 IP；DNS A 记录全部指向它 |
| 私网 IP | `172.23.76.208` | 仅 VPC 内使用 |
| 系统盘 | ESSD Entry 40 GiB | 镜像 + pg 数据 + MinIO 媒体文件共用；需配置 Docker 日志轮转（§7）并定期 `docker image prune`；**媒体文件超过约 15 GiB 时挂数据盘迁移 miniodata volume** |
| 带宽 | 固定带宽 3 Mbps | 峰值下行约 375 KB/s，必须靠 nginx 30d 缓存头 + 图片 WebP 化（单图 < 500KB）控流量；视频类大文件谨慎放 MinIO，Hero 视频建议 < 5MB |
| 计费 | 包年包月，到期 2027-07-07 | 建议开自动续费防止到期释放 |
| 安全组 | 入方向仅放行 22 / 80 / 443 | **9000/9001（MinIO）、5432（PG）一律不对公网开放**，仅走 compose 内网 |

#### 2C2G 内存预算（compose 各服务加 `mem_limit`）

| 服务 | 上限 | 说明 |
|------|------|------|
| postgres | 384 MB | 小库足够，`shared_buffers` 保持默认 128MB |
| minio | 512 MB | IAM/admin 操作（建用户/挂策略）会瞬时冲高，256m 实测被 cgroup 杀导致 exit0 重启循环，必须 ≥512m |
| api (NestJS) | 512 MB | `NODE_OPTIONS=--max-old-space-size=384` |
| web / admin (Next.js) | 各 320 MB | `NODE_OPTIONS=--max-old-space-size=256` |
| gateway + acme | ~64 MB | nginx 极轻 |
| 合计 | ~2.11 GB | 超出物理 2GiB，重度依赖 2G swap；低流量小站各容器峰值不同时到，可接受 |

---

## 3. 域名与 DNS

域名 `tzjii.com` 已迁入阿里云（注册商 + 云解析 NS 均已切换，dns1/dns2.hichina.com 已生效）：

| 用途 | 域名 | 解析 |
|------|-------------|------|
| 主域名（裸域） | `tzjii.com` | A → `REDACTED-IP`（nginx 301 到 www） |
| C 端官网 | `www.tzjii.com` | A → `REDACTED-IP` |
| 管理后台 | `admin.tzjii.com` | A → `REDACTED-IP` |
| API | `api.tzjii.com` | A → `REDACTED-IP` |
| 静态资源（MinIO） | `static.tzjii.com` | A → `REDACTED-IP` |

- 证书：acme.sh DNS-01 通配符证书，需同时签 `tzjii.com` + `*.tzjii.com`（通配符不覆盖裸域），已有容器自动续期。
- DNS 在阿里云云解析，acme 容器通过 `ALI_KEY/ALI_SECRET`（RAM 子账号，仅授 `AliyunDNSFullAccess`）自动完成 TXT 校验。

---

## 4. MinIO 生产化改造（本方案核心变更）

现状：生产走 OSS（`OSS_DOMAIN` + nginx 反代），本地开发已用 MinIO。目标：生产与开发对齐，全部走 MinIO，去掉 OSS 依赖。

### 4.1 compose 新增 minio 服务（`infra/docker/docker-compose.prod.yml`）

```yaml
  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z   # 锁定版本，生产禁 latest
    restart: unless-stopped
    command: server /data
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:?required}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:?required}
      # 浏览器预签名直传所需 CORS（与 dev 对齐，域名换生产值）
      MINIO_API_CORS_ALLOW_ORIGIN: "https://${WEB_DOMAIN},https://${ADMIN_DOMAIN}"
      MINIO_API_CORS_ALLOW_METHODS: "GET,PUT,POST,HEAD"
      MINIO_API_CORS_ALLOW_HEADERS: "*"
    volumes:
      - miniodata:/data
    expose:
      - "9000"          # 仅 compose 内网，不映射宿主机端口
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
```

并在 `volumes:` 增加 `miniodata:`。生产**不开 9001 Console**（减少攻击面），管理操作用 `mc` 容器临时执行。

### 4.2 nginx 静态域名改反代 MinIO（`nginx/templates/tzj.conf.template`）

将 `${STATIC_DOMAIN}` 的 server 块从反代 OSS 改为反代 minio：

```nginx
server {
    listen 443 ssl http2;
    server_name ${STATIC_DOMAIN};
    include /etc/nginx/snippets/ssl.conf;

    client_max_body_size 100m;          # 预签名 PUT 直传上限

    location / {
        include /etc/nginx/snippets/proxy-docker.conf;
        set $upstream_minio minio:9000;
        proxy_pass http://$upstream_minio;
        proxy_http_version 1.1;
        proxy_set_header Host $host;    # 关键：保留 Host，SigV4 签名才能校验通过
        proxy_set_header X-Real-IP $remote_addr;
        # 公开读的静态资源缓存（MinIO 返回的私有请求不受影响）
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
}
```

> 签名原理：API 用公网端点 `https://static.tzjii.com` 生成预签名 URL（SigV4 把 Host 算进签名），浏览器直传经 nginx 转发到 minio 时 Host 未被改写，签名校验通过。**因此 `proxy_set_header Host $host` 不可省略。**

同时在模板中新增**裸域 301** server 块（§3 承诺，现有模板缺失）：

```nginx
server {
    listen 443 ssl http2;
    server_name ${BASE_DOMAIN};
    include /etc/nginx/snippets/ssl.conf;
    return 301 https://www.${BASE_DOMAIN}$request_uri;
}
```

（compose gateway 的 `environment` 需补 `BASE_DOMAIN: ${BASE_DOMAIN}` 供 envsubst 使用）

### 4.3 环境变量变更（`.env.prod` / `.env.prod.example`）

**域名段整体迁移（现 example 仍是 jiawen.live 测试域，漏改会导致 CORS 拦截生产前端）**：

```bash
WEB_DOMAIN=www.tzjii.com
ADMIN_DOMAIN=admin.tzjii.com
API_DOMAIN=api.tzjii.com
BASE_DOMAIN=tzjii.com
STATIC_DOMAIN=static.tzjii.com
ACME_EMAIL=<管理员邮箱>
CORS_ORIGINS=https://www.tzjii.com,https://admin.tzjii.com
WEB_URL=https://www.tzjii.com
ADMIN_URL=https://admin.tzjii.com
NEXT_PUBLIC_WEB_URL=https://www.tzjii.com
NEXT_PUBLIC_SITE_URL=https://www.tzjii.com
NEXT_PUBLIC_API_URL=https://api.tzjii.com/api/v1
NEXT_PUBLIC_ADMIN_API_URL=https://api.tzjii.com/api/v1
```

**S3/MinIO 段**：

```bash
# 删除
OSS_DOMAIN=...

# 新增
MINIO_ROOT_USER=<随机 20 位>
MINIO_ROOT_PASSWORD=<随机 40 位>

# S3 段改为（forcePathStyle 模式，与 dev 一致）
S3_BUCKET=tzj-uploads-prod
S3_REGION=us-east-1
S3_ENDPOINT=https://static.tzjii.com          # 公网端点，签名与直传同源
S3_ACCESS_KEY_ID=<MinIO 应用级 AK，见 4.4>
S3_ACCESS_KEY_SECRET=<对应 SK>
S3_PUBLIC_DOMAIN=https://static.tzjii.com/tzj-uploads-prod
NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://static.tzjii.com/tzj-uploads-prod
S3_FORCE_PATH_STYLE=true                      # 新增，见下方代码改动
```

**必需的代码改动（P0）**：`apps/api/src/storage/s3.service.ts` 当前的判定是 `endpoint 含 'localhost' 或 'minio'` 才开 forcePathStyle，而生产端点 `https://static.tzjii.com` 两者都不含 → SDK 会误走 virtual-hosted 风格（请求发往不存在的 `tzj-uploads-prod.static.tzjii.com`），所有 S3 操作失败。改为读显式开关（兼容旧行为）：

```typescript
forcePathStyle:
  this.config.get('S3_FORCE_PATH_STYLE') === 'true' ||
  this.config.get<string>('S3_ENDPOINT', '').includes('localhost') ||
  this.config.get<string>('S3_ENDPOINT', '').includes('minio'),
```

并在 `env.validation.ts` 补 `S3_FORCE_PATH_STYLE: z.enum(['true','false']).default('false')`。

同步动作：
- compose `gateway` 服务的 `environment` 去掉 `OSS_DOMAIN`
- GitHub Vars 里 `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` 同步改为新值（构建期注入 Next.js）
- **`IMAGE_REGISTRY` 必须等于 GitHub Vars 的 `ACR_REGISTRY/ACR_NAMESPACE` 拼接值**——现 example 里是 `.../REDACTED-NAMESPACE`（旧项目命名空间），若 CI 推新命名空间而服务器端不改，pull 阶段拉错/拉不到镜像
- **`.env.prod.local` 的 `CF_API_TOKEN`/`CF_ZONE_ID` 必须留空**——`issue.sh` 判定 CF 凭证优先于阿里云，tzjii.com NS 在阿里云，残留 CF 配置会导致 DNS-01 签发必败（顺带更新 issue.sh 头注释里「jiawen.live NS 在 Cloudflare」的过时说明）
- ~~`next.config.ts` 的 `images.remotePatterns`~~ 已验证满足：动态读 `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` 注入 + 静态兜底已含 `**.tzjii.com`，无需改动

### 4.4 Bucket 初始化（一次性，ECS 上执行）

```bash
# --env-file 必不可少：\$ 转义后变量在容器内求值，不注入则凭证为空
docker run --rm --network tzj_default --env-file /opt/tzj/.env.prod \
  --entrypoint sh minio/mc -c "
  mc alias set prod http://minio:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD &&
  mc mb -p prod/tzj-uploads-prod &&
  mc anonymous set download prod/tzj-uploads-prod &&           # 公开只读
  mc admin user add prod tzj-api '<S3_ACCESS_KEY_SECRET>' &&    # 应用专用 AK/SK
  mc admin policy attach prod readwrite --user tzj-api
"
```

目录结构沿用 AGENTS.md 规范：`products/`、`images/{YYYYMM}/`、`statics/`、`videos/`、`uploads/`。

### 4.5 存量数据迁移（一次性）

> 生产站的初始内容来自**本地开发环境**：内容数据在本地 dev 库（`tzj_dev`），媒体文件在本地 dev MinIO（`tzj-uploads-dev`）。上线时把两者一次性同步到生产，之后以生产为准。

#### 4.5.1 本地内容数据 → 生产数据库

同步范围（管理后台模块 ↔ 数据表映射）：

| 模块 | 数据表 |
|------|--------|
| 案例管理 | `cases` |
| 新闻管理 | `news` |
| 博客管理 | `blogs` |
| 展会管理 | `trade_shows` |
| 法务页面 | `pages` |
| 媒体库 | `media_assets`（文件本体见 §4.5.2） |
| 文档中心 | `doc_folders`、`doc_tags`、`internal_documents`、`internal_document_revisions`、`document_permissions` |
| 账号管理 | `users`（2FA 状态不迁，见注意事项 2） |
| 角色与权限 | `access_roles` |
| 客服设置 + 站点设置 | `settings`（同一张表，不同 key/group）|

**不迁移**（运行时数据，生产从零开始）：`sessions`、`audit_logs`、`page_views`、`visitors`、`blocked_ips`、`contacts`、`customers`、`chat_*`、`notification_logs`、`two_factor_recovery_codes`（随 2FA 状态一并重置）、`integrations`（含加密密钥，生产在后台重新配置）。

执行步骤（前提：deploy.yml 首次全量部署已跑完 `prisma migrate deploy` 建好空表）：

```bash
# ① 本机导出（dev 库：tzj_admin / tzj_dev；--disable-triggers 免去 FK 顺序问题，
#    容器内 tzj_admin 即 initdb 超级用户，DISABLE TRIGGER 有权限执行）
cd infra/docker && docker compose -f docker-compose.dev.yml exec -T postgres \
  pg_dump -U tzj_admin -d tzj_dev --data-only --disable-triggers \
  -t access_roles -t users \
  -t cases -t news -t blogs -t trade_shows -t pages -t media_assets \
  -t doc_folders -t doc_tags -t internal_documents \
  -t internal_document_revisions -t document_permissions \
  -t settings > /tmp/tzj-content-sync.sql

# ② 媒体 URL 前缀改写：本地 dev 前缀 → 生产 S3_PUBLIC_DOMAIN
#    （media_assets.url 及富文本 content 里内嵌的图片地址一并替换；对象 key 不变）
sed -i '' 's|http://localhost:9000/tzj-uploads-dev|https://static.tzjii.com/tzj-uploads-prod|g' \
  /tmp/tzj-content-sync.sql

# ③ 传到服务器并导入（单事务 + 出错即停；生产库 tzj / tzj_prod）
scp /tmp/tzj-content-sync.sql tzj-prod:/tmp/
ssh tzj-prod "cd /opt/tzj && docker compose -f docker-compose.prod.yml \
  --env-file .env.prod --env-file .env.prod.local \
  exec -T postgres psql -U tzj -d tzj_prod --single-transaction -v ON_ERROR_STOP=1 \
  < /tmp/tzj-content-sync.sql"

# ④ 重置 2FA 状态（密文用本地 SECRETS_ENCRYPTION_KEY 加密，生产密钥独立无法解密，
#    不重置则已启用 2FA 的账号登录必卡死；上线后在生产重新绑定）
ssh tzj-prod "cd /opt/tzj && docker compose -f docker-compose.prod.yml \
  --env-file .env.prod --env-file .env.prod.local \
  exec -T postgres psql -U tzj -d tzj_prod -c 'UPDATE users SET \"twoFactorEnabled\"=false, \
    \"twoFactorSecretEnc\"=NULL, \"twoFactorPendingSecretEnc\"=NULL, \
    \"twoFactorPendingCreatedAt\"=NULL, \"twoFactorConfirmedAt\"=NULL, \"twoFactorLastStep\"=NULL;'"
```

注意事项：

1. **只能对空表导入**：首次 migrate 后表是空的可直接导；若需重跑，先在生产 `TRUNCATE` 上述表（`--single-transaction` 保证失败不留半截数据）。
2. 密码哈希（bcrypt）自包含、跨环境有效，本地账号用原密码即可登录生产 admin；但 2FA 密文依赖 `SECRETS_ENCRYPTION_KEY`，§8 要求生产密钥独立随机 → 密文跨环境不可解，故 2FA 状态一律重置（步骤 ④）、上线后重新绑定；**上线后立即为所有账号改强密码**。
3. `settings` 整表迁移即同时覆盖「站点设置」与「客服设置」（chatPrompts 等 key 同表存储）；其中静态资源引用（如 `content/wechat.jpg`）存的是对象 key，不受前缀替换影响。

#### 4.5.2 本地 MinIO 媒体对象 → 生产 MinIO

媒体库及富文本引用的文件本体在本地 dev MinIO（`tzj-uploads-dev`，实测 1153 对象 / 556MiB）。**分两步完成**：小文件走公网反代批量同步，大文件走服务器内网入库。

**❌ 不要整库走 `static.tzjii.com` 公网 mirror：**实测公网 nginx 反代 + SigV4 签名 + 单核 ECS 上 nginx 把请求体缓冲到临时文件，把上传吞吐压到 <1MB/s（跟带宽无关：同一批文件用 scp 直传服务器能跑到 12–14MB/s）；且大文件（>16MB）走分片上传时，若 nginx 开了 `proxy_request_buffering off` 会把 body 改用 chunked 重编码转发、破坏 aws-chunked 签名导致 minio 返 **HTTP 400**。

**✅ 正确做法：**

```bash
# ① 小文件（图片/图标 ≤约 10MB）——本机走公网反代 mirror，数量多但单个小，快且可重跑（--overwrite 幂等）
docker run --rm --add-host static.tzjii.com:<生产 IP> --entrypoint sh minio/mc -c "
  mc alias set dev http://host.docker.internal:9000 minioadmin <本地MINIO_ROOT_PASSWORD> &&
  mc alias set prod https://static.tzjii.com <S3_ACCESS_KEY_ID> <S3_ACCESS_KEY_SECRET> &&
  mc mirror --overwrite dev/tzj-uploads-dev prod/tzj-uploads-prod"
# （本地解析器若缓存了新域名的 NXDOMAIN，容器 DNS 会 no such host，故用 --add-host 直映射绕过）

# ② 大文件（视频/大图 >16MB，本例 7×37MB mp4 + 4 张大图 = 320MiB）——先导出到本地目录，
#    scp 到服务器（~12MB/s，秒级），再在服务器上走内网 http://minio:9000 入库（根凭证，无 nginx/TLS/签名穿透，53MB/s）
mkdir -p /tmp/tzj-tree/{videos,content,products}   # 按 bucket 前缀组织
docker run --rm -v /tmp/tzj-tree:/out --entrypoint sh minio/mc -c \
  "mc alias set dev http://host.docker.internal:9000 minioadmin <pw> && mc cp dev/tzj-uploads-dev/videos/xxx.mp4 /out/videos/ ..."
scp -r /tmp/tzj-tree/* deploy@<生产 IP>:/tmp/tzj-tree/
ssh deploy@<生产 IP> 'docker run --rm --network tzj_default -v /tmp/tzj-tree:/data \
  --env-file /opt/tzj/.env.prod --entrypoint sh minio/mc -c \
  "mc alias set prod http://minio:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD && mc cp --recursive /data/ prod/tzj-uploads-prod/"'

# ③ 校验：两端对象数/总大小一致（均 1153 对象 / 556MiB），抽查大文件公网 GET 200 + content-length 正确
```

> 前提：§4.4 bucket 已初始化、DNS/证书已就绪（§6.3 步骤 1–4）。后台管理后台的媒体上传走预签名 PUT + 分片，单文件仍受 nginx `client_max_body_size 100m` 限制（已配 300s 读写/请求体超时，但不得关 `proxy_request_buffering`）；超大视频先压缩（AGENTS.md 规范本就要求视频 < 1080p / 30s）。

#### 4.5.3 存量 OSS 数据迁移（如有）

```bash
# mc 直接对拷 OSS → MinIO（OSS 兼容 S3 协议）；同样走 mc 容器，宿主机不装二进制
docker run --rm --network tzj_default --env-file /opt/tzj/.env.prod \
  --entrypoint sh minio/mc -c "
  mc alias set oss https://oss-cn-beijing.aliyuncs.com <OSS_AK> <OSS_SK> &&
  mc alias set prod http://minio:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD &&
  mc mirror oss/tzj-media-static-assets prod/tzj-uploads-prod
"
```

迁移后数据库中的媒体 URL 前缀若与新 `S3_PUBLIC_DOMAIN` 不一致，跑一次 SQL 批量替换前缀（上线窗口内执行，替换前先备份）。

### 4.6 配套清理（同一个 PR 内完成）

1. **移除 redis 服务**：`docker-compose.prod.yml` 删除 `redis` 服务、`redisdata` volume，及 api 的 `depends_on.redis`。依据：API 代码中 Redis 仅为注释标注的可选依赖（多实例 Socket.IO 才需要），`env.validation.ts` 无任何 REDIS 变量，单机部署纯属死重量（~60MB 内存）。
2. **去除 acme 的 CDN 证书推送**：`infra/docker/acme/issue.sh` 尾部在 `STATIC_DOMAIN + Ali_Key` 存在时会调 `deploy-cdn.sh` 往阿里云 CDN 推证书——MinIO 自托管后 static 域名不再走 CDN，删除该分支及 `deploy-cdn.sh`，**并同时删掉 `--issue` 命令里的 `--renew-hook "sh /scripts/deploy-cdn.sh"`**（renew-hook 会被 acme.sh 持久化进域配置，脚本删了 hook 还在，之后每次自动续期都报错；nginx 侧已有 `90-periodic-reload.sh` 每 6h 自动 reload，无需 hook）。
3. **API 访问自身公网域名的回环优化（可选）**：api 容器内访问 `static.tzjii.com` 会经公网 IP hairpin，占 3 Mbps 带宽。可在 api 服务加 `extra_hosts: ["static.tzjii.com:网关容器IP"]` 或接受现状（服务端直接 S3 写入频率低，主路径是浏览器预签名直传）。首版接受现状，不加复杂度。
4. **落地 §2 内存预算**：给 compose 各服务加 `mem_limit`（postgres 384m / minio 512m / api 512m / web·admin 各 320m），并在 api/web/admin 的 `environment` 补 `NODE_OPTIONS`（api `--max-old-space-size=384`，web/admin `--max-old-space-size=256`）。
5. **清理 `.env.prod.local.example` 注释**：删掉「CDN 证书推送仍需 ALI_KEY/ALI_SECRET」一行（CDN 推送已废，ALI_KEY/ALI_SECRET 仅供 acme DNS-01 使用）。
6. **Makefile 按运行位置拆分（已执行）**：根 `Makefile` 只留本地开发 target（dev / db-*）；新建 `infra/docker/Makefile`（服务器运维：prod-deploy / prod-status / prod-logs / gateway-reload / cert-selfsigned / acme-build / infra-up / cert-issue / cert-renew），路径全按 `/opt/tzj`，PROD 宏用 `$(wildcard)` 条件叠加 acme override（与 deploy.sh 的 compose() 对齐），经 scp `strip_components: 2` 落地为 `/opt/tzj/Makefile`；两个 workflow 的 scp 清单已补 `infra/docker/Makefile`；旧的 `cert-deploy-cdn` 与 `deploy-ssh-help` target 随拆分删除。

---

## 5. CI/CD（GitHub + GitHub Actions）

### 5.0 代码同步宪法（Constitutional，高于一切便利性考量）

> 背景：本项目曾长期处于「本地领先远程数百个提交」的漂移状态。部署链路（deploy.yml 构建镜像、scp 铺设 infra 文件）**只认远程仓库**，本地未 push 的改动对生产不存在——漂移必然导致「本地改了、线上没改」的幻觉性上线。

1. **每次本地代码变动完成后，必须立即 commit 并 push 到远程仓库**（GitHub `origin`，默认推送目标），禁止本地与远程长期漂移。
2. 一切部署以远程仓库为唯一事实源：镜像里的代码 = 远程 main，服务器上的 infra 文件 = 远程 main 的 scp 产物。
3. 上线/部署前的强制自检（两条都必须为空）：
   ```bash
   git status --porcelain          # 工作区必须干净
   git log --oneline origin/main..main   # 本地领先必须为 0
   ```
4. 双远程现状：`origin`（GitHub，CI/CD 事实源）+ `codeup`（云效，历史遗留备份）。宪法约束的是 `origin`；codeup 不强制同步。

### 5.1 流水线分工（现有 workflows 微调）

| Workflow | 触发 | 职责 | 调整 |
|----------|------|------|------|
| `ci.yml` | PR / push(main, develop) | lint + typecheck + 权限门禁 + 构建 + Trivy 扫描 | Node 20 → **22**（与 engines 对齐，含 perf.yml 共 3 处）；`npm install -g @lhci/cli` 改 `pnpm dlx`（AGENTS 禁止条款 8）；`trivy-action@master` 锁版本 |
| `deploy.yml` | **push(main) + 手动** | 构建 3 镜像 → 推 ACR → SSH 部署 | 触发器从仅手动改为 `push: branches: [main]`（保留 `workflow_dispatch`）；**scp 清单删掉幽灵路径 `infra/docker/scripts`（目录不存在，scp-action 会直接失败）**；头注释去「云效主路径」过时文案 |
| `deploy-ssh.yml` | 手动 | 不构建，仅按 tag 重新部署 = **回滚通道** | 同上：删 `infra/docker/scripts` 幽灵路径 + 更新云效过时注释（tag 描述改 git sha） |
| `perf.yml` | 手动 | 性能基线 | `base_url` 默认值 `tzj-admin.jiawen.live` → `admin.tzjii.com`；Node 20 → 22 |

发布流：`PR → main`（CI 门禁）→ 合并后 `deploy.yml` 自动构建部署 → 失败/回滚用 `deploy-ssh.yml` 指定旧 sha。
并发控制已具备（`concurrency: deploy-production`），不会双部署。

### 5.2 GitHub Secrets / Vars 清单

> 写入方式统一用 `gh variable set` / `gh secret set`，完整命令见 §10.5。

**Secrets（Settings → Secrets and variables → Actions）**

| 名称 | 用途 |
|------|------|
| `ACR_USERNAME` / `ACR_PASSWORD` | 推送镜像到 ACR |
| `ECS_SSH_KEY` | 部署机私钥（专用密钥对，非个人密钥） |
| `TURBO_TOKEN` / `TURBO_TEAM` | Turbo 远程缓存（可选） |

**Vars**

| 名称 | 示例值 |
|------|--------|
| `ACR_REGISTRY` | `crpi-xxx.cn-beijing.personal.cr.aliyuncs.com` |
| `ACR_NAMESPACE` | `<命名空间>` |
| `ECS_HOST` / `ECS_USER` | `REDACTED-IP` / `deploy` |
| `NEXT_PUBLIC_API_URL` | `https://api.tzjii.com/api/v1` |
| `NEXT_PUBLIC_ADMIN_API_URL` | `https://api.tzjii.com/api/v1` |
| `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` | `https://static.tzjii.com/tzj-uploads-prod` |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_WEB_URL` | `https://www.tzjii.com` |

`environment: production` 建议开启 required reviewers = 本人，作为生产部署的最后闸门（自动触发时也会等待批准；若嫌繁琐可不设）。

> ⚠️ 顺序硬约束：`ci.yml` 的 docker-build job 引用 `vars.NEXT_PUBLIC_*` 作 build-args，web 的 `lib/env.ts` 缺值会 fail-fast——**先配齐上表 Vars，再把本地 main 推上 GitHub**，否则首次 CI 直接飘红。

> ⚠️ **旧配置残留坑（首次部署实测）**：仓库 `zzlw/tzj-website` 曾用于旧项目（jiawen.live / OSS / `ECS_HOST=REDACTED-IP` / `ECS_USER=root`），残留了一批 24 天前的 Vars/Secrets。**首次部署前必须逐项 `gh variable list` / `gh secret list` 核对并覆盖上表 9 个 Vars + 3 个 Secrets**——尤其 `ECS_HOST`/`ECS_USER`/`NEXT_PUBLIC_*` 全指向旧环境；`NEXT_PUBLIC_*` 是构建期烤进镜像，配错会导致前端连错域名。其余无 workflow 引用的残留项（`DATABASE_URL`/`CORS_ORIGINS`/`S3_*`/secret 版 `ECS_HOST` 等）是旧 SSH-注入式部署遗物，当前架构运行时 env 走服务器 `/opt/tzj/.env.prod`，可忽略。

> 🔑 **专用部署密钥**：CI 用 `~/.ssh/tzj_deploy`（ed25519，与个人密钥隔离），公钥已装入 deploy 用户 `authorized_keys`，私钥进 `gh secret set ECS_SSH_KEY`。若换机重建 CI，需重新 `ssh-keygen` 并把公钥追加到服务器。

### 5.3 部署脚本

复用 `infra/docker/deploy.sh`（tag 持久化 → pull → prisma migrate → 滚动更新 → 健康检查 → smoke test），无需改动；MinIO 属基础设施容器，随 `compose up -d` 常驻，不参与滚动更新。

---

## 6. 首次部署 Runbook（ECS 初始化 → 上线）

> 本节命令在服务器内执行；从本机发起的 SSH 免密、安全组、DNS、GitHub 配置等全部 CLI 命令见 §10。

### 6.1 系统初始化（全新 Ubuntu 24.04 最小系统，以 root 执行）

> 前提认知：阿里云 Ubuntu 镜像的 apt 源默认指向 `mirrors.cloud.aliyuncs.com`（内网，免流量且快），无需换源；但原生最小系统缺常用工具，且 Docker Hub 在境内直拉基本不通，以下步骤已针对性处理。

```bash
# 0. 基础工具（原生镜像缺什么装什么；rsync 供 scp-action/文件同步，dnsutils 提供 dig，
#    make 供 /opt/tzj/Makefile 运维入口）
apt update && apt -y upgrade
apt -y install curl wget rsync dnsutils ca-certificates gnupg \
  ufw fail2ban unzip jq htop make
# 说明：不需要 git/node/pnpm——服务器只跑镜像，不拉代码不构建

# 1. 创建部署用户（禁 root 远程 + 密钥登录）
adduser deploy && usermod -aG sudo deploy
rsync -a ~/.ssh /home/deploy/ && chown -R deploy:deploy /home/deploy/.ssh
# /etc/ssh/sshd_config: PermitRootLogin no / PasswordAuthentication no 后 systemctl restart ssh

# 2. 防火墙与时区
ufw allow 22,80,443/tcp && ufw enable
timedatectl set-timezone Asia/Shanghai

# 3. Docker：用仓库现成脚本（apt 装 docker.io + compose-v2，走内网源；
#    并写入国内 registry mirror，解决 Docker Hub 镜像拉不动的问题）
#    ⚠️ 不要用 get.docker.com（跨境下载，纯净机上经常超时）
#    服务器上没有仓库，脚本从本机经 stdin 下发（在本机仓库根目录执行）：
#      ssh tzj-prod-root 'bash -s' < infra/docker/setup-docker-mirror.sh
usermod -aG docker deploy

# 3b. 合并日志轮转到 daemon.json（setup 脚本的 tee 会整体覆写，
#     需要把 registry-mirrors 和 log-opts 写在同一份文件里，避免互相覆盖）
cat >/etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://docker.m.daocloud.io", "https://docker.1ms.run"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "3" }
}
EOF
systemctl restart docker

# 4. swap（2C2G 必须开 2G，否则滚动更新时会 OOM 杀容器）
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile
swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 5. 备份工具（§7 的 OSS 归档备份用）
curl -o /tmp/ossutil.zip https://gosspublic.alicdn.com/ossutil/v2/2.1.1/ossutil-2.1.1-linux-amd64.zip \
  && unzip -o /tmp/ossutil.zip -d /tmp/ossutil-tmp \
  && install /tmp/ossutil-tmp/*/ossutil /usr/local/bin/ && rm -rf /tmp/ossutil*
# （版本号以官网最新为准；也可替代：用 docker 跑 mc 镜像同步到 OSS，免装二进制）
```

验收初始化完成：

```bash
docker compose version && docker info | grep -A2 'Registry Mirrors'
docker pull postgres:15-alpine        # 能拉通 = mirror 生效
free -h | grep -i swap                # swap 2.0Gi
sudo -u deploy docker ps              # deploy 用户可用 docker
```

### 6.2 部署目录与环境文件

```bash
mkdir -p /opt/tzj && chown deploy:deploy /opt/tzj
```

⚠️ **首次铺设不能等 deploy.yml**：§6.3 步骤 2–5（证书/基础设施/MinIO）先于首次触发 deploy.yml（步骤 6），此时 compose/nginx/acme 文件还没被 CI 的 scp 铺过——首次由本机手动同步（清单与 deploy.yml 的 scp 一致）：

```bash
# 本机仓库根目录执行；后续更新由 deploy.yml 的 scp 自动覆盖
rsync -av infra/docker/docker-compose.prod.yml infra/docker/docker-compose.acme.override.yml \
  infra/docker/deploy.sh infra/docker/Makefile infra/docker/.env.prod.local.example \
  infra/docker/nginx infra/docker/acme tzj-prod:/opt/tzj/
```

手工准备三个环境文件（不入 git）：

```bash
#   /opt/tzj/.env.prod        ← 从 .env.prod.example 复制，按 §4.3 填域名段 + MinIO 值 + IMAGE_REGISTRY
#   /opt/tzj/.env.prod.local  ← 从 .env.prod.local.example 复制（镜像 tag / ALI_KEY・ALI_SECRET，CF_* 留空）
#   /opt/tzj/.env.deploy      ← ACR 登录凭证（可选）
```

### 6.3 上线顺序

> 服务器运维入口是随 scp 落地的 `/opt/tzj/Makefile`（源文件 `infra/docker/Makefile`，路径全按服务器布局，PROD 宏已含双 `--env-file` + acme override 叠加，与 deploy.sh 对齐）。
> 仓库根 Makefile 只管本地开发，不含 prod/cert target。若需手写 `docker compose` 命令，必须带双 `--env-file`（compose 插值有 `:?required`，缺了解析阶段直接报错）。

1. DNS 五条 A 记录（含裸域）指向 ECS，`dig` 逐一验证
2. 自签占位证书让 nginx 能起：`make -C /opt/tzj cert-selfsigned`
3. 首次构建 acme 镜像并启动基础设施（acme.override 把 build 置空、只认 `tzj-acme:prod` 镜像，首次必须先显式 build，`acme-build` 内部已去除 override）：
   ```bash
   make -C /opt/tzj acme-build infra-up   # 产出 tzj-acme:prod → 拉起 postgres/minio/acme/gateway
   ```
4. 签真证书并重载：`make -C /opt/tzj cert-issue gateway-reload`
5. 初始化 MinIO bucket（§4.4）→ 本机执行媒体对象同步（§4.5.2，本地 dev MinIO → 生产）
6. GitHub 配好 Secrets/Vars → 手动触发 `deploy.yml` 完成首次全量部署（`migrate deploy` 建好表结构）
7. 导入本地内容数据到生产库（§4.5.1：案例/新闻/博客/展会/法务页面/媒体库/文档中心/账号/角色权限/客服与站点设置，含媒体 URL 前缀改写）
8. 验收：三域名 HTTPS 可达、`/api/v1/health` OK、用同步过来的管理员账号登录 admin、前台各栏目内容与图片正常、admin 上传图片 → 图片经 `static.tzjii.com` 可访问

---

## 7. 备份与运维

| 对象 | 策略 | 实现 |
|------|------|------|
| PostgreSQL | 每日 02:00 `pg_dump`，本地保留 14 天；**同日同步一份到阿里云 OSS 归档型 bucket（仅存备份，月成本≈几毛钱）** | ECS crontab + ossutil |
| MinIO 数据 | 每周 `mc mirror` 到 OSS 备份 bucket + 阿里云快照兜底 | crontab |
| ECS 快照 | 系统盘自动快照策略，每日 1 次保留 7 天 | 阿里云控制台配置 |
| 日志 | Docker `json-file` 驱动 + `max-size=50m,max-file=3`（已在 §6.1 步骤 3b 写入 daemon.json，与 registry-mirrors 合并维护） | 防日志撑爆磁盘 |
| 监控告警 | 云监控免费版：CPU > 80%、内存 > 85%、磁盘 > 80% 短信告警；UptimeRobot 免费拨测三域名 | 零成本 |

> 备份原则：pg_dump 本地目录和 MinIO 都在同一块系统盘上，**不构成异地备份**；机器级故障的真正兜底是「OSS 备份 bucket + ECS 快照」两条腿。OSS 仅用于备份归档，不影响「静态存储去 OSS 化」的主方案。

备份脚本示例（crontab）：

```bash
# 用 compose exec 而非写死容器名；双 --env-file 必须带（compose 插值有 :?required，缺了直接报错）
0 2 * * * cd /opt/tzj && docker compose -f docker-compose.prod.yml --env-file .env.prod --env-file .env.prod.local exec -T postgres pg_dump -U tzj tzj_prod | gzip > /opt/tzj/backup/pg_$(date +\%F).sql.gz && find /opt/tzj/backup -mtime +14 -delete
```

---

## 8. 安全清单（上线前核对）

- [ ] 安全组仅 22/80/443；MinIO 9000/9001、PG 5432 未映射宿主机端口
- [ ] SSH 禁 root、禁密码；部署密钥为专用密钥对
- [ ] `MINIO_ROOT_USER/PASSWORD` 为强随机值；应用使用独立 AK（`tzj-api`），不用 root 凭证
- [ ] bucket 仅 `anonymous download`（公开只读），无匿名写；`backups/` 前缀不公开
- [ ] `.env.prod*` 权限 600，属主 deploy，永不入 git
- [ ] JWT_SECRET / SECRETS_ENCRYPTION_KEY 生产独立随机值
- [ ] acme 使用的阿里云 RAM 子账号仅授 DNS 权限
- [ ] GitHub 仓库 private；`production` environment 开启部署审批（可选）

---

## 9. 实施顺序（预计半天）

| # | 任务 | 产出 |
|---|------|------|
| 1 | ~~购买 ECS~~（已购：e-c1m1.large / 2C2G / 北京 / `REDACTED-IP`）~~重装为 Ubuntu 24.04 + 域名解析~~ ✅ | 可 SSH 的服务器 |
| 2 | ~~系统初始化（§6.1）~~ ✅ | Docker 就绪、加固完成 |
| 3 | ~~改造 infra：compose（+minio/−redis/mem_limit）+ nginx 模板（minio 反代 + 裸域 301）+ env example（域名段 + S3 段）+ s3.service.ts forcePathStyle（§4.1–4.6）~~ ✅ | PR 合入 main |
| 4 | ~~ECS 铺环境文件，启动 postgres/minio/acme/gateway，出证书~~ ✅ | 基础设施就绪 |
| 5 | ~~MinIO bucket 初始化 + 本地媒体对象同步（§4.4 / §4.5.2）~~ ✅（1153 对象/556MiB 已对齐） | 静态资源可访问 |
| 6 | ~~GitHub Secrets/Vars 配置，触发 `deploy.yml`~~ ✅（9 Vars + 3 Secrets 已刷新，专用部署密钥 `~/.ssh/tzj_deploy` 已建；run 30462440474 构建 3 镜像 + 部署成功，30 表已建，web/admin/api 全 healthy） | 首次上线（表结构就绪） |
| 7 | 本地内容数据导入生产库（§4.5.1，11 个后台模块） | 站点内容就绪 |
| 8 | 备份 crontab + 云监控 + 拨测（§7） | 运维闭环 |

## 10. 全 CLI 操作手册（aliyun CLI + GitHub CLI）

> 原则：**除「购买实例」「域名过户」等一次性商务操作外，全部部署动作用 CLI 完成**，可复制、可复现、可审计，不依赖控制台点击。
> 本机已就绪：`aliyun` 3.4.2（profile `account-b`，OAuth，cn-beijing）、`gh` 2.96.0（账号 `zzlw`，git 协议 ssh）。

### 10.0 SSH 免密登录（含 IP 说明）

> **IP 双轨约定**：本机已打通私网通道，日常运维 SSH 目标为私网 IP `172.23.76.208`（免流量、不占 3 Mbps 公网带宽）；**GitHub Actions 的 `ECS_HOST` 必须仍用公网 IP `REDACTED-IP`**（跨境 Runner 无法进入 VPC 私网）。公网 IP 同时作为私网通道故障时的运维备途。

**密钥分工（对应 §8 安全清单「部署密钥为专用密钥对」）**

| 密钥 | 用途 | 位置 |
|------|------|------|
| `~/.ssh/id_ed25519`（已有） | 人工运维登录 | 本机个人密钥，不外传 |
| `~/.ssh/tzj_deploy`（待建） | GitHub Actions 自动部署 | 私钥进 `gh secret`，公钥进服务器 |

```bash
# 生成 CI 专用密钥（无口令，供 Actions 非交互使用）
ssh-keygen -t ed25519 -f ~/.ssh/tzj_deploy -C "github-actions-deploy" -N ""
```

**路径 A：重装系统时注入 root 免密（推荐，§9 任务 1 本就要重装为 Ubuntu 24.04）**

```bash
# 1. 查实例 ID 与当前状态
aliyun ecs DescribeInstances --RegionId cn-beijing \
  --output cols=InstanceId,InstanceName,Status,PublicIpAddress rows=Instances.Instance[]

# 2. 查 Ubuntu 24.04 官方镜像 ID
aliyun ecs DescribeImages --RegionId cn-beijing --OSType linux \
  --ImageOwnerAlias system --InstanceType ecs.e-c1m1.large \
  --ImageName '*ubuntu_24_04_x64*' \
  --output cols=ImageId,ImageName rows=Images.Image[]

# 3. 导入本机公钥为阿里云密钥对
aliyun ecs ImportKeyPair --RegionId cn-beijing --KeyPairName tzj-ops \
  --PublicKeyBody "$(cat ~/.ssh/id_ed25519.pub)"

# 4. 重装系统盘并绑定密钥对（root 直接免密，不设密码）
#    ⚠️ ReplaceSystemDisk 要求实例处于已停止状态，先 Stop 并等状态变 Stopped
aliyun ecs StopInstance --InstanceId <i-xxx>
aliyun ecs DescribeInstances --RegionId cn-beijing --InstanceIds '["<i-xxx>"]' \
  --output cols=InstanceId,Status rows=Instances.Instance[]        # 直到 Status=Stopped
aliyun ecs ReplaceSystemDisk --InstanceId <i-xxx> \
  --ImageId <ubuntu_24_04_x64_...> --KeyPairName tzj-ops --SystemDisk.Size 40
aliyun ecs StartInstance --InstanceId <i-xxx>

# 5. 验证免密（首次会问 host key，输 yes）
ssh root@172.23.76.208 'cat /etc/os-release | head -2'
```

**路径 B：不重装系统，用云助手写入公钥（全程免密码，无需重启）**

```bash
aliyun ecs RunCommand --RegionId cn-beijing --InstanceId.1 <i-xxx> \
  --Type RunShellScript --ContentEncoding PlainText --CommandContent "
mkdir -p /root/.ssh && chmod 700 /root/.ssh
grep -qF '$(cat ~/.ssh/id_ed25519.pub)' /root/.ssh/authorized_keys 2>/dev/null || \
  echo '$(cat ~/.ssh/id_ed25519.pub)' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys"
# 用返回的 InvokeId 查执行结果
aliyun ecs DescribeInvocationResults --RegionId cn-beijing --InvokeId <invoke-id>
```

**部署用户免密（§6.1 步骤 1 之后执行，两把公钥都装上）**

```bash
# 个人密钥 → 人工运维；tzj_deploy 公钥 → GitHub Actions
ssh-copy-id -i ~/.ssh/id_ed25519.pub  deploy@172.23.76.208
ssh-copy-id -i ~/.ssh/tzj_deploy.pub  deploy@172.23.76.208
```

**本机 SSH 别名（`~/.ssh/config`，后续命令一律用 `tzj-prod`）**

```
Host tzj-prod                # 日常运维：私网通道
    HostName 172.23.76.208
    User deploy
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 30
    ServerAliveCountMax 3

Host tzj-prod-root           # 仅系统初始化阶段可用，§6.1 完成后 sshd 会禁 root
    HostName 172.23.76.208
    User root
    IdentityFile ~/.ssh/id_ed25519

Host tzj-prod-pub            # 备途：私网通道故障时走公网
    HostName REDACTED-IP
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```

验证：`ssh tzj-prod 'docker ps'` 免密返回即达标。

### 10.1 aliyun CLI：网络与安全组（对应 §2）

```bash
# 查实例所属安全组
aliyun ecs DescribeInstances --RegionId cn-beijing --InstanceIds '["<i-xxx>"]' \
  --output cols=InstanceId,SecurityGroupIds.SecurityGroupId rows=Instances.Instance[]

# 查现有规则（核对是否有多余放行）
aliyun ecs DescribeSecurityGroupAttribute --RegionId cn-beijing --SecurityGroupId <sg-xxx> \
  --output cols=IpProtocol,PortRange,SourceCidrIp,Policy rows=Permissions.Permission[]

# 只放行 22/80/443
for p in 22/22 80/80 443/443; do
  aliyun ecs AuthorizeSecurityGroup --RegionId cn-beijing --SecurityGroupId <sg-xxx> \
    --IpProtocol tcp --PortRange $p --SourceCidrIp 0.0.0.0/0 --Policy accept
done

# 若存在 9000/9001/5432/3306 等多余规则，逐条撤销（§8 要求）
aliyun ecs RevokeSecurityGroup --RegionId cn-beijing --SecurityGroupId <sg-xxx> \
  --IpProtocol tcp --PortRange 9000/9000 --SourceCidrIp 0.0.0.0/0
```

### 10.2 aliyun CLI：DNS 五条 A 记录（对应 §3）

```bash
IP=REDACTED-IP
# 查现有记录（确认哪些缺失）
aliyun alidns DescribeDomainRecords --DomainName tzjii.com \
  --output cols=RecordId,RR,Type,Value,TTL rows=DomainRecords.Record[]

# 补齐五条（裸域 @ + 四个子域）；已存在的改用 UpdateDomainRecord
for rr in @ www admin api static; do
  aliyun alidns AddDomainRecord --DomainName tzjii.com \
    --RR "$rr" --Type A --Value $IP --TTL 600
done

# 改已有记录的值
aliyun alidns UpdateDomainRecord --RecordId <record-id> --RR www --Type A --Value $IP --TTL 600

# 验证（等 TTL 生效）
for h in tzjii.com www.tzjii.com admin.tzjii.com api.tzjii.com static.tzjii.com; do
  echo -n "$h -> "; dig +short $h @223.5.5.5
done
```

### 10.3 aliyun CLI：acme DNS-01 专用 RAM 子账号（对应 §3、§8）

```bash
aliyun ram CreateUser --UserName tzj-acme-dns
aliyun ram CreateAccessKey --UserName tzj-acme-dns      # 输出的 AK/SK → .env.prod.local 的 ALI_KEY/ALI_SECRET
aliyun ram AttachPolicyToUser --UserName tzj-acme-dns \
  --PolicyType System --PolicyName AliyunDNSFullAccess   # 仅 DNS 权限，不给其他
```

### 10.4 aliyun CLI：备份基础设施（对应 §7）

```bash
# 归档型 OSS bucket（存 pg_dump + MinIO 镜像）
# ⚠️ oss 子命令需 AK 凭证，OAuth profile 不支持 → 显式指定 AK profile
aliyun oss mb oss://tzj-prod-backup --acl private --storage-class Archive \
  -e oss-cn-beijing.aliyuncs.com --profile default

# 每日系统盘自动快照，保留 7 天（参数名大小写以 --help 为准）
aliyun ecs CreateAutoSnapshotPolicy --RegionId cn-beijing \
  --autoSnapshotPolicyName tzj-daily --timePoints '["2"]' \
  --repeatWeekdays '["1","2","3","4","5","6","7"]' --retentionDays 7
aliyun ecs ApplyAutoSnapshotPolicy --RegionId cn-beijing \
  --autoSnapshotPolicyId <asp-xxx> --diskIds '["<d-xxx>"]'

# 开自动续费，防到期释放（§2）
aliyun ecs ModifyInstanceAutoRenewAttribute --RegionId cn-beijing \
  --InstanceId <i-xxx> --RenewalStatus AutoRenewal --Duration 12 --PeriodUnit Month
```

> 云监控告警规则（CPU/内存/磁盘）用 `aliyun cms PutResourceMetricRule` 亦可，但参数繁琐且需先建联系人组；此项**允许走控制台**，属一次性配置。

### 10.5 GitHub CLI：仓库配置（对应 §5.2）

```bash
gh repo view --json visibility,defaultBranchRef    # 确认 private + main

# Vars（非敏感）
gh variable set ACR_REGISTRY  --body "crpi-xxx.cn-beijing.personal.cr.aliyuncs.com"
gh variable set ACR_NAMESPACE --body "<命名空间>"
gh variable set ECS_HOST      --body "REDACTED-IP"   # 必须公网 IP：Runner 不在私网内
gh variable set ECS_USER      --body "deploy"
gh variable set NEXT_PUBLIC_API_URL         --body "https://api.tzjii.com/api/v1"
gh variable set NEXT_PUBLIC_ADMIN_API_URL   --body "https://api.tzjii.com/api/v1"
gh variable set NEXT_PUBLIC_S3_PUBLIC_DOMAIN --body "https://static.tzjii.com/tzj-uploads-prod"
gh variable set NEXT_PUBLIC_SITE_URL        --body "https://www.tzjii.com"
gh variable set NEXT_PUBLIC_WEB_URL         --body "https://www.tzjii.com"

# Secrets（敏感；私钥用文件重定向，避免进 shell 历史）
gh secret set ECS_SSH_KEY < ~/.ssh/tzj_deploy
gh secret set ACR_USERNAME
gh secret set ACR_PASSWORD          # 不带 --body 时交互式粘贴，不留痕

gh variable list && gh secret list   # 与 §5.2 清单逐项核对
```

**生产环境审批闸门（§5.2 建议项）**

```bash
gh api -X PUT repos/zzlw/tzj-website/environments/production \
  -F 'reviewers[][type]=User' -F "reviewers[][id]=$(gh api user --jq .id)"
```

### 10.6 GitHub CLI：部署与回滚（对应 §5.1、回滚预案）

```bash
# 首次上线（Vars/Secrets 配好后手动触发）
gh workflow run deploy.yml --ref main
gh run watch                                  # 实时跟踪
gh run list --workflow=deploy.yml --limit 5
gh run view --log-failed                      # 失败时只看错误日志

# 日常发布：合并 PR 即自动部署（docs/**、*.md 除外）
gh pr create --base main --title "..." --body "..."
gh pr checks                                  # 等 CI 绿灯
gh pr merge --squash

# 回滚：指定上一个可用 sha
gh run list --workflow=deploy.yml --status success --limit 5 --json headSha,createdAt
gh workflow run deploy-ssh.yml -f service=all -f tag=<上一个 sha>
```

### 10.7 服务器侧运维（经 SSH 别名，无需登录控制台）

```bash
# 日常运维经 /opt/tzj/Makefile（PROD 宏已封装双 --env-file，裸 docker compose 会因 :?required 插值报错）
ssh tzj-prod 'make -C /opt/tzj prod-status'
ssh tzj-prod 'make -C /opt/tzj prod-logs'
ssh tzj-prod 'free -h && df -h / && docker stats --no-stream'

# 系统初始化脚本一次性下发（§6.1 步骤 3）
ssh tzj-prod-root 'bash -s' < infra/docker/setup-docker-mirror.sh

# 上线验收
curl -sI https://www.tzjii.com | head -1
curl -s https://api.tzjii.com/api/v1/health
```

### 10.8 执行顺序速查（与 §9 对应）

| §9 任务 | 主要 CLI 动作 |
|---------|--------------|
| 1 重装系统 + 解析 | §10.0 路径 A（ImportKeyPair → ReplaceSystemDisk）+ §10.2 DNS + §10.1 安全组 |
| 2 系统初始化 | §10.7 下发 `setup-docker-mirror.sh`，其余按 §6.1 在 `ssh tzj-prod-root` 内执行 |
| 3 infra 改造 PR | `gh pr create` → `gh pr checks` → `gh pr merge --squash` |
| 4 环境文件 + 证书 | `scp` 环境文件 → `ssh tzj-prod` 按 §6.3 步骤 2–4：`make -C /opt/tzj cert-selfsigned acme-build infra-up cert-issue gateway-reload` |
| 5 MinIO 初始化 + 媒体同步 | `ssh tzj-prod` 执行 §4.4 的 mc 命令 → 本机执行 §4.5.2 的 mc mirror |
| 6 首次上线 | §10.5 配 Vars/Secrets → §10.6 `gh workflow run` |
| 7 内容数据导入 | 本机按 §4.5.1：pg_dump → sed 前缀改写 → scp → 生产 psql 导入 |
| 8 备份运维闭环 | §10.3 RAM 子账号 + §10.4 OSS bucket / 快照 / 自动续费 |

---

## 回滚预案

- 应用回滚：Actions → `Deploy ECS (SSH)` → 选服务 + 输入上一个可用 git sha
- 数据库回滚：`migrate deploy` 失败时部署脚本已中断（不会更新应用），必要时从每日备份恢复
- 全机故障：新 ECS 按 §6 重建（<1h），数据从快照 + pg 备份 + MinIO 镜像恢复
