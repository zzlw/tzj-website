import { SetMetadata } from '@nestjs/common';
import type { Role } from '../roles';

export const ROLES_KEY = 'roles';

/** 限定可访问该路由的角色。未标注则任意已登录用户可访问。 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
