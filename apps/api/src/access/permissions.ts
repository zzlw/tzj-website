import { Role } from '../auth/roles';

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
    id: 'content',
    label: '内容管理',
    permissions: [
      { id: 'content.view', label: '查看内容', description: '含草稿与未发布内容' },
      { id: 'content.create', label: '创建内容' },
      { id: 'content.edit', label: '编辑内容' },
      { id: 'content.publish', label: '发布 / 下线' },
      { id: 'content.delete', label: '删除内容' },
    ],
  },
  {
    id: 'media',
    label: '媒体库',
    permissions: [
      // 说明：媒体库「查看/浏览」已对所有已登录角色开放，无需单独权限，故此处不再定义 media.view。
      { id: 'media.upload', label: '上传媒体' },
      { id: 'media.delete', label: '删除媒体', description: '移入回收站' },
      {
        id: 'media.purge',
        label: '永久删除媒体',
        description: '从回收站物理清除存储对象',
      },
      {
        id: 'media.replaceSite',
        label: '替换站点资源',
        description: '覆盖 content/ 下固定 key 的官网静态图片/视频',
      },
    ],
  },
  {
    id: 'contacts',
    label: '询盘管理',
    permissions: [
      { id: 'contacts.view', label: '查看询盘' },
      { id: 'contacts.manage', label: '处理询盘' },
      { id: 'contacts.delete', label: '删除询盘' },
    ],
  },
  {
    id: 'customers',
    label: '客户管理',
    permissions: [
      {
        id: 'customers.view',
        label: '查看客户',
        description: '查看私海 / 公海客户（含全部需 customers.manage）',
      },
      {
        id: 'customers.manage',
        label: '管理客户',
        description: '新建 / 编辑 / 认领 / 退回公海 / 转移客户',
      },
      { id: 'customers.delete', label: '删除客户' },
    ],
  },
  {
    id: 'operations',
    label: '运营分析',
    permissions: [
      {
        id: 'analytics.view',
        label: '查看访客分析',
        description: '官网 PV/UV、页面排行、来源与设备分布（只读）',
      },
    ],
  },
  {
    id: 'security',
    label: '网站安全',
    permissions: [
      {
        id: 'security.view',
        label: '查看安全策略',
        description: '查看 IP 封禁列表与异常流量',
      },
      {
        id: 'security.manage',
        label: '管理安全策略',
        description: '封禁 / 解封 IP，阻止恶意访问',
      },
    ],
  },
  {
    id: 'docs',
    label: '内部文档',
    permissions: [
      { id: 'docs.view', label: '查看内部文档', description: '阅读已发布的内部文档' },
      { id: 'docs.create', label: '创建内部文档' },
      { id: 'docs.edit', label: '编辑内部文档', description: '含查看草稿' },
      {
        id: 'docs.publish',
        label: '发布内部文档',
        description: '发布、下线，或将个人文档分享到公司知识库',
      },
      { id: 'docs.delete', label: '删除内部文档' },
      {
        id: 'docs.manage',
        label: '管理文档库结构',
        description: '文件夹增删改、置顶等',
      },
    ],
  },
  {
    id: 'support',
    label: '客服与工单',
    permissions: [
      {
        id: 'chat.view',
        label: '查看会话',
        description: '查看实时会话列表与聊天记录',
      },
      {
        id: 'chat.manage',
        label: '管理会话',
        description: '接入 / 回复 / 转接 / 关闭会话',
      },
      {
        id: 'chat.delete',
        label: '删除会话',
        description: '软删除会话记录（含批量）',
      },
      {
        id: 'tickets.view',
        label: '查看工单',
        description: '查看工单列表与详情',
      },
      {
        id: 'tickets.manage',
        label: '处理工单',
        description: '回复 / 更新状态 / 添加评论',
      },
      {
        id: 'tickets.delete',
        label: '删除工单',
      },
    ],
  },
  {
    id: 'system',
    label: '系统管理',
    permissions: [
      { id: 'users.manage', label: '账号管理' },
      { id: 'access.view', label: '查看角色与权限' },
      { id: 'access.manage', label: '创建与管理自定义角色' },
      { id: 'audit.view', label: '查看操作日志', description: '查看谁在何时做了什么' },
      { id: 'settings.view', label: '查看站点设置', description: '联系方式、备案、社媒等' },
      { id: 'settings.manage', label: '管理站点设置', description: '编辑官网联系方式、备案与社媒' },
      {
        id: 'integrations.view',
        label: '查看集成凭证',
        description: '查看第三方 API 密钥（脱敏）与基础设施 env 状态',
      },
      {
        id: 'integrations.manage',
        label: '管理集成凭证',
        description: '编辑第三方 API 密钥（加密存储）',
      },
      {
        id: 'system.view',
        label: '查看系统状态',
        description: '服务健康、内存/CPU/磁盘与通知发送记录',
      },
    ],
  },
];

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.id));

/** 当前保留的系统预置角色（仅超级管理员）。 */
export const SYSTEM_ROLE_SLUGS = [Role.ADMIN] as const;

export const ROLE_META: Record<
  (typeof SYSTEM_ROLE_SLUGS)[number],
  { label: string; description: string; system: boolean }
> = {
  [Role.ADMIN]: {
    label: '超级管理员',
    description: '拥有全部权限，可管理账号与系统配置。',
    system: true,
  },
};

/** 已废弃的预置角色 slug（保留鉴权基线，不再写入数据库）。 */
export const DEPRECATED_ROLE_SLUGS = ['editor', 'viewer'] as const;

/**
 * 鉴权基线：@Roles 装饰器中的 slug 映射到权限子集。
 * 含已废弃的 editor/viewer，供自定义角色的超集校验。
 */
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  [Role.ADMIN]: ALL_PERMISSION_IDS,
  editor: [
    'content.view',
    'content.create',
    'content.edit',
    'content.publish',
    'media.upload',
    'contacts.view',
    'contacts.manage',
    'customers.view',
    'customers.manage',
  ],
  viewer: ['content.view'],
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

export const RESERVED_ROLE_SLUGS = new Set<string>([Role.ADMIN, ...DEPRECATED_ROLE_SLUGS]);

export function slugifyRoleName(name: string): string {
  const latin = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (latin) return latin;
  const trimmed = name.trim();
  if (!trimmed) return '';
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return `role-${hash.toString(36)}`;
}

export function assertValidPermissions(permissions: string[]) {
  const invalid = permissions.filter((p) => !ALL_PERMISSION_IDS.includes(p));
  if (invalid.length > 0) {
    throw new Error(`无效权限: ${invalid.join(', ')}`);
  }
}

/**
 * ❗ 权限定义与控制器对齐规范（防止同类问题再次发生）：
 *
 * 1. 新增业务模块时，必须在此文件的 PERMISSION_GROUPS 中定义对应权限组
 * 2. 对应控制器必须使用 @RequirePermissions('xxx.yyy') 装饰器执行权限
 * 3. 访客公开端点用 @Public()，管理端点绝不允许裸露（无装饰器）
 * 4. CI 检查：所有非 @Public 控制器的写操作端点必须有 @RequirePermissions
 */
