'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@tzj/ui';
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserItem } from '@/features/types';
import { api } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';

/**
 * 生成 16 位随机密码：字符集固定含小写+大写+数字，稳过后端 IsStrongPassword
 * （8-128 位且 ≥2 类字符 + 弱口令黑名单）。crypto.getRandomValues 保证熵源。
 */
function generatePassword(): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = lower + upper + digits;
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b, i) => {
    // 前三位分别保证三类字符各至少一个，其余从全集取
    if (i === 0) return lower[b % lower.length]!;
    if (i === 1) return upper[b % upper.length]!;
    if (i === 2) return digits[b % digits.length]!;
    return all[b % all.length]!;
  });
  // 打乱前三位的固定位置
  const seed = new Uint32Array(chars.length);
  crypto.getRandomValues(seed);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = seed[i]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

interface ResetPasswordDialogProps {
  /** 目标用户；null 时关闭 */
  target: UserItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 行操作「重置密码」对话框（docs/security/account-recovery-design.md §4.2）：
 * 管理员互助重置通道；目标为 ADMIN 时需操作者当前密码复核（后端硬校验，
 * 且仅 admin 操作者可达——列表侧已按角色遮蔽入口）。
 */
export function ResetPasswordDialog({ target, onOpenChange }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [actorPassword, setActorPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const open = target !== null;
  const targetIsAdmin = target?.role === 'admin';

  // 每次打开重置表单状态
  useEffect(() => {
    if (open) {
      setPassword('');
      setActorPassword('');
      setCopied(false);
    }
  }, [open]);

  function handleGenerate() {
    setPassword(generatePassword());
    setCopied(false);
  }

  async function handleCopy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch (e) {
      notifyError(e, '复制失败，请手动选择复制');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSubmitting(true);
    try {
      await api.post(`users/${target.id}/reset-password`, {
        password,
        ...(targetIsAdmin ? { actorPassword } : {}),
      });
      notifySuccess(
        '密码已重置；其登录态将在 15 分钟内全部失效（刷新链路已切断）。请提醒用户登录后立即修改密码。',
      );
      onOpenChange(false);
    } catch (err) {
      notifyError(err, '重置失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
          <DialogDescription>
            为账号「{target?.username}」设置新密码。明文只展示这一次，请复制后线下转交。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert icon="info">
            执行前请通过当面 / 视频 / 内部 IM
            等第二渠道确认申请人身份，禁止仅凭邮件或聊天文字请求操作。
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="reset-new-password">新密码</Label>
            <div className="flex gap-2">
              <Input
                id="reset-new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setCopied(false);
                }}
                placeholder="输入或点击生成"
                autoComplete="off"
                required
                minLength={8}
                maxLength={128}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerate}
                aria-label="生成随机密码"
                title="生成随机密码"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void handleCopy()}
                disabled={!password}
                aria-label="复制密码"
                title="复制密码"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {targetIsAdmin && (
            <div className="space-y-2">
              <Label htmlFor="reset-actor-password">您的当前密码</Label>
              <Input
                id="reset-actor-password"
                type="password"
                value={actorPassword}
                onChange={(e) => setActorPassword(e.target.value)}
                placeholder="重置管理员密码需复核您的身份"
                autoComplete="current-password"
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting || !password}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              重置密码
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
