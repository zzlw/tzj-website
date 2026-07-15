'use client';

import { Suspense } from 'react';
import { ChatMessenger } from '@/features/chat/ChatMessenger';

export default function ChatConsolePage() {
  // 显式视口高度：100svh − 顶栏(h-14=3.5rem) − main 的 py-5(2.5rem) = 6rem
  // 必须显式，否则 Radix ScrollArea 内 <main> 高度为 auto，flex 高度链断裂导致整页滚动
  return (
    <div className="flex h-[calc(100svh-6rem)] min-h-0 flex-col">
      {/* ChatMessenger 使用 useSearchParams，必须包裹在 Suspense 边界，否则生产构建报错 */}
      <Suspense fallback={null}>
        <ChatMessenger />
      </Suspense>
    </div>
  );
}
