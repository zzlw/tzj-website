import type { MeResult } from '@tzj/types';
import { redirect } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/auth';
import { EnrollTwoFactorClient } from './EnrollTwoFactorClient';

export const metadata = { title: '启用两步验证 | TZJ Admin' };

/** 强制 2FA 绑定引导页：独立于 (dashboard) 组，无侧边栏外壳 */
export default async function EnrollTwoFactorPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // 已绑定或开关已关 → 防直达，回首页。
  // /auth/me 瞬时失败时保守停留在绑定页（业务请求仍由 API 守卫兜底）。
  let setupRequired = true;
  try {
    const me = await apiFetch<MeResult>('/auth/me');
    setupRequired = me.twoFactorSetupRequired === true;
  } catch (error) {
    console.warn('[Enroll2FA] Failed to fetch /auth/me:', error);
  }
  // 注意：redirect 必须在 try/catch 之外，否则 NEXT_REDIRECT 会被 catch 吞掉
  if (!setupRequired) redirect('/');

  return <EnrollTwoFactorClient />;
}
