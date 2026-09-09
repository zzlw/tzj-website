'use client';

import dynamic from 'next/dynamic';
import { type ComponentProps, useEffect, useState } from 'react';
import { onChatWidgetWake } from '@/features/chat/open-chat';
import type { ChatWidget } from './ChatWidget';

/**
 * ChatWidget 懒加载包装：聊天窗是右下角交互组件，非首屏内容、无 SEO 价值，
 * 懒加载后整条聊天依赖链（MarkdownPreview → vditor → react-markdown）移出
 * 首屏 chunk。
 *
 * 仅 dynamic 还不够：chunk 会在 hydration 后立刻开拉，其中 vditor 的 lute
 * 解析引擎近 600KB，在移动端与首屏图片抢带宽。故再延后到浏览器空闲期挂载，
 * 并订阅 openChat 唤醒，保证空闲期到来前的 CTA 点击不落空。
 *
 * 注意：next/dynamic({ ssr: false }) 只能在 Client Component 调用，
 * layout.tsx 是 async Server Component，故需要本包装层；
 * dynamic 声明必须在模块顶层（写在组件函数内会每次渲染重建）。
 */
const LazyChatWidget = dynamic(() => import('./ChatWidget').then((mod) => mod.ChatWidget), {
  ssr: false,
  // 加载窗口极短且组件为 fixed 悬浮 UI，无占位不会产生布局偏移
  loading: () => null,
});

type ChatWidgetProps = ComponentProps<typeof ChatWidget>;

export function ChatWidgetLazy(props: ChatWidgetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const activate = () => setMounted(true);
    const unsubscribe = onChatWidgetWake(activate);

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(activate, { timeout: 4000 });
      return () => {
        unsubscribe();
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(activate, 2000);
    return () => {
      unsubscribe();
      window.clearTimeout(id);
    };
  }, []);

  if (!mounted) return null;
  return <LazyChatWidget {...props} />;
}
