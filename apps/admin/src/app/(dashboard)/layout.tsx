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
    // 认证失败（token 被撤销等极端情况）→ 跳转登录
    if (error instanceof Error && error.message.includes('401')) {
      redirect('/login?reason=session_expired');
    }
    // API 临时不可达，使用 fallback：超级管理员拥有所有权限
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
