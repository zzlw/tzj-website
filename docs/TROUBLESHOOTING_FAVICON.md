# Favicon 上传问题排查与解决方案

## 问题现象
线上环境上传 Favicon 时返回 `INTERNAL_SERVER_ERROR`，本地环境正常。

## 根本原因分析

### 1. Dockerfile 缺少运行时依赖（✅ 已修复）
**问题**：生产镜像只安装了 `vips`，缺少 `vips-dev` 和 `libc6-compat`，导致 `sharp` 库在 Alpine Linux 中无法正常工作。

**修复**：已在 [apps/api/Dockerfile](../apps/api/Dockerfile#L57) 添加：
```dockerfile
RUN apk add --no-cache wget openssl vips vips-dev libc6-compat
```

### 2. 缺少 S3/MinIO/OSS 配置（⚠️ 需检查线上配置）
**问题**：生产环境的 `.env.prod.local` 文件中可能缺少以下必要的环境变量：
- `S3_ACCESS_KEY_ID` - OSS 访问密钥 ID
- `S3_ACCESS_KEY_SECRET` - OSS 访问密钥密文

**验证方法**：
登录线上服务器 `/opt/tzj` 目录，检查 `.env.prod.local` 文件是否存在且包含正确的 S3 配置。

**解决方案**：
1. 确保线上服务器存在 `/opt/tzj/.env.prod.local` 文件
2. 在该文件中添加或更新以下配置：
   ```bash
   # S3/OSS 配置
   S3_BUCKET=tzj-media-static-assets
   S3_REGION=oss-cn-beijing
   S3_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
   S3_ACCESS_KEY_ID=<你的阿里云 AccessKey ID>
   S3_ACCESS_KEY_SECRET=<你的阿里云 AccessKey Secret>
   S3_PUBLIC_DOMAIN=https://static.tzjii.com/tzj-uploads-prod
   ```

### 3. png-to-ico 库兼容性问题（✅ 已添加测试）
**问题**：`png-to-ico` 库在 Alpine Linux 环境中可能存在兼容性问题。

**修复**：
- 已在 [apps/api/scripts/test-favicon.ts](../apps/api/scripts/test-favicon.ts) 添加测试脚本
- 已在 [apps/api/Dockerfile](../apps/api/Dockerfile#L32-L34) 添加构建时测试步骤
- 如果构建失败，会立即发现并报告具体错误信息

## 详细修复内容

### 修改的文件

#### 1. apps/api/Dockerfile
- **第 57 行**：添加 `vips-dev` 和 `libc6-compat` 到生产镜像
- **第 32-34 行**：添加构建时 favicon 转换测试

#### 2. apps/api/src/site-settings/favicon.service.ts
- **第 33-80 行**：增强错误日志，便于诊断问题
  - 记录上传开始、格式检测、转换过程、S3 上传等关键步骤
  - 捕获并记录详细的错误信息和堆栈跟踪

#### 3. apps/api/scripts/test-favicon.ts（新增）
- 独立的测试脚本，验证 `sharp` 和 `png-to-ico` 在 Alpine 环境中的兼容性
- 创建测试图片 → 缩放 → 转换为 ICO → 验证输出

#### 4. apps/api/package.json
- **第 27 行**：添加 `test:favicon` 脚本，方便手动测试

## 部署步骤

### 方案 A：重新构建并部署（推荐）

1. **提交代码更改**：
   ```bash
   git add apps/api/Dockerfile \
             apps/api/src/site-settings/favicon.service.ts \
             apps/api/scripts/test-favicon.ts \
             apps/api/package.json
   git commit -m "fix: 修复 Favicon 上传问题 - 添加 Alpine 依赖和错误日志"
   git push origin main
   ```

2. **触发 CI/CD 构建**（云效自动构建）

3. **验证构建是否成功**：
   - 查看构建日志，确认 `Testing favicon ICO conversion...` 步骤通过
   - 如果失败，查看具体错误信息

4. **部署到生产环境**：
   ```bash
   # 登录线上服务器
   ssh <your-server>
   
   # 切换到部署目录
   cd /opt/tzj
   
   # 检查 .env.prod.local 是否存在且包含 S3 配置
   cat .env.prod.local | grep S3
   
   # 如果缺失，编辑文件添加配置
   vi .env.prod.local
   
   # 执行部署
   ./infra/docker/deploy.sh api <new-tag>
   ```

5. **验证功能**：
   - 打开 Admin 后台
   - 上传一个新的 Favicon 图标
   - 检查是否成功，查看 API 日志确认

### 方案 B：紧急修复（如果无法立即重新构建）

如果线上急需修复，可以临时使用以下方法：

1. **直接上传 ICO 格式文件**（跳过转换）：
   - 使用在线工具将 PNG/JPG 转换为 ICO 格式
   - 直接上传 ICO 文件到 Admin 后台

2. **检查并修复环境变量**：
   ```bash
   # 登录线上服务器
   ssh <your-server>
   cd /opt/tzj
   
   # 查看当前 S3 配置
   grep S3 .env.prod.local
   
   # 如果为空或缺失，添加配置后重启 api 服务
   docker compose -f infra/docker/docker-compose.prod.yml \
     --env-file .env.prod \
     --env-file .env.prod.local \
     restart api
   ```

## 验证清单

部署完成后，请验证以下内容：

- [ ] Docker 镜像构建成功，favicon 测试通过
- [ ] 线上服务器 `/opt/tzj/.env.prod.local` 包含正确的 S3 配置
- [ ] API 容器正常运行且健康检查通过
- [ ] Admin 后台可以成功上传 Favicon（PNG/JPG/WebP/ICO）
- [ ] 上传后的 Favicon 可以在浏览器标签页正确显示
- [ ] API 日志中没有 `INTERNAL_SERVER_ERROR` 错误

## 后续优化建议

1. **添加监控告警**：对 S3 上传失败添加告警通知
2. **改进错误提示**：在前端显示更友好的错误信息（如"OSS 配置错误，请联系管理员"）
3. **定期测试**：在 CI/CD 流程中添加端到端的 Favicon 上传测试
4. **文档完善**：在部署文档中明确说明 `.env.prod.local` 的必要配置项

## 相关文件和代码

- [Dockerfile](../apps/api/Dockerfile)
- [FaviconService](../apps/api/src/site-settings/favicon.service.ts)
- [FaviconController](../apps/api/src/site-settings/favicon.controller.ts)
- [Admin Favicon Feature](../apps/admin/src/features/favicon.ts)
- [BFF Route](../apps/admin/src/app/api/site-settings/favicon/route.ts)
- [测试脚本](../apps/api/scripts/test-favicon.ts)
