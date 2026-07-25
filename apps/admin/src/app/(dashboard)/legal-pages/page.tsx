'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@tzj/ui';
import { ExternalLink, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Can } from '@/components/Can';
import { formatDate } from '@/features/constants';
import { ApiError, api } from '@/lib/apiClient';
import { WEB_BASE } from '@/lib/config';
import { notifyError, notifySuccess } from '@/lib/notify';

const MarkdownEditor = dynamic(
  () => import('@/components/crud/MarkdownEditor').then((mod) => ({ default: mod.MarkdownEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-md border border-border bg-muted/20 text-sm text-muted-foreground">
        编辑器加载中…
      </div>
    ),
  },
);

/** Page 实体（API pages 模块）；status 与 Prisma 一致为小写字符串 */
type LegalPageRow = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  status: string;
  updatedAt: string;
};

const LOCALES = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'en', label: 'English' },
] as const;

const LEGAL_PAGES = [
  { key: 'privacy', label: '隐私政策', webPath: '/privacy' },
  { key: 'terms', label: '使用条款', webPath: '/terms' },
] as const;

/** slug 约定：`{key}-{locale}`，与 C 端 getLegalPage 的读取约定一致 */
function slugOf(key: string, locale: string): string {
  return `${key}-${locale}`;
}

export default function LegalPagesPage() {
  const qc = useQueryClient();
  const pagesQ = useQuery({
    queryKey: ['pages'],
    queryFn: () => api.query<LegalPageRow[]>('pages'),
  });

  // slug → 正文草稿；仅在首次拿到数据时填充，避免刷新覆盖正在编辑的内容
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!pagesQ.data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of LEGAL_PAGES) {
        for (const l of LOCALES) {
          const slug = slugOf(p.key, l.id);
          if (next[slug] === undefined) {
            next[slug] = pagesQ.data.find((row) => row.slug === slug)?.content ?? '';
          }
        }
      }
      return next;
    });
  }, [pagesQ.data]);

  const saveMut = useMutation({
    mutationFn: async ({ slug, title }: { slug: string; title: string }) => {
      const content = drafts[slug] ?? '';
      const existing = (pagesQ.data ?? []).find((row) => row.slug === slug);
      if (existing) {
        return api.put<LegalPageRow>(`pages/${existing.id}`, { title, content });
      }
      return api.post<LegalPageRow>('pages', { title, slug, content, status: 'published' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages'] });
      notifySuccess('已保存并发布', 'C 端约 1 分钟内生效');
    },
    onError: (e) => notifyError(e, '保存失败'),
  });

  if (pagesQ.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pagesQ.isError) {
    return (
      <p className="text-sm text-destructive">
        {pagesQ.error instanceof ApiError ? pagesQ.error.message : '加载失败'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="法务页面"
        description="维护官网「隐私政策」「使用条款」正文（Markdown）。留空未保存的语言在 C 端自动回退到内置文案。"
      />

      {LEGAL_PAGES.map((page) => (
        <Card key={page.key}>
          <CardHeader>
            <CardTitle>{page.label}</CardTitle>
            <CardDescription>按语言分别维护；保存后即发布到官网对应语言版本</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={LOCALES[0].id}>
              <TabsList>
                {LOCALES.map((l) => (
                  <TabsTrigger key={l.id} value={l.id}>
                    {l.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {LOCALES.map((l) => {
                const slug = slugOf(page.key, l.id);
                const existing = (pagesQ.data ?? []).find((row) => row.slug === slug);
                const pending = saveMut.isPending && saveMut.variables?.slug === slug;
                return (
                  <TabsContent key={l.id} value={l.id} className="mt-4 space-y-3">
                    <MarkdownEditor
                      value={drafts[slug] ?? ''}
                      onChange={(md) => setDrafts((prev) => ({ ...prev, [slug]: md }))}
                      folder="pages"
                      defaultMode="ir"
                      minHeight={420}
                      placeholder={`请输入${page.label}（${l.label}）正文…`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {existing
                            ? `最近保存：${formatDate(existing.updatedAt)}`
                            : '尚未维护，C 端展示内置文案'}
                        </span>
                        <a
                          href={`${WEB_BASE}/${l.id}${page.webPath}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          查看 C 端页面
                        </a>
                      </div>
                      <Can anyPerm={['content.edit', 'content.create']}>
                        <Button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            saveMut.mutate({ slug, title: `${page.label}（${l.label}）` })
                          }
                        >
                          {pending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              保存中…
                            </>
                          ) : (
                            '保存并发布'
                          )}
                        </Button>
                      </Can>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
