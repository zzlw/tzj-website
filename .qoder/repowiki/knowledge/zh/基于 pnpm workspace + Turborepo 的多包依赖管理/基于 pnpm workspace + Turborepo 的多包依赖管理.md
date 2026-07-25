---
kind: dependency_management
name: 基于 pnpm workspace + Turborepo 的多包依赖管理
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - pnpm-workspace.yaml
    - .npmrc
    - turbo.json
    - apps/web/package.json
    - apps/admin/package.json
    - apps/api/package.json
---

该仓库采用 pnpm workspace 作为多包依赖管理的核心，配合 Turborepo 进行任务编排与缓存加速，形成统一的 Monorepo 依赖治理体系。

**系统架构与工具链**
- 包管理器：pnpm（版本锁定在 packageManager 字段为 11.9.0，engines 要求 >=9.0.0），通过 pnpm-workspace.yaml 定义工作区范围（apps/*、packages/*）
- 构建编排：Turborepo（turbo.json 配置 build/dev/lint/test/typecheck/clean/prisma 等任务及其依赖关系与缓存策略）
- 镜像源：.npmrc 指定 registry=https://registry.npmmirror.com（淘宝镜像），并启用 shamefully-hoist=true 兼容传统 node_modules 结构
- 类型检查：TypeScript 6.0.3，根目录 tsconfig.base.json 统一基础配置

**依赖声明策略**
- Catalog 集中版本管理：pnpm-workspace.yaml 的 catalog 段统一管理 web/admin 共享依赖（next、react、lucide-react、tailwindcss、zod、@tanstack/react-query 等），各应用通过 "catalog:" 引用，保持各自为直接依赖以便 Next.js 正常解析
- 工作区内包引用：应用间依赖使用 "workspace:*" 协议（如 @tzj/types、@tzj/ui、@tzj/dnd），确保本地开发时自动链接
- 原生模块白名单：.npmrc 中 onlyBuiltDependencies[] 明确列出需要编译的原生依赖（@prisma/client、sharp、bcrypt、@swc/core 等），避免不必要的重新安装
- 允许构建包：pnpm-workspace.yaml 的 allowBuilds 配置允许特定包执行构建脚本（如 @alicloud/openapi-core、@parcel/watcher）

**Monorepo 包结构**
- apps/ 下三个独立应用：@tzj/web（官网）、@tzj/admin（管理后台）、@tzj/api（NestJS 后端）
- packages/ 下共享包：@tzj/config、@tzj/dnd、@tzj/theme、@tzj/types、@tzj/ui
- 每个子包拥有独立的 package.json，声明自身依赖并通过 workspace:* 或 catalog: 引用共享依赖

**约束与规范**
- Node/pnpm 版本锁定：package.json engines 字段强制 node>=22.0.0、pnpm>=9.0.0
- 严格 peer 依赖禁用：strict-peer-dependencies=false，auto-install-peers=true，降低依赖冲突成本
- 最小发布年龄豁免：minimumReleaseAgeExclude 对 lucide-react、postcss 等包放宽安全扫描限制
- 构建产物缓存：Turborepo 缓存 .next/**、dist/**、build/** 等输出目录，提升增量构建速度
- 环境变量隔离：globalDependencies 包含 **/.env.*local 和 **/.env，确保环境变更触发重建