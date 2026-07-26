import type { ScreenWatermark, SitePublicSettings } from '@tzj/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { Providers } from '@/components/Providers';
import { ChatPresenceProvider } from '@/features/chat/ChatPresenceProvider';
import { apiFetch, getSession } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware 已确保 token 有效，这里只做安全网检查
  const session = await getSession();
  if (!session) redirect('/login');

  // 从 API 获取最新权限，顺带读强制 2FA 绑定标记
  let permissions: string[] = [];
  let twoFactorSetupRequired = false;
  try {
    const me = await apiFetch<{ permissions?: string[]; twoFactorSetupRequired?: boolean }>(
      '/auth/me',
    );
    permissions = me.permissions ?? [];
    twoFactorSetupRequired = me.twoFactorSetupRequired === true;
  } catch (error) {
    // 注意：到此说明已通过上面的 session 校验（用户确实已登录），
    // 此时 /auth/me 失败通常是 token 续期边界的瞬时问题（middleware 会在后续请求修正）。
    // 切勿直接跳转登录，否则会出现「点一下会话就跳登录」的现象。
    // 仅当确实无会话时才在上方 redirect；此处统一降级处理。
    console.warn('[Dashboard] Failed to fetch permissions from /auth/me:', error);
    if (session.role === 'admin') {
      permissions = ['*'];
    }
  }

  // 强制 2FA：未绑定用户导向绑定页（redirect 必须在 try/catch 之外，避免 NEXT_REDIRECT 被吞）
  if (twoFactorSetupRequired) redirect('/enroll-2fa');

  const roleLabels: Record<string, string> = { admin: '超级管理员' };

  // 后台防截图水印配置：经公开接口下发（所有登录用户可读），
  // 失败则回退为关闭，不阻断后台渲染。
  let watermark: ScreenWatermark | undefined;
  try {
    const site = await apiFetch<SitePublicSettings>('/settings/site/public');
    watermark = site.screenWatermark;
  } catch (error) {
    console.warn('[Dashboard] Failed to load screen watermark settings:', error);
  }

  // 侧边栏默认展开状态：服务端读取 cookie（SidebarProvider 切换时写入），
  // 作为跨页导航后 URL 无 ?nav= 参数时的回退，保证刷新后仍保持收起/展开状态。
  const cookieStore = await cookies();
  const sidebarDefaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <Providers
      session={{
        username: session.username,
        role: session.role,
        permissions,
      }}
    >
      <ChatPresenceProvider agentEmail={session.username}>
        <DashboardShell
          username={session.username}
          roleLabel={roleLabels[session.role] ?? session.role}
          defaultOpen={sidebarDefaultOpen}
          watermark={watermark}
        >
          {children}
        </DashboardShell>
      </ChatPresenceProvider>
    </Providers>
  );
}
