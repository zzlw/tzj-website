import { z } from 'zod';
import type { ResourceConfig } from '@/components/crud/config';
import { contentAuditColumns } from '@/components/LastOperatorCell';
import {
  BLOG_CATEGORY_OPTIONS,
  formatDate,
  labelOf,
  STATUS_OPTIONS,
  StatusBadge,
  toDateInput,
} from '@/features/constants';
import type { BlogItem } from '@/features/types';

const schema = z.object({
  title: z.string().min(1, '请输入标题'),
  slug: z.string().min(1, '请填写标题'),
  category: z.string().min(1, '请选择分类'),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  coverImage: z.string().optional(),
  detailCoverImage: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDesc: z.string().optional(),
  isFeatured: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

export const blogConfig: ResourceConfig<BlogItem> = {
  resource: 'blogs',
  basePath: '/blog',
  title: '博客',
  singular: '博客',
  searchable: true,
  searchPlaceholder: '搜索标题、摘要、正文、作者…',
  filters: [
    { key: 'category', label: '全部分类', options: BLOG_CATEGORY_OPTIONS },
    { key: 'status', label: '全部状态', options: STATUS_OPTIONS },
  ],
  columns: [
    // 主标识列固定到左侧，宽表横向滚动时始终可辨认当前行（滚动阴影按需出现）。
    { key: 'title', header: '标题', sortable: true, pinLeft: true },
    {
      key: 'category',
      header: '分类',
      sortable: true,
      cell: (r) => labelOf(BLOG_CATEGORY_OPTIONS, r.category),
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
    ...contentAuditColumns<BlogItem>(),
  ],
  fields: [
    { name: 'title', label: '标题', type: 'text', required: true, colSpan: 2 },
    {
      name: 'category',
      label: '分类',
      type: 'select',
      required: true,
      options: BLOG_CATEGORY_OPTIONS,
    },
    {
      name: 'publishedAt',
      label: '发布时间',
      type: 'date',
      help: '留空则发布时自动取当前时间',
    },
    {
      name: 'excerpt',
      label: '摘要',
      type: 'textarea',
      colSpan: 2,
      help: '留空时从正文截取',
    },
    {
      name: 'content',
      label: '正文',
      type: 'markdown',
      colSpan: 2,
      folder: 'blog',
      help: '保存后自动估算阅读时长',
    },
    {
      name: 'coverImage',
      label: '封面图',
      type: 'image',
      colSpan: 2,
      folder: 'blog',
      help: '建议比例 16:9',
    },
    {
      name: 'detailCoverImage',
      label: '详情页封面图',
      type: 'image',
      colSpan: 2,
      folder: 'blog',
      help: '详情页顶部宽幅大图（建议比例约 3:1）；留空则默认使用封面图',
    },
    { name: 'seoTitle', label: 'SEO 标题', type: 'text', colSpan: 2 },
    { name: 'seoDesc', label: 'SEO 描述', type: 'textarea', colSpan: 2 },
    { name: 'isFeatured', label: '精选', type: 'switch', placeholder: '设为精选' },
  ],
  schema,
  publishable: true,
  previewPath: (r) => `/resources/blog/${r.slug}`,
  defaultSort: { column: 'publishedAt', order: 'desc' },
  // 含审计列（创建/更新时间、创建人）后列多易溢出，固定操作列到右侧保持可达。
  pinActions: true,
  defaults: {
    title: '',
    slug: '',
    category: '',
    excerpt: '',
    content: '',
    coverImage: '',
    detailCoverImage: '',
    seoTitle: '',
    seoDesc: '',
    isFeatured: false,
    publishedAt: '',
  },
  toForm: (r) => ({
    title: r.title,
    slug: r.slug,
    category: r.category,
    publishedAt: toDateInput(r.publishedAt),
    excerpt: r.excerpt ?? '',
    content: r.content ?? '',
    coverImage: r.coverImage ?? '',
    detailCoverImage: r.detailCoverImage ?? '',
    seoTitle: r.seoTitle ?? '',
    seoDesc: r.seoDesc ?? '',
    isFeatured: r.isFeatured,
  }),
};
