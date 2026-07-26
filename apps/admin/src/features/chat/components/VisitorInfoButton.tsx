'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@tzj/ui';
import { Info } from 'lucide-react';
import { useVisitorDrawer } from '@/components/visitor-drawer/context';
import { notifyError } from '@/lib/notify';
import { getChatVisitorProfile } from '../api';
import type { ChatRoom } from '../types';

const INFO_BUTTON_CLASS =
  'border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:size-10';

/**
 * 头部「访客信息」入口：点击时先确保画像已加载再打开公共访客抽屉
 * （Intercom 全局实体抽屉模式，与访客中心/询盘等入口共用同一抽屉，转化线索也在抽屉内完成）。
 * 存量会话若未采集到 visitorId 则直接提示（无旧弹层回退）。
 */
export function VisitorInfoButton({ room }: { room: ChatRoom }) {
  const { openPerson } = useVisitorDrawer();
  const qc = useQueryClient();
  // 预取画像，让点击时的 ensureQueryData 大概率直接命中缓存
  useQuery({
    queryKey: ['chat', 'visitor-profile', room.roomId],
    queryFn: () => getChatVisitorProfile(room.roomId),
    staleTime: 60_000,
  });

  const handleClick = async () => {
    try {
      const profile = await qc.ensureQueryData({
        queryKey: ['chat', 'visitor-profile', room.roomId],
        queryFn: () => getChatVisitorProfile(room.roomId),
        staleTime: 60_000,
      });
      const visitorId = profile?.visitorId ?? null;
      if (!visitorId) {
        notifyError('该会话未采集到访客 ID，暂无访客档案');
        return;
      }
      openPerson(visitorId, {
        name: room.clientName ?? null,
        email: room.clientEmail ?? null,
      });
    } catch (error) {
      notifyError(error, '访客画像加载失败，请稍后重试');
    }
  };

  // hover 提示依赖 ChatHeader 操作区的 TooltipProvider
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="访客信息"
          onClick={handleClick}
          className={INFO_BUTTON_CLASS}
        >
          <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>查看访客信息</TooltipContent>
    </Tooltip>
  );
}
