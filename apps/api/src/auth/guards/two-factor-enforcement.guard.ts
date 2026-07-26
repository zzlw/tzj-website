import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TWOFA_ENROLLMENT_REQUIRED } from '@tzj/types';
import { SettingsService } from '../../settings/settings.service';
import { AuthService } from '../auth.service';
import { ALLOW_UNENROLLED_KEY } from '../decorators/allow-unenrolled.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../roles';

/**
 * 强制 2FA 守卫（方案见 docs/security/2fa-enforcement-toggle-design.md）。
 * 开关（Setting key='security.auth'）打开时，未绑定 2FA 的已登录用户
 * 仅可访问 @AllowUnenrolled() 豁免清单，其余请求一律 403 TWOFA_ENROLLMENT_REQUIRED，
 * 前端据此引导进入绑定页；绑定完成后下一个请求即恢复（无需重登）。
 */
@Injectable()
export class TwoFactorEnforcementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowUnenrolled = this.reflector.getAllAndOverride<boolean>(ALLOW_UNENROLLED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowUnenrolled) return true;

    // kill-switch 同步豁免（事故止血口径与登录挑战、refresh gating 一致）
    if (this.auth.twoFactorChallengeDisabled()) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    // 无 user 由 JwtAuthGuard 兜底；已绑定用户零开销短路（不读设置）
    if (!user || user.twoFactorEnabled) return true;

    const { twoFactorRequired } = await this.settings.getSecurityAuthSettings();
    if (!twoFactorRequired) return true;

    // 注意：异常过滤器取 `error` 字段作为响应信封的 error.code
    throw new ForbiddenException({
      error: TWOFA_ENROLLMENT_REQUIRED,
      message: '管理员已强制开启两步验证，请先完成绑定',
    });
  }
}
