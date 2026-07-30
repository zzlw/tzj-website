'use client';

import {
  Avatar,
  AvatarFallback,
  cn,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
} from '@tzj/ui';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AudioLines,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronsUpDown,
  FileUser,
  Filter,
  Fingerprint,
  FolderOpen,
  Globe,
  Headphones,
  Images,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  Scale,
  ScrollText,
  Shield,
  ShieldBan,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { useChatPresence } from '@/features/chat/ChatPresenceProvider';
import { BASE_PATH } from '@/lib/config';
import { useSession } from './session';

// 聊天会话徽章（§4.2.4）：展开态显示未读数，收起态显示红点（红点=未读语义规范）
function ChatNavBadge() {
  const { actionableUnread } = useChatPresence();

  if (actionableUnread <= 0) return null;

  const displayCount = actionableUnread > 99 ? '99+' : actionableUnread;

  return (
    <>
      <span
        className={cn(
          'ml-auto text-xs font-semibold text-white',
          'bg-red-500 hover:bg-red-600',
          'min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center',
          'transition-colors duration-200',
          'group-data-[collapsible=icon]:hidden',
        )}
      >
        {displayCount}
      </span>
      {/* 收起态红点：定位到 relative 的 SidebarMenuItem（li）右上角 */}
      <span className="absolute top-1 right-1 hidden size-2 rounded-full bg-red-500 group-data-[collapsible=icon]:block" />
    </>
  );
}

type NavItemDef = {
  label: string;
  href: string;
  icon: LucideIcon;
  perm?: string;
  anyPerm?: readonly string[];
  /** 当前路径在此前缀下时不激活（避免 /documents 误匹配 /documents/mine） */
  activeExcludePrefix?: string;
  /** 图标附加类名（如灵犀声波动画 lingxi-icon） */
  iconClassName?: string;
  /** 未上线的预告项：渲染 SOON 徽标与畅想 tooltip，不可点击 */
  soon?: { tagline: string; description: string; footer: string };
};

const NAV_GROUPS: Array<{
  label: string;
  items: NavItemDef[];
}> = [
  {
    label: '概览',
    items: [{ label: '仪表盘', href: '/', icon: LayoutDashboard }],
  },
  {
    label: '智能',
    items: [
      {
        label: '灵犀',
        href: '/lingxi',
        icon: AudioLines,
        // 声波动画保留：波形是灵犀的品牌符号，语音在未来演进（方案 §13）
        iconClassName: 'lingxi-icon',
        anyPerm: ['lingxi.use'],
      },
    ],
  },
  {
    label: '内容',
    items: [
      { label: '案例管理', href: '/cases', icon: FolderOpen },
      { label: '新闻管理', href: '/news', icon: Newspaper },
      { label: '博客管理', href: '/blog', icon: BookOpen },
      { label: '展会管理', href: '/trade-shows', icon: CalendarDays },
      { label: '法务页面', href: '/legal-pages', icon: Scale },
    ],
  },
  {
    label: '知识库',
    items: [
      {
        label: '文档中心',
        href: '/documents/mine',
        icon: FileUser,
        perm: 'docs.view',
      },
    ],
  },
  {
    label: '运营',
    items: [
      { label: '媒体库', href: '/media', icon: Images },
      { label: '询盘管理', href: '/contacts', icon: MessageSquare, perm: 'contacts.view' },
      { label: '在线客服', href: '/chat', icon: MessagesSquare, perm: 'chat.view' },
      { label: '访客分析', href: '/analytics', icon: BarChart3, perm: 'analytics.view' },
      { label: '访客中心', href: '/visitors', icon: Fingerprint, perm: 'analytics.view' },
      { label: '转化看板', href: '/growth/conversions', icon: TrendingUp, perm: 'analytics.view' },
      { label: '渠道归因', href: '/growth/channels', icon: Filter, perm: 'analytics.view' },
      { label: '客服绩效', href: '/growth/support', icon: Headphones, perm: 'analytics.view' },
    ],
  },
  {
    label: '客户管理',
    items: [
      { label: '我的客户', href: '/customers/mine', icon: Users, perm: 'customers.view' },
      { label: '公海客户', href: '/customers/public', icon: Globe, perm: 'customers.view' },
    ],
  },
];

const SECURITY_NAV = {
  label: '网站安全',
  items: [
    {
      label: 'IP 封禁',
      href: '/security/ip-block',
      icon: ShieldBan,
      anyPerm: ['security.view', 'security.manage'],
    },
  ],
} as const;

const SYSTEM_NAV = {
  label: '系统',
  items: [
    { label: '账号管理', href: '/users', icon: Users, perm: 'users.manage' },
    { label: '角色与权限', href: '/access', icon: Shield, perm: 'access.view' },
    { label: '操作日志', href: '/audit-logs', icon: ScrollText, perm: 'audit.view' },
    { label: '系统状态', href: '/system/status', icon: Activity, perm: 'system.view' },
    { label: '站点设置', href: '/settings/site', icon: Globe, perm: 'settings.manage' },
    { label: '客服设置', href: '/settings/chat', icon: Headphones, perm: 'settings.manage' },
    {
      label: '集成与凭证',
      href: '/settings/integrations',
      icon: KeyRound,
      perm: 'integrations.view',
    },
  ],
} as const;

function isActive(pathname: string, item: NavItemDef) {
  const { href, activeExcludePrefix } = item;
  if (
    activeExcludePrefix &&
    (pathname === activeExcludePrefix || pathname.startsWith(`${activeExcludePrefix}/`))
  ) {
    return false;
  }
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const sidebarCollapseText =
  'min-w-0 transition-opacity duration-300 ease-in-out motion-reduce:transition-none group-data-[collapsible=icon]:hidden';

function NavItem({ item, pathname }: { item: NavItemDef; pathname: string }) {
  if (item.soon) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton className="cursor-default">
              <item.icon className="lingxi-icon" />
              <span>{item.label}</span>
              <span
                className={cn(
                  'ml-auto rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-px text-xs font-semibold tracking-wider text-primary',
                  sidebarCollapseText,
                )}
              >
                SOON
              </span>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={12}
            className="max-w-[272px] bg-foreground px-4 py-3.5 text-background"
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <item.icon className="lingxi-icon size-3.5 text-primary" />
              {item.label} · {item.soon.tagline}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-background/70">
              {item.soon.description}
            </p>
            <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
              {item.soon.footer}
            </div>
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive(pathname, item)} tooltip={item.label}>
        <Link href={item.href}>
          <item.icon className={item.iconClassName} />
          <span>{item.label}</span>
          {item.href === '/chat' && <ChatNavBadge />}
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
            <div className={cn('grid flex-1 text-left text-sm leading-tight', sidebarCollapseText)}>
              <span className="truncate font-semibold">拓之迹</span>
              <span className="truncate text-xs text-sidebar-foreground/60">内容管理后台</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarNavUser({ username, roleLabel }: { username: string; roleLabel: string }) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [loading, setLoading] = useState(false);
  const initials = username.slice(0, 1).toUpperCase() || 'A';

  async function logout() {
    setLoading(true);
    try {
      await fetch(`${BASE_PATH}/api/auth/logout`, { method: 'POST' });
    } finally {
      router.replace('/login');
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
              className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary/15 text-xs font-semibold text-sidebar-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn('grid flex-1 text-left text-sm leading-tight', sidebarCollapseText)}
              >
                <span className="truncate font-medium">{username}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">{roleLabel}</span>
              </div>
              <ChevronsUpDown className={cn('ml-auto size-4 shrink-0', sidebarCollapseText)} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--anchor-width)] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
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
                  <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
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
              {loading ? '退出中…' : '退出登录'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  const { permissions } = useSession();

  // 超级管理员拥有所有权限（通配符）
  const hasAllPermissions = permissions.includes('*');

  const filterItems = (items: NavItemDef[]) =>
    items.filter((item) => {
      // 如果有通配符权限，显示所有菜单
      if (hasAllPermissions) return true;

      if (item.anyPerm?.some((p) => permissions.includes(p))) return true;
      if (item.perm && permissions.includes(item.perm)) return true;
      return !item.perm && !item.anyPerm;
    });

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: filterItems(group.items),
  })).filter((group) => group.items.length > 0);

  const securityItems = filterItems([...SECURITY_NAV.items]);
  const groupsWithSecurity =
    securityItems.length > 0
      ? [...navGroups, { label: SECURITY_NAV.label, items: securityItems }]
      : navGroups;

  const systemItems = filterItems([...SYSTEM_NAV.items]);
  const groups =
    systemItems.length > 0
      ? [...groupsWithSecurity, { label: SYSTEM_NAV.label, items: systemItems }]
      : groupsWithSecurity;

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

export function AppSidebar({ username, roleLabel }: { username: string; roleLabel: string }) {
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
