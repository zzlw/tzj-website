---
kind: external_dependency
name: MinIO 对象存储（本地开发媒体存储）
slug: minio
category: external_dependency
category_hints:
    - vendor_identity
    - client_constraint
scope:
    - '**'
---

### 身份与用途
- 本地开发环境的 S3 兼容对象存储，替代生产环境的阿里云 OSS。
- 容器化部署，默认端口 9000（API）/ 9001（控制台），bucket `tzj-uploads-dev`。

### 技术特性
- 使用 MinIO 的 erasure coding 后端（`xl.meta` 格式），支持高可用和纠删码。
- 通过 `@aws-sdk/client-s3` 访问，endpoint 配置为 `http://localhost:9000`，path-style 模式。

### 数据管理
- 媒体数据按前缀组织：`cases/`, `content/`, `images/`, `products/`, `statics/`, `trade-shows/`, `uploads/`, `videos/`。
- 支持递归上传/下载，与阿里云 OSS 保持 API 兼容性。
- 本地恢复脚本可直接将生产 OSS 数据镜像到 MinIO，便于开发测试。

### 运维注意
- 删除数据库时不会自动清理 MinIO 数据，需手动处理或编写清理脚本。
- 恢复流程需确保 MinIO 服务启动后再执行数据导入。