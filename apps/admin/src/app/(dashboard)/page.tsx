import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Inbox,
  BookOpen,
  CalendarDays,
  MessageSquare,
  Newspaper,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@tzj/ui";
import { apiFetchFull } from "@/lib/auth";
import type { ContactItem } from "@/features/types";

export const dynamic = "force-dynamic";

async function countOf(resource: string, params = ""): Promise<number> {
  try {
    const { pagination } = await apiFetchFull(
      `/${resource}?limit=1${params}`,
    );
    return pagination?.total ?? 0;
  } catch {
    return 0;
  }
}

async function recentContacts(): Promise<ContactItem[]> {
  try {
    const { data } = await apiFetchFull<ContactItem[]>("/contact?limit=5");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function formatTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STAT_CONFIG = [
  { label: "工程案例", key: "cases", icon: FolderOpen, href: "/cases" },
  { label: "新闻", key: "news", icon: Newspaper, href: "/news" },
  { label: "博客", key: "blogs", icon: BookOpen, href: "/blog" },
  { label: "展会", key: "trade-shows", icon: CalendarDays, href: "/trade-shows" },
  { label: "询盘总数", key: "contacts", icon: MessageSquare, href: "/contacts" },
  { label: "待处理询盘", key: "pending", icon: Inbox, href: "/contacts" },
] as const;

export default async function DashboardPage() {
  const [cases, news, blogs, tradeShows, contactsTotal, pendingTotal, contacts] =
    await Promise.all([
      countOf("cases"),
      countOf("news"),
      countOf("blogs"),
      countOf("trade-shows"),
      countOf("contact"),
      countOf("contact", "&isHandled=false"),
      recentContacts(),
    ]);

  const values: Record<string, number> = {
    cases,
    news,
    blogs,
    "trade-shows": tradeShows,
    contacts: contactsTotal,
    pending: pendingTotal,
  };

  return (
    <div>
      <PageHeader
        title="仪表盘"
        description="内容运营数据概览与最新询盘动态"
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {STAT_CONFIG.map((stat) => (
          <Link key={stat.key} href={stat.href} className="group">
            <Card className="border-border/80 transition-colors hover:border-primary/40 hover:bg-accent/30">
              <CardContent className="p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <stat.icon className="h-4 w-4" />
                </div>
                <div className="text-2xl font-semibold tracking-tight text-foreground">
                  {values[stat.key]}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">最新询盘</CardTitle>
            <CardDescription>最近 5 条客户咨询记录</CardDescription>
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
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              暂无询盘
            </div>
          ) : (
            <div className="divide-y divide-border">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!c.isRead && (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
                        >
                          新
                        </Badge>
                      )}
                      <span className="truncate text-sm font-medium text-foreground">
                        {c.name}
                        {c.company ? ` · ${c.company}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {c.message}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTime(c.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
