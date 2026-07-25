---
kind: error_handling
name: TZJ Monorepo 错误处理体系
category: error_handling
scope:
    - '**'
source_files:
    - apps/api/src/common/filters/http-exception.filter.ts
    - apps/api/src/common/interceptors/transform.interceptor.ts
    - apps/api/src/common/interceptors/audit.interceptor.ts
    - apps/admin/src/lib/apiClient.ts
    - apps/admin/src/lib/notify.ts
    - apps/admin/src/app/global-error.tsx
---

## 1. 系统/方法概述
本仓库在后端（NestJS）与前端（Next.js Admin/Web）分别建立了统一的错误处理机制：后端通过全局异常过滤器与响应拦截器标准化 HTTP 错误与成功响应；前端通过 ApiError 类型、统一请求封装与 toast 通知组件，将后端错误信息转化为用户可感知的提示。

## 2. 关键文件与包
- 后端统一错误过滤器：`apps/api/src/common/filters/http-exception.filter.ts`
- 后端统一成功响应拦截器：`apps/api/src/common/interceptors/transform.interceptor.ts`
- 后端审计拦截器（失败不中断主流程）：`apps/api/src/common/interceptors/audit.interceptor.ts`
- 前端 API 客户端与错误类：`apps/admin/src/lib/apiClient.ts`
- 前端统一通知封装：`apps/admin/src/lib/notify.ts`
- 前端全局错误页面（Next.js App Router）：`apps/admin/src/app/global-error.tsx`
- 业务模块中广泛使用 NestJS 内置异常（UnauthorizedException、ForbiddenException、NotFoundException、BadRequestException、ConflictException 等），例如 `apps/api/src/auth/auth.service.ts`、`apps/api/src/access/roles.service.ts`、`apps/api/src/auth/guards/roles.guard.ts`。

## 3. 架构与约定
- 后端统一错误响应格式
  - `AllExceptionsFilter` 捕获所有未处理异常，返回 `{ success: false, error: { code, message, details? }, traceId, timestamp, path }`。
  - 对 `HttpException` 子类优先提取其 response 中的 `error.message` / `code` / `details`；非 HttpException 时，生产环境隐藏具体堆栈，仅返回 `Internal server error`。
  - 状态码映射：5xx → `INTERNAL_ERROR`，其他 → `ERROR` 或对应 `HttpStatus` 常量名。
- 后端统一成功响应格式
  - `TransformInterceptor` 将控制器返回值包装为 `{ success: true, data, pagination?, traceId, timestamp }`。
  - 若 service 返回 `{ data, pagination }` 结构，自动提升 `pagination` 到顶层。
- 审计与幂等性
  - `AuditInterceptor` 仅对已登录用户的写操作（POST/PUT/PATCH/DELETE）记录审计日志，且写入失败不影响主流程（try/catch + warn）。
- 前端错误传播
  - `apiClient.ts` 的 `request` 函数在 `!res.ok || body.success === false` 时抛出 `ApiError`，携带 `status`、`code`、`details`。
  - `notifyError` 优先取 `ApiError.message`，否则回退字符串或默认文案，并通过 `@tzj/ui` 的 `toast.error` 展示。
- 前端全局错误页
  - Next.js 的 `global-error.tsx` 提供“页面出错了”兜底 UI，包含重试按钮调用 `reset()`。

## 4. 约定与约束
- 后端服务层应抛出 NestJS 内置异常（如 `UnauthorizedException`、`ForbiddenException`、`NotFoundException`、`BadRequestException`、`ConflictException`），由 `AllExceptionsFilter` 统一格式化，避免直接 throw 裸 `Error`。
- 对外暴露的错误体必须遵循 `{ code, message, details? }` 结构，便于前端解析与展示。
- 成功响应一律经 `TransformInterceptor` 包装，禁止控制器直接返回裸数据。
- 前端所有网络请求统一走 `apiClient.ts` 的 `api.*` 方法，错误以 `ApiError` 形式向上冒泡，再由 `notifyError` 或业务逻辑自行处理。
- 审计日志写入失败不得影响主业务流程，需 try/catch 并记录警告日志。
- 环境变量校验失败（如 `config/env.validation.ts`）直接 throw Error 终止启动，属于启动期不可恢复错误。