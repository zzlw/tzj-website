# TZJ Monorepo 开发指南

> 面向贡献者与 AI 编码助手的项目约定：技术栈、目录结构、开发命令与代码规范。

## 技术栈

| 层 | 技术 |
|---|------|
| 官网 / 后台 | Next.js 16 · React 19 · Tailwind CSS 4 · Shadcn/ui |
| API | NestJS 11 · Prisma 7 · PostgreSQL 16 |
| 构建 | Turborepo · pnpm workspace |
| 质量 | Biome 2.x (lint + format) · TypeScript strict |

## 目录结构

```
apps/
├── web/          # C 端官网
├── admin/        # CMS 管理后台
└── api/          # REST API（NestJS）
packages/
├── ui/           # 共享 UI 组件 (@tzj/ui)
├── types/        # 共享类型 (@tzj/types)
├── theme/        # 设计令牌 (@tzj/theme)
├── config/       # 共享配置 (@tzj/config)
└── ...
infra/docker/     # Docker 编排 + 服务器脚本
docs/             # 架构/规范/设计文档
```

依赖拓扑：`apps/*` → `packages/*` 单向依赖，包间不允许循环依赖。

## 开发命令

```bash
pnpm install       # 安装依赖
make dev           # 启动本地依赖服务（PostgreSQL + Redis + MinIO）
pnpm dev           # 启动全部应用（web:3001 / admin:3002 / api:4000）
pnpm typecheck     # 全仓 TypeScript 类型检查
pnpm lint          # Biome lint + format 检查
```

本地数据库 schema 同步使用 `make db-push`（非破坏性）；生产使用
`prisma migrate deploy`，任何 schema 变更必须配套 `apps/api/prisma/migrations/`
下的迁移文件。

## 代码规范（Constitutional Rules）

### 必须遵循
1. **TypeScript Strict Mode** — 所有代码在 `strict: true` 下编译通过
2. **Import 顺序** — Biome `organizeImports` 自动排序（`builtin → external → internal → relative → types`）
3. **组件命名** — PascalCase，文件名与组件名一致
4. **Hook 规则** — 自定义 Hook 以 `use` 开头，仅在顶层调用
5. **错误边界** — 每个 Page 组件必须有 ErrorBoundary 包裹
6. **SSR 兼容** — 禁止在 Server Component 中使用 `window` / `document`
7. **环境变量** — 使用 `zod` 在启动时验证所有环境变量
8. **国际化** — 所有用户可见文本使用 i18n key

### 绝对禁止
1. ❌ `eval()` / `Function()` 动态代码执行
2. ❌ `innerHTML` / `dangerouslySetInnerHTML`（未经 DOMPurify 过滤）
3. ❌ `console.log` 遗留在生产代码中
4. ❌ 硬编码的 URL / 密钥 / 凭证
5. ❌ `@ts-ignore` / `@ts-nocheck` 跳过类型检查
6. ❌ 未处理的 Promise rejection
7. ❌ 同步文件 I/O（`readFileSync` / `writeFileSync` 在请求处理中）

## 设计令牌

设计令牌分层：`packages/theme` 提供共享基准，各应用在自身 `globals.css` 中覆盖。
圆角覆盖须保持相邻刻度单调递增，禁止「锐利小圆角 → 大圆角」的断崖。
详见 [docs/design](docs/design/README.md) 与 [CONVENTIONS.md](CONVENTIONS.md)。

## 许可证

本项目采用 [MIT License](LICENSE)。
