# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-06

### Added

- **Monorepo 架构**: pnpm workspace + Turborepo 项目结构
- **apps/web**: Next.js 16 官网（i18n 三语支持、Rosenbauer 浅色工业风格）
- **apps/admin**: Next.js 16 CMS 管理后台（JWT RBAC、内容管理）
- **apps/api**: NestJS 11 后端（Prisma 7 + 20 个模块 + JWT 认证 + Swagger）
- **@tzj/ui**: Shadcn/ui 共享组件库
- **@tzj/types**: 共享类型包
- **@tzj/config**: 共享配置（Biome + TSConfig）
- **@tzj/theme**: 设计令牌（CSS 变量 + JS 常量双导出）
- **CI/CD**: 云效 Flow 公共构建集群 → ACR → ECS Docker Compose
- **HTTPS**: Let's Encrypt + acme.sh DNS-01 泛域名证书
- **对象存储**: 阿里云 OSS（S3 兼容，@aws-sdk/client-s3）
- **数据库**: PostgreSQL 16 + Prisma 7 ORM
- **设计基准**: Rosenbauer 白底浅色工业调性 + 流体标题 clamp 排版

### Infrastructure

- `deploy.sh` — ECS 服务器端部署（拉镜像 → migrate → 滚动更新）
- `deploy-local.sh` — 本地 Mac 一键构建 + push + SSH 部署
- `docker-compose.prod.yml` — 生产环境编排
- `infra/docker/acme/` — SSL 证书自动签发与续期
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Monorepo 初始化**: pnpm workspace + Turborepo 项目结构
- **@tzj/types**: 共享类型包（Product / Case / News / Solution / Contact / Page 实体与 DTO）
- **@tzj/ui**: Shadcn/ui 组件库（Button / Card / Badge / Dialog / Table / DataTable / Input / Label / Tabs / Sheet / Alert / Tooltip + ThemeProvider）
- **@tzj/config**: 共享配置（Biome / TSConfig preset）
- **@tzj/theme**: 设计令牌（CSS 变量 + JS 常量双导出）
- **apps/api**: NestJS 11 后端（Prisma 6 + 6 个 CRUD 模块 + 健康检查 + Swagger）
- **apps/web**: Next.js 15 官网（首页 + 产品 + 案例 + 方案 + 新闻 + 关于 + 联系 + 服务 共 8 个页面）
- **apps/admin**: Next.js 15 管理后台（仪表盘 + 5 个管理模块 + 登录页）
- **harness/**: AI 工程治理体系（AGENTS.md + HARNESS.md + Runner + 6 个 Inspector + 2 个 Evaluator + 5 个 Pipeline + 2 个 Reporter）
- **设计基准**: Rosenbauer 深色工业调性 + WHP Training Towers 信息流结构
