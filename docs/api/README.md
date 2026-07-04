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
