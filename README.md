# TZJ — 拓之迹官网

> 应急救援训练装备制造商官网 + CMS 管理后台，Turborepo Monorepo 架构。
>
> **线上地址**：官网 <https://www.tzjii.com> · 管理后台 <https://admin.tzjii.com>

[![CI/CD Pipeline](https://github.com/zzlw/tzj-website/actions/workflows/ci.yml/badge.svg)](https://github.com/zzlw/tzj-website/actions/workflows/ci.yml)
[![Deploy Production](https://github.com/zzlw/tzj-website/actions/workflows/deploy.yml/badge.svg)](https://github.com/zzlw/tzj-website/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/github/license/zzlw/tzj-website)](LICENSE)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fwww.tzjii.com&label=website&up_message=online)](https://www.tzjii.com)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/zzlw/tzj-website?label=commits)](https://github.com/zzlw/tzj-website/commits/main)
[![Last Commit](https://img.shields.io/github/last-commit/zzlw/tzj-website)](https://github.com/zzlw/tzj-website)

[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)]()
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)]()
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)]()
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)]()
[![NestJS 11](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)]()
[![Prisma 6](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)]()
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)]()
[![Node.js 22](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)]()
[![Turborepo 2](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white)]()
[![Biome 2](https://img.shields.io/badge/Biome-2-60A5FA?logo=biome&logoColor=white)]()
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)]()
[![pnpm 11](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)]()

## 技术栈

| 层 | 技术 |
|---|------|
| 官网 | Next.js 16 · React 19 · Tailwind CSS 4 · Shadcn/ui |
| 后台 | Next.js 16 · React 19 |
| API | NestJS 11 · Prisma 6 · PostgreSQL 16 |
| 构建 | Turborepo · pnpm workspace |
| 质量 | Biome 2.x (lint + format) · TypeScript strict |
| 部署 | GitHub Actions · ACR · Docker Compose · ECS |

## 项目结构

```
├── apps/
│   ├── web/          # C 端官网 (www.tzjii.com)
│   ├── admin/        # CMS 管理后台 (admin.tzjii.com)
│   └── api/          # REST API (api.tzjii.com)
├── packages/
│   ├── ui/           # 共享 UI 组件 (@tzj/ui)
│   ├── types/        # 共享类型 (@tzj/types)
│   ├── theme/        # 设计令牌 (@tzj/theme)
│   └── config/       # 共享配置 (@tzj/config)
├── infra/
│   └── docker/       # Docker 编排 + 服务器脚本
└── docs/             # 专题文档
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动本地开发环境（PostgreSQL + Redis + MinIO）
make dev

# 启动全部服务
pnpm dev
```

- 官网: http://localhost:3001
- 后台: http://localhost:3002
- API: http://localhost:4000/api/docs

## 演示账号

管理后台提供只读游客账号，用于体验 CMS 功能（最小权限：仅可查看官网内容，无任何写权限）：

| 入口 | 地址 | 用户名 | 密码 |
|---|---|---|---|
| 管理后台 | <https://admin.tzjii.com> | `guest` | `guest1234` |

- 游客角色：`guest`（自定义只读角色，权限仅为 `content.view`，越权写操作返回 403）
- 账号由 [`apps/api/scripts/create-guest-user.cjs`](apps/api/scripts/create-guest-user.cjs)
  幂等创建/重置（服务器 API 容器内执行，含审计留痕），重复执行会同步更新而非报错

## 数据库（Prisma）

schema 单一来源：`apps/api/prisma/schema.prisma`。任何变更都必须同步到数据库：

```bash
make dev          # 先确保 PostgreSQL 在跑（make dev 已包含依赖服务）
make db-push      # 本地开发：把 schema 直接同步到数据库（快速，不含迁移历史）
make db-migrate   # 生产/预发：应用 apps/api/prisma/migrations/ 下的迁移（幂等、可回滚）
```

- 生产部署由 `infra/docker/deploy.sh` 的 `run_migrate` 自动执行 `prisma migrate deploy`，
  **因此任何 schema 变更都必须配套提交 `prisma/migrations/` 下的迁移文件**，否则 prod 不会生效。
- 最近一次变更：`ChatMessage.content` 改为可空（支持仅附件、无文本的消息），
  见迁移 `20260714000100_make_chatmessage_content_optional`。

## 部署

生产部署由 GitHub Actions 自动完成（`.github/workflows/deploy.yml`）：

- `push main` 触发构建并推送镜像至容器仓库（ACR）
- SSH 连接服务器（`infra/docker/deploy.sh`）执行镜像拉取、迁移与服务滚动更新
- 服务器运维入口：`make -C infra/docker <target>`（见 `infra/docker/Makefile`）

## 文档

- [系统架构](ARCHITECTURE.md)
- [编码规范](CONVENTIONS.md)
- [开发指南](AGENTS.md)
- [变更日志](CHANGELOG.md)
- [API 文档](docs/api/README.md)
- [品牌规范](docs/brand/README.md)
- [设计系统](docs/design/README.md)
- [架构决策记录](docs/decisions/README.md)
