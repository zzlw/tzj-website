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
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserItem } from '@/features/types';
import { api } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';

interface ForceDisable2faDialogProps {
  /** 目标用户；null 时关闭 */
  target: UserItem | null;
  onOpenChange: (open: boolean) => void;
  /** 成功后由列表页刷新行内 2FA 状态 */
  onSuccess: () => void;
}

/**
 * 行操作「强制解除 2FA」对话框（docs/security/account-recovery-design.md §4.2）：
 * 覆盖 P3（丢 2FA 设备 + 恢复码用尽）。后端 POST /auth/2fa/force-disable
 * 为 @Roles('admin') 硬约束并要求操作者密码，操作即审计（2fa_force_disabled）。
 */
export function ForceDisable2faDialog({
  target,
  onOpenChange,
  onSuccess,
}: ForceDisable2faDialogProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const open = target !== null;

  useEffect(() => {
    if (open) setPassword('');
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSubmitting(true);
    try {
      await api.post('auth/2fa/force-disable', {
        targetUserId: target.id,
        password,
      });
      notifySuccess(`已解除「${target.username}」的两步验证`);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      notifyError(err, '解除失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>强制解除两步验证</DialogTitle>
          <DialogDescription>
            解除账号「{target?.username}」的 2FA 绑定（适用于设备丢失且恢复码用尽）。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert variant="destructive" icon="warning">
            解除后该用户可仅凭密码登录，请先通过当面 / 视频 / 内部 IM
            等第二渠道核实申请人身份。若全局强制 2FA 已开启，其下次登录会被引导重新绑定。
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="force-disable-password">您的当前密码</Label>
            <Input
              id="force-disable-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="高危操作需复核您的身份"
              autoComplete="current-password"
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting || !password}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              确认解除
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
