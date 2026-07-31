import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@tzj/ui';
import {
  ArrowRight,
  FileText,
  Inbox,
  Mail,
  MessageSquare,
  PenLine,
  Plus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { DashboardAnalyticsPanel } from '@/components/dashboard/DashboardAnalyticsPanel';
import { auditActionLabel, auditResourceLabel, auditUserLabel } from '@/features/audit-labels';
import type { AuditLogItem, ContactItem } from '@/features/types';
import { apiFetch, apiFetchFull, hasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function countOf(resource: string, params = ''): Promise<number> {
  try {
    const { pagination } = await apiFetchFull(`/${resource}?limit=1${params}`);
    return pagination?.total ?? 0;
  } catch {
    return 0;
  }
}

async function fetchList<T>(resource: string, params = ''): Promise<T[]> {
  try {
    const { data } = await apiFetchFull<T[]>(`/${resource}?${params}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function formatTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateLong(d = new Date()): string {
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

const CONTENT_LINKS = [
  { label: '工程案例', key: 'cases', href: '/cases' },
  { label: '新闻', key: 'news', href: '/news' },
  { label: '博客', key: 'blogs', href: '/blog' },
  { label: '活动', key: 'trade-shows', href: '/trade-shows' },
  { label: '媒体素材', key: 'media', href: '/media' },
] as const;

/* 快捷入口唯一保留处：欢迎行右侧，按权限过滤后取前 2 个 */
const QUICK_ACTIONS = [
  { label: '新建文档', href: '/documents/mine/new', icon: PenLine, perm: 'docs.create' },
  { label: '新建案例', href: '/cases/new', icon: Plus, perm: 'content.create' },
  { label: '处理询盘', href: '/contacts', icon: MessageSquare },
] as const;

function ContactStatusBadge({ handled }: { handled: boolean }) {
  return handled ? (
    <Badge variant="outline" className="border-success/30 bg-success-muted text-success-foreground">
      已处理
    </Badge>
  ) : (
    <Badge variant="outline" className="border-warning/40 bg-warning-muted text-warning-foreground">
      待处理
    </Badge>
  );
}

/* ── 指标区：待处理/未读/客户/内容总数 4 张静态卡 + 内容库链接行 ── */

interface Metric {
  label: string;
  value: number;
  icon: typeof Inbox;
}

async function MetricsSection({ canCustomers }: { canCustomers: boolean }) {
  const [cases, news, blogs, tradeShows, media, pendingTotal, unreadTotal, customersTotal] =
    await Promise.all([
      countOf('cases'),
      countOf('news'),
      countOf('blogs'),
      countOf('trade-shows'),
      countOf('media'),
      countOf('contact', '&isHandled=false'),
      countOf('contact', '&isRead=false'),
      canCustomers
        ? apiFetch<{ total?: number }>('/customers/summary')
            .then((r) => r?.total ?? 0)
            .catch(() => 0)
        : Promise.resolve(0),
    ]);

  const contentValues: Record<string, number> = {
    cases,
    news,
    blogs,
    'trade-shows': tradeShows,
    media,
  };

  const metrics: Metric[] = [
    { label: '待处理询盘', value: pendingTotal, icon: Inbox },
    { label: '未读询盘', value: unreadTotal, icon: Mail },
    ...(canCustomers ? [{ label: '客户总数', value: customersTotal, icon: Users }] : []),
    { label: '内容总数', value: cases + news + blogs + tradeShows, icon: FileText },
  ];

  return (
    <section className="mb-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="py-0">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{m.value}</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <m.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="text-xs">内容库</span>
        {CONTENT_LINKS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            {item.label}
            <span className="font-medium tabular-nums text-foreground">
              {contentValues[item.key]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MetricsSkeleton() {
  return (
    <section className="mb-8" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => i).map((i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
    </section>
  );
}

/* ── 动态区：最新询盘 + 最近操作双栏 ── */

async function ActivitySection({ canAudit }: { canAudit: boolean }) {
  const [contacts, auditLogs] = await Promise.all([
    fetchList<ContactItem>('contact', 'limit=6'),
    canAudit
      ? fetchList<AuditLogItem>('audit-logs', 'limit=8&sortBy=createdAt&sortOrder=desc')
      : Promise.resolve([]),
  ]);

  return (
    <div className={canAudit ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
      <Card className="pb-0">
        <CardHeader>
          <CardTitle className="text-base">最新询盘</CardTitle>
          <CardDescription>最近收到的客户咨询</CardDescription>
          <CardAction>
            <Link
              href="/contacts"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              查看全部
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">暂无询盘</div>
          ) : (
            <div className="divide-y divide-border">
              {contacts.map((c) => (
                <Link
                  key={c.id}
                  href="/contacts"
                  className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!c.isRead ? (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 px-1.5 py-0 text-xs text-primary"
                        >
                          新
                        </Badge>
                      ) : null}
                      <ContactStatusBadge handled={c.isHandled} />
                      <span className="truncate text-sm font-medium text-foreground">
                        {c.name}
                        {c.company ? ` · ${c.company}` : ''}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTime(c.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canAudit ? (
        <Card className="pb-0">
          <CardHeader>
            <CardTitle className="text-base">最近操作</CardTitle>
            <CardDescription>后台账号的关键操作记录</CardDescription>
            <CardAction>
              <Link
                href="/audit-logs"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                操作日志
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            {auditLogs.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                暂无操作记录
              </div>
            ) : (
              <div className="divide-y divide-border">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-4 px-6 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{auditUserLabel(log)}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          {auditActionLabel(log.action)}
                          {auditResourceLabel(log.resource)}
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">
      <Skeleton className="h-72" />
      <Skeleton className="h-72" />
    </div>
  );
}

/* ── 页面壳：欢迎行即时渲染，数据区块逐块流式吐出 ── */

export default async function DashboardPage() {
  const me = await apiFetch<{
    permissions?: string[];
    nickname?: string | null;
    username?: string;
  }>('/auth/me').catch(() => ({
    permissions: [] as string[],
    nickname: null as string | null,
    username: undefined as string | undefined,
  }));

  const permissions = me.permissions ?? [];
  const displayName = me.nickname?.trim() || me.username || '管理员';
  const canAnalytics = hasPermission(permissions, 'analytics.view');
  const canAudit = hasPermission(permissions, 'audit.view');
  const canCustomers =
    hasPermission(permissions, 'customers.view') || hasPermission(permissions, 'customers.manage');

  const primaryActions = QUICK_ACTIONS.filter(
    (a) => !('perm' in a && a.perm) || hasPermission(permissions, a.perm),
  ).slice(0, 2);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatDateLong()} · 内容、询盘与访问概览</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            你好，{displayName}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryActions.map((action) => (
            <Button key={action.href} variant="secondary" size="sm" asChild>
              <Link href={action.href}>
                <action.icon className="mr-1.5 h-3.5 w-3.5" />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsSection canCustomers={canCustomers} />
      </Suspense>

      {canAnalytics ? <DashboardAnalyticsPanel /> : null}

      <Suspense fallback={<ActivitySkeleton />}>
        <ActivitySection canAudit={canAudit} />
      </Suspense>
    </div>
  );
}
