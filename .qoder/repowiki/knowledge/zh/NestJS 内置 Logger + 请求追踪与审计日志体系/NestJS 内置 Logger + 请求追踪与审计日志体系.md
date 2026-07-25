---
kind: logging_system
name: NestJS 内置 Logger + 请求追踪与审计日志体系
category: logging_system
scope:
    - '**'
source_files:
    - apps/api/src/main.ts
    - apps/api/src/common/middleware/request-id.middleware.ts
    - apps/api/src/common/filters/http-exception.filter.ts
    - apps/api/src/common/interceptors/audit.interceptor.ts
---

## 1. 使用的系统与框架
- 后端（apps/api）：使用 NestJS 内置的 `@nestjs/common` 提供的 `Logger` 类，作为全项目统一的结构化日志输出工具。
- 前端（apps/admin、apps/web）：未引入第三方日志库，仅通过原生 `console.log / console.error / console.info` 输出调试信息，无统一日志框架。

## 2. 核心文件与位置
- `apps/api/src/main.ts`：应用启动入口，配置 NestJS 全局 logger 级别并输出启动信息。
- `apps/api/src/common/middleware/request-id.middleware.ts`：为每个 HTTP 请求注入 `traceId`（x-request-id），贯穿日志与错误响应。
- `apps/api/src/common/filters/http-exception.filter.ts`：全局异常过滤器，统一错误响应格式并在服务端记录错误日志。
- `apps/api/src/common/interceptors/audit.interceptor.ts`：审计拦截器，对已登录用户的写操作落库审计日志，包含 traceId、IP、User-Agent 等字段。
- 各 Service/Controller 中通过 `new Logger('模块名')` 实例化日志对象，如 `Auth`、`RolesService`、`IpLocationService`、`Exception`、`Audit` 等。

## 3. 架构与约定
- **日志级别策略**：在 `main.ts` 中通过 `{ logger: ['error', 'warn', 'log', 'debug', 'verbose'] }` 开启全部级别，由运行环境控制实际输出。
- **上下文追踪**：`requestId` 中间件从上游 `x-request-id` 头获取或生成 UUID，挂载到 `req.id` 并回写响应头；异常过滤器和审计拦截器均使用该 `traceId` 关联一次请求的全链路日志。
- **结构化字段**：审计日志写入 `auditLog` 表时包含 `userId`、`action`、`resource`、`resourceId`、`detail`、`ip`、`userAgent`、`traceId` 等字段，便于按用户/资源/时间维度检索。
- **错误响应格式**：所有未捕获异常统一返回 `{ success: false, error: { code, message, details? }, traceId, timestamp, path }`，生产环境隐藏具体异常消息。
- **敏感信息过滤**：审计详情中对 `password`、`actorPassword`、`newPassword`、`currentPassword` 等键进行排除，避免密码泄露。

## 4. 约定与约束
- **后端必须使用 NestJS Logger**：所有 Service/Module 通过 `private readonly logger = new Logger('ClassName')` 实例化，禁止直接使用 `console.*` 输出业务日志（脚本/seed 除外）。
- **traceId 必须贯穿**：所有需要可追踪的请求应携带 `x-request-id` 头；若缺失则自动生成，且该 ID 会出现在错误响应与审计日志中。
- **审计范围限定**：仅对 POST/PUT/PATCH/DELETE 方法且已认证用户的写操作记录审计日志，失败或异常不写入（由异常过滤器处理）。
- **生产环境脱敏**：异常过滤器在生产模式下将 `message` 固定为 `Internal server error`，不暴露堆栈细节。
- **前端无统一日志**：`apps/web` 与 `apps/admin` 未集成集中式日志系统，仅保留必要的 `console.*` 调试输出，无级别控制或收集机制。