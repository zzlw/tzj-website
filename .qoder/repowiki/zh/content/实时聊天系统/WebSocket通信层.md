# WebSocket通信层

<cite>
**本文档引用的文件**   
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [support.module.ts](file://apps/api/src/support/support.module.ts)
- [chat-room.controller.ts](file://apps/api/src/support/chat-room.controller.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [message-search.service.ts](file://apps/api/src/support/message-search.service.ts)
- [ChatMessenger.tsx](file://apps/admin/src/features/chat/ChatMessenger.tsx)
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [api.ts](file://apps/admin/src/features/chat/api.ts)
- [types.ts](file://apps/admin/src/features/chat/types.ts)
- [ChatPresenceProvider.tsx](file://apps/admin/src/features/chat/ChatPresenceProvider.tsx)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
- [presence.ts](file://apps/web/src/features/chat/presence.ts)
- [types.ts](file://apps/web/src/features/chat/types.ts)
- [api.ts](file://apps/web/src/features/chat/api.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件面向WebSocket通信层，聚焦聊天网关的实现原理与前后端Socket连接机制。内容涵盖连接建立、消息路由、事件处理、连接管理、认证流程、心跳检测、断线重连、错误处理、消息序列化与传输优化、连接池管理、负载均衡与故障转移策略，并提供具体代码示例路径以便快速定位实现细节。

## 项目结构
后端采用NestJS模块组织，聊天相关能力集中在support模块中；前端在admin与web两个应用中分别提供聊天功能与Socket封装。关键文件分布如下：
- 后端网关与服务：
  - 网关入口与事件路由：chat.gateway.ts
  - 模块装配：support.module.ts
  - REST接口（令牌、房间等）：chat-room.controller.ts
  - 业务服务：chat-room.service.ts、chat-auth.service.ts、chat-presence.store.ts、message-search.service.ts
- 前端客户端：
  - 管理后台聊天UI与Socket Hook：ChatMessenger.tsx、useChatSocket.ts、api.ts、types.ts、ChatPresenceProvider.tsx
  - 访客聊天Hook与类型：useVisitorChat.ts、presence.ts、types.ts、api.ts

```mermaid
graph TB
subgraph "后端(NestJS)"
GW["聊天网关<br/>chat.gateway.ts"]
MOD["支持模块<br/>support.module.ts"]
CTRL["房间控制器<br/>chat-room.controller.ts"]
SVC_ROOM["房间服务<br/>chat-room.service.ts"]
SVC_AUTH["认证服务<br/>chat-auth.service.ts"]
STORE["在线状态存储<br/>chat-presence.store.ts"]
SEARCH["消息搜索服务<br/>message-search.service.ts"]
end
subgraph "前端(Admin)"
UI_ADMIN["聊天界面<br/>ChatMessenger.tsx"]
HOOK_ADMIN["Socket Hook<br/>useChatSocket.ts"]
API_ADMIN["API封装<br/>api.ts"]
TYPES_ADMIN["类型定义<br/>types.ts"]
PRESENCE_ADMIN["在线状态Provider<br/>ChatPresenceProvider.tsx"]
end
subgraph "前端(Web)"
HOOK_WEB["访客聊天Hook<br/>useVisitorChat.ts"]
PRESENCE_WEB["在线状态工具<br/>presence.ts"]
TYPES_WEB["类型定义<br/>types.ts"]
API_WEB["API封装<br/>api.ts"]
end
UI_ADMIN --> HOOK_ADMIN
HOOK_ADMIN --> GW
HOOK_ADMIN --> API_ADMIN
PRESENCE_ADMIN --> HOOK_ADMIN
HOOK_WEB --> GW
HOOK_WEB --> API_WEB
PRESENCE_WEB --> HOOK_WEB
GW --> SVC_ROOM
GW --> SVC_AUTH
GW --> STORE
GW --> SEARCH
CTRL --> SVC_ROOM
MOD --> GW
MOD --> CTRL
```

图表来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [support.module.ts](file://apps/api/src/support/support.module.ts)
- [chat-room.controller.ts](file://apps/api/src/support/chat-room.controller.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [message-search.service.ts](file://apps/api/src/support/message-search.service.ts)
- [ChatMessenger.tsx](file://apps/admin/src/features/chat/ChatMessenger.tsx)
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [api.ts](file://apps/admin/src/features/chat/api.ts)
- [types.ts](file://apps/admin/src/features/chat/types.ts)
- [ChatPresenceProvider.tsx](file://apps/admin/src/features/chat/ChatPresenceProvider.tsx)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
- [presence.ts](file://apps/web/src/features/chat/presence.ts)
- [types.ts](file://apps/web/src/features/chat/types.ts)
- [api.ts](file://apps/web/src/features/chat/api.ts)

章节来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [support.module.ts](file://apps/api/src/support/support.module.ts)
- [chat-room.controller.ts](file://apps/api/src/support/chat-room.controller.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [message-search.service.ts](file://apps/api/src/support/message-search.service.ts)
- [ChatMessenger.tsx](file://apps/admin/src/features/chat/ChatMessenger.tsx)
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [api.ts](file://apps/admin/src/features/chat/api.ts)
- [types.ts](file://apps/admin/src/features/chat/types.ts)
- [ChatPresenceProvider.tsx](file://apps/admin/src/features/chat/ChatPresenceProvider.tsx)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
- [presence.ts](file://apps/web/src/features/chat/presence.ts)
- [types.ts](file://apps/web/src/features/chat/types.ts)
- [api.ts](file://apps/web/src/features/chat/api.ts)

## 核心组件
- 聊天网关（Gateway）：负责WebSocket生命周期管理、鉴权、消息路由、广播与订阅、心跳与断线重连触发。
- 房间服务（Room Service）：会话生命周期、消息持久化、历史查询、房间元数据维护。
- 认证服务（Auth Service）：校验访问令牌、解析用户身份、权限控制。
- 在线状态存储（Presence Store）：维护用户在线状态、设备信息、房间成员列表。
- 消息搜索服务（Message Search）：对消息进行索引与检索，支持关键词过滤。
- 前端Socket Hook（Admin/Web）：封装连接建立、事件监听、消息发送、心跳、重连、错误处理与状态同步。
- 在线状态Provider（Admin）：集中管理在线状态展示与更新。

章节来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [message-search.service.ts](file://apps/api/src/support/message-search.service.ts)
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [ChatPresenceProvider.tsx](file://apps/admin/src/features/chat/ChatPresenceProvider.tsx)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
- [presence.ts](file://apps/web/src/features/chat/presence.ts)

## 架构总览
整体采用“网关+服务”的解耦设计：网关仅处理协议与路由，业务逻辑下沉至服务层；前端通过统一的Hook抽象Socket交互，屏蔽底层差异。

```mermaid
sequenceDiagram
participant FE as "前端(Hook)"
participant GW as "聊天网关"
participant AUTH as "认证服务"
participant ROOM as "房间服务"
participant PRE as "在线状态存储"
participant SEARCH as "消息搜索服务"
FE->>GW : "建立WebSocket连接(携带令牌)"
GW->>AUTH : "验证令牌并解析用户身份"
AUTH-->>GW : "返回用户上下文"
GW->>PRE : "注册连接与会话ID"
GW-->>FE : "连接成功/初始化事件"
FE->>GW : "加入房间/选择会话"
GW->>ROOM : "校验房间权限/加载元数据"
ROOM-->>GW : "返回房间信息"
GW-->>FE : "房间加入成功/成员列表"
FE->>GW : "发送消息"
GW->>ROOM : "持久化消息/构建消息体"
ROOM-->>GW : "返回已保存消息"
GW->>SEARCH : "索引消息(可选)"
SEARCH-->>GW : "索引完成"
GW-->>FE : "消息回显/广播给房间内其他用户"
FE->>GW : "心跳ping"
GW-->>FE : "心跳pong"
FE->>GW : "断开连接"
GW->>PRE : "清理在线状态"
GW-->>FE : "关闭事件"
```

图表来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [message-search.service.ts](file://apps/api/src/support/message-search.service.ts)
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)

## 详细组件分析

### 聊天网关（Gateway）
职责与要点：
- 连接建立：拦截器或守卫阶段校验JWT令牌，失败则拒绝连接。
- 事件路由：按事件名分发到对应处理器（如join、leave、send、typing、heartbeat）。
- 消息广播：基于房间ID将消息推送给同房间用户，避免跨房间泄漏。
- 心跳检测：服务端定时检查活跃连接，超时主动断开。
- 断线重连：配合前端指数退避策略，服务端不主动重连但保持会话可恢复。
- 错误处理：统一异常包装，区分网络错误、鉴权错误、业务错误。

```mermaid
classDiagram
class ChatGateway {
+onConnection(client) void
+onDisconnect(client) void
+handleJoin(roomId, payload) void
+handleLeave(roomId, payload) void
+handleSend(roomId, message) void
+handleTyping(roomId, payload) void
+handleHeartbeat(client) void
-validateToken(token) boolean
-broadcast(roomId, event, data) void
-updatePresence(client, status) void
}
class ChatAuthService {
+verifyToken(token) UserContext
+extractPermissions(user) string[]
}
class ChatRoomService {
+joinRoom(roomId, userId) RoomInfo
+sendMessage(roomId, message) Message
+getHistory(roomId, cursor) Message[]
+leaveRoom(roomId, userId) void
}
class PresenceStore {
+register(clientId, roomId, userId) void
+unregister(clientId) void
+getOnlineUsers(roomId) UserList
+setTyping(roomId, userId, isTyping) void
}
class MessageSearchService {
+indexMessage(message) void
+search(query, roomId) Message[]
}
ChatGateway --> ChatAuthService : "鉴权"
ChatGateway --> ChatRoomService : "房间操作"
ChatGateway --> PresenceStore : "在线状态"
ChatGateway --> MessageSearchService : "消息索引"
```

图表来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [message-search.service.ts](file://apps/api/src/support/message-search.service.ts)

章节来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

### 认证流程（JWT）
- 前端在建立WebSocket连接时附带令牌（通常通过查询参数或握手头）。
- 网关在服务端校验令牌有效性及权限范围，失败则立即断开连接。
- 成功后将用户上下文注入到后续事件处理器中。

```mermaid
flowchart TD
Start(["开始"]) --> AttachToken["前端附加令牌到连接请求"]
AttachToken --> Validate["网关调用认证服务校验令牌"]
Validate --> Valid{"令牌有效?"}
Valid --> |否| Reject["拒绝连接并关闭"]
Valid --> |是| InjectCtx["注入用户上下文到会话"]
InjectCtx --> Allow["允许进入事件处理阶段"]
Reject --> End(["结束"])
Allow --> End
```

图表来源
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

章节来源
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

### 消息路由与广播
- 路由规则：以事件名为键，匹配处理器；房间级隔离确保消息只推送给同房间用户。
- 广播策略：优先内存广播，必要时结合外部消息队列（可扩展）。
- 反序列化：接收JSON字符串后校验结构，失败返回结构化错误。

```mermaid
sequenceDiagram
participant FE as "前端"
participant GW as "网关"
participant ROOM as "房间服务"
participant PRE as "在线状态存储"
FE->>GW : "事件 : send | 数据 : {roomId, content}"
GW->>GW : "反序列化与校验"
GW->>ROOM : "持久化消息"
ROOM-->>GW : "返回消息对象"
GW->>PRE : "获取房间在线用户"
PRE-->>GW : "用户列表"
GW-->>FE : "广播消息给同房间用户"
```

图表来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)

章节来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)

### 心跳检测与断线重连
- 心跳：前端定时发送ping，服务端回复pong；若长时间无响应，服务端主动断开。
- 重连：前端实现指数退避与最大重试次数，避免雪崩；重连时重新鉴权。
- 状态恢复：重连后拉取未确认消息与最新房间状态。

```mermaid
flowchart TD
Start(["连接建立"]) --> Heartbeat["启动心跳定时器"]
Heartbeat --> Ping["发送ping"]
Ping --> Pong{"收到pong?"}
Pong --> |是| KeepAlive["保持连接"]
Pong --> |否| Timeout["超时计数+1"]
Timeout --> MaxCheck{"超过阈值?"}
MaxCheck --> |否| Wait["等待下一次ping"]
MaxCheck --> |是| Disconnect["服务端断开连接"]
Disconnect --> Reconnect["前端触发重连(指数退避)"]
Reconnect --> Verify["重新鉴权"]
Verify --> Success{"鉴权成功?"}
Success --> |是| Resume["恢复状态/拉取历史"]
Success --> |否| Fail["提示登录过期"]
KeepAlive --> Heartbeat
Resume --> Heartbeat
Fail --> End(["结束"])
```

图表来源
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

章节来源
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

### 连接管理与在线状态
- 连接注册：每次连接建立时记录clientId、roomId、userId、设备信息。
- 状态更新：用户打字、离开、在线状态变更实时广播。
- 清理策略：连接关闭时移除在线记录，防止僵尸状态。

```mermaid
classDiagram
class PresenceStore {
+register(clientId, roomId, userId) void
+unregister(clientId) void
+getOnlineUsers(roomId) UserList
+setTyping(roomId, userId, isTyping) void
+removeUser(roomId, userId) void
}
class ChatGateway {
+onConnection(client) void
+onDisconnect(client) void
+handleTyping(roomId, payload) void
}
ChatGateway --> PresenceStore : "读写在线状态"
```

图表来源
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

章节来源
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

### 前端Socket封装（Admin与Web）
- Admin侧Hook：封装连接、事件订阅、消息发送、心跳、重连、错误处理，暴露统一API供UI使用。
- Web侧Hook：轻量版，侧重访客场景的快速接入与最小化状态管理。
- 类型定义：统一消息结构、事件名、状态枚举，保证前后端一致性。

```mermaid
sequenceDiagram
participant UI as "聊天UI"
participant HOOK as "Socket Hook"
participant API as "REST API"
participant GW as "网关"
UI->>HOOK : "初始化连接(携带token)"
HOOK->>API : "获取访问令牌(如需)"
API-->>HOOK : "返回token"
HOOK->>GW : "建立WebSocket连接"
GW-->>HOOK : "连接成功事件"
UI->>HOOK : "发送消息/加入房间"
HOOK->>GW : "发送事件"
GW-->>HOOK : "广播/确认事件"
HOOK-->>UI : "渲染消息/更新状态"
```

图表来源
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [api.ts](file://apps/admin/src/features/chat/api.ts)
- [types.ts](file://apps/admin/src/features/chat/types.ts)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
- [api.ts](file://apps/web/src/features/chat/api.ts)
- [types.ts](file://apps/web/src/features/chat/types.ts)

章节来源
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)
- [api.ts](file://apps/admin/src/features/chat/api.ts)
- [types.ts](file://apps/admin/src/features/chat/types.ts)
- [useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
- [api.ts](file://apps/web/src/features/chat/api.ts)
- [types.ts](file://apps/web/src/features/chat/types.ts)

### 在线状态Provider（Admin）
- 集中管理在线人数、当前用户状态、打字指示等。
- 与Socket Hook联动，实时更新UI展示。

章节来源
- [ChatPresenceProvider.tsx](file://apps/admin/src/features/chat/ChatPresenceProvider.tsx)
- [useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)

## 依赖关系分析
- 模块装配：support.module.ts将网关、控制器、服务注册为NestJS模块，便于依赖注入与生命周期管理。
- 控制器依赖：chat-room.controller.ts依赖chat-room.service.ts提供REST接口（如令牌、房间信息）。
- 网关依赖：chat.gateway.ts依赖auth、room、presence、search服务，形成低耦合高内聚。
- 前端依赖：Hook依赖API封装与类型定义，保证契约一致。

```mermaid
graph LR
MOD["support.module.ts"] --> GW["chat.gateway.ts"]
MOD --> CTRL["chat-room.controller.ts"]
CTRL --> ROOM_SVC["chat-room.service.ts"]
GW --> AUTH_SVC["chat-auth.service.ts"]
GW --> ROOM_SVC
GW --> PRE_STORE["chat-presence.store.ts"]
GW --> SEARCH_SVC["message-search.service.ts"]
```

图表来源
- [support.module.ts](file://apps/api/src/support/support.module.ts)
- [chat-room.controller.ts](file://apps/api/src/support/chat-room.controller.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [message-search.service.ts](file://apps/api/src/support/message-search.service.ts)
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

章节来源
- [support.module.ts](file://apps/api/src/support/support.module.ts)
- [chat-room.controller.ts](file://apps/api/src/support/chat-room.controller.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
- [message-search.service.ts](file://apps/api/src/support/message-search.service.ts)
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)

## 性能考量
- 消息序列化：尽量使用紧凑JSON结构，避免冗余字段；大消息分片传输。
- 广播优化：房间级广播优先内存转发，避免不必要的数据库写入；批量合并高频事件（如typing）。
- 心跳间隔：合理设置心跳周期与超时阈值，平衡实时性与资源消耗。
- 连接池与负载均衡：多实例部署时，网关需共享在线状态与房间映射（可通过Redis扩展）；通过反向代理均衡负载。
- 故障转移：网关实例故障时，前端自动切换至可用节点并重连；服务端状态迁移由中间件或外部存储保障。

[本节为通用指导，不直接分析具体文件]

## 故障排查指南
- 连接失败：检查令牌是否有效、CORS配置、端口与域名是否正确。
- 消息丢失：确认消息持久化是否成功、广播目标房间是否正确、是否存在重复消费。
- 心跳超时：调整心跳间隔与超时阈值，检查网络延迟与服务器负载。
- 在线状态不一致：检查连接关闭事件是否触发清理、是否存在僵尸连接。
- 鉴权失败：核对JWT签名、有效期、权限范围与网关校验逻辑。

章节来源
- [chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)
- [chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- [chat-room.service.ts](file://apps/api/src/support/chat-room.service.ts)
- [chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)

## 结论
本WebSocket通信层以网关为核心，结合认证、房间、在线状态与消息搜索服务，实现了稳定可靠的实时聊天能力。前端通过统一的Hook封装了连接、事件、心跳与重连逻辑，降低了集成复杂度。通过合理的序列化、广播与心跳策略，系统在性能与可靠性之间取得平衡。未来可在多实例部署下引入分布式状态共享与更完善的负载均衡与故障转移机制。

[本节为总结性内容，不直接分析具体文件]

## 附录
- 连接建立示例路径：
  - 前端Hook初始化与发送消息：[useChatSocket.ts](file://apps/admin/src/features/chat/useChatSocket.ts)、[useVisitorChat.ts](file://apps/web/src/features/chat/useVisitorChat.ts)
  - 网关事件处理与鉴权：[chat.gateway.ts](file://apps/api/src/support/chat.gateway.ts)、[chat-auth.service.ts](file://apps/api/src/support/chat-auth.service.ts)
- 消息序列化与类型定义：
  - 前端类型：[types.ts](file://apps/admin/src/features/chat/types.ts)、[types.ts](file://apps/web/src/features/chat/types.ts)
  - 后端DTO与模型：参考support模块中的服务与控制器文件
- 在线状态与Provider：
  - 后端存储：[chat-presence.store.ts](file://apps/api/src/support/chat-presence.store.ts)
  - 前端Provider：[ChatPresenceProvider.tsx](file://apps/admin/src/features/chat/ChatPresenceProvider.tsx)

[本节为补充说明，不直接分析具体文件]