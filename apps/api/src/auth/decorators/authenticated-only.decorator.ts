import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';

/**
 * 显式标记「仅需登录、无需特定权限」的端点（自我服务类：改自己的资料/密码、
 * 管理自己的会话、2FA 自助流程、媒体选择器列表等）。
 *
 * 背景：RolesGuard 采用 fail-closed 兜底（无任何注解即 403），该装饰器用于
 * 声明有意豁免权限校验的端点，同时被 scripts/check-permissions.mjs 识别。
 * 见 docs/b2b-permission-system-assessment.md 第三章 P1。
 */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);
