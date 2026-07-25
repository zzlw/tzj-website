---
kind: external_dependency
name: 纯真 IP 地址库（离线地理定位主源）
slug: lib-qqwry
category: external_dependency
category_hints:
    - sdk_real_api
    - framework_behavior
scope:
    - '**'
---

### 身份与用途
- 国内 IP 地理位置查询的主数据源，提供省市区级别定位及运营商信息。
- 离线 `.dat` 文件格式，无需网络请求，性能优于在线 API。

### 集成方式
- 通过 `lib-qqwry` 包加载纯真库数据，替代原有的 `geoip-lite`（仅国家/省级粗粒度）。
- 结合在线 API（`ip-api.com` → `ipapi.co` 兜底）补充 ISO 国家码和中文名。

### 定位策略
- 主源：纯真库（国内精确到省市区+街道 + 运营商）
- 补充：`ip-api.com`（中文名 + ISO 国家码）→ `ipapi.co`（HTTPS 兜底）
- 融合：取去空格后更详尽的地理串，ISP 优先纯真库中文名
- 缓存：进程内 TTL Map（命中 7 天 / 未命中 30 分钟）

### 适用场景
- 访客分析模块的 IP 定位优化，历史数据读取时重新解析，旧数据也能显示更精确地区。
- GPS 采集行沿用入库 GPS 地区，内网/保留地址跳过外呼。

### 验证
- 已验证解析到省市区级别，中文地名准确，运营商信息完整。