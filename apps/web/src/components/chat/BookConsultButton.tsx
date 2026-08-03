'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { RbButton } from '@/components/ui';
import { useBookConsultChat } from '@/features/chat/use-book-consult-chat';

/**
 * 「预约咨询」智能按钮——点击后走三级分流（在线→聊天 / 手机→拨号 / 兜底→表单）。
 * 外观与 RbButton 完全一致，仅将 href 导航替换为 useBookConsultChat 逻辑。
 */
interface BookConsultButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'light';
  className?: string;
  icon?: LucideIcon;
  /** 场景化开场消息（不传则聊天面板不自动发送消息） */
  message?: string;
}

export function BookConsultButton({
  children,
  message,
  ...rest
}: BookConsultButtonProps) {
  const { handleClick } = useBookConsultChat({ message });
  return (
    <RbButton onClick={handleClick} {...rest}>
      {children}
    </RbButton>
  );
}
