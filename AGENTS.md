# AI Agent 行为规范 — TZJ Monorepo

> 本文件定义了 AI Agent 在 Monorepo 中的行为边界、职责划分和协作协议。
> 参考：Anthropic Constitutional AI、OpenAI Guardrails、Vercel AI SDK 最佳实践。

---

## Agent 角色定义

### Architecture Agent (A1)

**职责范围**
- Monorepo 架构规划与包边界约束
- 依赖治理（循环依赖检测、版本一致性）
- Workspace 拓扑维护（apps/* → packages/* 单向依赖）
- Turborepo Pipeline 编排与优化
- 技术栈升级决策（Next.js / NestJS / Prisma 版本锁定）

**所有权**
- `turbo.json`、`tsconfig.base.json`、`pnpm-workspace.yaml`
- `packages/*/package.json` 的 `dependencies` / `peerDependencies`
- `apps/*/package.json` 的 `dependencies`
- `biome.json` 全局规则

**禁止操作**
- 不得修改业务代码（Controller / Service / Component 内部实现）
- 不得添加 `apps/` 之间的直接依赖
- 不得引入未经审批的第三方包
- 不得变更 `packages/types` 中的已发布类型（仅允许新增）

---

### Code Generation Agent (A2)

**职责范围**
- 生产代码生成（组件、页面、API 模块）
- 类型安全保证（TypeScript strict mode 合规）
- 共享组件复用（优先使用 `packages/ui` 中的组件）
- 代码风格一致性（Biome linter + formatter 规则遵循）
- 单元测试与集成测试生成

**所有权**
- `apps/*/src/**` 业务代码
- `packages/ui/src/**` UI 组件
- `packages/types/src/**` 类型定义（新增）
- `apps/api/prisma/schema.prisma`（与 A1 协商后修改）

**禁止操作**
- 不得修改根目录配置文件（package.json / turbo.json）
- 不得引入 `any` 类型（除非有明确的 `@ts-expect-error` 注释说明原因）
- 不得在 `apps/web` 或 `apps/admin` 中直接调用 Prisma（必须通过 API）
- 不得硬编码环境变量（必须使用 `.env` + 运行时验证）
- 不得使用 `dangerouslySetInnerHTML`（除非经过 XSS 过滤管道）

---

## Agent 协作协议

### JSON Contract（Agent 间通信格式）

```typescript
interface AgentMessage {
  from: "A1" | "A2";
  to: "A1" | "A2";
  type: "request" | "response" | "notification" | "escalation";
  priority: "low" | "medium" | "high" | "critical";
  subject: string;
  payload: Record<string, unknown>;
  timestamp: string; // ISO 8601
  correlationId: string; // UUID for tracing
}
```

### 通信流程

```
1. A2 需要修改 Schema → 发送 request 给 A1
2. A1 评估影响 → 回复 response（approve/reject + 理由）
3. A1 approve → A2 执行变更 → 发送 notification 确认完成
4. 冲突 → A1 发起 escalation → 人类决策
```

### 边界冲突解决

| 场景 | 决策者 | 理由 |
|------|--------|------|
| 新增 package | A1 | 架构变更 |
| 新增 UI 组件 | A2 | 代码生成 |
| 修改 shared type | A1 审批, A2 执行 | 类型安全影响全局 |
| 新增 API endpoint | A2 | 业务代码 |
| 修改 CORS 策略 | A1 | 安全架构 |
| 新增 npm 依赖 | A1 审批 | 依赖治理 |

---

## Workspace 所有权矩阵

| 路径 | 所有者 | 修改需审批 |
|------|--------|-----------|
| `apps/api/src/**` | A2 | 否 |
| `apps/web/src/**` | A2 | 否 |
| `apps/admin/src/**` | A2 | 否 |
| `packages/ui/src/**` | A2 | 新增/删除组件需 A1 知悉 |
| `packages/types/src/**` | A1 + A2 | 是（A1 审批） |
| `turbo.json` | A1 | 否（A1 专属） |
| `*.config.*` (根) | A1 | 否（A1 专属） |
| `prisma/schema.prisma` | A2 提议, A1 审批 | 是 |


---

## 失败处理策略

### 编译失败
1. A2 自动分析错误日志
2. 尝试修复（最多 3 轮）
3. 3 轮后仍失败 → 生成诊断报告 → escalation

### 类型错误
1. 检查是否为共享类型变更引起
2. 若是 → 通知 A1 评估
3. 若否 → A2 自行修复

### 运行时错误
1. 收集 stacktrace + 上下文
2. 分类：可重试 / 不可重试
3. 不可重试 → 生成 Bug Report → escalation

### 安全评分不通过
1. 立即阻断生成流程
2. 生成安全报告（风险等级 + 影响范围 + 修复建议）
3. critical/high → escalation
4. medium/low → 加入 Backlog

---

## 代码生成约束（Constitutional Rules）

### 必须遵循
1. **TypeScript Strict Mode** — 所有代码必须在 `strict: true` 下编译通过
2. **Import 顺序** — Biome `organizeImports` 自动排序（`builtin → external → internal → relative → types`）
3. **组件命名** — PascalCase，文件名与组件名一致
4. **Hook 规则** — 自定义 Hook 以 `use` 开头，仅在顶层调用
5. **错误边界** — 每个 Page 组件必须有 ErrorBoundary 包裹
6. **SSR 兼容** — 禁止在 Server Component 中使用 `window` / `document`
7. **环境变量** — 使用 `zod` 在启动时验证所有环境变量
8. **国际化准备** — 所有用户可见文本使用 i18n key

### 绝对禁止
1. ❌ `eval()` / `Function()` 动态代码执行
2. ❌ `innerHTML` / `dangerouslySetInnerHTML`（未经 DOMPurify 过滤）
3. ❌ `console.log` 遗留在生产代码中
4. ❌ 硬编码的 URL / 密钥 / 凭证
5. ❌ `@ts-ignore` / `@ts-nocheck` 跳过类型检查
6. ❌ 未处理的 Promise rejection
7. ❌ 同步文件 I/O（`readFileSync` / `writeFileSync` 在请求处理中）
8. ❌ `npm install` 在 CI/CD 中（必须使用 `pnpm install --frozen-lockfile`）

---

## 对象存储规范 (S3/MinIO/OSS)

### 存储架构

| 环境 | 服务 | 端点 | 说明 |
|------|------|------|------|
| 本地开发 | MinIO | `localhost:9000` (API), `localhost:9001` (Console) | Docker Compose 启动 |
| 生产环境 | 阿里云 OSS | `oss-cn-*.aliyuncs.com` | S3 兼容协议，零代码切换 |

统一 SDK：`@aws-sdk/client-s3`，服务层封装在 `apps/api/src/storage/s3.service.ts`。

### 环境变量

```
S3_BUCKET              — Bucket 名称（本地: tzj-uploads-dev）
S3_REGION              — 区域（本地: us-east-1，线上: oss-cn-xxx）
S3_ENDPOINT            — S3 端点（本地: http://localhost:9000）
S3_ACCESS_KEY_ID       — 访问密钥
S3_ACCESS_KEY_SECRET   — 密钥密文
S3_PUBLIC_DOMAIN       — 公开访问域名前缀（本地: http://localhost:9000/tzj-uploads-dev）
```

### Bucket 目录结构

```
tzj-uploads-dev/
├── products/           — 品牌产品图（trainingtowers.com 素材）
├── images/{YYYYMM}/    — 产品/案例/新闻图（www.tzjii.com 自有素材）
├── statics/            — Logo、UI 图标、服务图
├── videos/             — 视频文件（Hero 背景、产品演示）
└── uploads/            — 用户上传文件（通过 StorageController API）
```

### URL 规范

1. 所有数据库中存储的媒体 URL 必须以 `S3_PUBLIC_DOMAIN` 为前缀
2. 前端 `next.config.ts` 的 `images.remotePatterns` 必须包含 MinIO/OSS 域名
3. **禁止硬编码** `localhost:9000` 或 OSS 域名，统一通过 `S3_PUBLIC_DOMAIN` 环境变量
4. Seed 脚本和批量上传脚本中的 URL 必须使用 `S3_PUBLIC_DOMAIN` 拼接

### 上传最佳实践

- 图片上传前压缩（推荐 WebP 格式，单文件 < 500KB）
- 视频使用 MP4 (H.264) 格式，分辨率不超过 1080p，时长建议 < 30s
- 文件命名规则：`{timestamp}-{sanitized-original-name}`
- 通过 `POST /api/v1/storage/upload` API 上传（单文件 10MB 限制）
- MinIO Bucket 设置为公开读取（`public` policy），无需签名即可访问

### 所有权

- `apps/api/src/storage/` — A2 维护（S3Service, StorageController）
- `apps/api/src/seed/upload-media.ts` — A2 维护（批量上传脚本）
- `biome.json` — A1 维护（linter + formatter 全局配置）

---

## 设计令牌规范 (Design Tokens)

### 分层架构（B2 多主题后）

- **web（C 端）**：维持编译期 `@theme` 直写——ui 共享基准在前、app 覆盖在后，视觉不变，不加载主题切换器。
- **admin（B 端）**：运行时主题机制——工具类经 `@theme inline` 映射到原始变量（oklch），`:root` / `.dark` / `.theme-*` 运行时切换；10 套配色预设（含品牌红 `theme-brand`）+ 明暗模式 + cookie 持久化。默认主题为品牌红 `theme-brand`（无 cookie 时服务端与客户端均回退 brand），中性 zinc 体系作为「默认」预设保留可选。细则见 CONVENTIONS.md「Admin 多主题机制」。

### 圆角刻度 (Border Radius)

- 共享基准刻度（`packages/ui/src/globals.css`）：

  | token | sm | md | lg | xl | 2xl | 3xl | 4xl | 6xl | 8xl |
  |-------|----|----|----|----|-----|-----|-----|-----|-----|
  | 值(rem) | 0.25 | 0.5 | 0.75 | 1 | 1 | 1.5 | 2 | 3 | 4 |
  | 值(px) | 4 | 8 | 12 | 16 | 16 | 24 | 32 | 48 | 64 |

- 各 app 现状：
  - **admin**：由单一运行时 `--radius` 派生（sm=-4px / md=-2px / lg=基准 / xl=+4px / 2xl=+8px / 3xl=+14px），默认 0.625rem；主题预设可覆盖 `--radius` 整体缩放（如 `theme-brand` 的 0.375rem 锐利工业风）；`4xl+` 走共享基准。旧版「逐档枚举覆盖 + 单调递增审查」对 admin 废止（派生机制天然单调）。
  - **web（C 端 Rosenbauer 工业风）**：`sm~xl` 锐利（2/2/4/4px）、`2xl=6px`、`3xl=16px`（作"桥梁"，避免断崖）、`4xl/6xl/8xl` 大圆角（32/48/64px）。
- **禁止事项（Constitutional，适用于 web 等枚举式覆盖）**：app 覆盖圆角时，相邻大刻度之间必须保持**单调、可预期的递增**，禁止出现"锐利小圆角 → 大圆角"的断崖。若需锐利工业风，仅覆盖到 `2xl` 及以下；`4xl+` 大圆角档应连续，中间用 `3xl` 等档位作过渡桥梁。

### 所有权

- `packages/ui/src/globals.css` 的圆角基准与语义状态令牌 — A1 维护（共享令牌，改动需评审）
- `apps/admin/src/app/globals.css` + `theme-presets.css` 的运行时主题层 — A2 维护，预设必须同时提供明暗两套值
- `apps/web/src/app/globals.css` 的品牌覆盖 — A2 维护，须遵守上方"禁止事项"

---

## 持续改进

- 每次 PR 合并后，通过 Biome lint + TypeScript strict 模式保障代码质量
- 月度代码质量回顾 → 人类审核 + 规范更新
