# Architecture Decision Records (ADR)

本目录记录关键架构决策。

## ADR-001: 技术栈选型

**状态**: 已采纳
**日期**: 2026-06-25

**决策**:
- 前端: Next.js 16 + React 19 + App Router + Tailwind CSS 4
- 后端: NestJS 11 + Prisma 7 + PostgreSQL 16
- 组件: Shadcn/ui (Radix UI primitives)
- 构建: Turborepo + pnpm workspace
- 代码质量: Biome 2.x (lint + format)
- 管理后台: 与官网统一技术栈 (Next.js 16)

**理由**:
- Next.js 16 App Router 提供最佳 SSR/ISR 性能
- NestJS 提供成熟的企业级后端架构
- Prisma 7 类型安全 ORM 与 TypeScript 深度集成
- Turborepo 高效 Monorepo 构建编排

## ADR-002: 设计基准

**状态**: 已采纳
**日期**: 2026-06-25（2026-07 更新为浅色风格）

**决策**:
- 学 Rosenbauer 的「调性」— 白底浅色主题、锐利边角、流体大标题、品牌红强调
- 学 WHP Training Towers 的「结构」— 产品中心钻取、信息架构

**理由**:
- Rosenbauer 作为全球消防设备制造商，其网站调性与拓之迹的应急救援训练装备定位高度契合
- WHP 的信息架构清晰展示了产品线分类和方案对比的最佳实践

## ADR-003: 代码质量保障

**状态**: 已采纳
**日期**: 2026-06-25

**决策**:
- Biome 2.x 统一 lint + format
- TypeScript strict mode 强制类型安全
- CI 流水线自动检查（云效 Flow）

**理由**:
- 轻量级工具链，无需额外治理框架
- Biome 速度快、规则全面，替代 ESLint + Prettier

## ADR-004: CI/CD 与部署

**状态**: 已采纳
**日期**: 2026-07

**决策**:
- 主路径: 云效 Flow（公共构建集群）→ ACR → ECS Docker Compose
- 备用: 本地 Mac deploy-local.sh（构建 + push + SSH 部署）
- HTTPS: Let's Encrypt + acme.sh（DNS-01 泛域名）
- 对象存储: 阿里云 OSS（S3 兼容，@aws-sdk/client-s3 零代码切换）

**理由**:
- 云效国内构建速度快，与阿里云 ACR/ECS 网络互通
- Docker Compose 简单可靠，ECS 不参与构建

