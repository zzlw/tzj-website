---
kind: external_dependency
name: PostgreSQL 数据库（Prisma ORM + pg_trgm 扩展）
slug: postgresql
category: external_dependency
category_hints:
    - vendor_identity
    - migration_status
scope:
    - '**'
---

### 身份与版本
- 生产/开发均使用 PostgreSQL 15.18（备份 dump 显示 PG 15.18 → server 也是 15.18，版本完全匹配）。
- 通过 Prisma 6 作为 ORM，schema 单一来源为 `apps/api/prisma/schema.prisma`。

### 迁移策略
- 本地开发：`pnpm prisma:push`（非破坏性同步，适合开发阶段快速迭代）。
- 生产部署：`prisma migrate deploy`（幂等、可回滚，由 `deploy.sh` 的 `run_migrate` 自动执行）。
- 仓库中 `prisma/migrations/` 目录为空，采用 `db push` 工作流而非传统迁移文件。

### 特殊依赖
- 支持 JSON 字段（如 `traits`、`detail`、`config`）用于灵活数据存储。

### 数据恢复
- 生产备份位于 OSS `_db-sync/tzj_dev.dump`（Postgres dump 格式），可通过 `pg_restore --clean --if-exists` 恢复。
- 恢复时需先终止运行中的 API 连接，避免竞争条件。