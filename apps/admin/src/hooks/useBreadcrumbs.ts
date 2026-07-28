'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

export type BreadcrumbEntry = {
  label: string;
  /** 可点击跳转的路径；无对应页面的中间层级（如 /settings）不带链接 */
  href?: string;
};

/** 静态路径 → 中文标题（与侧边栏导航命名保持一致） */
const PATH_LABELS: Record<string, string> = {
  '/': '仪表盘',
  '/lingxi': '灵犀',
  '/cases': '案例管理',
  '/news': '新闻管理',
  '/blog': '博客管理',
  '/trade-shows': '展会管理',
  '/legal-pages': '法务页面',
  '/documents': '知识库',
  '/documents/mine': '文档中心',
  '/media': '媒体库',
  '/contacts': '询盘管理',
  '/chat': '在线客服',
  '/analytics': '访客分析',
  '/visitors': '访客中心',
  '/customers': '客户管理',
  '/customers/mine': '我的客户',
  '/customers/public': '公海客户',
  '/customers/trash': '回收站',
  '/security': '网站安全',
  '/security/ip-block': 'IP 封禁',
  '/users': '账号管理',
  '/access': '角色与权限',
  '/audit-logs': '操作日志',
  '/system': '系统',
  '/system/status': '系统状态',
  '/settings': '设置',
  '/settings/site': '站点设置',
  '/settings/chat': '客服设置',
  '/settings/integrations': '集成与凭证',
  '/settings/account': '账户设置',
};

/** 动态尾段标题（new/edit 等操作段） */
const ACTION_LABELS: Record<string, string> = {
  new: '新建',
  edit: '编辑',
};

/** 存在 page.tsx、可安全跳转的路径（中间层级仅这些渲染为链接） */
const LINKABLE_PATHS = new Set([
  '/',
  '/cases',
  '/news',
  '/blog',
  '/trade-shows',
  '/legal-pages',
  '/documents/mine',
  '/media',
  '/contacts',
  '/chat',
  '/analytics',
  '/visitors',
  '/customers',
  '/customers/mine',
  '/customers/public',
  '/customers/trash',
  '/security',
  '/security/ip-block',
  '/users',
  '/access',
  '/audit-logs',
  '/system/status',
  '/settings/site',
  '/settings/chat',
  '/settings/integrations',
  '/settings/account',
]);

/**
 * 从当前路径生成面包屑：静态段查 PATH_LABELS，new/edit 查 ACTION_LABELS，
 * 其余视为动态 ID —— 处于末段时显示「详情」，处于中间（如 /blog/[id]/edit）则跳过，
 * 避免出现「博客管理 / 详情 / 编辑」的冗余层级。
 */
export function useBreadcrumbs(): BreadcrumbEntry[] {
  const pathname = usePathname();

  return useMemo(() => {
    if (pathname === '/') {
      return [{ label: '仪表盘' }];
    }

    const segments = pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbEntry[] = [];

    segments.forEach((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      const isLast = index === segments.length - 1;

      let label = PATH_LABELS[path] ?? ACTION_LABELS[segment];
      if (!label) {
        // 动态 ID 段：仅末段渲染「详情」，中间段跳过
        if (!isLast) return;
        label = '详情';
      }

      crumbs.push({
        label,
        href: !isLast && LINKABLE_PATHS.has(path) ? path : undefined,
      });
    });

    return crumbs;
  }, [pathname]);
}
