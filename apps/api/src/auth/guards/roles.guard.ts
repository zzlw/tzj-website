import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isPermissionSubset, ROLE_PERMISSIONS } from '../../access/permissions';
import { RolesService } from '../../access/roles.service';
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
