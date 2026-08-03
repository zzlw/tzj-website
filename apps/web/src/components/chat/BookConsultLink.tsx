'use client';

import type { ReactNode } from 'react';
import { useBookConsultChat } from '@/features/chat/use-book-consult-chat';

/**
 * 「预约咨询」文本链接——外观与原 <Link href="/contact"> 一致（text-sm font-bold text-primary），
 * 点击后走三级分流（在线→聊天 / 手机→拨号 / 兜底→表单）。
 */
interface BookConsultLinkProps {
  children: ReactNode;
  className?: string;
  /** 场景化开场消息 */
  message?: string;
}

export function BookConsultLink({
  children,
  className = 'text-sm font-bold text-primary transition-colors hover:text-primary-hover',
  message,
}: BookConsultLinkProps) {
  const { handleClick } = useBookConsultChat({ message });
  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
