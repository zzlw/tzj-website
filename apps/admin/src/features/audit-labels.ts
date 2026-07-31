import type { AuditLogItem } from './types';

export const AUDIT_ACTION_OPTIONS = [
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  // 以下为后端手动写入的语义化动作（customers/contact/chat-rooms.service 中的 soft-delete、purge），
  // 拦截器不会自动生成，必须顯式列出，否则下拉筛选不到（见 docs/operation-audit-system-assessment.md v4.7）。
  // 2FA 相关的细分 action（2fa_setup/2fa_enabled/2fa_policy_enabled 等）不入下拉：
  // 均属低频且可通过 resource='auth' + search '2fa_' 组合定位，避免菜单膨胀。
  { value: 'soft-delete', label: '软删除' },
  { value: 'purge', label: '永久删除' },
] as const;

export const AUDIT_RESOURCE_OPTIONS = [
  { value: 'auth', label: '认证' },
  { value: 'users', label: '账号' },
  { value: 'access', label: '角色权限' },
  { value: 'cases', label: '案例' },
  { value: 'news', label: '新闻' },
  { value: 'blogs', label: '博客' },
  { value: 'trade-shows', label: '活动' },
  { value: 'media', label: '媒体' },
  // 后端控制器路由为 @Controller('contact')（单数），拦截器写入 resource='contact'；
  // v4.7 前误写为 'contacts'（复数）导致筛选 0 结果。
  { value: 'contact', label: '询盘' },
  { value: 'customers', label: '客户' },
  { value: 'chat-rooms', label: '会话' },
  { value: 'pages', label: '页面' },
  { value: 'settings', label: '站点设置' },
  { value: 'integrations', label: '集成凭证' },
] as const;

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action;
}

export function auditResourceLabel(resource: string): string {
  return AUDIT_RESOURCE_OPTIONS.find((o) => o.value === resource)?.label ?? resource;
}

export function auditUserLabel(log: Pick<AuditLogItem, 'user'>): string {
  if (!log.user) return '—';
  return log.user.nickname?.trim() || log.user.username;
}

export function formatAuditDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN');
}
