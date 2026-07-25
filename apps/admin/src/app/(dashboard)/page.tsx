import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  PageHeader,
} from '@tzj/ui';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  FolderOpen,
  Images,
  Inbox,
  Mail,
  MessageSquare,
  Newspaper,
  PenLine,
  Plus,
  ScrollText,
  Users,
} from 'lucide-react';
import Link from 'next/link';
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

const CONTENT_STATS = [
  {
    label: '工程案例',
    key: 'cases',
    icon: FolderOpen,
    href: '/cases',
    color: 'text-blue-600 bg-blue-500/10',
  },
  {
    label: '新闻',
    key: 'news',
    icon: Newspaper,
    href: '/news',
    color: 'text-violet-600 bg-violet-500/10',
  },
  {
    label: '博客',
    key: 'blogs',
    icon: BookOpen,
    href: '/blog',
    color: 'text-emerald-600 bg-emerald-500/10',
  },
  {
    label: '展会',
    key: 'trade-shows',
    icon: CalendarDays,
    href: '/trade-shows',
    color: 'text-orange-600 bg-orange-500/10',
  },
  {
    label: '媒体素材',
    key: 'media',
    icon: Images,
    href: '/media',
    color: 'text-pink-600 bg-pink-500/10',
  },
] as const;

const QUICK_ACTIONS = [
  { label: '新建文档', href: '/documents/mine/new', icon: PenLine, perm: 'docs.create' },
  { label: '新建案例', href: '/cases/new', icon: Plus, perm: 'content.create' },
  { label: '处理询盘', href: '/contacts', icon: MessageSquare },
  { label: '访客分析', href: '/analytics', icon: BarChart3, perm: 'analytics.view' },
  { label: '上传素材', href: '/media', icon: Images },
] as const;

function ContactStatusBadge({ handled }: { handled: boolean }) {
  return handled ? (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
      已处理
    </Badge>
  ) : (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
      待处理
    </Badge>
  );
}

interface OpsAlert {
  label: string;
  value: number;
  href: string;
  icon: typeof Inbox;
  accent: boolean;
  hint: string;
}

/** 核心指标卡片（询盘漏斗 + 客户）：抽为纯函数，避免抬高 DashboardPage 认知复杂度。 */
function buildOpsAlerts(args: {
  pendingTotal: number;
  unreadTotal: number;
  contactsTotal: number;
  customersTotal: number;
  canCustomers: boolean;
}): OpsAlert[] {
  const { pendingTotal, unreadTotal, contactsTotal, customersTotal, canCustomers } = args;
  const alerts: OpsAlert[] = [
    {
      label: '待处理询盘',
      value: pendingTotal,
      href: '/contacts',
      icon: Inbox,
      accent: pendingTotal > 0,
      hint: pendingTotal > 0 ? '需尽快跟进' : '暂无积压',
    },
    {
      label: '未读询盘',
      value: unreadTotal,
      href: '/contacts',
      icon: Mail,
      accent: unreadTotal > 0,
      hint: '新到未查看',
    },
    {
      label: '询盘总数',
      value: contactsTotal,
      href: '/contacts',
      icon: MessageSquare,
      accent: false,
      hint: '累计客户咨询',
    },
  ];
  if (canCustomers) {
    alerts.push({
      label: '客户总数',
      value: customersTotal,
      href: '/customers',
      icon: Users,
      accent: false,
      hint: '已建档客户',
    });
  }
  return alerts;
}

/** 欢迎区运营一句话：优先提醒待处理，其次未读，都无则报内容库规模。抽出以收敛嵌套三元分支。 */
function HeroSummary({
  pendingTotal,
  unreadTotal,
  publishedCount,
}: {
  pendingTotal: number;
  unreadTotal: number;
  publishedCount: number;
}) {
  if (pendingTotal > 0) {
    return (
      <>
        当前有 <span className="font-medium text-amber-700">{pendingTotal} 条待处理询盘</span>
        {unreadTotal > 0 ? `、${unreadTotal} 条未读` : ''}
        ，建议优先跟进。
      </>
    );
  }
  if (unreadTotal > 0) {
    return <>有 {unreadTotal} 条未读询盘，暂无待处理事项。</>;
  }
  return <>内容库共 {publishedCount} 篇已发布内容，运营状态良好。</>;
}

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

  const [
    cases,
    news,
    blogs,
    tradeShows,
    media,
    contactsTotal,
    pendingTotal,
    unreadTotal,
    contacts,
    auditLogs,
    customersTotal,
  ] = await Promise.all([
    countOf('cases'),
    countOf('news'),
    countOf('blogs'),
    countOf('trade-shows'),
    countOf('media'),
    countOf('contact'),
    countOf('contact', '&isHandled=false'),
    countOf('contact', '&isRead=false'),
    fetchList<ContactItem>('contact', 'limit=6'),
    canAudit
      ? fetchList<AuditLogItem>('audit-logs', 'limit=8&sortBy=createdAt&sortOrder=desc')
      : Promise.resolve([]),
    canCustomers
      ? apiFetch<{ total?: number }>('/customers/summary')
          .then((r) => r?.total ?? 0)
          .catch(() => 0)
      : Promise.resolve(0),
  ]);

  const values: Record<string, number> = {
    cases,
    news,
    blogs,
    'trade-shows': tradeShows,
    media,
  };

  const visibleContentStats = CONTENT_STATS;

  const visibleQuickActions = QUICK_ACTIONS.filter(
    (a) => !('perm' in a && a.perm) || hasPermission(permissions, a.perm),
  );

  const opsAlerts = buildOpsAlerts({
    pendingTotal,
    unreadTotal,
    contactsTotal,
    customersTotal,
    canCustomers,
  });

  return (
    <div>
      <PageHeader title="仪表盘" description="内容运营、询盘与官网访问的一站式概览" />

      <Card className="mb-8 overflow-hidden border-border/80 bg-gradient-to-br from-primary/[0.06] via-background to-background shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{formatDateLong()}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              你好，{displayName}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <HeroSummary
                pendingTotal={pendingTotal}
                unreadTotal={unreadTotal}
                publishedCount={cases + news + blogs + tradeShows}
              />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleQuickActions.slice(0, 3).map((action) => (
              <Button key={action.href} variant="secondary" size="sm" asChild>
                <Link href={action.href}>
                  <action.icon className="mr-1.5 h-3.5 w-3.5" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">内容库</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {visibleContentStats.map((stat) => (
            <Link key={stat.key} href={stat.href} className="group">
              <Card className="border-border/80 transition-colors hover:border-primary/40 hover:bg-accent/30">
                <CardContent className="p-4">
                  <div
                    className={cn(
                      'mb-3 flex h-9 w-9 items-center justify-center rounded-lg',
                      stat.color,
                    )}
                  >
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-semibold tabular-nums tracking-tight">
                    {values[stat.key]}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">核心指标</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {opsAlerts.map((item) => (
            <Link key={item.label} href={item.href} className="group">
              <Card
                className={cn(
                  'h-full border-border/80 transition-colors hover:border-primary/40',
                  item.accent && 'border-amber-200/80 bg-amber-50/40',
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      item.accent
                        ? 'bg-amber-500/15 text-amber-700'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-semibold tabular-nums">{item.value}</div>
                    <div className="text-xs font-medium text-foreground/80">{item.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {canAnalytics ? <DashboardAnalyticsPanel /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">最新询盘</CardTitle>
              <CardDescription>最近收到的客户咨询</CardDescription>
            </div>
            <Link
              href="/contacts"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              查看全部
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
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
                            className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
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
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base">最近操作</CardTitle>
                <CardDescription>后台账号的关键操作记录</CardDescription>
              </div>
              <Link
                href="/audit-logs"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                操作日志
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  暂无操作记录
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between gap-4 px-6 py-3.5"
                    >
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
        ) : (
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">快捷入口</CardTitle>
              <CardDescription>常用管理功能</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {visibleQuickActions.map((action) => (
                <Button key={action.href} variant="outline" className="justify-start" asChild>
                  <Link href={action.href}>
                    <action.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {action.label}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {canAudit ? (
        <Card className="mt-6 border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              快捷入口
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {visibleQuickActions.map((action) => (
              <Button key={action.href} variant="outline" size="sm" asChild>
                <Link href={action.href}>
                  <action.icon className="mr-1.5 h-3.5 w-3.5" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
