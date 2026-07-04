/** 后台列表「最后操作人」关联用户（不含敏感字段） */
export const LAST_OPERATOR_USER_SELECT = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  phone: true,
  avatar: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export const LAST_OPERATOR_USER_INCLUDE = {
  lastOperatorUser: { select: LAST_OPERATOR_USER_SELECT },
} as const;

export const CREATED_BY_USER_INCLUDE = {
  createdByUser: { select: LAST_OPERATOR_USER_SELECT },
} as const;

/** 后台内容列表关联用户 */
export const CONTENT_ADMIN_USER_INCLUDE = {
  ...LAST_OPERATOR_USER_INCLUDE,
  ...CREATED_BY_USER_INCLUDE,
} as const;

const INTERNAL_KEYS = [
  "systemPublishedAt",
  "createdBy",
  "createdById",
  "createdByUser",
  "lastOperator",
  "lastOperatorId",
  "lastOperatorUser",
] as const;

/** 前台公开列表不暴露内部审计字段 */
export function stripInternalContentFields<T extends Record<string, unknown>>(
  item: T,
  includeUnpublished: boolean,
): Omit<T, (typeof INTERNAL_KEYS)[number]> {
  if (includeUnpublished) return item;
  const copy = { ...item };
  for (const key of INTERNAL_KEYS) {
    delete copy[key];
  }
  return copy;
}
