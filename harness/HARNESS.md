# R.E.S.T 评分标准 — TZJ Monorepo Harness

> **R**eliability · **E**fficiency · **S**ecurity · **T**raceability
> 四维评分体系，作为 Monorepo 的唯一质量门禁。
> 最低通过分：**80/100**

---

## 评分总览

| 维度 | 权重 | 满分 | 说明 |
|------|------|------|------|
| Reliability（可靠性） | 30% | 30 | 类型安全、错误处理、边界测试 |
| Efficiency（效率） | 25% | 25 | Bundle 大小、渲染性能、API 响应 |
| Security（安全性） | 25% | 25 | XSS/CSRF/注入防护、敏感数据保护 |
| Traceability（可追溯性） | 20% | 20 | 日志、监控、变更审计 |
| **总计** | **100%** | **100** | **≥80 通过, <80 阻断** |

---

## R — Reliability（可靠性）— 30分

### R1: TypeScript 类型安全（10分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| `any` 使用率 | 4 | 0个 any = 4分, 1-2个 = 2分, ≥3个 = 0分 |
| `@ts-expect-error` 使用 | 2 | 仅在有充分注释时允许，否则每项 -1分 |
| 接口/类型覆盖率 | 2 | 所有 API 响应有类型定义 = 2分 |
| 泛型使用合理性 | 2 | 无不必要的泛型嵌套 = 2分 |

### R2: 错误处理（10分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| try-catch 覆盖 | 3 | 所有 async 操作有错误处理 |
| Error Boundary | 3 | 每个 Page 组件有 ErrorBoundary |
| 优雅降级 | 2 | API 失败时有 fallback UI |
| 错误信息质量 | 2 | 错误消息有上下文（非泛型 Error） |

### R3: 边界测试（10分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| 空值处理 | 3 | null/undefined 防御（可选链、空值合并） |
| 数组边界 | 2 | 空数组、超大数组、并发操作 |
| 输入验证 | 3 | class-validator / zod schema 验证 |
| 分页边界 | 2 | 负数页码、超大 limit、越界 offset |

---

## E — Efficiency（效率）— 25分

### E1: Bundle 大小（8分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| Tree-shaking 兼容 | 2 | 使用 ESM exports，无副作用 |
| 动态导入 | 3 | 路由级 code-splitting（Next.js 自动 + 手动 lazy） |
| 图片优化 | 2 | 使用 `next/image`，有 width/height/alt |
| 依赖体积 | 1 | 无 >500KB 的单一依赖未审批 |

### E2: 渲染性能（9分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| Server Component 使用 | 3 | 默认 Server Component，仅交互组件标记 "use client" |
| 不必要的重渲染 | 3 | 正确使用 useMemo/useCallback/React.memo |
| 列表渲染 Key | 1 | 使用稳定唯一 key（非 index） |
| 图片懒加载 | 2 | 首屏外图片使用 loading="lazy" |

### E3: API 响应效率（8分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| N+1 查询 | 3 | 无 N+1 问题（使用 Prisma include / 批量查询） |
| 分页实现 | 2 | 所有列表接口有分页 |
| 缓存策略 | 2 | ISR / SWR / Redis 缓存适当使用 |
| 响应压缩 | 1 | NestJS 启用 gzip/brotli |

---

## S — Security（安全性）— 25分

### S1: 注入防护（10分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| SQL 注入 | 4 | 使用 Prisma ORM，无 raw SQL（或参数化查询） |
| XSS 防护 | 3 | 无 `dangerouslySetInnerHTML`（或经 DOMPurify 过滤） |
| CSRF 防护 | 2 | API 有 Origin/Referer 验证 |
| 路径遍历 | 1 | 无用户输入直接拼接文件路径 |

### S2: 认证与授权（8分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| JWT 安全 | 3 | 使用 RS256、有过期时间、有 refresh 机制 |
| 密码存储 | 2 | bcrypt/argon2 哈希，无明文密码 |
| 权限控制 | 2 | RBAC 实现，API 有角色守卫 |
| CORS 配置 | 1 | 明确的 Origin 白名单 |

### S3: 敏感数据保护（7分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| 环境变量安全 | 3 | `.env` 不提交到 Git，启动时验证 |
| 日志脱敏 | 2 | 日志中无密码、token、PII 数据 |
| API 响应过滤 | 2 | 不返回 password、internalId 等敏感字段 |

---

## T — Traceability（可追溯性）— 20分

### T1: 日志系统（8分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| 结构化日志 | 3 | 使用 JSON 格式日志（NestJS Logger / pino） |
| 请求追踪 | 3 | 每个请求有 correlationId（从 Header → Response） |
| 错误日志 | 2 | 错误日志包含 stacktrace + 上下文信息 |

### T2: 监控与告警（6分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| 健康检查端点 | 2 | `/health` 返回 DB 连接 + 内存 + 版本信息 |
| 性能指标 | 2 | API 响应时间、错误率、吞吐量可观测 |
| 异常告警 | 2 | 5xx 错误率 > 1% 触发告警 |

### T3: 变更审计（6分）

| 检查项 | 分值 | 规则 |
|--------|------|------|
| Git 提交规范 | 2 | Conventional Commits 格式 |
| Schema 迁移 | 2 | Prisma migration 文件有序管理 |
| 变更记录 | 2 | CHANGELOG.md 自动/手动维护 |

---

## 评分算法

```typescript
interface DimensionScore {
  dimension: "R" | "E" | "S" | "T";
  maxScore: number;     // 30 / 25 / 25 / 20
  earnedScore: number;
  details: CheckResult[];
}

interface CheckResult {
  checkId: string;       // e.g. "R1.1"
  name: string;
  maxScore: number;
  earnedScore: number;
  status: "pass" | "warn" | "fail";
  message: string;
  suggestions?: string[];
}

interface ScoreReport {
  totalScore: number;     // 0-100
  passed: boolean;        // >= 80
  dimensions: DimensionScore[];
  timestamp: string;
  gitCommit: string;
  suggestions: string[];  // Top 5 改进建议
}

// 评分计算
function calculateScore(dimensions: DimensionScore[]): ScoreReport {
  const totalScore = dimensions.reduce((sum, d) => sum + d.earnedScore, 0);
  return {
    totalScore,
    passed: totalScore >= 80,
    dimensions,
    timestamp: new Date().toISOString(),
    gitCommit: getGitCommit(),
    suggestions: generateTopSuggestions(dimensions),
  };
}
```

---

## 评分结果处理

### PASS（≥ 80分）
- ✅ 允许代码合并 / 部署
- 📊 记录评分到 `harness/metrics/scores.json`
- 📝 生成评分摘要（附加到 PR 评论）

### WARN（70-79分）
- ⚠️ 允许合并但标记风险
- 📋 生成改进清单（限期 7 天内修复）
- 🔔 通知相关 Agent 关注薄弱维度

### FAIL（< 70分）
- 🚫 **阻断合并 / 部署**
- 📋 生成详细诊断报告
- 🔔 立即通知人类审查
- 🔄 回滚到最近一次 PASS 版本
- 📌 失败维度的所有检查项进入修复队列

---

## 评分趋势监控

```
评分记录格式 (scores.json):
{
  "scores": [
    {
      "date": "2025-01-15T10:00:00Z",
      "commit": "abc123",
      "total": 85,
      "R": 26, "E": 22, "S": 20, "T": 17,
      "passed": true
    }
  ],
  "trend": "improving",      // improving / stable / declining
  "streak": { "pass": 12, "fail": 0 },
  "alerts": []
}
```

**趋势告警规则**：
- 连续 3 次总分下降 → `declining` 告警
- 单一维度连续 2 次下降 → 维度专项审查
- 安全评分 < 15 → 立即安全审查
- 任何维度得分 < 50% → 紧急修复

---

## 持续评估策略

| 触发时机 | 评估范围 | 阻断级别 |
|----------|----------|----------|
| PR 提交 | 变更文件相关维度 | WARN |
| PR 合并前 | 全量四维评估 | FAIL |
| 每日定时 | 全量评估 + 趋势分析 | 仅记录 |
| Schema 变更 | R + S 维度 | FAIL |
| 新依赖引入 | E + S 维度 | WARN |
| 部署前 | 全量四维评估 | FAIL |
