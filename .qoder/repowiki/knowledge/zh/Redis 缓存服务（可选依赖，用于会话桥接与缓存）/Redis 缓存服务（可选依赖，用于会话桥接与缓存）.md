---
kind: external_dependency
name: Redis 缓存服务（可选依赖，用于会话桥接与缓存）
slug: redis
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

### 角色与使用
- 作为可选依赖存在（`redis` 包），用于 Socket.IO 跨进程广播（`@socket.io/redis-adapter`）和 IP 定位结果缓存。
- 本项目中 Redis 并非强制依赖，IP 定位服务改用进程内 TTL Map 缓存（7天命中/30分钟未命中）以适配"Redis 可选"现状。

### 架构约束
- 当 Redis 不可用时，系统应能降级运行（如聊天功能可能受限，但核心业务不受影响）。
- 当前实现中，IP 封禁缓存（`IpBanService.isBlocked`）使用内存缓存而非 Redis，确保无外部依赖。

### 部署配置
- Docker Compose 中包含 Redis 服务定义（`infra/docker/docker-compose.dev.yml`）。
- 生产环境需确保 Redis 可用，否则部分实时功能（如聊天室多实例广播）可能异常。