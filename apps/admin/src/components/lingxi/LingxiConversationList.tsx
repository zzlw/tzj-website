'use client';

/**
 * 会话历史侧列（docs/lingxi-ai-report-design.md §7.1）：新建 / 切换 / 删除。
 * 列表走 react-query（既有模式）；删除经 ConfirmDialog 二次确认后软删。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LingxiConversationSummary } from '@tzj/types';
import { Button, ConfirmDialog, cn, ScrollArea, Skeleton, toast } from '@tzj/ui';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/apiClient';

const LIST_KEY = ['lingxi', 'conversations'] as const;

export function LingxiConversationList({
  activeId,
  generating,
  onSelect,
  onNew,
}: {
  activeId: string | null;
  generating: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<LingxiConversationSummary | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: LIST_KEY,
    queryFn: () =>
      api.query<{ items: LingxiConversationSummary[] }>('lingxi/conversations', { pageSize: 50 }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/lingxi/conversations/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      toast.success('会话已删除');
      if (id === activeId) onNew();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '删除失败'),
  });

  const items = data?.items ?? [];

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border">
      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={generating}
          onClick={onNew}
        >
          <MessageSquarePlus className="size-4" />
          新对话
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 px-3 pb-3">
          {isLoading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">暂无历史会话</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'group flex items-center gap-1 rounded-md transition-colors',
                  item.id === activeId ? 'bg-primary/10' : 'hover:bg-surface-hover',
                )}
              >
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm disabled:pointer-events-none',
                    item.id === activeId ? 'font-medium text-primary' : 'text-foreground/80',
                  )}
                >
                  {item.title ?? '未命名会话'}
                </button>
                <button
                  type="button"
                  aria-label="删除会话"
                  onClick={() => setPendingDelete(item)}
                  className="mr-1.5 hidden shrink-0 rounded-sm p-1 text-muted-foreground hover:text-destructive group-hover:block"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="删除会话"
        description={`确定删除「${pendingDelete?.title ?? '未命名会话'}」？删除后将进入回收站，30 天后自动清理。`}
        confirmLabel="删除"
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
