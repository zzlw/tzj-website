"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderOpen,
  Newspaper,
  BookOpen,
  CalendarDays,
  MessageSquare,
  Images,
  BarChart3,
  LogOut,
  ChevronsUpDown,
  User,
  Users,
  Shield,
  ScrollText,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
  cn,
} from "@tzj/ui";
import { BASE_PATH } from "@/lib/config";
import { useSession } from "./session";

type NavItemDef = {
  label: string;
  href: string;
  icon: LucideIcon;
  perm?: string;
};

const NAV_GROUPS: Array<{
  label: string;
  items: NavItemDef[];
}> = [
  {
    label: "概览",
    items: [{ label: "仪表盘", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "内容",
    items: [
      { label: "案例管理", href: "/cases", icon: FolderOpen },
      { label: "新闻管理", href: "/news", icon: Newspaper },
      { label: "博客管理", href: "/blog", icon: BookOpen },
      { label: "展会管理", href: "/trade-shows", icon: CalendarDays },
    ],
  },
  {
    label: "运营",
    items: [
      { label: "媒体库", href: "/media", icon: Images },
      { label: "询盘管理", href: "/contacts", icon: MessageSquare },
      { label: "访客分析", href: "/analytics", icon: BarChart3, perm: "analytics.view" },
    ],
  },
];

const SYSTEM_NAV = {
  label: "系统",
  items: [
    { label: "账号管理", href: "/users", icon: Users, perm: "users.manage" },
    { label: "角色与权限", href: "/access", icon: Shield, perm: "access.view" },
    { label: "操作日志", href: "/audit-logs", icon: ScrollText, perm: "audit.view" },
  ],
} as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const sidebarCollapseText =
  "min-w-0 transition-opacity duration-300 ease-in-out motion-reduce:transition-none group-data-[collapsible=icon]:hidden";

function NavItem({
  item,
  pathname,
}: {
  item: NavItemDef;
  pathname: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive(pathname, item.href)}
        tooltip={item.label}
      >
        <Link href={item.href}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarBrand() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <Link href="/">
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              TZJ
            </div>
            <div
              className={cn(
                "grid flex-1 text-left text-sm leading-tight",
                sidebarCollapseText,
              )}
            >
              <span className="truncate font-semibold">拓之迹</span>
              <span className="truncate text-xs text-muted-foreground">
                内容管理后台
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarNavUser({
  username,
  roleLabel,
}: {
  username: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [loading, setLoading] = useState(false);
  const initials = username.slice(0, 1).toUpperCase() || "A";

  async function logout() {
    setLoading(true);
    try {
      await fetch(`${BASE_PATH}/api/auth/logout`, { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary/15 text-xs font-semibold text-sidebar-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "grid flex-1 text-left text-sm leading-tight",
                  sidebarCollapseText,
                )}
              >
                <span className="truncate font-medium">{username}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleLabel}
                </span>
              </div>
              <ChevronsUpDown
                className={cn("ml-auto size-4 shrink-0", sidebarCollapseText)}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-sidebar-primary/15 text-xs font-semibold text-sidebar-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{username}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/settings/account">
                <User className="h-4 w-4" />
                账户设置
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              disabled={loading}
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              {loading ? "退出中…" : "退出登录"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  const { permissions } = useSession();

  const filterItems = (items: NavItemDef[]) =>
    items.filter((item) => !item.perm || permissions.includes(item.perm));

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: filterItems(group.items),
  })).filter((group) => group.items.length > 0);

  const systemItems = filterItems([...SYSTEM_NAV.items]);
  const groups =
    systemItems.length > 0
      ? [...navGroups, { label: SYSTEM_NAV.label, items: systemItems }]
      : navGroups;

  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 ? <SidebarSeparator /> : null}
          <SidebarGroup>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </Fragment>
      ))}
    </>
  );
}

export function AppSidebar({
  username,
  roleLabel,
}: {
  username: string;
  roleLabel: string;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarNavUser username={username} roleLabel={roleLabel} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
