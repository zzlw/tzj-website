# TZJ 官网 CI/CD 部署方案（阿里云 + Docker + GitHub Actions + ACME）

本文档描述 **tzj-website-reconstruction** monorepo 在阿里云上的持续集成与持续部署方案：

- **计算**：阿里云 ECS + Docker Compose
- **数据库**：阿里云 RDS PostgreSQL（推荐，或 ECS 自建）
- **对象存储**：阿里云 OSS（S3 兼容，应用零代码切换）
- **镜像仓库**：阿里云 ACR
- **CI/CD**：GitHub Actions（仓库 [`zzlw/tzj-website`](https://github.com/zzlw/tzj-website)）
- **HTTPS 证书**：ACME 协议（Let's Encrypt + acme.sh + 阿里云 DNS）

---

## 0. 本项目生产环境（jiawen.live）

> 以下为 **2026-07-05** 确定的生产配置，后续部署以此为准。

### 0.1 服务器

| 项 | 值 |
|----|-----|
| **ECS 公网 IP** | `REDACTED-IP` |
| **SSH** | `root@REDACTED-IP`（本机已配置免密登录） |
| **地域** | 华北 2（北京）`cn-beijing` |
| **部署目录（建议）** | `/opt/tzj/` |

```bash
ssh root@REDACTED-IP
```

### 0.2 域名

根域名 **`jiawen.live`** 托管在阿里云 DNS（DomainId: `3a93d6851f7543a2a16fbcb7ed7066b4`）。

| 用途 | 域名 | 解析类型 | 目标 |
|------|------|----------|------|
| **C 端官网** | `tzj.jiawen.live` | A | `REDACTED-IP` |
| **B 端后台** | `tzj-admin.jiawen.live` | A | `REDACTED-IP` |
| **API** | `tzj-api.jiawen.live` | A | `REDACTED-IP` |
| **OSS 静态资源** | `tzj-static.jiawen.live` | CNAME | `tzj-media-static-assets.oss-cn-beijing.aliyuncs.com` |

### 0.3 OSS 对象存储

| 项 | 值 |
|----|-----|
| **Bucket** | `tzj-media-static-assets` |
| **地域** | `oss-cn-beijing` |
| **Endpoint** | `https://oss-cn-beijing.aliyuncs.com` |
| **公开访问域名** | `https://tzj-static.jiawen.live` |
| **直连 OSS（备用）** | `https://tzj-media-static-assets.oss-cn-beijing.aliyuncs.com` |

Bucket 内目录（与代码约定一致）：

```
tzj-media-static-assets/
├── content/     # 站点静态（sync-content-media 同步目标）
├── uploads/     # 后台媒体库上传
└── cms/         # 正文内嵌媒体
```

### 0.4 应用 URL 一览

| 变量 | 生产值 |
|------|--------|
| `WEB_URL` | `https://tzj.jiawen.live` |
| `ADMIN_URL` | `https://tzj-admin.jiawen.live` |
| `NEXT_PUBLIC_SITE_URL` | `https://tzj.jiawen.live` |
| `NEXT_PUBLIC_WEB_URL` | `https://tzj.jiawen.live` |
| `NEXT_PUBLIC_API_URL` | `https://tzj-api.jiawen.live/api/v1` |
| `NEXT_PUBLIC_ADMIN_API_URL` | `https://tzj-api.jiawen.live/api/v1` |
| `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` | `https://tzj-static.jiawen.live` |
| `S3_PUBLIC_DOMAIN` | `https://tzj-static.jiawen.live` |
| `CORS_ORIGINS` | `https://tzj.jiawen.live,https://tzj-admin.jiawen.live` |

### 0.5 ECS Docker 加速器（必做）

国内 ECS 拉取 Docker Hub 镜像较慢，**必须先配置阿里云镜像加速器**（控制台「容器镜像服务 → 镜像工具 → 镜像加速器」获取专属地址）。

当前服务器 `REDACTED-IP` 已配置：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://bxkt6ohk.mirror.aliyuncs.com"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

一键脚本：[`infra/docker/setup-docker-mirror.sh`](../infra/docker/setup-docker-mirror.sh)

验证：

```bash
docker info | grep -A2 "Registry Mirrors"
# 应显示 https://bxkt6ohk.mirror.aliyuncs.com/
```

> **说明**：加速器仅加速 Docker Hub（`postgres:15-alpine` 等基础镜像）。**应用镜像在 GitHub Actions 构建并 push 到阿里云 ACR（北京，与 ECS 同区域）**，ECS 只做 `docker pull + compose up`。

### 0.6 国内最佳实践：Actions 构建 + ACR 同区域拉取

| 环节 | 做法 |
|------|------|
| **构建** | GitHub Actions（海外 Runner，网络稳定） |
| **镜像仓库** | ACR 个人版 `REDACTED-ACR/tzj` |
| **ECS** | 只 pull + run；Docker Hub 基础镜像走加速器 |
| **静态资源** | OSS（不进镜像） |

```text
push main → Actions build-push → REDACTED-ACR/tzj/tzj-{web,admin,api}
          → SSH ECS → docker login ACR → pull → migrate → up
```

Workflow：

- CI 校验：`.github/workflows/ci.yml`（PR 仅 build 校验，不 push）
- 生产部署：`.github/workflows/deploy.yml`（build-push ACR + SSH deploy）

ACR 初始化：[`infra/aliyun/setup-acr.sh`](../infra/aliyun/setup-acr.sh)

GitHub Secrets（必配）：

| Secret | 说明 |
|--------|------|
| `ACR_USERNAME` | 阿里云登录名（邮箱/手机号） |
| `ACR_PASSWORD` | ACR 控制台「访问凭证 → 固定密码」 |

GitHub Variables（已配 / 脚本写入）：

| Variable | 值 |
|----------|-----|
| `ACR_REGISTRY` | `REDACTED-ACR` |
| `ACR_INSTANCE_ID` | `REDACTED-ACR` |
| `ACR_NAMESPACE` | `tzj` |
| `IMAGE_REGISTRY` | `REDACTED-ACR/tzj` |

---

## 1. 架构总览

```
                    ┌─────────────────────────────────────┐
                    │   GitHub Actions (zzlw/tzj-website) │
                    │  lint → typecheck → build → docker  │
                    │  → push ACR → sync OSS → SSH deploy │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │  ACR registry.cn-beijing.aliyuncs.com │
                    │  tzj-web / tzj-admin / tzj-api        │
                    └─────────────────┬───────────────────┘
                                      │ docker pull
                    ┌─────────────────▼───────────────────┐
                    │  ECS REDACTED-IP (cn-beijing)       │
                    │  Nginx + ACME → tzj*.jiawen.live      │
                    │  web:3000 / admin:3002 / api:4000     │
                    └─────────┬───────────────┬─────────────┘
                              │               │
                    ┌─────────▼─────┐  ┌──────▼────────────────────┐
                    │  PostgreSQL   │  │  OSS tzj-media-static-assets│
                    └───────────────┘  │  tzj-static.jiawen.live   │
                                       └───────────────────────────┘
```

### 设计原则

| 原则 | 说明 |
|------|------|
| 镜像不进 Git | ECS 只拉 ACR 镜像，不在服务器上 build |
| 静态资源只走 OSS | 图片/视频/二维码统一存 OSS，C 端通过 `S3_PUBLIC_DOMAIN` 访问 |
| 迁移与启动分离 | `prisma migrate deploy` 在部署流程中单独执行 |
| 构建时注入 public env | Next.js 的 `NEXT_PUBLIC_*` 必须在 **docker build** 阶段传入 |
| 证书 ACME 自动续期 | acme.sh + 阿里云 DNS API，cron 续期并 reload Nginx |

---

## 2. 阿里云 CLI：OSS + DNS 初始化

本机已安装 **阿里云 CLI**（`aliyun version`）。一键脚本：

```bash
# 仓库根目录
chmod +x infra/aliyun/setup-oss-dns.sh
./infra/aliyun/setup-oss-dns.sh
```

脚本路径：[`infra/aliyun/setup-oss-dns.sh`](../infra/aliyun/setup-oss-dns.sh)

### 2.1 脚本会做什么

1. 创建 Bucket `tzj-media-static-assets`（已存在则跳过）
2. 写入 CORS（[`infra/aliyun/oss-cors.xml`](../infra/aliyun/oss-cors.xml)）
3. 配置 `content/`、`uploads/`、`cms/` 公共读策略
4. 添加 DNS 解析（见 §0.2）

### 2.2 手动命令（与脚本等价）

**创建 Bucket：**

```bash
aliyun oss mb oss://tzj-media-static-assets \
  --storage-class Standard \
  --acl private
```

**DNS — C 端 / 后台 / API（A 记录 → ECS）：**

```bash
ECS_IP=REDACTED-IP
DOMAIN=jiawen.live

for rr in tzj tzj-admin tzj-api; do
  aliyun alidns AddDomainRecord \
    --DomainName "$DOMAIN" \
    --RR "$rr" \
    --Type A \
    --Value "$ECS_IP" \
    --TTL 600
done
```

**DNS — OSS 静态域名（CNAME）：**

```bash
aliyun alidns AddDomainRecord \
  --DomainName jiawen.live \
  --RR tzj-static \
  --Type CNAME \
  --Value tzj-media-static-assets.oss-cn-beijing.aliyuncs.com \
  --TTL 600
```

**验证：**

```bash
dig +short tzj.jiawen.live
dig +short tzj-static.jiawen.live
aliyun oss ls oss://tzj-media-static-assets/
aliyun alidns DescribeDomainRecords --DomainName jiawen.live --RRKeyWord tzj
```

### 2.3 OSS 自定义域名绑定

DNS CNAME 生效后，在 **OSS 控制台** → Bucket `tzj-media-static-assets` → **传输管理** → **绑定域名** → 添加 `tzj-static.jiawen.live`（需 ICP 备案域名）。

未绑定自定义域名前，可临时使用直连 OSS URL 作为 `S3_PUBLIC_DOMAIN`。

---

## 3. GitHub Actions 环境变量

仓库：**`zzlw/tzj-website`**

本机已用 **GitHub CLI** 写入以下配置（`gh variable list` / `gh secret list` 可查看）。

### 3.1 Repository Variables（已配置 ✅）

| 变量名 | 值 |
|--------|-----|
| `ECS_HOST` | `REDACTED-IP` |
| `ECS_USER` | `root` |
| `ACR_REGISTRY` | `REDACTED-ACR` |
| `ACR_INSTANCE_ID` | `REDACTED-ACR` |
| `ACR_NAMESPACE` | `tzj` |
| `IMAGE_REGISTRY` | `REDACTED-ACR/tzj` |
| `S3_BUCKET` | `tzj-media-static-assets` |
| `S3_REGION` | `oss-cn-beijing` |
| `S3_ENDPOINT` | `https://oss-cn-beijing.aliyuncs.com` |
| `S3_PUBLIC_DOMAIN` | `https://tzj-static.jiawen.live` |
| `WEB_URL` | `https://tzj.jiawen.live` |
| `ADMIN_URL` | `https://tzj-admin.jiawen.live` |
| `CORS_ORIGINS` | `https://tzj.jiawen.live,https://tzj-admin.jiawen.live` |
| `NEXT_PUBLIC_API_URL` | `https://tzj-api.jiawen.live/api/v1` |
| `NEXT_PUBLIC_ADMIN_API_URL` | `https://tzj-api.jiawen.live/api/v1` |
| `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` | `https://tzj-static.jiawen.live` |
| `NEXT_PUBLIC_SITE_URL` | `https://tzj.jiawen.live` |
| `NEXT_PUBLIC_WEB_URL` | `https://tzj.jiawen.live` |

### 3.2 Repository Secrets（已配置 ✅）

| Secret | 说明 |
|--------|------|
| `ECS_HOST` | `REDACTED-IP` |
| `ECS_USER` | `root` |
| `ECS_SSH_KEY` | 本机 SSH 私钥（免密登录同一 key） |
| `S3_ACCESS_KEY_ID` | 阿里云 RAM AccessKey（与 CLI 同账号） |
| `S3_ACCESS_KEY_SECRET` | 阿里云 RAM Secret |
| `S3_BUCKET` | `tzj-media-static-assets` |
| `S3_ENDPOINT` | `https://oss-cn-beijing.aliyuncs.com` |
| `S3_PUBLIC_DOMAIN` | `https://tzj-static.jiawen.live` |
| `S3_REGION` | `oss-cn-beijing` |

### 3.3 待手动补充的 Secrets

| Secret | 说明 |
|--------|------|
| `DATABASE_URL` | RDS / ECS PostgreSQL 连接串 |
| `JWT_SECRET` | 至少 16 字符随机串 |
| `SECRETS_ENCRYPTION_KEY` | 至少 32 字符 |
| `ACR_USERNAME` | 阿里云登录名（邮箱/手机号） |
| `ACR_PASSWORD` | ACR 控制台固定密码 |

**写入命令示例：**

```bash
REPO=zzlw/tzj-website

# 待填真实值
gh secret set DATABASE_URL --body "postgresql://..." -R "$REPO"
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)" -R "$REPO"
gh secret set SECRETS_ENCRYPTION_KEY --body "$(openssl rand -base64 32)" -R "$REPO"
gh secret set ACR_USERNAME --body "<阿里云登录名>" -R "$REPO"
gh secret set ACR_PASSWORD --body "<ACR固定密码>" -R "$REPO"
```

**批量更新 Variable：**

```bash
gh variable set NEXT_PUBLIC_API_URL \
  --body "https://tzj-api.jiawen.live/api/v1" -R zzlw/tzj-website
```

---

## 4. 环境变量（ECS `.env.prod`）

在 ECS `/opt/tzj/.env.prod` 维护（**勿提交 Git**）：

```bash
# 镜像（ACR 同区域）
IMAGE_REGISTRY=registry.cn-beijing.aliyuncs.com/tzj
IMAGE_TAG=latest

# 数据库
DATABASE_URL=postgresql://user:pass@<host>:5432/tzj_prod?schema=public

# API
API_PORT=4000
NODE_ENV=production
JWT_SECRET=<随机串>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
SECRETS_ENCRYPTION_KEY=<32+ 字符>
CORS_ORIGINS=https://tzj.jiawen.live,https://tzj-admin.jiawen.live
THROTTLE_TTL=60
THROTTLE_LIMIT=120

# 站点 URL
WEB_URL=https://tzj.jiawen.live
ADMIN_URL=https://tzj-admin.jiawen.live
NEXT_PUBLIC_WEB_URL=https://tzj.jiawen.live
NEXT_PUBLIC_SITE_URL=https://tzj.jiawen.live
NEXT_PUBLIC_API_URL=https://tzj-api.jiawen.live/api/v1
NEXT_PUBLIC_ADMIN_API_URL=https://tzj-api.jiawen.live/api/v1

# OSS（S3 兼容）
S3_BUCKET=tzj-media-static-assets
S3_REGION=oss-cn-beijing
S3_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
S3_ACCESS_KEY_ID=<RAM Key>
S3_ACCESS_KEY_SECRET=<RAM Secret>
S3_PUBLIC_DOMAIN=https://tzj-static.jiawen.live
NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://tzj-static.jiawen.live
```

---

## 5. 分支与环境

| 分支 | 环境 | 触发 | 镜像 Tag |
|------|------|------|----------|
| `develop` | staging | push | `staging-<short-sha>` |
| `main` | production | push | `prod-<short-sha>`、`latest` |
| PR | — | pull_request | 仅 CI，不部署 |

---

## 6. CI 流水线

现有 workflow：`.github/workflows/ci.yml`。

### 6.1 Job：`quality`

```text
checkout → pnpm install → pnpm check → pnpm typecheck → pnpm build
```

### 6.2 Job：`prisma-check`（PR 必过）

```bash
cd apps/api
pnpm exec prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --exit-code
```

### 6.3 Job：`docker-build-push`（main）

**Next.js build-args（生产）：**

```yaml
build-args: |
  NEXT_PUBLIC_API_URL=https://tzj-api.jiawen.live/api/v1
  NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://tzj-static.jiawen.live
  NEXT_PUBLIC_SITE_URL=https://tzj.jiawen.live
  NEXT_PUBLIC_WEB_URL=https://tzj.jiawen.live
  NEXT_PUBLIC_ADMIN_API_URL=https://tzj-api.jiawen.live/api/v1
```

推送 ACR：

```text
registry.cn-beijing.aliyuncs.com/<namespace>/tzj-web:<tag>
registry.cn-beijing.aliyuncs.com/<namespace>/tzj-admin:<tag>
registry.cn-beijing.aliyuncs.com/<namespace>/tzj-api:<tag>
```

---

## 7. CD 部署流水线

### 7.1 部署顺序

```text
1. 构建并 push 三镜像到 ACR
2. pnpm prisma:sync:static-media → OSS content/
3. SSH root@REDACTED-IP
4. docker compose pull
5. prisma migrate deploy
6. 滚动更新：api → admin → web
7. Smoke test
```

### 7.2 生产 Compose

`infra/docker/docker-compose.prod.yml`（ECS 复制到 `/opt/tzj/`）：

```yaml
services:
  api:
    image: ${ACR_REGISTRY}/${ACR_NAMESPACE}/tzj-api:${IMAGE_TAG}
    env_file: .env.prod
    ports: ["127.0.0.1:4000:4000"]
    restart: unless-stopped

  web:
    image: ${ACR_REGISTRY}/${ACR_NAMESPACE}/tzj-web:${IMAGE_TAG}
    ports: ["127.0.0.1:3000:3000"]
    restart: unless-stopped

  admin:
    image: ${ACR_REGISTRY}/${ACR_NAMESPACE}/tzj-admin:${IMAGE_TAG}
    ports: ["127.0.0.1:3002:3000"]
    restart: unless-stopped
```

### 7.3 静态资源同步

```bash
pnpm --filter @tzj/api prisma:sync:static-media
pnpm --filter @tzj/api prisma:sync:static-media -- --force
```

---

## 8. HTTPS：ACME 证书（jiawen.live）

在 **ECS** 上执行，使用 acme.sh + 阿里云 DNS API（DNS-01）。

### 8.1 安装

```bash
curl https://get.acme.sh | sh -s email=ops@jiawen.live
source ~/.bashrc
```

### 8.2 阿里云 DNS API

使用与 OSS 相同的 RAM AccessKey（需 DNS 修改权限）：

```bash
export Ali_Key="<AccessKeyId>"
export Ali_Secret="<AccessKeySecret>"
```

### 8.3 申请证书（三域名一张证）

```bash
acme.sh --issue --dns dns_ali \
  -d tzj.jiawen.live \
  -d tzj-admin.jiawen.live \
  -d tzj-api.jiawen.live \
  --keylength ec-256
```

### 8.4 安装到 Nginx

```bash
acme.sh --install-cert -d tzj.jiawen.live --ecc \
  --key-file       /etc/nginx/ssl/jiawen.live.key \
  --fullchain-file /etc/nginx/ssl/jiawen.live.cer \
  --reloadcmd     "nginx -s reload"
```

### 8.5 Nginx 配置

`/etc/nginx/conf.d/tzj.conf`：

```nginx
server {
    listen 80;
    server_name tzj.jiawen.live tzj-admin.jiawen.live tzj-api.jiawen.live;
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name tzj.jiawen.live;
    ssl_certificate     /etc/nginx/ssl/jiawen.live.cer;
    ssl_certificate_key /etc/nginx/ssl/jiawen.live.key;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name tzj-admin.jiawen.live;
    ssl_certificate     /etc/nginx/ssl/jiawen.live.cer;
    ssl_certificate_key /etc/nginx/ssl/jiawen.live.key;
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name tzj-api.jiawen.live;
    ssl_certificate     /etc/nginx/ssl/jiawen.live.cer;
    ssl_certificate_key /etc/nginx/ssl/jiawen.live.key;
    client_max_body_size 100m;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 8.6 OSS 静态域名证书

`tzj-static.jiawen.live` 指向 OSS，HTTPS 在 **OSS 控制台** 或 **CDN** 申请免费证书，与 ECS 证书独立。应用层只需 `S3_PUBLIC_DOMAIN=https://tzj-static.jiawen.live`。

---

## 9. GitHub Actions Deploy 骨架

```yaml
# .github/workflows/deploy.yml
name: Deploy to Aliyun ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11.9.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile

      - name: Sync static media to OSS
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          S3_BUCKET: ${{ vars.S3_BUCKET }}
          S3_ENDPOINT: ${{ vars.S3_ENDPOINT }}
          S3_REGION: ${{ vars.S3_REGION }}
          S3_ACCESS_KEY_ID: ${{ secrets.S3_ACCESS_KEY_ID }}
          S3_ACCESS_KEY_SECRET: ${{ secrets.S3_ACCESS_KEY_SECRET }}
          S3_PUBLIC_DOMAIN: ${{ vars.S3_PUBLIC_DOMAIN }}
        run: pnpm --filter @tzj/api prisma:sync:static-media

      - name: Deploy to ECS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ vars.ECS_HOST }}
          username: ${{ vars.ECS_USER }}
          key: ${{ secrets.ECS_SSH_KEY }}
          script: |
            export IMAGE_TAG=${{ github.sha }}
            /opt/tzj/deploy.sh
```

---

## 10. Docker 改造清单

| 项 | 目标 |
|----|------|
| web/admin Dockerfile | 增加 `NEXT_PUBLIC_*` build-args |
| API Dockerfile | healthcheck 端口改为 4000 |
| `docker-compose.prod.yml` | 新增 |
| `deploy.yml` | 新增 |
| `.env.prod.example` | 新增（不含密钥） |

本地验证构建：

```bash
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://tzj-api.jiawen.live/api/v1 \
  --build-arg NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://tzj-static.jiawen.live \
  --build-arg NEXT_PUBLIC_SITE_URL=https://tzj.jiawen.live \
  -t tzj/web:local .
```

---

## 11. 实施路线图

### Phase 1 — 基础设施

- [x] ECS `REDACTED-IP`，SSH 免密
- [x] OSS Bucket `tzj-media-static-assets`
- [x] GitHub Variables / 部分 Secrets
- [x] 执行 `./infra/aliyun/setup-oss-dns.sh` 完成 DNS
- [ ] OSS 绑定 `tzj-static.jiawen.live`
- [x] ECS：Docker + 阿里云加速器 + Nginx
- [ ] ECS：acme.sh 证书
- [ ] PostgreSQL（Compose 内置 / RDS）
- [ ] ACR 命名空间 + 固定密码 + GitHub Secrets
- [ ] push main → ACR 镜像 + 首次 deploy

### Phase 2 — 镜像与 Compose

- [x] Dockerfile build-args
- [x] `docker-compose.prod.yml` + `deploy.sh`
- [x] `.github/workflows/deploy.yml`（Actions 构建 → push ACR → ECS pull）
- [ ] 配置 `ACR_USERNAME` / `ACR_PASSWORD` + push main 触发首次部署

### Phase 3 — CD

- [ ] `deploy.yml` + `/opt/tzj/deploy.sh`
- [ ] migrate + sync + smoke test（随 deploy workflow 自动）

---

## 12. 仓库对照

| 能力 | 路径 |
|------|------|
| CI | `.github/workflows/ci.yml` |
| OSS/DNS 脚本 | `infra/aliyun/setup-oss-dns.sh` |
| OSS CORS | `infra/aliyun/oss-cors.xml` |
| 静态 sync | `pnpm --filter @tzj/api prisma:sync:static-media` |
| 部署脚本 | `infra/docker/deploy.sh` |
| Docker 加速器 | `infra/docker/setup-docker-mirror.sh` |
| ACR 初始化 | `infra/aliyun/setup-acr.sh` |

---

## 13. 相关文档

- [Admin CMS 规划](./admin-cms-plan.md)
- [API 说明](./api/README.md)
- 对象存储约定 — 根目录 `AGENTS.md`

---

*文档版本：2026-07-05 · 生产域名 jiawen.live · ECS REDACTED-IP*
