import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/** 满足任一权限即可访问（与 @Roles 可同时使用，满足其一即通过）。 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
