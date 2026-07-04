# Architecture Decision Records (ADR)

本目录记录关键架构决策。

## ADR-001: 技术栈选型

**状态**: 已采纳
**日期**: 2025-01

**决策**:
- 前端: Next.js 15 + React 19 + App Router + Tailwind CSS 4
- 后端: NestJS 11 + Prisma 6 + PostgreSQL
- 组件: Shadcn/ui (Radix UI primitives)
- 构建: Turborepo + pnpm workspace
- 代码质量: Biome (lint + format)
- 管理后台: 与官网统一技术栈 (Next.js 15)

**理由**:
- Next.js 15 App Router 提供最佳 SSR/ISR 性能
- NestJS 提供成熟的企业级后端架构
- Prisma 6 类型安全 ORM 与 TypeScript 深度集成
- Turborepo 高效 Monorepo 构建编排

## ADR-002: 设计基准

**状态**: 已采纳
**日期**: 2025-01

**决策**:
- 学 Rosenbauer 的「调性」— 深色主题、全屏 Hero、品牌红强调
- 学 WHP Training Towers 的「结构」— Hero → Split → Bento Grid → Stats → Tabs → CTA → Form → Footer

**理由**:
- Rosenbauer 作为全球消防设备制造商，其网站调性与拓之迹的应急救援训练装备定位高度契合
- WHP 的信息架构清晰展示了产品线分类和方案对比的最佳实践

## ADR-003: Harness 治理体系

**状态**: 已采纳
**日期**: 2025-01

**决策**:
- 采用 R.E.S.T 四维评分 (Reliability/Efficiency/Security/Traceability)
- 最低通过分 80/100
- 6 个 Inspector + 2 个 Evaluator + 5 个 Pipeline + 2 个 Reporter

**理由**:
- 参考 Anthropic Constitutional AI、OpenAI Guardrails、Vercel AI SDK 最佳实践
- 结构化治理确保 AI 生成代码的质量门禁
