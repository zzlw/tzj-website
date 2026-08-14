# 系统架构设计 — TZJ Monorepo

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Turborepo Orchestrator                │
├───────────────┬─────────────────┬───────────────────────┤
│   apps/web    │   apps/admin    │     apps/api          │
│   Next.js 16  │   Next.js 16    │     NestJS 11         │
│   React 19    │   React 19      │     Prisma 7          │
│   Port 3001   │   Port 3002     │     Port 4000         │
├───────────────┴─────────────────┴───────────────────────┤
│              Shared Packages Layer                       │
├─────────┬───────────┬─────────────┬─────────────────────┤
│ @tzj/ui │ @tzj/types│ @tzj/config │    @tzj/theme       │
│ Shadcn  │ Entities  │ Biome/TS    │    Design Tokens    │
├─────────┴───────────┴─────────────┴─────────────────────┤
│              Infrastructure (Docker + CI/CD)                │
│  deploy.sh + GitHub Actions + acme.sh         │
└─────────────────────────────────────────────────────────┘
```

## 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| 框架 | Next.js (App Router) | 16.x |
| UI | React | 19.x |
| 后端 | NestJS | 11.x |
| ORM | Prisma | 7.x |
| 数据库 | PostgreSQL | 16.x |
| 样式 | Tailwind CSS | 4.x |
| 组件 | Radix UI + Shadcn/ui | latest |
| 构建 | Turborepo | 2.x |
| 包管理 | pnpm workspace | 11.x |
| 语言 | TypeScript | 6.x |
| 代码质量 | Biome | latest |

## 数据流

```
Browser → apps/web (SSR/ISR) → apps/api (REST) → PostgreSQL
Browser → apps/admin (CSR)   → apps/api (REST) → PostgreSQL
```

## 包依赖关系

```
apps/web   → @tzj/ui, @tzj/types, @tzj/theme
apps/admin → @tzj/ui, @tzj/types, @tzj/theme
apps/api   → @tzj/types
packages/ui     → @tzj/theme (peerDependency: react)
packages/theme  → (无依赖)
packages/types  → (无依赖)
packages/config → (无依赖, 仅导出配置)
```

## API 设计

- REST API，全局前缀 `/api/v1`
- Swagger 文档: `/api/docs`
- 健康检查: `/api/v1/health`
- CORS: 允许 web(3001) + admin(3002)
- 统一响应格式: `{ code, message, data, pagination? }`

## 安全策略

- JWT RS256 认证 + RBAC 角色守卫
- Prisma ORM 防 SQL 注入
- class-validator 输入验证
- CORS 白名单
- 环境变量启动校验 (zod)
