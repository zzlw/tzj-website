---
kind: configuration_system
name: TZJ 多应用配置系统：环境变量校验、分层加载与运行时设置管理
category: configuration_system
scope:
    - '**'
source_files:
    - packages/config/src/env.ts
    - apps/api/src/config/env.validation.ts
    - apps/api/src/app.module.ts
    - apps/admin/src/lib/config.ts
    - apps/web/src/lib/site.ts
    - apps/web/src/lib/site-settings.ts
    - apps/api/src/settings/settings.schema.ts
    - apps/api/src/settings/settings.defaults.ts
    - apps/web/src/lib/site-defaults.ts
    - infra/docker/.env.prod.example
    - infra/docker/.env.deploy.local.example
    - apps/web/.env.example
    - apps/admin/.env.local
---

## 1. 系统与框架
- **NestJS 后端**使用 `@nestjs/config` 的 `ConfigModule.forRoot` 统一加载 `.env.local` → `.env` → `../../.env`，并通过自定义 `validateEnv`（基于 Zod）在启动时 fail-fast 校验。
- **共享包 `@tzj/config`** 提供跨应用的 Zod 环境模式（base / api / web / admin），各应用可继承扩展。
- **Next.js 前端（apps/web、apps/admin）** 通过 `process.env.NEXT_PUBLIC_*` 注入构建期常量，配合 `.env.example` 与 `.env.local` 覆盖默认值。
- **运行时 CMS 设置**通过 API `/settings/site/public` 拉取，C 端以 ISR 缓存（开发 0s、生产 300s）并合并环境变量实现“部署级覆盖”。

## 2. 关键文件与位置
- `packages/config/src/env.ts` — 共享 Zod 环境模式（base/api/web/admin）及类型导出
- `apps/api/src/config/env.validation.ts` — API 运行时环境变量 Zod 校验与错误格式化
- `apps/api/src/app.module.ts` — Nest `ConfigModule.forRoot` 装配 envFilePath 与 validate
- `apps/admin/src/lib/config.ts` — Admin 应用 API_BASE、BASE_PATH、WEB_BASE 等构建期常量
- `apps/web/src/lib/site.ts` — 站点级常量（名称、联系方式、备案号）与环境变量覆盖
- `apps/web/src/lib/site-settings.ts` — 从 API 拉取站点设置并与环境变量/默认值合并
- `apps/api/src/settings/settings.schema.ts` — 站点公开设置的 Zod 校验模式
- `apps/api/src/settings/settings.defaults.ts` — 站点设置默认值与归一化逻辑
- `apps/web/src/lib/site-defaults.ts` — C 端与 API 对齐的默认站点设置
- `infra/docker/.env.prod.example` / `.env.deploy.local.example` — 生产/本地部署环境变量模板
- `apps/web/.env.example` / `apps/admin/.env.local` — 各应用环境变量示例

## 3. 架构与约定
- **分层加载顺序**（API 侧）：`.env.local` > `.env` > `../../.env`，由 `ConfigModule.forRoot` 的 `envFilePath` 数组控制。
- **启动时校验**：所有环境变量经 Zod schema 解析，缺失或非法直接抛错并打印详细路径+消息，确保进程不启动于非法状态。
- **共享模式扩展**：`@tzj/config` 暴露 base/api/web/admin 四套 schema，应用可按需 extend 新增字段。
- **运行时设置三源合并**：CMS 返回的 JSON < 默认值（`DEFAULT_SITE_PUBLIC_SETTINGS`）< 环境变量（`NEXT_PUBLIC_*`），环境变量优先级最高，便于不同环境一键覆盖。
- **ISR 缓存策略**：Web 端对站点设置与 favicon 请求设置 `revalidate: isDev ? 0 : 300`，平衡开发与生产时效性。
- **S3/OSS 公共域名**：通过 `S3_PUBLIC_DOMAIN` 与 `NEXT_PUBLIC_S3_PUBLIC_DOMAIN` 分别在后端与前端暴露，媒体 URL 构造统一走 `getS3PublicDomain()`。

## 4. 约定与约束
- **环境变量命名规范**：服务端变量无前缀（如 `DATABASE_URL`、`JWT_SECRET`），客户端变量统一加 `NEXT_PUBLIC_` 前缀（如 `NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_CONTACT_PHONE`）。
- **必填与默认值**：Zod schema 中所有必要字段均设 `default` 或 `optional`，禁止未定义运行时行为；`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET` 为必填。
- **安全敏感项**：`JWT_SECRET` 至少 16 字符，`SECRETS_ENCRYPTION_KEY` 至少 32 字符，生产环境必须配置。
- **CORS 白名单**：通过逗号分隔的 `CORS_ORIGINS` 配置，默认包含 localhost 各端口。
- **站点设置结构**：所有多语言文本统一使用 `{ 'zh-CN': ..., 'zh-TW': ..., en: ... }` 的 `LocalizedText` 结构，旧数据通过 `normalizeLocalizedText` 迁移。
- **部署模板隔离**：生产模板 `.env.prod.example` 仅含非敏感变量，密钥与 ACR/ECS 凭证放入 `.env.prod.local`（gitignore），避免泄露。
- **前端构建期常量**：Next.js 仅编译 `NEXT_PUBLIC_*` 到客户端 bundle，其他环境变量仅在服务端可用。