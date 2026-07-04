# 拓之迹 后台管理系统（Admin + API）落地方案

> 目标：把现有 `apps/admin`（Next.js 16 后台）与 `apps/api`（NestJS 11 + Prisma）从「脚手架」升级为**生产可用、业内顶级实践**的内容管理系统（CMS），并与 `apps/web` 打通，让运营人员可自助维护产品、案例、新闻、方案、询盘与站点设置。

- 状态：草案 v1
- 适用范围：`apps/api`、`apps/admin`、`apps/web`（数据源迁移部分）
- 关联文档：`ARCHITECTURE.md`、`CONVENTIONS.md`、`docs/product-menu-ia-plan.md`

---

## 0. 结论先行（TL;DR）

现有后端骨架质量不错，但距离「可交付」还差几块**关键拼图**，按优先级：

1. **认证与鉴权（Auth + RBAC）完全缺失** —— `User` 模型、`bcrypt` 依赖、admin 登录页都在，但 **API 没有 auth 模块、没有 JWT、没有守卫**；admin 登录是 `<form action="/admin">` 的假登录。**这是第一优先级，也是安全红线。**
2. **API 输入层不设防** —— 所有 controller 用 `@Body() body: any`，配合全局 `ValidationPipe({ whitelist, forbidNonWhitelisted })` 反而会把未声明字段全部剔除或报错。**必须补 DTO + class-validator。**
3. **响应格式不统一** —— `TransformInterceptor`（`{success,data,timestamp}`）与 `ARCHITECTURE.md` 约定（`{code,message,data,pagination}`）不一致，且**未全局注册**；admin `lib/api.ts` 直接 `res.json()`，三者对不上。
4. **Admin 全是静态假数据** —— 列表页硬编码 `[1..5]`，无数据请求、无表单、无 token 注入、无分页/加载/错误态。
5. **Web 仍是静态数据** —— `apps/web` 的 `lib/blog.ts`、`lib/news.ts`、`lib/solutions.ts` 是硬编码；后台改了内容前台看不到。需迁移为 API 驱动 + 按需 ISR。

本方案给出：目标架构、Auth/RBAC 设计、API 与前端最佳实践、内容工作流、安全/可观测/测试/部署清单，以及**分 5 个里程碑的可执行路线图**与关键代码骨架。

---



## 1. 现状盘点



### 1.1 已具备（可复用，质量良好）


| 层      | 内容                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 框架 | NestJS 11、全局前缀 `api/v1`、CORS 白名单（web:3001 / admin:3002）、Swagger `api/docs`、全局 `ValidationPipe`                                                              |
| 数据模型   | Prisma 6 + PostgreSQL，已建 `Category / Product / Case / News / Solution / Contact / Page / User / Setting`，含 `status`、`sortOrder`、`isFeatured`、`viewCount`、索引 |
| 业务模块   | `products / cases / news / solutions / pages / contact / storage / health` 的 controller+service+module                                                      |
| 存储     | `storage` 模块（`@aws-sdk/client-s3` + presigner，MinIO 本地 / OSS 线上零切换）                                                                                         |
| 公共层    | `common/filters/http-exception.filter`、`common/interceptors/transform.interceptor`、`common/pipes/validation.pipe`                                           |
| Seed   | `prisma/seed.ts`、`upload-media.ts`、`media-map.json`                                                                                                         |
| Admin  | Next.js 16 + React 19 + Tailwind 4 + `@tzj/ui`（Radix/shadcn）；页面 `login/products/cases/news/solutions/settings`、`Sidebar`、`lib/api.ts`                       |
| 约定     | 统一响应格式、JWT RS256 + RBAC、zod 环境校验（均已在 `ARCHITECTURE.md` 声明，但**尚未实现**）                                                                                        |




### 1.2 关键缺口（本方案要补齐）

- ❌ **Auth/RBAC**：无 `auth` 模块、无 JWT、无 `@nestjs/jwt`/`passport`、无守卫、无 `@CurrentUser`/`@Roles` 装饰器；admin 无登录态管理。
- ❌ **DTO 与校验**：controller 全用 `any`，无 `class-validator` DTO，无出参序列化（`class-transformer` 已装但未用）。
- ❌ **统一响应/错误**：拦截器未注册、格式不统一；错误无 `traceId`。
- ❌ **审计日志**：CMS 必备的「谁在何时改了什么」缺失。
- ❌ **媒体库**：有 S3 上传能力，但无 `MediaAsset` 表与后台媒体库 UI。
- ❌ **富文本/长内容编辑**：`News.content`、`Product.description` 需要编辑器 + XSS 消毒。
- ❌ **发布工作流**：schema 有 `draft/published/archived`，但无「定时发布 / 预览 / 发布后回刷前台」。
- ❌ **前端数据层**：admin 无 TanStack Query/表单/表格方案，全静态。
- ❌ **Web 联动**：前台静态数据未接 API。
- ❌ **安全加固**：无限流（throttler）、无 helmet、无刷新令牌轮换、无密码策略、无富文本消毒。
- ❌ **可观测/测试/CI**：无结构化日志/错误上报、几乎无测试、迁移未纳入 CI。

---



## 2. 目标架构与原则

```
Browser ── apps/web  (SSR/ISR, 只读)  ─┐
                                        ├─► apps/api (NestJS REST /api/v1) ─► PostgreSQL (Prisma)
Browser ── apps/admin (CSR, 读写)  ─────┘                    │
                                                             └─► Redis(会话/限流/缓存)  └─► S3/OSS(媒体)
```

**设计原则**

1. **API 是唯一事实源**：web/admin 都只经 `api/v1` 读写，禁止 admin 直连数据库。
2. **契约优先**：DTO + Swagger 即契约；`@tzj/types` 导出前后端共享类型，杜绝 `any`。
3. **纵深防御**：Auth 网关 + RBAC + 输入校验 + ORM 参数化 + 输出消毒，层层设防。
4. **最小可用增量**：复用现有模块与 schema，按里程碑增量交付，每步可上线。
5. **运营视角**：发布工作流、媒体库、审计、可预览，围绕「非技术运营能自助」设计。

---



## 3. 认证与鉴权（Auth + RBAC）—— 最高优先级



### 3.1 方案选型

- **令牌**：JWT **双令牌**——短期 `accessToken`（15 min，内存/请求头）+ 长期 `refreshToken`（7 d，**httpOnly + Secure + SameSite=Strict Cookie**，服务端可吊销）。
- **算法**：起步用 `HS256`（`JWT_SECRET` 已在 `.env`）；对外多服务时升级 `RS256`（与 `ARCHITECTURE.md` 一致）。
- **库**：`@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`；admin 侧用 Next.js Route Handler 做 BFF 代理，令牌只存 httpOnly cookie，**前端 JS 不接触 refreshToken**（防 XSS 窃取）。
- **刷新**：Refresh Token **轮换（rotation）+ 复用检测**，每次刷新签发新 refresh 并作废旧的；存 `Session` 表（可远程下线）。



### 3.2 数据模型增量（Prisma）

```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshHash  String   // 存 refreshToken 的 hash，不存明文
  userAgent    String?
  ip           String?
  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt    DateTime @default(now())
  @@index([userId])
  @@map("sessions")
}

// User 增加反向关系
// sessions Session[]
```



### 3.3 API 侧骨架

```ts
// apps/api/src/auth/auth.module.ts
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.getOrThrow("JWT_SECRET"),
        signOptions: { expiresIn: "15m" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

```ts
// 守卫 + 装饰器（RBAC）
export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata("isPublic", true);
export const CurrentUser = createParamDecorator(
  (_data, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return required.includes(user?.role);
  }
}
```

**全局默认加锁**：`JwtAuthGuard` 注册为全局守卫，只有标了 `@Public()` 的读接口（前台展示用）放行，其余默认需登录：

```ts
// main.ts / app.module providers
{ provide: APP_GUARD, useClass: JwtAuthGuard },
{ provide: APP_GUARD, useClass: RolesGuard },
```



### 3.4 角色与权限矩阵（RBAC）


| 角色       | 产品/案例/新闻/方案 | 询盘 Contact | 用户/设置 | 说明    |
| -------- | ----------- | ---------- | ----- | ----- |
| `admin`  | 增删改查 + 发布   | 查看/处理/删除   | 全部    | 超级管理员 |
| `editor` | 增删改 + 发布    | 查看/处理      | ❌     | 内容运营  |
| `viewer` | 只读          | 只读         | ❌     | 审阅/访客 |


- 公开读接口（`GET` 列表/详情，`status=published`）→ `@Public()`，供 `apps/web` 调用。
- 写接口与「含草稿的查询」→ 需 `editor`/`admin`。
- 用户管理、系统设置、审计日志 → 仅 `admin`。



### 3.5 Admin 登录流（BFF 模式）

1. 登录表单 → 调用 **admin 自身的** Route Handler `POST /api/auth/login`（Next server）。
2. Route Handler 转发到 NestJS `POST /api/v1/auth/login`，拿到 access+refresh。
3. Route Handler 把 refresh 写 **httpOnly cookie**，access 也放 cookie（或内存）；返回用户信息给前端。
4. admin 的 `middleware.ts` 校验 cookie，未登录跳 `/login`；`lib/api.ts` 请求经 BFF 自动带 access，401 时静默走刷新。

> 现有 `apps/admin/src/app/login/page.tsx` 的 `action="/admin"` 假登录**必须替换**为上述真实流程。

---



## 4. API 层最佳实践



### 4.1 DTO + 校验（消灭 `any`）

每个模块建 `dto/`，用 `class-validator` + `PartialType`：

```ts
// products/dto/create-product.dto.ts
export class CreateProductDto {
  @IsString() @MinLength(2) title!: string;
  @IsString() @Matches(/^[a-z0-9-]+$/) slug!: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() description?: string;
  @IsString() categoryId!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsIn(["draft", "published", "archived"]) status?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsObject() specs?: Record<string, unknown>;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

控制器改为强类型：`create(@Body() dto: CreateProductDto)`、`update(@Param("id") id: string, @Body() dto: UpdateProductDto)`。全局 `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` 从此**真正生效**。

### 4.2 统一响应与错误

统一为一种格式并**全局注册**拦截器与过滤器；与 admin/web 客户端约定一致：

```jsonc
// 成功
{ "success": true, "data": { }, "pagination": { "page":1, "limit":12, "total":42, "totalPages":4 }, "timestamp": "..." }
// 失败
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] }, "traceId": "...", "timestamp": "..." }
```

- 分页统一封装 `PaginationDto`（`page/limit/sort/order`）与 `paginate()` 工具，替换各 service 里重复的 `skip/take`。
- `HttpExceptionFilter` 注入 `traceId`（见 §9），结构化输出。
- 统一列表查询语义：`status` 缺省对公开接口强制 `published`（避免草稿泄漏）。



### 4.3 通用能力

- **软删除**：为可恢复实体加 `deletedAt`，service 默认过滤；提供回收站。
- **乐观并发**：`updatedAt` 作版本号，更新时校验，避免多人覆盖。
- **限流**：`@nestjs/throttler`（登录接口更严格，如 5 次/min）。
- **安全头**：`helmet`、压缩 `compression`。
- **幂等的 viewCount**：`findOne` 里 `increment` 建议异步/去抖，避免爬虫刷量（或迁到埋点）。



### 4.4 审计日志

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String   // create | update | delete | publish | login
  entity    String   // product | case | news ...
  entityId  String?
  diff      Json?    // 变更前后
  ip        String?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
  @@map("audit_logs")
}
```

用一个 `AuditInterceptor` 或在 service 写操作后统一落库。

---



## 5. 数据模型增量汇总

在现有 schema 基础上新增 / 调整：

1. `Session`（刷新令牌、远程下线）— §3.2
2. `AuditLog`（操作审计）— §4.4
3. `MediaAsset`（媒体库，替代裸字符串 URL 数组）：

```prisma
model MediaAsset {
  id         String   @id @default(cuid())
  url        String
  key        String   @unique   // S3 object key
  filename   String
  mimeType   String
  size       Int
  width      Int?
  height     Int?
  alt        String?
  folder     String   @default("uploads")
  uploadedBy String?
  createdAt  DateTime @default(now())
  @@index([folder])
  @@map("media_assets")
}
```

4.（可选）`Revision`：内容版本历史（`entity/entityId/data(Json)/createdBy`），支持回滚。
5. `User` 增加 `sessions Session[]`；密码策略字段（`passwordChangedAt`）。

> 迁移用 `prisma migrate dev`（开发）/ `prisma migrate deploy`（线上），**禁止**在生产用 `db push`。

---



## 6. Admin 前端架构

现有 admin 是静态 mockup，需要落地一套「顶级中后台」标准栈：


| 关注点   | 选型                             | 说明                                            |
| ----- | ------------------------------ | --------------------------------------------- |
| 服务端状态 | **TanStack Query**             | 缓存、失效、乐观更新、重试；替代裸 `fetch`                     |
| 表单    | **react-hook-form + zod**      | 与 API DTO 同构校验（zod schema 可与 `@tzj/types` 共享） |
| 表格    | **TanStack Table**             | 分页/排序/列筛选/列显隐                                 |
| 富文本   | **Tiptap**（或 Lexical）          | 输出 HTML/JSON，配合服务端 **sanitize-html** 消毒       |
| 通知    | **sonner / toast**             | 统一操作反馈                                        |
| 鉴权    | `middleware.ts` + BFF cookie   | 未登录跳转、按角色隐藏菜单/按钮                              |
| 权限门禁  | `<Can role="admin">` 组件 + hook | UI 级 RBAC（后端仍是最终防线）                           |
| 组件    | 复用 `@tzj/ui`（Radix/shadcn）     | 保持与主站设计一致                                     |




### 6.1 数据层骨架

```ts
// lib/api.ts —— 关键修正：带 token、经 BFF、401 自动刷新、解包 {success,data}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/bff${path}`, { ...init, credentials: "include" });
  if (res.status === 401) { await refresh(); return request<T>(path, init); }
  const json = await res.json();
  if (!json.success) throw new ApiError(json.error);
  return json.data as T;
}
```

```ts
// hooks/useProducts.ts
export const useProducts = (params: ProductQuery) =>
  useQuery({ queryKey: ["products", params], queryFn: () => api.products.list(params) });

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.products.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};
```



### 6.2 页面清单（对齐 Sidebar + 缺口）

- 仪表盘：内容统计、待处理询盘、最近审计、快捷入口。
- 产品 / 案例 / 新闻 / 方案：列表（真实分页/搜索/筛选）+ 新建/编辑抽屉或详情页（表单 + 富文本 + 媒体选择）+ 发布/下架/置顶/排序（拖拽）。
- **媒体库**（新增）：上传（走 presigned URL 直传 S3）、检索、复用、alt 管理。
- **询盘 Contact**（新增页）：列表、已读/已处理、备注、导出。
- 系统设置：站点信息、SEO、导航、联系方式（写入 `Setting` KV）。
- **用户与角色**（仅 admin）：账号、角色、启用/禁用、重置密码。
- **审计日志**（仅 admin）：筛选查看。

---



## 7. 内容工作流与 Web 联动



### 7.1 发布工作流

- 状态机：`draft → published → archived`，可 `scheduledAt` 定时发布（cron/队列）。
- **预览**：admin 生成带签名 token 的预览链接，`apps/web` 用 Next **Draft Mode** 渲染未发布内容。
- 发布动作写 `AuditLog`，并触发前台回刷（下）。



### 7.2 Web 从静态迁移到 API（关键）

现状：`apps/web/src/lib/{blog,news,solutions}.ts` 为硬编码。目标：

1. 在 web 端封装 `lib/cms.ts`，`fetch(api/v1/...)` 拉 `published` 内容；用 **ISR**（`export const revalidate = 300`）+ `generateStaticParams` 从 API 拉 slug。
2. 后台发布/更新时，API 调用 web 的 **On-Demand Revalidation** Webhook：
  ```
   POST {WEB_URL}/api/revalidate?tag=news&secret=***   → res.revalidateTag("news")
  ```
   实现内容「即改即生效」，兼顾静态性能与实时性。
3. 迁移顺序：新闻/博客 → 案例 → 方案 → 产品；迁移期间保留静态兜底，逐个替换。

> 注意：现有前台菜单/IA（见 `docs/product-menu-ia-plan.md`）与 API 的 `Category`/`Solution` 分类需对齐；建议后台「分类管理」直接驱动前台菜单数据。

---



## 8. 安全加固清单

- [ ] 全局 `JwtAuthGuard`，默认拒绝，`@Public()` 显式放行只读接口。
- [ ] Refresh Token 轮换 + 复用检测 + 服务端吊销（`Session`）。
- [ ] 密码：`bcrypt`（cost ≥ 12）、强度校验、错误不区分「用户不存在/密码错」。
- [ ] 登录限流（`throttler`）+ 失败锁定；`helmet` + `compression`。
- [ ] CORS 收紧到精确域名；生产强制 HTTPS、Cookie `Secure`。
- [ ] 富文本 **sanitize-html** 白名单消毒，杜绝存储型 XSS。
- [ ] 上传：类型/大小校验、扩展名白名单、presigned 直传、私有桶 + CDN 回源。
- [ ] Zod 校验环境变量（`@tzj/config/env`，`ARCHITECTURE.md` 已声明，需落地并在启动时 fail-fast）。
- [ ] 机密只走环境变量/密钥管理，绝不入库/入仓；`.env` 已在 `.gitignore`。
- [ ] 审计所有写操作与登录。

---



## 9. 可观测性与运维

- **结构化日志**：`nestjs-pino`，每请求注入 `traceId`（`x-request-id`），贯穿响应与错误。
- **错误上报**：Sentry（api + admin + web）。
- **健康检查**：扩展现有 `health` 为 `/health/live` + `/health/ready`（含 DB/Redis/S3 探活），供 K8s/compose 探针。
- **指标**：可选 `prom-client` 暴露 `/metrics`。
- **备份**：PostgreSQL 定时逻辑备份 + PITR；S3/OSS 版本化。

---



## 10. 测试策略


| 层      | 工具                                                     | 重点                       |
| ------ | ------------------------------------------------------ | ------------------------ |
| 单元     | Jest（已配置）                                              | service 业务逻辑、权限判定、DTO 校验 |
| 集成/E2E | `@nestjs/testing` + Supertest + 测试库（Testcontainers/PG） | auth 流、RBAC、CRUD、分页      |
| 前端     | Vitest + Testing Library                               | 表单校验、hooks、门禁组件          |
| 契约     | 由 Swagger/OpenAPI 生成客户端类型，保证前后端一致                      |                          |


目标：auth 与权限相关**关键路径 100% 覆盖**；核心 CRUD 冒烟必测。

---



## 11. CI/CD 与部署

- **CI**（GitHub Actions，`.github` 已存在）：`install → typecheck → lint(biome) → test → prisma migrate diff 校验 → build`；Turbo 缓存加速。
- **DB 迁移**：CI/CD 用 `prisma migrate deploy`；PR 阶段校验迁移与 schema 漂移。
- **镜像**：`apps/api`、`apps/admin` 已有 `Dockerfile`；多阶段构建、非 root 运行。
- **编排**：`infra/` + compose：`postgres` / `redis` / `minio` / `api` / `admin` / `web`。
- **环境**：dev / staging / prod 三套；密钥走 Secret Manager。
- **上线顺序**：迁移 → API → admin → web（含 revalidate 配置）。

---



## 12. 分阶段路线图（里程碑 + 验收）

> 每个里程碑独立可上线；标注 ★ 为强依赖前置项。



### M0 · 基础对齐（0.5–1 周）

- 统一响应/错误格式并全局注册拦截器+过滤器；`traceId`。
- 环境变量 Zod 校验、`helmet`、`throttler`、`compression`。
- 修正 admin `lib/api.ts` 解包逻辑、端口/BaseURL 对齐。
- **验收**：Swagger 可用；示例接口返回统一格式；异常有 traceId。



### M1 · 认证与鉴权 ★（1–1.5 周）—— 最高优先级

- `auth` 模块（login/refresh/logout/me）、`Session` 表、双令牌 + 轮换。
- 全局 `JwtAuthGuard` + `RolesGuard` + `@Public/@Roles/@CurrentUser`。
- admin 真实登录（BFF cookie）、`middleware.ts` 守卫、菜单/按钮 RBAC 门禁。
- **验收**：未登录访问写接口 401；角色越权 403；刷新/下线可用；假登录被移除。



### M2 · CRUD 打通 + DTO（1.5–2 周）

- 各模块补齐 DTO + 校验，controller 去 `any`。
- admin 接入 TanStack Query + RHF + zod + TanStack Table，产品/案例/新闻/方案**真实 CRUD**。
- 询盘 Contact 管理页；审计日志落库。
- **验收**：后台可增删改查并落库；列表真实分页/搜索/筛选；写操作有审计。



### M3 · 媒体库 + 富文本 + 发布工作流（1.5–2 周）

- `MediaAsset` + 媒体库 UI + presigned 直传；富文本（Tiptap）+ sanitize。
- 草稿/发布/定时/预览（Next Draft Mode）。
- **验收**：图文内容可视化编辑；预览未发布内容；定时发布生效。



### M4 · Web 联动 + 可观测 + 上线（1–1.5 周）

- web 静态数据迁移到 API（ISR + 按需 revalidate webhook）。
- 分类管理驱动前台菜单；日志/Sentry/健康探针；CI 迁移校验。
- **验收**：后台发布后前台按需回刷生效；监控与告警就绪；一键部署。

---



## 13. 附录：关键代码骨架索引

落地时新增/改动的主要文件（相对 `apps/api/src` 与 `apps/admin/src`）：

```
api/src/auth/            auth.module.ts / auth.controller.ts / auth.service.ts
                         strategies/jwt.strategy.ts
                         guards/jwt-auth.guard.ts / roles.guard.ts
                         decorators/roles.decorator.ts / public.decorator.ts / current-user.decorator.ts
                         dto/login.dto.ts / refresh.dto.ts
api/src/common/          interceptors/transform.interceptor.ts(全局注册) / audit.interceptor.ts
                         dto/pagination.dto.ts   utils/paginate.ts
api/src/<module>/dto/    create-*.dto.ts / update-*.dto.ts   (products/cases/news/solutions/pages/contact)
api/src/media/           media.module.ts / media.service.ts   (基于现有 storage)
api/prisma/schema.prisma 新增 Session / AuditLog / MediaAsset (+ 可选 Revision)

admin/src/middleware.ts           登录守卫
admin/src/app/(auth)/login        真实登录（替换假表单）
admin/src/app/bff/[...]/route.ts  BFF 代理（注入 token / 刷新）
admin/src/lib/api.ts              解包 {success,data} + 401 刷新
admin/src/lib/query.ts            TanStack Query Provider
admin/src/features/<domain>/      hooks / 表单 / 表格 / 详情
admin/src/components/auth/Can.tsx UI 级 RBAC 门禁

web/src/lib/cms.ts                前台 API 数据源（替换 lib/{blog,news,solutions}.ts）
web/src/app/api/revalidate/route.ts  按需 ISR 回刷
```

> 建议每完成一个里程碑，回填 `CHANGELOG.md` 与 `docs/decisions/`（ADR）。

---



## 14. 实施进度（持续更新）



### ✅ M0 · 基础对齐（已完成）

- 统一响应包装 `TransformInterceptor`：`{ success, data, pagination?, traceId, timestamp }`，自动上提分页。
- 统一错误 `AllExceptionsFilter`：`{ success:false, error:{code,message,details}, traceId, path, timestamp }`，5xx 记录堆栈。
- `requestId` 中间件：复用/生成 `x-request-id` 并回写响应头，贯穿日志与响应。
- `main.ts` 加固：`helmet` + `compression` + CORS 白名单（`CORS_ORIGINS` 逗号分隔）。
- 环境校验 `config/env.validation.ts`（Zod），在 `ConfigModule` 加载 `.env` 后 fail-fast。
- `ThrottlerModule` 全局限流（`THROTTLE_TTL` / `THROTTLE_LIMIT`）。
- 全局注册（`app.module.ts` 的 `APP_INTERCEPTOR` / `APP_FILTER` / `APP_GUARD`）。
- admin `lib/api.ts`：解包统一响应、BaseURL 对齐 `:4000/api/v1`、错误信息透传。



### ✅ M1 · 认证与鉴权（已完成）

- Prisma 新增 `Session`（refresh 轮换/可撤销，存 sha256）与 `AuditLog`（审计），`User` 反向关联。
- `auth` 模块：JWT 双令牌（access 15m / refresh 7d）、`passport-jwt` 策略、登录/刷新/登出/me。
- 刷新令牌**轮换 + 复用检测**（命中已撤销令牌即撤销该用户全部会话）。
- 全局 `JwtAuthGuard`（`@Public()` 放行）+ `RolesGuard`（`@Roles()` 生效）。
- 所有只读 GET 标注 `@Public()`；写操作标注 `@Roles(EDITOR, ADMIN)`，删除限 `ADMIN`；官网留言 `POST /contact` 公开。
- admin：`(dashboard)` 路由组 + 独立 `/login`；`proxy.ts`（Next 16 新约定）守卫；BFF 登录/登出（httpOnly cookie）；`lib/auth.ts` 服务端 `apiFetch`（Bearer + 401 自动刷新）；`UserMenu` 登出；`Can` UI 门禁。
- 新增 `prisma/seed.ts`：管理员账号 `admin@example.com / REDACTED-PASSWORD`（可用 `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` 覆盖）。

**验证**：`apps/api` 与 `apps/admin` 均通过 `tsc --noEmit` 与生产构建（`nest build` / `next build`）。

**启动前置（需本地 Postgres）**：

```
# 1) 启动依赖（示例，用你现有的 docker-compose 或本地 PG）
# 2) 迁移 + 生成 client + 种子
cd apps/api
pnpm prisma:migrate   # 首次创建 sessions / audit_logs 等表
pnpm prisma:generate
pnpm prisma:seed
# 3) 启动
pnpm --filter @tzj/api dev      # http://localhost:4000  (Swagger: /api/docs)
pnpm --filter @tzj/admin dev    # http://localhost:3002/admin/login
```



### ✅ M2 · CRUD 打通 + DTO（已完成）

**API**

- 各模块补齐 `create/update` DTO（`class-validator` + Swagger），控制器 `@Body()` 全面去 `any`：`products/cases/news/solutions/pages/contact`。
- 共享 `common/enums/content-status.enum.ts`（draft/published/archived）。
- service 适配 DTO：`products` 处理 `category` 关联（`connect`）与 `specs` JSON；`solutions` 处理 `features` JSON；`news` 在首次转「已发布」且未指定时自动写 `publishedAt`；`contact` 默认 `source=website`（`UpdateContactDto` 仅 `isRead/isHandled/remark`）。
- 新增 **Categories 模块**（产品分类）：`GET /categories` 公开，写操作 `EDITOR/ADMIN`、删除 `ADMIN`；列表含 `_count.products`。
- 新增全局 `AuditInterceptor`：对**已登录用户**的写操作（POST/PUT/PATCH/DELETE）成功后落 `AuditLog`（action/resource/resourceId/ip/ua/traceId），失败不影响主流程。
- `prisma/seed.ts` 追加 9 个产品分类（对应产品线）。

**Admin**

- 接入 `@tanstack/react-query`（`QueryProvider`）、`react-hook-form` + `zod` + `@hookform/resolvers`、`@tanstack/react-table`。
- **BFF 万能代理** `app/api/bff/[...path]/route.ts`：注入 httpOnly cookie 中的 Bearer，401 自动 `refresh` 并回写新 cookie；客户端 `lib/apiClient.ts` 统一解包 `{success,data,pagination,error}`。
- 声明式 CRUD 框架 `components/crud/*`：`ResourceManager`（列表 + 搜索 + 筛选 + 分页 + 新增/编辑/删除 + `Can` 门禁）、`DataTable`（TanStack Table）、`ResourceForm`（RHF+zod，按字段类型渲染）、`Modal`。
- 真实 CRUD 页：`产品 / 案例 / 新闻 / 方案` 全部替换为接口数据；`询盘管理` 页（列表 + 已读/待处理筛选 + 详情抽屉 + 标记已读/已处理 + 备注 + 删除）。
- 客户端会话上下文 `session.tsx` + `Can`（UI 级 RBAC，真正权限仍由 API `RolesGuard` 强制）；侧边栏新增「询盘管理」入口。
- 新增 `app/global-error.tsx`。

**验证**

- `tsc --noEmit` + 生产构建（`nest build` / `next build`）均通过。
- 端到端冒烟：登录取 token → `POST /products` 成功；缺字段返回 `400` 校验数组；无 token 返回 `401`；`AuditLog` 正确记录 `create products`。
- 已 `prisma db push`（schema 同步）+ `prisma:seed`（管理员 + 9 分类）。

> ⚠️ 构建注意：`.env` 里的 `NODE_ENV="development"` 若被 `source` 进构建 shell，会触发 Next 16 已知 bug（`/_global-error` 预渲染 `useContext` 崩溃，见 vercel/next.js#87719）。`next build` 请在未导出 `NODE_ENV` 的环境执行（正常终端即可）。



### ✅ 运维调整 · 端口与菜单精简（已完成）

- **API 端口 3000 → 4000**（腾出本机 3000 给其他项目）：`.env` / `.env.example` 的 `API_PORT`、`NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_ADMIN_API_URL`；`CORS_ORIGINS` 收敛为 web(3001)+admin(3002)；`main.ts` 默认端口/CORS；admin `lib/config.ts` 与 web `lib/api.ts` 兜底地址；文档同步。
- **菜单精简（对齐业内最佳实践）**：
  - 移除「系统设置」：原为无后端的静态占位表单，站点设置/SEO 归入 M4，避免"死菜单"。
  - 「仪表盘」由写死假数据改为**真实统计**（服务端 `apiFetchFull` 读分页 `total`：产品/案例/新闻/方案/询盘总数 + 待处理询盘 + 最新询盘列表），去掉不存在的"注册用户"。
  - 保留并新增「媒体库」；核心内容模块（产品/案例/新闻/方案/询盘）不变。
- 清理 M2 前遗留死代码 `admin/src/lib/api.ts`（`adminApi`，已被 BFF `apiClient` 取代）。

### ✅ M3 · 媒体库 + 富文本 + 发布工作流（已完成）

**API**

- Prisma 新增 `MediaAsset`（key/url/filename/mimeType/size/folder/alt/uploadedBy），`User` 反向关联。
- **Media 模块**：`GET /media`（分页 + 类型/目录/搜索筛选）、`POST /media/upload`（服务端代理上传，multipart）、`POST /media/presign`（预签名直传，备用）、`POST /media`（直传登记）、`DELETE /media/:id`（删对象+记录，限 ADMIN）；权限 `EDITOR/ADMIN`。
- `S3Service`：新增 `getPresignedPutUrl`，启动时 `ensureBucket`（桶不存在自动创建，开箱即用）。
- **富文本安全**：`common/utils/sanitize.ts`（`sanitize-html` 白名单）；`products/cases/solutions/pages` 的 `description/content` 与 `news.content` 写入前统一清洗（防存储型 XSS）。
- **定时发布**：4 个内容模型加 `scheduledAt`；`@nestjs/schedule` 的 `PublishingService` 每分钟将到点草稿置为 `published`（新闻同时写 `publishedAt`）；DTO 增补 `scheduledAt`。

**Admin**

- **媒体上传 BFF** `app/api/media/upload/route.ts`（专处理 multipart，注入 Bearer + 401 刷新回写 cookie）。
- `features/media.ts`：`useMediaList` / `useUploadMedia` / `useDeleteMedia`。
- **媒体库页** `/media`：网格浏览、类型筛选、上传、复制链接、删除、分页。
- **媒体选择器** `MediaPicker`：浏览/上传/单选或多选，供表单与富文本插图复用。
- **富文本编辑器** `RichTextEditor`（Tiptap：加粗/斜体/删除线/H2/H3/列表/引用/链接/插图/撤销重做），插图走媒体选择器；`globals.css` 补编辑器排版。
- `ResourceForm` 重构为 `Controller` 受控，新增 `image`（单图）/`gallery`（图集）/`datetime`（定时）字段；四个内容页封面改图形化选择、图片集改图集选择。
- 列表行新增**一键发布/下线**（`status` 切换，`EDITOR/ADMIN`）与**预览**（跳前台，`cases/solutions/news` 有详情路由）。

**验证**

- `tsc --noEmit` + 生产构建（`nest build` / `next build`）均通过；`prisma db push` 同步 `media_assets` 与 `scheduledAt`。
- 端到端冒烟（API :4000）：登录 → 上传 → 公开 URL 200 → 列表 → 删除（对象+记录清除）；富文本清洗剥离 `<script>` / `onerror` / `javascript:`；定时发布：过去时间草稿经调度器自动转 `published`。测试数据均已清理。

### ⏭ 下一步（M4）

- M4 Web 联动：web 静态数据迁移到 API（ISR + 按需 revalidate webhook）；分类驱动前台菜单；站点设置/SEO（重新引入「设置」为真实功能）；Sentry/健康探针；CI 迁移校验。
- 可选增强：媒体图片尺寸(width/height)提取、拖拽上传、Next Draft Mode 预览未发布内容（当前预览依赖 `findOne` 不按状态过滤）。

