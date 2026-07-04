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
