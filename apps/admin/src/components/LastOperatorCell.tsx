'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Separator,
} from '@tzj/ui';
import { useRef, useState } from 'react';
import { formatDate, formatDateTime } from '@/features/constants';
import type { ContentOperatorUser } from '@/features/types';
import { roleLabel } from '@/features/users';

function displayNickname(user: ContentOperatorUser): string {
  return user.nickname?.trim() || user.username;
}

function initials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t.slice(0, 2).toUpperCase();
}

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function OperatorProfileCard({ user }: { user: ContentOperatorUser }) {
  const nickname = displayNickname(user);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11">
          {user.avatar ? <AvatarImage src={user.avatar} alt={nickname} /> : null}
          <AvatarFallback className="text-sm font-medium">{initials(nickname)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-foreground">{nickname}</div>
          <div className="truncate text-xs text-muted-foreground">@{user.username}</div>
        </div>
        {user.isActive ? (
          <Badge
            variant="outline"
            className="shrink-0 border-success/30 bg-success-muted text-success-foreground"
          >
            启用
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 border-zinc-200 bg-zinc-50 text-zinc-600">
            停用
          </Badge>
        )}
      </div>
      <Separator />
      <div className="space-y-2">
        <ProfileRow label="用户名" value={user.username} />
        <ProfileRow label="昵称" value={user.nickname?.trim() || '—'} />
        <ProfileRow label="邮箱" value={user.email?.trim() || '—'} />
        <ProfileRow label="手机" value={user.phone?.trim() || '—'} />
        <ProfileRow label="角色" value={roleLabel(user.role)} />
        <ProfileRow
          label="最近登录"
          value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
        />
        <ProfileRow label="注册时间" value={formatDate(user.createdAt)} />
      </div>
    </div>
  );
}

function OperatorInline({ user }: { user: ContentOperatorUser }) {
  const nickname = displayNickname(user);

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-left font-medium text-foreground">
      <Avatar className="h-5 w-5">
        {user.avatar ? <AvatarImage src={user.avatar} alt={nickname} /> : null}
        <AvatarFallback className="text-xs font-medium">{initials(nickname)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{nickname}</span>
    </span>
  );
}

export function LastOperatorCell({
  user,
  fallback,
  profileOnHover = true,
}: {
  user?: ContentOperatorUser | null;
  fallback?: string | null;
  /** 为 false 时仅展示操作人，不弹出资料卡片（适用于 Dialog 等会自动聚焦的场景） */
  profileOnHover?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allowOpenRef = useRef(false);

  if (!user) {
    if (!fallback?.trim()) return <span className="text-muted-foreground">—</span>;
    const label = fallback.trim().split(/\s+/)[0] ?? fallback;
    return <span>{label}</span>;
  }

  if (!profileOnHover) {
    return <OperatorInline user={user} />;
  }

  const nickname = displayNickname(user);

  function handleOpenChange(next: boolean) {
    if (next && !allowOpenRef.current) return;
    setOpen(next);
    if (!next) allowOpenRef.current = false;
  }

  return (
    <HoverCard open={open} onOpenChange={handleOpenChange} openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onPointerEnter={() => {
            allowOpenRef.current = true;
          }}
          onPointerLeave={() => {
            allowOpenRef.current = false;
          }}
          onFocus={(event) => {
            if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
              allowOpenRef.current = true;
            }
          }}
          onBlur={() => {
            allowOpenRef.current = false;
          }}
        >
          <Avatar className="h-5 w-5">
            {user.avatar ? <AvatarImage src={user.avatar} alt={nickname} /> : null}
            <AvatarFallback className="text-xs font-medium">{initials(nickname)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{nickname}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start" side="top">
        <OperatorProfileCard user={user} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function lastOperatorColumn<
  T extends { lastOperator?: string | null; lastOperatorUser?: ContentOperatorUser | null },
>() {
  return {
    key: 'lastOperator',
    header: '最后操作人',
    sortable: true,
    sortKey: 'lastOperatorId',
    cell: (r: T) => <LastOperatorCell user={r.lastOperatorUser} fallback={r.lastOperator} />,
  } as const;
}

export function creatorColumn<
  T extends { createdBy?: string | null; createdByUser?: ContentOperatorUser | null },
>() {
  return {
    key: 'createdBy',
    header: '创建人',
    sortable: true,
    sortKey: 'createdById',
    cell: (r: T) => <LastOperatorCell user={r.createdByUser} fallback={r.createdBy} />,
  } as const;
}

/** 内容模块列表：创建时间、更新时间、创建人 */
export function contentAuditColumns<
  T extends BaseEntity & {
    createdBy?: string | null;
    createdByUser?: ContentOperatorUser | null;
  },
>() {
  return [
    {
      key: 'createdAt',
      header: '创建时间',
      sortable: true,
      className: 'whitespace-nowrap text-muted-foreground',
      cell: (r: T) => formatDateTime(r.createdAt),
    },
    {
      key: 'updatedAt',
      header: '更新时间',
      sortable: true,
      className: 'whitespace-nowrap text-muted-foreground',
      cell: (r: T) => formatDateTime(r.updatedAt),
    },
    creatorColumn<T>(),
  ] as const;
}

type BaseEntity = { createdAt: string; updatedAt: string };
