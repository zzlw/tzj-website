'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@tzj/ui';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useChatPresence } from '@/features/chat/ChatPresenceProvider';
import { NotificationPanel } from '@/features/chat/components/NotificationPanel';
import { useSession } from './session';

/**
 * 顶栏通知铃铛：角标数据源为 actionableUnread（与 Sidebar ChatNavBadge 同口径），
 * 弹层内容（NotificationPanel）仅在 Popover 打开时挂载，关闭即退订 socket 监听。
 */
export function NotificationBell() {
  const { permissions } = useSession();
  const { actionableUnread } = useChatPresence();
  // 受控 open：点击条目跳转后主动收起弹层（壳层跨页常驻，Popover 不会自行关闭）
  const [open, setOpen] = useState(false);

  // 权限门控：与 Sidebar 菜单过滤同源口径（chat.view 或 * 通配符），
  // 避免无权限用户看到一个点击后无法访问 /chat 的入口
  if (!permissions.includes('*') && !permissions.includes('chat.view')) return null;

  const displayCount = actionableUnread > 99 ? '99+' : actionableUnread;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={actionableUnread > 0 ? `未读消息 ${actionableUnread} 条` : '消息通知'}
      >
        <Bell className="size-[18px]" />
        {actionableUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-medium text-destructive-foreground">
            {displayCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <NotificationPanel onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
