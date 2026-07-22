import { z } from 'zod';
import type { FieldDef } from '@/components/crud/config';
import type { RoleOption } from '@/features/access';

export const FALLBACK_ROLE_OPTIONS: RoleOption[] = [
  { value: 'admin', label: '超级管理员', system: true },
];

export function roleLabel(role: string, options?: RoleOption[]): string {
  const list = options ?? FALLBACK_ROLE_OPTIONS;
  return list.find((r) => r.value === role)?.label ?? role;
}

export function roleOptionsToFieldOptions(options: RoleOption[]) {
  return options.map((r) => ({ label: r.label, value: r.value }));
}

const baseSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符').max(64),
  nickname: z.string().max(64).optional(),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z.string().max(32).optional(),
  role: z.string().min(1, '请选择角色'),
  isActive: z.boolean().optional(),
});

export const createUserSchema = baseSchema.extend({
  password: z.string().min(8, '密码至少 8 位').max(128),
});

export const updateUserSchema = baseSchema.extend({
  password: z.string().min(8, '密码至少 8 位').max(128).optional().or(z.literal('')),
  lockedUntil: z.string().optional().or(z.literal('')).or(z.null()),
});

export function buildUserCreateFields(roleOptions: RoleOption[]): FieldDef[] {
  return [
    { name: 'username', label: '用户名', type: 'text', required: true },
    { name: 'password', label: '初始密码', type: 'text', required: true, colSpan: 2 },
    { name: 'nickname', label: '昵称', type: 'text' },
    {
      name: 'role',
      label: '角色',
      type: 'select',
      required: true,
      options: roleOptionsToFieldOptions(roleOptions),
    },
    { name: 'email', label: '邮箱', type: 'text', colSpan: 2 },
    { name: 'phone', label: '手机号', type: 'text' },
  ];
}

export function buildUserEditFields(roleOptions: RoleOption[]): FieldDef[] {
  return [
    { name: 'username', label: '用户名', type: 'text', required: true },
    { name: 'nickname', label: '昵称', type: 'text' },
    {
      name: 'role',
      label: '角色',
      type: 'select',
      required: true,
      options: roleOptionsToFieldOptions(roleOptions),
    },
    {
      name: 'isActive',
      label: '账号状态',
      type: 'switch',
      placeholder: '启用账号',
    },
    { name: 'email', label: '邮箱', type: 'text', colSpan: 2 },
    { name: 'phone', label: '手机号', type: 'text' },
    {
      name: 'lockedUntil',
      label: '临时锁定至',
      type: 'datetime',
      help: '设置后该账号在指定时间前无法登录，留空则不锁定',
      emptyAsNull: true,
    },
    {
      name: 'password',
      label: '新密码',
      type: 'text',
      colSpan: 2,
      help: '留空则不修改密码',
    },
  ];
}

export const userCreateDefaults = {
  username: '',
  password: '',
  nickname: '',
  email: '',
  phone: '',
  role: 'admin',
};

export const userEditDefaults = {
  username: '',
  nickname: '',
  email: '',
  phone: '',
  role: 'admin',
  isActive: true,
  lockedUntil: '',
  password: '',
};
