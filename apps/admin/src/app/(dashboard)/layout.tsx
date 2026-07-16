import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { Providers } from '@/components/Providers';
import { ChatPresenceProvider } from '@/features/chat/ChatPresenceProvider';
import { apiFetch, getSession } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware 已确保 token 有效，这里只做安全网检查
  const session = await getSession();
  if (!session) redirect('/login');

  // 从 API 获取最新权限
  let permissions: string[] = [];
  try {
    const me = await apiFetch<{ permissions?: string[] }>('/auth/me');
    permissions = me.permissions ?? [];
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

  const roleLabels: Record<string, string> = { admin: '超级管理员' };

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
        >
          {children}
        </DashboardShell>
      </ChatPresenceProvider>
    </Providers>
  );
}
