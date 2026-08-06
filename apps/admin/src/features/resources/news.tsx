import { z } from 'zod';
import type { ResourceConfig } from '@/components/crud/config';
import { contentAuditColumns } from '@/components/LastOperatorCell';
import {
  formatDate,
  labelOf,
  NEWS_CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  StatusBadge,
  toDateInput,
} from '@/features/constants';
import type { NewsItem } from '@/features/types';

const schema = z.object({
  title: z.string().min(1, '请输入标题'),
  slug: z.string().min(1, '请填写标题'),
  category: z.string().min(1, '请选择分类'),
  summary: z.string().optional(),
  content: z.string().optional(),
  coverImage: z.string().optional(),
  detailCoverImage: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDesc: z.string().optional(),
  isTop: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

export const newsConfig: ResourceConfig<NewsItem> = {
  resource: 'news',
  basePath: '/news',
  title: '新闻动态',
  singular: '新闻',
  searchable: true,
  searchPlaceholder: '搜索标题、摘要、正文、作者…',
  filters: [
    { key: 'category', label: '全部分类', options: NEWS_CATEGORY_OPTIONS },
    { key: 'status', label: '全部状态', options: STATUS_OPTIONS },
  ],
  columns: [
    // 主标识列固定到左侧，宽表横向滚动时始终可辨认当前行（滚动阴影按需出现）。
    { key: 'title', header: '标题', sortable: true, pinLeft: true },
    {
      key: 'category',
      header: '分类',
      sortable: true,
      cell: (r) => labelOf(NEWS_CATEGORY_OPTIONS, r.category),
    },
    {
      key: 'status',
      header: '状态',
      sortable: true,
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'publishedAt',
      header: '发布时间',
      sortable: true,
      cell: (r) => formatDate(r.publishedAt),
    },
    ...contentAuditColumns<NewsItem>(),
  ],
  fields: [
    { name: 'title', label: '标题', type: 'text', required: true, colSpan: 2 },
    {
      name: 'category',
      label: '分类',
      type: 'select',
      required: true,
      options: NEWS_CATEGORY_OPTIONS,
    },
    {
      name: 'publishedAt',
      label: '发布时间',
      type: 'date',
      help: '留空则发布时自动取当前时间',
    },
    { name: 'summary', label: '摘要', type: 'textarea', colSpan: 2 },
    { name: 'content', label: '正文', type: 'markdown', colSpan: 2, folder: 'news' },
    {
      name: 'coverImage',
      label: '封面图',
      type: 'image',
      colSpan: 2,
      folder: 'news',
      help: '建议比例 16:9',
    },
    {
      name: 'detailCoverImage',
      label: '详情页封面图',
      type: 'image',
      colSpan: 2,
      folder: 'news',
      help: '详情页顶部宽幅大图（建议比例约 3:1）；留空则默认使用封面图',
    },
    { name: 'seoTitle', label: 'SEO 标题', type: 'text', colSpan: 2 },
    { name: 'seoDesc', label: 'SEO 描述', type: 'textarea', colSpan: 2 },
    { name: 'isTop', label: '置顶', type: 'switch', placeholder: '设为置顶' },
  ],
  schema,
  publishable: true,
  previewPath: (r) => `/resources/news/${r.slug}`,
  defaultSort: { column: 'publishedAt', order: 'desc' },
  // 含审计列（创建/更新时间、创建人）后列多易溢出，固定操作列到右侧保持可达。
  pinActions: true,
  defaults: {
    title: '',
    slug: '',
    category: '',
    summary: '',
    content: '',
    coverImage: '',
    detailCoverImage: '',
    seoTitle: '',
    seoDesc: '',
    isTop: false,
    publishedAt: '',
  },
  toForm: (r) => ({
    title: r.title,
    slug: r.slug,
    category: r.category,
    publishedAt: toDateInput(r.publishedAt),
    summary: r.summary ?? '',
    content: r.content ?? '',
    coverImage: r.coverImage ?? '',
    detailCoverImage: r.detailCoverImage ?? '',
    seoTitle: r.seoTitle ?? '',
    seoDesc: r.seoDesc ?? '',
    isTop: r.isTop,
  }),
};
