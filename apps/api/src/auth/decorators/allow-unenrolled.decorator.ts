import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNENROLLED_KEY = 'allowUnenrolled';

/**
 * 强制 2FA 期间允许「未绑定 2FA 的已登录用户」访问的最小豁免集
 * （me / logout / 2FA 绑定流程本体），见 docs/security/2fa-enforcement-toggle-design.md §5.3。
 */
export const AllowUnenrolled = () => SetMetadata(ALLOW_UNENROLLED_KEY, true);
