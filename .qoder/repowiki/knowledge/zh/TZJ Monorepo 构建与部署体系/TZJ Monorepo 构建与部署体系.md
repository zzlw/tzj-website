---
kind: build_system
name: TZJ Monorepo 构建与部署体系
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - pnpm-workspace.yaml
    - turbo.json
    - Makefile
    - .github/workflows/ci.yml
    - .github/workflows/deploy.yml
    - infra/docker/deploy.sh
    - apps/api/Dockerfile
    - apps/web/Dockerfile
    - apps/admin/Dockerfile
---

## 1. 构建系统概览

该仓库采用 **pnpm workspace + Turborepo** 作为多包 monorepo 的构建编排核心，统一协调 `apps/web`（Next.js 官网）、`apps/admin`（Next.js 管理后台）、`apps/api`（NestJS API）三个应用以及 `packages/*` 共享包的依赖安装、类型检查、构建与缓存。所有 Node.js 工具链通过根 `package.json` 脚本暴露，开发者只需执行 `pnpm build` / `pnpm dev` / `pnpm typecheck` 即可触发全量或按 filter 的并行任务。

- **包管理器**: pnpm 11.9.0（通过 `packageManager` 字段锁定），使用 `pnpm-workspace.yaml` 声明 `apps/*` 与 `packages/*` 为工作区，并通过 `catalog` 集中管理跨应用共享依赖版本。
- **任务编排**: Turborepo 2.x，通过 `turbo.json` 定义 `build`、`dev`、`lint`、`test`、`typecheck`、`clean`、`prisma:*` 等任务，利用 `dependsOn["^build"]` 实现依赖包先构建、增量缓存与远程缓存（TURBO_TOKEN/TURBO_TEAM）。
- **代码质量**: Biome 统一 lint/format/check，根脚本 `pnpm run check` / `format --write .` 驱动。

## 2. 关键文件与职责

| 文件 | 作用 |
|---|---|
| `package.json` | 根脚本入口：`build`、`dev`、`typecheck`、`db:migrate`、`deploy:prod` 等 |
| `pnpm-workspace.yaml` | 工作区声明 + `catalog` 共享依赖版本集中管理 |
| `turbo.json` | Turborepo 任务图、缓存策略、输入输出定义 |
| `Makefile` | 本地开发/运维快捷命令（`dev`、`db-push`、`db-migrate`、`cert-*`、`prod-deploy`） |
| `.github/workflows/ci.yml` | CI 流水线：pnpm install → lint → typecheck → turbo build → Lighthouse → Docker 构建 + Trivy 扫描 → dependency audit |
| `.github/workflows/deploy.yml` | 生产部署：构建镜像推送到 ACR → SSH 到 ECS → 执行 `deploy.sh` 滚动更新 |
| `infra/docker/deploy.sh` | ECS 部署脚本：参数解析、镜像 tag 持久化、Prisma migrate、健康检查、smoke test、网关重载 |
| `apps/*/Dockerfile` | 各应用独立多阶段 Docker 构建（API 使用 `pnpm deploy --prod` 打包；Web/Admin 使用 Next.js Standalone Output） |
| `infra/docker/docker-compose.*.yml` | 开发/生产环境编排（Postgres、Redis、MinIO、Nginx gateway、ACME、各 app） |

## 3. 架构与约定

### 3.1 构建流程
- **本地开发**: `make dev` 启动 docker-compose.dev，`pnpm dev` 通过 `scripts/dev.mjs` 同时启动 web/admin/api 三个 dev server。
- **Monorepo 构建**: `pnpm build` → `turbo run build` 按依赖拓扑并行构建，产物输出至 `.next/**`、`dist/**`、`build/**`（由 `turbo.json` outputs 定义）。
- **Docker 构建**: 每个应用独立 `Dockerfile`，基于 `node:22-alpine`，使用 DaoCloud 镜像加速；CI 中通过 `docker/build-push-action` 构建并缓存到 GitHub Actions cache。

### 3.2 部署流程
- **主路径**: 云效 Flow（见 `infra/yunxiao/pipeline.yml`），日常发布走 Codeup push → 云效 pipeline。
- **备用路径**: GitHub Actions `deploy.yml` → 构建镜像推送阿里云 ACR → SSH 到 ECS → 执行 `deploy.sh all <sha>`。
- **ECS 部署脚本** (`deploy.sh`)：
  - 支持 `api|web|admin|all` 四种服务粒度，自动持久化镜像 tag 到 `.env.prod.local`。
  - API 部署前自动执行 `prisma migrate deploy`，等待 `/api/v1/health` 健康后继续。
  - 最后重建 Nginx gateway 与 ACME 证书容器，执行 smoke test 验证 web/admin 可访问。

### 3.3 数据库与迁移
- **开发环境**: `make db-push` 调用 `pnpm --filter @tzj/api prisma:push` 直接同步 schema（非幂等，仅开发用）。
- **生产环境**: `make db-migrate` 调用 `prisma:migrate:deploy`，由 `deploy.sh` 在 API 启动前自动执行，保证幂等与可回滚。
- **全文索引**: `make db-index` 手动创建 pg_trgm + GIN 索引（API 启动时也会尝试自动创建，受 `CHAT_SEARCH_AUTO_INDEX=false` 限制时需手动兜底）。

### 3.4 安全与合规
- **依赖审计**: CI 中运行 `pnpm audit --audit-level=high`（允许失败但记录结果）。
- **镜像安全**: Trivy 扫描 CRITICAL/HIGH 级别漏洞，结果上传 SARIF 到 GitHub Security。
- **最小权限**: Docker 镜像内使用非 root 用户（`nestjs` / `nextjs`），HEALTHCHECK 探针确保服务就绪。

## 4. 约定与约束

- **Node 版本要求**: 根 `engines.node >= 22.0.0`，CI Runner 使用 node 20（兼容），pnpm 锁定 11.9.0。
- **依赖版本集中管理**: 通过 `pnpm-workspace.yaml catalog` 声明共享依赖版本，应用内以 `catalog:` 引用保持直接依赖关系。
- **构建缓存**: Turbo 启用远程缓存（`TURBO_TOKEN`/`TURBO_TEAM`），Docker 构建使用 `cache-from: type=gha` 与 `cache-to: type=gha,mode=max`。
- **环境变量注入**: Next.js 应用通过 Dockerfile `ARG NEXT_PUBLIC_*` 在构建期注入运行时变量；API 通过 `.env.prod` + `.env.prod.local` 分离敏感与非敏感配置。
- **部署不可变性**: 每次部署使用 git SHA 作为镜像 tag，`.env.prod.local` 持久化当前生效的 TAG，支持快速回滚。
- **网关热重载**: 部署完成后通过 `nginx -s reload` 无中断切换流量，ACME 证书自动续签后同样触发 reload。

## 5. 适用场景总结

该构建体系适用于多应用 monorepo 的标准化开发体验（统一命令、并行构建、增量缓存）、CI/CD 自动化（构建→测试→安全扫描→镜像推送→SSH 部署）以及生产环境的滚动发布与快速回滚。所有流程围绕 pnpm + Turborepo + Docker + GitHub Actions 展开，形成从本地到生产的完整闭环。