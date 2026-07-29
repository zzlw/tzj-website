'use client';

import {
  Alert,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
} from '@tzj/ui';
import { Loader2, LogOut, Monitor, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from '@/components/session';
import { TwoFactorCard } from '@/components/settings/TwoFactorCard';
import {
  useChangePassword,
  useProfile,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
  useUpdateProfile,
} from '@/features/account';
import { roleLabel } from '@/features/users';
import { notifyError, notifySuccess } from '@/lib/notify';

export default function AccountSettingsPage() {
  const { role } = useSession();
  const { data: profile, isLoading, isError, error } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? '');
      setEmail(profile.email ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        nickname: nickname.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      notifySuccess('资料已保存');
    } catch (err) {
      notifyError(err, '保存失败');
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      notifySuccess('密码已更新', '请重新登录以生效');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      notifyError(err, '修改失败');
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="账户设置" description="管理个人资料与登录密码" />

      {isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : '未知错误'}
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        /* 大屏双列：左侧资料/密码，右侧安全相关（ 2FA + 会话）；窄屏退回单列 */
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">基本信息</CardTitle>
                <CardDescription>
                  用户名 {profile?.username} · {roleLabel(role)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nickname">昵称</Label>
                    <Input
                      id="nickname"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="显示名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">手机号</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="可选"
                    />
                    <p className="text-xs text-muted-foreground">
                      11 位大陆手机号，保存后可用于登录
                    </p>
                  </div>
                  <Button type="submit" disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? '保存中…' : '保存资料'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">修改密码</CardTitle>
                <CardDescription>修改成功后当前所有会话将失效，需重新登录</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={savePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">当前密码</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">新密码</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={changePassword.isPending}>
                    {changePassword.isPending ? '提交中…' : '更新密码'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <TwoFactorCard />

            <SessionsCard />
          </div>
        </div>
      )}
    </div>
  );
}

/** 活跃会话管理卡片 */
function SessionsCard() {
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  async function handleRevoke(id: string) {
    try {
      await revokeSession.mutateAsync(id);
      notifySuccess('会话已撤销');
    } catch (err) {
      notifyError(err, '撤销失败');
    }
  }

  async function handleRevokeOthers() {
    try {
      await revokeOthers.mutateAsync(undefined);
      notifySuccess('其他会话已全部撤销');
    } catch (err) {
      notifyError(err, '操作失败');
    }
  }

  function parseUA(ua: string | null): { icon: typeof Monitor; label: string } {
    if (!ua) return { icon: Monitor, label: '未知设备' };
    if (/mobile|android|iphone/i.test(ua)) return { icon: Smartphone, label: '移动设备' };
    return { icon: Monitor, label: '桌面设备' };
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">活跃会话</CardTitle>
        <CardDescription>当前账号的登录设备，可撤销异常会话</CardDescription>
        {sessions && sessions.length > 1 && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeOthers}
              disabled={revokeOthers.isPending}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              退出其他会话
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((s, idx) => {
              const { icon: Icon, label } = parseUA(s.userAgent);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {label}
                        {idx === 0 && (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            当前
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.ip ?? '未知 IP'} · {formatTime(s.createdAt)}
                      </p>
                    </div>
                  </div>
                  {idx !== 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(s.id)}
                      disabled={revokeSession.isPending}
                    >
                      撤销
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">无活跃会话</p>
        )}
      </CardContent>
    </Card>
  );
}
