'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@tzj/ui';
import { UserRoundCheck, UserRoundPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { VisitorConvertToLeadDialog } from '@/components/visitor-drawer/VisitorConvertToLeadDialog';
import { useAnalyticsVisitorActivity } from '@/features/analytics';
import { getChatVisitorProfile } from '../api';
import type { ChatRoom } from '../types';

const ICON_BUTTON_CLASS =
  'border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-offset-background size-8 rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 sm:size-10';

/**
 * 头部「转为客户线索」入口：与访客中心/人物抽屉同源的转化对话框。
 * 经会话画像取 visitorId，再取 visitor-activity 身份块拿转化状态与去重锚点（latestContactId）；
 * 已转客户则图标变为「查看客户档案」链接（口径同 identityBlock.convertedCustomerId）。
 */
export function ConvertLeadButton({ room }: { room: ChatRoom }) {
  const queryClient = useQueryClient();
  const [convertOpen, setConvertOpen] = useState(false);
  // 与 VisitorInfoButton 同键的画像查询：命中同一缓存，不重复打后端
  const profileQuery = useQuery({
    queryKey: ['chat', 'visitor-profile', room.roomId],
    queryFn: () => getChatVisitorProfile(room.roomId),
    staleTime: 60_000,
  });
  const visitorId = profileQuery.data?.visitorId ?? null;
  const activityQuery = useAnalyticsVisitorActivity(visitorId);
  const identity = activityQuery.data?.identity;

  // 已转客户：图标高亮并直达客户档案（hover 提示依赖 ChatHeader 操作区的 TooltipProvider）
  if (identity?.convertedCustomerId) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="查看客户档案"
            className={ICON_BUTTON_CLASS}
          >
            <Link href={`/customers/${identity.convertedCustomerId}`}>
              <UserRoundCheck className="text-primary h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>已转客户 · 查看客户档案</TooltipContent>
      </Tooltip>
    );
  }

  // 身份块就绪才可转化：确保去重锚点与表单预填准确（未采集 visitorId 的存量会话禁用）
  const ready = Boolean(visitorId && identity);
  return (
    <>
      {/* 禁用态（未采集到访客 ID）用 span 包裹，保证 Tooltip 仍可触发 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="转为客户线索"
              disabled={!ready}
              onClick={() => setConvertOpen(true)}
              className={ICON_BUTTON_CLASS}
            >
              <UserRoundPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {visitorId ? '转为客户线索' : '该会话未采集到访客 ID，暂不支持转化'}
        </TooltipContent>
      </Tooltip>
      {visitorId && identity ? (
        <VisitorConvertToLeadDialog
          key={visitorId}
          source="chat"
          seed={{
            visitorId,
            name: identity.name ?? room.clientName ?? null,
            email: identity.email ?? room.clientEmail ?? null,
            phone: identity.phone ?? null,
            company: identity.company ?? null,
            contactId: identity.latestContactId ?? null,
            region: activityQuery.data?.techInfo.region ?? null,
          }}
          open={convertOpen}
          onOpenChange={setConvertOpen}
          onConverted={() => {
            setConvertOpen(false);
            // 失效身份块/询盘/访客列表缓存：头部图标与访客中心转化状态列同步刷新
            queryClient.invalidateQueries({
              queryKey: ['analytics', 'visitor-activity', visitorId],
            });
            queryClient.invalidateQueries({
              queryKey: ['analytics', 'visitor-inquiries', visitorId],
            });
            queryClient.invalidateQueries({ queryKey: ['analytics', 'visitors'] });
          }}
        />
      ) : null}
    </>
  );
}
