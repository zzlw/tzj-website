import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isPermissionSubset, ROLE_PERMISSIONS } from '../../access/permissions';
import { RolesService } from '../../access/roles.service';
import { ALLOW_UNENROLLED_KEY } from '../decorators/allow-unenrolled.decorator';
import { AUTHENTICATED_ONLY_KEY } from '../decorators/authenticated-only.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser, Role } from '../roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPerms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (
      (!requiredPerms || requiredPerms.length === 0) &&
      (!requiredRoles || requiredRoles.length === 0)
    ) {
      // fail-closed 兜底：无权限注解的端点必须显式声明为「仅登录」
      // （@AuthenticatedOnly 或 2FA 自助流程的 @AllowUnenrolled），否则一律 403。
      // 新增端点漏标注将被 scripts/check-permissions.mjs 在 CI 拦截。
      const authOnly = this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      const allowUnenrolled = this.reflector.getAllAndOverride<boolean>(ALLOW_UNENROLLED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!authOnly && !allowUnenrolled) {
        throw new ForbiddenException('权限不足');
      }
      const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
      if (!user) {
        throw new ForbiddenException('权限不足');
      }
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      throw new ForbiddenException('权限不足');
    }

    const userPerms = await this.rolesService.getPermissionsForSlug(user.role);

    if (requiredPerms?.length) {
      const ok = requiredPerms.some((p) => userPerms.includes(p));
      if (ok) return true;
    }

    if (requiredRoles?.length) {
      if (requiredRoles.includes(user.role as Role)) return true;
      for (const role of requiredRoles) {
        const baseline = ROLE_PERMISSIONS[role];
        if (baseline && isPermissionSubset(userPerms, baseline)) return true;
      }
    }

    throw new ForbiddenException('权限不足');
  }
}
