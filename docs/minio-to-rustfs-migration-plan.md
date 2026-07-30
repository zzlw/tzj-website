# MinIO → RustFS 迁移方案

> 状态：方案评审稿（未实施）
> 日期：2026-07-30
> 范围：本地开发环境（docker-compose.dev.yml）+ 生产环境（阿里云 ECS 单机 compose）
> 关联文档：`docs/deployment-plan.md`（§4 MinIO 生产化改造）、AGENTS.md「对象存储规范」

---

## 1. 背景与动机

### 1.1 现状

项目当前以 **MinIO** 作为唯一对象存储（dev / prod 对齐），通过 `@aws-sdk/client-s3` 走 S3 兼容协议：

- **dev**：`minio/minio:latest`，`localhost:9000`（API）+ `9001`（Console），root 凭证 `minioadmin`
- **prod**：`minio/minio:RELEASE.2025-04-22T22-12-26Z`（锁版本），仅 compose 内网 `minio:9000`，经 nginx 反代对外暴露为 `https://static.tzjii.com`，不开 Console
- **应用层**：全部收口在 `apps/api/src/storage/s3.service.ts`，纯 S3 API 调用，代码中无 MinIO 专有 SDK

### 1.2 为什么换 RustFS

| 维度 | MinIO | RustFS |
|------|-------|--------|
| 协议 | AGPL v3（商用限制强，社区版功能持续裁剪，Web Console 已被砍到只剩基础功能） | Apache 2.0（宽松，无传染性） |
| 语言/运行时 | Go（GC，IAM/admin 操作内存瞬时冲高，生产实测 256m 会被 cgroup 杀，被迫给 512m） | Rust（无 GC，内存占用更低更平稳，对 2C2G 生产机是实际收益） |
| S3 兼容 | 事实标准 | 定位即 MinIO drop-in replacement，S3 API + MinIO 兼容 admin API |
| 社区走向 | 社区版进入维护收缩期，功能向付费 AIStor 迁移 | 活跃开发中（GitHub 30k+ star），但**截至本文撰写最新版为 1.0.0-beta.12，尚未 GA** |

**核心风险先亮出来**：RustFS 仍处于 beta。因此本方案采用**两阶段策略**——先切 dev 验证跑一个观察期，生产切换设置明确的准入门槛（见 §8）。

---

## 2. 可行性评估

### 2.1 项目实际使用的 S3 API vs RustFS 支持情况

`S3Service` 用到的全部 API（逐一核对自 `apps/api/src/storage/s3.service.ts`）：

| API | 用途 | RustFS 支持 |
|-----|------|-------------|
| PutObject / GetObject / DeleteObject / CopyObject | 上传、下载（水印 Logo）、删除、站点资源替换备份 | ✅ |
| HeadBucket / HeadObject | 健康探针 `ping()`、`exists()` | ✅ |
| CreateBucket | dev 自动建桶 | ✅ |
| ListObjectsV2 | `list(prefix)` | ✅ |
| PutBucketPolicy | dev 自动设整桶匿名读 | ✅（无条件整桶匿名策略已验证可用；官方 issue #1874 确认对象级 ACL / tag 条件策略暂不支持，**本项目未用到**） |
| GetObject / PutObject 预签名 URL | 私有文件临时访问、浏览器直传 | ✅（标准 SigV4 预签名） |

结论：**应用代码零改动**。`forcePathStyle` 判定逻辑（`S3_FORCE_PATH_STYLE === 'true' || endpoint 含 localhost/minio`）在 dev（localhost 端点）和 prod（显式开关已置 true）下均不依赖 `minio` 字符串，服务改名不影响。

### 2.2 运维面差异对照

| 项目 | MinIO | RustFS | 迁移动作 |
|------|-------|--------|---------|
| root 凭证 | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY` | 改 compose + `.env.prod` 变量名 |
| API 端口 | 9000 | 9000（一致） | 无 |
| Console | 9001（`--console-address`） | 9001（`RUSTFS_CONSOLE_ENABLE=true`） | dev 保留、prod 维持关闭 |
| 健康检查 | `GET /minio/health/live` | `GET /health` | 改 compose healthcheck |
| CORS | `MINIO_API_CORS_ALLOW_ORIGIN/METHODS/HEADERS`（全局 env） | `RUSTFS_CORS_ALLOWED_ORIGINS`（全局 env，仅 origin 维度，逗号分隔；Console 另有独立变量） | 改 env 变量名；方法/头粒度消失，需实测预签名 PUT 直传（验证清单 §7） |
| IAM 用户/策略 | `mc admin user add` + `mc admin policy attach` | 内置 IAM（MinIO 兼容 admin API：add-user、policy attach、内置 `readwrite` 等 canned policy），可用 Console、官方 CLI `rc`，`mc admin` 大部分兼容 | 初始化脚本微调（§5.4），若个别 mc admin 命令被拒则换 `rc` |
| 匿名读 | `mc anonymous set download` | 同为 S3 PutBucketPolicy，`mc anonymous` 走 S3 API 可继续用 | 无 |
| 数据目录 | `/data` | `/data`（一致，镜像默认 `RUSTFS_VOLUMES=/data`） | RustFS 自 1.0.0-alpha.89 起官方支持**原地复用** MinIO 数据目录（rustfs/rustfs#2212），但本方案主动选择对象级迁移（§5.5）——旧 volume 全程只读，保留零风险回滚窗口 |
| 镜像 | `minio/minio` | `rustfs/rustfs`（锁定具体版本 tag，生产禁 latest） | 换镜像 |

### 2.3 不变量（迁移红线）

以下三项**绝对不变**，保证数据库中存量 URL、前端构建产物、SEO 收录全部无感：

1. **Bucket 名不变**：dev `tzj-uploads-dev`、prod `tzj-uploads-prod`（URL path-style 中含桶名）
2. **公开域名不变**：`S3_PUBLIC_DOMAIN` / `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` 原值保留
3. **端口与反代拓扑不变**：compose 内网 9000、nginx `static.tzjii.com` 反代逻辑不动（仅 upstream 服务名替换）

---

## 3. 影响面盘点

### 3.1 必改文件

| 文件 | 改动 |
|------|------|
| `infra/docker/docker-compose.dev.yml` | 新增 rustfs 服务，**与 minio 并存**（镜像、env、healthcheck、新 volume）；观察期结束后再删 minio 服务块 |
| `infra/docker/docker-compose.prod.yml` | 同上 + `api.depends_on` 服务名 |
| `infra/docker/nginx/templates/tzj.conf.template` | `set $upstream_minio minio:9000` → `set $upstream_rustfs rustfs:9000`（同文件近期有灵犀 SSE 的 `proxy_read_timeout` 改动落在 admin server block，与本方案改的 static block 不冲突，但实施 PR 前先合并/落地该改动，避免模板双头修改） |
| `infra/docker/.env.prod.example`（及服务器上 `.env.prod`） | `MINIO_ROOT_*` → `RUSTFS_ACCESS_KEY/SECRET_KEY`；S3 段不变 |
| `infra/docker/Makefile` | `up -d --no-deps postgres minio acme gateway` 中服务名 |
| ECS crontab 备份任务（服务器现场，不在仓库内） | deployment-plan.md §7 的每周 `mc mirror` MinIO→OSS 归档桶（`tzj-prod-backup`）：alias 端点 `minio:9000`→`rustfs:9000`、凭证换 `RUSTFS_*`。**仓库 grep 扫不到，切流后不改则媒体异地备份静默中断** |

### 3.2 无需改动（验证过）

- `apps/api/src/storage/s3.service.ts` 及全部业务代码（S3 API 通用）
- `.env.example` S3 段（端点、AK/SK、桶名均沿用；dev root 凭证若改名需同步 `S3_ACCESS_KEY_ID/SECRET`，见 §5.2）
- `apps/web/next.config.ts` remotePatterns（域名未变）
- 数据库中所有媒体 URL
- `apps/api/scripts/restore-media-to-minio.mjs`（走 S3 API，功能不受影响；文件名可后续顺手更名）
- `apps/api/prisma/lib/sync-content-media.ts`（`prisma:sync:static-media` 用到，仅 HeadObject + PutObject，端点/凭证均由 S3 环境变量驱动）

### 3.3 后续文档同步（迁移完成后）

- `docs/deployment-plan.md` §4 各处 MinIO 表述
- `AGENTS.md`「对象存储规范」章节（存储架构表、Bucket 政策描述）
- 注释中的「MinIO」字样（`s3.service.ts` 头注释、`media.service.ts`、`env.validation.ts` 等）——不影响功能，随迁移 PR 一并清理
- `apps/api/src/integrations/integration.registry.ts` 的**用户可见文案**「MinIO / 阿里云 OSS / AWS S3 的 Secret Access Key…」（集成中心后台 UI 展示，非代码注释，需改为 RustFS 表述）
- `apps/admin/src/lib/media-url.ts` 的公开域拼接（已用 `toStorageUrl`，走 `NEXT_PUBLIC_S3_PUBLIC_DOMAIN`）
- dev compose 陈旧注释「生产 OSS 的 CORS 走 infra/docker/oss/apply-cors.sh」（生产早已是自托管而非 OSS，改写 dev compose 时顺手修正，避免带进 rustfs 服务块）

---

## 4. 迁移策略总览

```
阶段一（dev，低风险）                    阶段二（prod，满足准入门槛后）
┌─────────────────────────┐             ┌──────────────────────────────────┐
│ 1. dev compose 换 rustfs │             │ 1. rustfs 服务并行上线（新 volume）│
│ 2. mc mirror 迁移 dev 数据│   观察期    │ 2. 内网 mc mirror 全量同步          │
│ 3. 全功能回归            │  ≥ 2~4 周   │ 3. 停 api → 增量同步 → 切 nginx     │
│ 4. 团队日常开发即回归测试  │ ──────────▶ │    upstream + 换 env → 起 api      │
└─────────────────────────┘             │ 4. 验证 → minio 停但保留 7 天回滚窗 │
                                        └──────────────────────────────────┘
```

- **dev 先行**：日常开发（媒体库上传、聊天附件、水印、favicon、浏览器直传）天然构成回归测试。
- **prod 并行双跑再切流**：迁移期间 minio 与 rustfs 同时在线，数据同步走 compose 内网（历史经验：内网 `mc cp/mirror` 可达 50MB/s，公网反代路径是陷阱，禁止使用——见 §6 注意事项）。
- **回滚成本趋近于零**：切流只动 nginx upstream 一行 + env 两行，旧 miniodata volume 原样保留。

---

## 5. 详细实施步骤

### 5.1 版本选择

```
镜像：rustfs/rustfs:<pin-tag>     # 实施时取当时最新 release tag（撰写时为 1.0.0-beta.12）
                                  # 生产禁 latest，与 MinIO 锁版本策略一致
```

### 5.2 dev 环境改造（`docker-compose.dev.yml`）

```yaml
  # ── RustFS (S3-compatible Object Storage) ──────────────────
  rustfs:
    image: rustfs/rustfs:<pin-tag>
    container_name: tzj_rustfs_dev
    restart: unless-stopped
    ports:
      - "9000:9000"   # S3 API (应用程序连接)
      - "9001:9001"   # Web Console (浏览器访问)
    environment:
      # 官方 Docker 形态：无需 command，卷/监听全走 env（镜像默认 RUSTFS_VOLUMES=/data，此处显式写出）
      RUSTFS_VOLUMES: /data
      RUSTFS_ADDRESS: 0.0.0.0:9000
      RUSTFS_CONSOLE_ADDRESS: 0.0.0.0:9001
      RUSTFS_ACCESS_KEY: rustfsadmin        # dev 专用，与 .env 的 S3_ACCESS_KEY_ID 保持一致
      RUSTFS_SECRET_KEY: rustfsadmin
      RUSTFS_CONSOLE_ENABLE: "true"
      # CORS：仅 origin 维度（RustFS 不提供 method/header 粒度配置）
      RUSTFS_CORS_ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3001,http://localhost:3002,https://www.tzjii.com,https://admin.tzjii.com"
      RUSTFS_CONSOLE_CORS_ALLOWED_ORIGINS: "http://localhost:9001"
    volumes:
      - rustfs_data:/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9000/health || exit 1"]
      interval: 30s
      timeout: 20s
      retries: 3
    networks:
      - tzj-dev
```

同步动作：

1. **rustfs 与 minio 服务块并存**（而非替换）：数据迁移需两容器同时在线，且避免依赖 orphan 容器的隐含行为；观察期结束后再删 minio 服务块与 `minio_data`。并存期间 minio 可改为不映射宿主机端口（只保内网），避免与 rustfs 抢 9000/9001
2. `volumes:` 增加 `rustfs_data`（保留 `minio_data` 直到观察期结束）
3. 根目录 `.env`：`S3_ACCESS_KEY_ID` / `S3_ACCESS_KEY_SECRET` 改为与 `RUSTFS_ACCESS_KEY/SECRET_KEY` 一致；`.env.example` 同步（`minioadmin` → `rustfsadmin`）
4. 其余 S3 变量（端点 `http://localhost:9000`、桶名、公开域名）**全部不变**

dev 存量数据迁移（本机一次性，两容器同网时执行）。**注意：dev 桶中是从生产恢复的真实业务媒体（本地库持续合并生产数据，见 AGENTS.md「数据库工作流规范」），不是可丢弃的测试数据**：末尾 `mc du` 两端总量核对是切换前的**强制关卡**（与 prod 同标准），不一致则禁止把 9000 端口切给 rustfs：

```bash
# 注意：compose 项目名取 compose 文件所在目录名（infra/docker/ → docker），
# 故网络名为 docker_tzj-dev（已实测 `docker network ls` 确认）
docker run --rm --network docker_tzj-dev --entrypoint sh minio/mc -c "
  mc alias set old http://minio:9000  minioadmin  minioadmin &&
  mc alias set new http://rustfs:9000 rustfsadmin rustfsadmin &&
  mc mb -p new/tzj-uploads-dev &&
  mc anonymous set download new/tzj-uploads-dev &&
  mc mirror --overwrite old/tzj-uploads-dev new/tzj-uploads-dev &&
  mc du old/tzj-uploads-dev && mc du new/tzj-uploads-dev    # 强制关卡：两端总量必须一致方可切换端口
"
```

> 匿名读兜底：dev 下 `S3Service.ensureBucket()` 启动时会自动 PutBucketPolicy 整桶公开读，即使上面 `mc anonymous` 失败也会被应用侧补齐。

> 观察期回退路径：若遇阻断性存储缺陷，将 9000/9001 端口映射还给 minio 服务块 + `.env` 凭证改回 `minioadmin` 即可，分钟级完成；`minio_data` 全程只读未动，存量无风险。**回退后必须反向 mirror（new→old）补回 rustfs 期间新上传的对象**——dev 媒体同样是真实业务数据，不存在“可直接舍弃”的选项。

### 5.3 prod compose 改造（`docker-compose.prod.yml`）

```yaml
  rustfs:
    image: rustfs/rustfs:<pin-tag>   # 锁定版本，生产禁 latest
    restart: unless-stopped
    mem_limit: 512m                  # 首月沿用 MinIO 配额观察；RustFS 无 GC 冲高问题，稳定后可下调试探 256m
    environment:
      # 官方 Docker 形态：无需 command，卷/监听全走 env
      RUSTFS_VOLUMES: /data
      RUSTFS_ADDRESS: 0.0.0.0:9000
      RUSTFS_ACCESS_KEY: ${RUSTFS_ACCESS_KEY:?required}
      RUSTFS_SECRET_KEY: ${RUSTFS_SECRET_KEY:?required}
      # 浏览器预签名直传所需 CORS（仅 origin 维度）
      RUSTFS_CORS_ALLOWED_ORIGINS: "https://${WEB_DOMAIN},https://${ADMIN_DOMAIN}"
    volumes:
      - rustfsdata:/data
    expose:
      - "9000"   # 仅 compose 内网；生产不开 9001 Console（与 MinIO 时期策略一致）
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
```

同步动作：

1. `volumes:` 增加 `rustfsdata`；**保留 `miniodata` 定义直到回滚窗口关闭**
2. `api.depends_on`：`minio` → `rustfs`（condition: service_healthy 不变）
3. `.env.prod`：删 `MINIO_ROOT_USER/PASSWORD`，增 `RUSTFS_ACCESS_KEY`（随机 20 位）/ `RUSTFS_SECRET_KEY`（随机 40 位）；S3 段六个变量**原值不动**
4. nginx 模板：`set $upstream_minio minio:9000; proxy_pass http://$upstream_minio;` → `set $upstream_rustfs rustfs:9000; proxy_pass http://$upstream_rustfs;`——**其余指令一律保留**，尤其 `proxy_set_header Host $host`（SigV4 签名校验）与「不关 proxy_request_buffering」注释（aws-chunked 流式签名教训，对 RustFS 同样适用）
5. `infra/docker/Makefile`：`up -d --no-deps postgres minio acme gateway` → `postgres rustfs acme gateway`

### 5.4 prod Bucket 与应用账号初始化（一次性，ECS 上执行）

> **执行主机声明（§5.4–§5.5 全部命令适用）**：唯一生产 ECS 为 **REDACTED-IP**（AGENTS.md「生产服务器唯一事实」）；REDACTED-IP 是旧项目废弃服务器，**严禁在其上执行任何迁移操作**。

沿用现有 mc 工具链（RustFS 实现 MinIO 兼容 admin API；若个别 `mc admin` 命令不被接受，等价改用 RustFS 官方 CLI `rc` 或临时开 Console 操作）：

```bash
docker run --rm --network tzj_default --env-file /opt/tzj/.env.prod \
  --entrypoint sh minio/mc -c "
  mc alias set prod http://rustfs:9000 \$RUSTFS_ACCESS_KEY \$RUSTFS_SECRET_KEY &&
  mc mb -p prod/tzj-uploads-prod &&
  mc anonymous set download prod/tzj-uploads-prod &&            # 整桶公开只读
  mc admin user add prod tzj-api '<S3_ACCESS_KEY_SECRET 原值>' && # 应用级 AK/SK 沿用现值，.env.prod S3 段零改动
  mc admin policy attach prod readwrite --user tzj-api           # RustFS 内置同名 canned policy
"
```

> 应用级账号 `tzj-api` 的 AK/SK **沿用现有值**，这样 `.env.prod` 的 `S3_ACCESS_KEY_ID/SECRET` 完全不用改，api 容器无需重建配置。

### 5.5 prod 数据迁移与切流

**T-1 天（无停机，业务照常）**

```bash
# 0. prod compose 含 :?required 强制插值，裸 docker compose 命令解析阶段就会报错；
#    必须双 --env-file + acme override（与 /opt/tzj/Makefile 的 $(PROD) 定义对齐）。
#    用 shell 函数而非字符串变量：变量写法依赖 bash 未加引号分词，zsh 下会整串报 command not found
prod() {
  docker compose -f /opt/tzj/docker-compose.prod.yml -f /opt/tzj/docker-compose.acme.override.yml \
    --env-file /opt/tzj/.env.prod --env-file /opt/tzj/.env.prod.local "$@"
}

# 1. 上新服务（与 minio 并行；2C2G 内存吃紧，迁移窗口临时停 admin 腾 320m，结束后拉起）
prod stop admin
prod up -d rustfs

# 2. 初始化（§5.4）

# 3. 全量同步（走 compose 内网，禁止走公网反代——历史实测公网反代路径 <1MB/s，内网 50MB/s）
docker run --rm --network tzj_default --env-file /opt/tzj/.env.prod \
  --entrypoint sh minio/mc -c "
  mc alias set old http://minio:9000  \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD &&
  mc alias set new http://rustfs:9000 \$RUSTFS_ACCESS_KEY \$RUSTFS_SECRET_KEY &&
  mc mirror --overwrite old/tzj-uploads-prod new/tzj-uploads-prod
"
```

**T 日切流（低峰执行，预期中断 < 5 分钟）**

```bash
# 1. 停 api（冻结写入），跑一次增量 mirror（幂等，秒级）；prod 函数同 T-1 天定义
#    注意：stop api 会掐断进行中的灵犀 SSE 会话与聊天长连接；低峰执行前确认无活跃
#    灵犀 run（即使有，RunBuffer 流恢复机制可兜底，属可接受中断）
prod stop api
<再执行一次上面的 mc mirror 命令>

# 2. 核对：两端对象数 / 总大小一致
#    mc du old/tzj-uploads-prod ；mc du new/tzj-uploads-prod

# 3. 切换：应用 compose / nginx / env 三处改动（§5.3），然后
prod up -d api gateway admin
prod exec gateway nginx -s reload

# 4. 验证清单（§7）全绿后：
prod stop minio   # 停容器但不删 volume

# 5. 更新备份 crontab（§3.1 末行）：每周 mc mirror 的源端 minio→rustfs、凭证换 RUSTFS_*，
#    改完手动跑一次验证媒体→OSS 归档桶备份链路恢复（否则停 minio 后异地备份静默中断）
```

**T+7 天（回滚窗口关闭）**

```bash
# 确认无异常后，删除 minio 服务定义与 volume（prod 函数同 T-1 天定义）
prod rm -sf minio
docker volume rm tzj_miniodata
```

---

## 6. 关键注意事项（来自本项目 MinIO 运维实战）

1. **nginx 反代不可关 `proxy_request_buffering`**：AWS SDK 大文件上传走 aws-chunked 流式 SigV4 签名，nginx 改 chunked 重编码会破坏签名（MinIO 时期实测返 400）。现有配置（默认缓冲 + 300s 超时）保持原样，切到 RustFS 后需用 >16MB 文件复测（验证清单第 6 项）。
2. **批量迁移永远走内网**：公网反代 + SigV4 + 单核小机 = 吞吐 <1MB/s 陷阱；`mc mirror` 一律加 `--overwrite` 保证幂等可重跑。
3. **数据目录不复用（策略选择，非技术限制）**：RustFS 自 1.0.0-alpha.89 起官方支持原地复用 MinIO 数据目录（bucket/对象/版本/IAM/生命周期均可读，见 rustfs/rustfs#2212；不支持项 site replication/事件通知/LDAP 本项目未用）。但原地复用后 RustFS 会写入该 volume，回滚 MinIO 的安全性官方未承诺；本项目数据量小、内网 mirror 分钟级完成，故坚持对象级迁移——`miniodata` 全程只读不动，回滚窗口零风险。
4. **healthcheck 用 curl 已确认可行**：官方 compose 的 healthcheck 即在容器内跑 curl，镜像自带，无需额外预检。
5. **2C2G 内存预算**：双跑窗口 rustfs(512m) + minio(512m) 超出常态预算，务必按 §5.5 临时停 admin，并确认 2G swap 在位。
6. **volume 属主**：RustFS 运行时用户为 `10001:10001`，挂载目录须对其可写；命名 volume 首次创建通常没问题，若容器起不来先查 `/data` 属主，必要时 `chown -R 10001:10001`。

---

## 7. 验证清单（dev 与 prod 各过一遍）

| # | 验证项 | 方法 |
|---|--------|------|
| 1 | 健康检查 | `curl -f http://<host>:9000/health` 返回 200；compose ps 显示 healthy |
| 2 | api 启动探针 | api 日志出现 `S3 Storage module loaded`；`GET /api/v1/health` 存储项 OK |
| 3 | 公开读 | 抽查数据库存量媒体 URL，公网 GET 200 + content-length 正确；匿名访问不存在对象返回 404/403 而非 500 |
| 4 | 后台上传 | admin 媒体库上传图片（<10MB），落库 URL 可访问 |
| 5 | 浏览器直传 | admin 预签名 PUT 直传（跨域路径），浏览器 Network 无 CORS 报错——**重点验证 RustFS 仅 origin 维度 CORS 是否放行 PUT**；若被拦，fallback：在 nginx static server block 注入 `Access-Control-Allow-Origin/Methods/Headers` 响应头并代答 OPTIONS preflight（dev 无 nginx，则需升级 RustFS 或改走服务端中转上传） |
| 6 | 大文件 | >16MB 文件经 nginx 反代上传成功（aws-chunked 签名回归） |
| 7 | 预签名 GET | 私有对象预签名 URL 有效期内可访问、过期后 403 |
| 8 | 水印链路 | 上传触发水印的媒体，`getObjectBuffer`（Logo 拉取）+ 处理后回写正常；覆盖三条路径：`watermark=auto`（正常烧录）、`skip`（原样上传）、`force`（跳过目录/类型限制强制烧录），且落库 `MediaAsset.watermarked` 值与实际处理结果一致 |
| 9 | 聊天附件 | 聊天发送附件（`buildChatKey` 路径）收发正常 |
| 10 | 回收站物理清除 | media purge 后对象确实从存储删除 |
| 11 | 对象总量核对 | 迁移后 `mc du` 新旧两端对象数 / 总大小一致 |
| 12 | 内存观察 | `docker stats` 观察 rustfs 常态 RSS 与上传峰值，为下调 mem_limit 取数 |

---

## 8. 生产切换准入门槛（Go / No-Go）

满足**全部**条件方可执行阶段二：

1. dev 环境切换后稳定运行 ≥ 2 周，验证清单 12 项全绿，无存储相关缺陷
2. RustFS 发布 1.0 GA，或团队明确接受 beta 上生产的风险并记录决策——实施时检查 [releases](https://github.com/rustfs/rustfs/releases)。**现实校准（2026-07-30 实测）**：官方路线图承诺的「GA 2026-07」已跳票，当日最新仍为 1.0.0-beta.12（pre-release），GA 时点未知；若 dev 观察期结束后仍未 GA，需显式走「接受 beta 风险并记录决策」分支做 Go/No-Go 表决，而非无限期等待
3. 生产媒体已有近期备份——具体指 deployment-plan.md §7 的两条腿：确认最近一次每周 `mc mirror`→OSS 归档桶（`tzj-prod-backup`）任务成功，必要时切流前手动补跑一次；另确认 ECS 快照在位
4. 选定低峰窗口，且当日无其他部署计划

任一不满足 → 推迟，dev 继续观察（dev/prod 短期异构可接受：应用层走标准 S3 API，两端行为差异已被本方案 §2.2 枚举）。

---

## 9. 回滚方案

| 时点 | 操作 | 耗时 |
|------|------|------|
| 切流后发现问题（T+0 ~ T+7） | nginx upstream 改回 `minio:9000`、compose `api.depends_on` 改回、`.env.prod` 恢复 `MINIO_ROOT_*`（S3 段本就没动过）→ `up -d minio api gateway` + nginx reload | < 5 分钟 |
| 回滚后的增量差异 | 切流后新写入 rustfs 的对象反向 `mc mirror new→old` 补回 | 分钟级 |
| 窗口关闭后（>T+7） | 已删 minio volume，回滚 = 反向全量迁移（rustfs → 重建 minio），流程同 §5.5 | 小时级 |

---

## 10. 工作量与排期估算

| 任务 | 工作量 |
|------|--------|
| dev compose + env 改造、数据迁移、全量验证 | 0.5 天 |
| 观察期（日常开发即回归） | 2~4 周（日历时间，无专职投入） |
| prod compose / nginx / env 改造 + 演练脚本 | 0.5 天 |
| prod 数据迁移 + 切流 + 验证 | 0.5 天（含低峰窗口等待） |
| 文档同步（deployment-plan.md、AGENTS.md、注释清理） | 0.5 天 |

**合计**：约 2 人日 + 2~4 周观察期。

---

## 附：变更文件一览（实施 PR Checklist）

- [ ] `infra/docker/docker-compose.dev.yml` — minio → rustfs 服务
- [ ] `infra/docker/docker-compose.prod.yml` — 同上 + depends_on + volumes
- [ ] `infra/docker/nginx/templates/tzj.conf.template` — upstream 服务名
- [ ] `infra/docker/.env.prod.example` — `RUSTFS_ACCESS_KEY/SECRET_KEY` 替换 `MINIO_ROOT_*`
- [ ] `infra/docker/Makefile` — 服务名
- [ ] `.env.example` — dev root 凭证名更新
- [ ] 服务器 `/opt/tzj/.env.prod` — 同 example（手工，不入库）
- [ ] （迁移完成后）文档与代码表述同步 — 按 §3.3 完整清单逐项执行（deployment-plan.md、AGENTS.md、注释、集成中心 UI 文案、toMinioUrl 更名等）
