# 编码规范 — TZJ Monorepo

## TypeScript

- **严格模式**: `strict: true`，禁止 `any`（除非 `@ts-expect-error` 附说明）
- **命名**: PascalCase (类/组件/类型)，camelCase (变量/函数)，UPPER_SNAKE (常量)
- **导入顺序**: `builtin → external → internal (@tzj/*) → relative → type imports`
- **导出**: 优先 named export，避免 default export（Page 组件除外）

## React / Next.js

- **组件**: 函数组件 + Hooks，禁止 class 组件
- **Server Components**: 默认使用，仅交互组件标记 `"use client"`
- **文件**: 组件文件名与导出名一致，PascalCase
- **Props**: 使用 interface 定义，内联在组件文件顶部
- **Hooks**: 自定义 Hook 以 `use` 开头，仅在顶层调用
- **Key**: `.map()` 渲染必须使用稳定唯一 key（非 index）

## NestJS

- **分层**: Controller → Service → PrismaService（禁止 Controller 直接调用 Prisma）
- **DTO**: 使用 class-validator 装饰器验证
- **模块**: 每个业务域独立 Module，通过 `forRoot()` 注入全局 PrismaModule

## Tailwind CSS

- **版本**: Tailwind CSS 4，使用 `@theme` CSS 变量配置
- **自定义属性**: 所有颜色使用 design token（`bg-background`、`text-primary` 等）
- **禁止**: 硬编码颜色值（#xxx）在组件 className 中

## 提交规范

- **格式**: Conventional Commits
  ```
  feat(scope): 描述
  fix(scope): 描述
  docs(scope): 描述
  refactor(scope): 描述
  chore(scope): 描述
  ```
- **scope**: `web` / `admin` / `api` / `ui` / `types` / `config` / `infra` / `root`

## 文件组织

```
apps/web/src/
├── app/              # Next.js App Router 页面
├── components/
│   ├── layout/       # Header, Footer
│   └── sections/     # 页面 Section 组件
└── lib/              # 工具函数、API Client

apps/api/src/
├── {module}/
│   ├── {module}.controller.ts
│   ├── {module}.service.ts
│   ├── {module}.module.ts
│   └── dto/
├── common/           # 全局 Filter / Interceptor / Pipe
└── prisma/           # PrismaModule / PrismaService
```

## 代码审查检查清单

- [ ] TypeScript strict 编译通过
- [ ] 无 `any` 类型
- [ ] Server/Client Component 边界正确
- [ ] 环境变量使用 zod 验证
- [ ] 无硬编码 URL / 密钥
- [ ] 错误处理完整（try-catch / ErrorBoundary）
- [ ] 导入顺序规范
