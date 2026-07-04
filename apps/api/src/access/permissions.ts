import { Role } from "../auth/roles";

export interface PermissionDef {
  id: string;
  label: string;
  description?: string;
}

export interface PermissionGroupDef {
  id: string;
  label: string;
  permissions: PermissionDef[];
}

/** 权限分组定义（与 API 鉴权规则对齐）。 */
export const PERMISSION_GROUPS: PermissionGroupDef[] = [
  {
    id: "content",
    label: "内容管理",
    permissions: [
      { id: "content.view", label: "查看内容", description: "含草稿与未发布内容" },
      { id: "content.create", label: "创建内容" },
      { id: "content.edit", label: "编辑内容" },
      { id: "content.publish", label: "发布 / 下线" },
      { id: "content.delete", label: "删除内容" },
    ],
  },
  {
    id: "media",
    label: "媒体库",
    permissions: [
      { id: "media.view", label: "查看媒体" },
      { id: "media.upload", label: "上传媒体" },
      { id: "media.delete", label: "删除媒体", description: "移入回收站" },
      {
        id: "media.purge",
        label: "永久删除媒体",
        description: "从回收站物理清除存储对象",
      },
      {
        id: "media.replaceSite",
        label: "替换站点资源",
        description: "覆盖 content/ 下固定 key 的官网静态图片/视频",
      },
    ],
  },
  {
    id: "contacts",
    label: "询盘管理",
    permissions: [
      { id: "contacts.view", label: "查看询盘" },
      { id: "contacts.manage", label: "处理询盘" },
      { id: "contacts.delete", label: "删除询盘" },
    ],
  },
  {
    id: "operations",
    label: "运营分析",
    permissions: [
      {
        id: "analytics.view",
        label: "查看访客分析",
        description: "官网 PV/UV、页面排行、来源与设备分布",
      },
    ],
  },
  {
    id: "system",
    label: "系统管理",
    permissions: [
      { id: "users.manage", label: "账号管理" },
      { id: "access.view", label: "查看角色与权限" },
      { id: "access.manage", label: "创建与管理自定义角色" },
      { id: "audit.view", label: "查看操作日志", description: "查看谁在何时做了什么" },
    ],
  },
];

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.id),
);

/** 当前保留的系统预置角色（仅超级管理员）。 */
export const SYSTEM_ROLE_SLUGS = [Role.ADMIN] as const;

export const ROLE_META: Record<
  (typeof SYSTEM_ROLE_SLUGS)[number],
  { label: string; description: string; system: boolean }
> = {
  [Role.ADMIN]: {
    label: "超级管理员",
    description: "拥有全部权限，可管理账号与系统配置。",
    system: true,
  },
};

/** 已废弃的预置角色 slug（保留鉴权基线，不再写入数据库）。 */
export const DEPRECATED_ROLE_SLUGS = ["editor", "viewer"] as const;

/**
 * 鉴权基线：@Roles 装饰器中的 slug 映射到权限子集。
 * 含已废弃的 editor/viewer，供自定义角色的超集校验。
 */
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  [Role.ADMIN]: ALL_PERMISSION_IDS,
  editor: [
    "content.view",
    "content.create",
    "content.edit",
    "content.publish",
    "media.view",
    "media.upload",
    "contacts.view",
    "contacts.manage",
  ],
  viewer: ["content.view"],
};

export function roleHasPermission(roleSlug: string, permissionId: string): boolean {
  return (ROLE_PERMISSIONS[roleSlug] ?? []).includes(permissionId);
}

export function isPermissionSubset(
  granted: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((p) => granted.includes(p));
}

export const RESERVED_ROLE_SLUGS = new Set<string>([
  Role.ADMIN,
  ...DEPRECATED_ROLE_SLUGS,
]);

export function slugifyRoleName(name: string): string {
  const latin = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (latin) return latin;
  const trimmed = name.trim();
  if (!trimmed) return "";
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return `role-${hash.toString(36)}`;
}

export function assertValidPermissions(permissions: string[]) {
  const invalid = permissions.filter((p) => !ALL_PERMISSION_IDS.includes(p));
  if (invalid.length > 0) {
    throw new Error(`无效权限: ${invalid.join(", ")}`);
  }
}
