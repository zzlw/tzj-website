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
- **禁止**: 硬编码颜色值（#xxx）在组件 className 中；语义状态禁用 Tailwind palette 类（emerald/amber 等），统一走 `success/warning/info` 语义令牌

### Admin 多主题机制（B2）

- **分层**: 工具类经 `@theme inline` 映射到运行时原始变量（`--background` 等 oklch 值），由 `:root` / `.dark` / `.theme-*` 在运行时切换，**禁止**在 admin 的 `@theme` 块内直写颜色字面值（会被烘进编译产物，主题无法覆盖）
- **CSS 内部引用**: admin 作用域内引用变量用 `var(--primary)` 等原始变量，不用 `var(--color-*)`（inline 模式下不产出）
- **预设**: 10 套配色预设定义在 `apps/admin/src/app/theme-presets.css`，预设类挂 `<body>`，仅覆盖强调色；每个预设必须同时提供 `.dark .theme-*` 暗色对应值
- **持久化**: 配色预设用 cookie `active_theme`（服务端预置 body 类，无闪变）；明暗模式由 next-themes 管理（html 上的 `.dark` 类）
- **圆角**: 由单一 `--radius` 派生（sm=-4px / md=-2px / lg=基准 / xl=+4px / 2xl=+8px / 3xl=+14px），预设可覆盖 `--radius` 整体缩放，逐档枚举式覆盖已废止
- **护栏**: `scripts/check-palette-escape.mjs` 随根 `pnpm check` 执行（CI 同步卡口），扫描 `apps/admin/src` + `packages/ui/src` 的 palette 逃逸色；web 官网豁免

### Admin 排版节奏（C1）

| 维度 | 允许值 | 禁止 |
|------|--------|------|
| 字号 | `text-xs / sm / base / lg / 2xl` 五档 | 任意值字号（`text-[10px]`、`text-[0.65rem]` 等） |
| 间距 | `gap-2 / 4 / 6` | 随意混用中间档 |
| 区块间距 | `space-y-6` | 逐页自定节奏 |
| 按钮高度 | 组件 size 变体（`xs / sm / default / lg / xl / icon / icon-sm / icon-xs`） | `h-7` / `h-8 w-8` 式 className 覆盖 |

- 数字展示（统计值、字节数、百分比等）统一加 `tabular-nums`
- 图标语义遵循 `docs/design/icon-semantics.md`，一个动作一个图标

### 后台 UI 文案规范（C1）

- **零形容词、零营销句**: 描述事实与动作，不写「强大的」「轻松管理」式修饰；空态与说明文案只讲「是什么、下一步做什么」
- **零建议句**: 不使用「建议您…」「您可以尝试…」；操作指引用祈使句直述（「点击右上角新建文档」）
- **动作动词一致**: 同一动作全后台统一用词（新建/编辑/删除/发布/撤回/恢复/转化），不混用「创建/添加/新增」
- **标点**: 中文文案用全角标点，中英文之间不加空格由排版层处理；提示语末尾不加句号，完整句才加

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
