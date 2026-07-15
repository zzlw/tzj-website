# TZJ — 拓之迹官网

> 应急救援训练装备制造商官网 + CMS 管理后台，Turborepo Monorepo 架构。

## 技术栈

| 层 | 技术 |
|---|------|
| 官网 | Next.js 16 · React 19 · Tailwind CSS 4 · Shadcn/ui |
| 后台 | Next.js 16 · React 19 |
| API | NestJS 11 · Prisma 7 · PostgreSQL 16 |
| 构建 | Turborepo · pnpm workspace |
| 质量 | Biome 2.x (lint + format) · TypeScript strict |
| 部署 | 云效 Flow · ACR · Docker Compose · ECS |

## 项目结构

```
├── apps/
│   ├── web/          # C 端官网 (tzj.jiawen.live)
│   ├── admin/        # CMS 管理后台 (tzj-admin.jiawen.live)
│   └── api/          # REST API (tzj-api.jiawen.live)
├── packages/
│   ├── ui/           # 共享 UI 组件 (@tzj/ui)
│   ├── types/        # 共享类型 (@tzj/types)
│   ├── theme/        # 设计令牌 (@tzj/theme)
│   └── config/       # 共享配置 (@tzj/config)
├── infra/
│   ├── docker/       # Docker 编排 + 部署脚本
│   └── yunxiao/      # 云效 CI/CD 流水线
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

```bash
# 本地构建 + push ACR + SSH 部署 ECS
./infra/docker/deploy-local.sh

# 仅构建
./infra/docker/deploy-local.sh --build-only

# 仅部署已有 tag
./infra/docker/deploy-local.sh --deploy-only --tag <commit-hash>
```

## 文档

- [系统架构](ARCHITECTURE.md)
- [编码规范](CONVENTIONS.md)
- [AI Agent 行为规范](AGENTS.md)
- [变更日志](CHANGELOG.md)
- [API 文档](docs/api/README.md)
- [品牌规范](docs/brand/README.md)
- [设计系统](docs/design/README.md)
- [架构决策记录](docs/decisions/README.md)
