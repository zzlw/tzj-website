# API Documentation

REST API 文档自动生成于 Swagger: `http://localhost:4000/api/docs`

## 端点概览

全局前缀: `/api/v1`

### 公共端点

| 模块 | 路径 | 说明 |
|------|------|------|
| Health | `/api/v1/health` | 健康检查 |
| Auth | `/api/v1/auth` | 登录/注册/刷新 Token |
| Pages | `/api/v1/pages` | CMS 页面（slug 查询） |
| Cases | `/api/v1/cases` | 客户案例 |
| News | `/api/v1/news` | 新闻资讯 |
| Blogs | `/api/v1/blogs` | 博客文章 |
| Trade Shows | `/api/v1/trade-shows` | 展会信息 |
| Contact | `/api/v1/contact` | 联系表单提交 |

### 管理端点（需 JWT）

| 模块 | 路径 | 说明 |
|------|------|------|
| Users | `/api/v1/users` | 用户管理 |
| Access | `/api/v1/access` | RBAC 权限 |
| Media | `/api/v1/media` | 媒体库管理 |
| Storage | `/api/v1/storage` | 文件上传 |
| Documents | `/api/v1/documents` | 内部文档 |
| Integrations | `/api/v1/integrations` | 第三方集成 |
| Notifications | `/api/v1/notifications` | 通知管理 |
| Analytics | `/api/v1/analytics` | 访问统计 |
| Audit Logs | `/api/v1/audit-logs` | 审计日志 |
| Settings | `/api/v1/settings` | 站点设置 |
| Security | `/api/v1/security` | IP 封禁等安全策略 |
| System | `/api/v1/system` | 系统信息 |

## 认证

管理端点需要 JWT Bearer Token:
```
Authorization: Bearer <token>
```
# API Documentation

REST API 文档自动生成于 Swagger: `http://localhost:3000/api/docs`

## 端点概览

| 模块 | 前缀 | 方法 |
|------|------|------|
| Health | `/api/v1/health` | GET |
| Products | `/api/v1/products` | GET, GET /:slug |
| Cases | `/api/v1/cases` | GET, GET /:slug |
| News | `/api/v1/news` | GET, GET /:id |
| Solutions | `/api/v1/solutions` | GET, GET /:slug |
| Pages | `/api/v1/pages` | GET, GET /:slug |
| Contact | `/api/v1/contact` | POST, GET (admin) |

## 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## 认证

Admin API 需要 JWT Bearer Token:
```
Authorization: Bearer <token>
```
