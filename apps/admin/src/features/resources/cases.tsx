import { z } from 'zod';
import type { ResourceConfig } from '@/components/crud/config';
import { contentAuditColumns } from '@/components/LastOperatorCell';
import {
  CASE_TYPE_OPTIONS,
  formatDate,
  labelOf,
  STATUS_OPTIONS,
  StatusBadge,
  toDateInput,
} from '@/features/constants';
import type { CaseItem } from '@/features/types';

const specSchema = z.object({
  label: z.coerce.string(),
  value: z.coerce.string(),
});

const schema = z.object({
  title: z.string().min(1, '请输入标题'),
  slug: z.string().min(1, '请填写标题'),
  caseType: z.string().min(1, '请选择案例类型'),
  summary: z.string().optional(),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  detailCoverImage: z.string().optional(),
  location: z.string().optional(),
  client: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  specs: z.array(specSchema).optional(),
  completionDate: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDesc: z.string().optional(),
  isFeatured: z.boolean().optional(),
});

export const casesConfig: ResourceConfig<CaseItem> = {
  resource: 'cases',
  basePath: '/cases',
  title: '工程案例',
  singular: '案例',
  searchable: true,
  searchPlaceholder: '搜索标题、摘要、详情、地点、客户…',
  filters: [
    { key: 'type', label: '全部类型', options: CASE_TYPE_OPTIONS },
    { key: 'status', label: '全部状态', options: STATUS_OPTIONS },
  ],
  columns: [
    // 主标识列固定到左侧，宽表横向滚动时始终可辨认当前行（滚动阴影按需出现）。
    { key: 'title', header: '标题', sortable: true, pinLeft: true },
    {
      key: 'caseType',
      header: '类型',
      sortable: true,
      cell: (r) => labelOf(CASE_TYPE_OPTIONS, r.caseType),
    },
    { key: 'location', header: '地点', sortable: true, cell: (r) => r.location ?? '—' },
    {
      key: 'status',
      header: '状态',
      sortable: true,
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'completionDate',
      header: '发布日期',
      sortable: true,
      cell: (r) => formatDate(r.completionDate),
    },
    ...contentAuditColumns<CaseItem>(),
  ],
  fields: [
    { name: 'title', label: '标题', type: 'text', required: true, colSpan: 2 },
    {
      name: 'caseType',
      label: '案例类型',
      type: 'select',
      required: true,
      options: CASE_TYPE_OPTIONS,
    },
    { name: 'location', label: '项目地点', type: 'text' },
    { name: 'client', label: '客户/单位', type: 'text' },
    {
      name: 'completionDate',
      label: '发布日期',
      type: 'date',
      help: '留空则按创建时间排序',
    },
    { name: 'summary', label: '摘要', type: 'textarea', colSpan: 2 },
    {
      name: 'highlights',
      label: '项目亮点',
      type: 'string-list',
      colSpan: 2,
      placeholder: '如：全镀锌钢结构，耐久抗腐蚀',
    },
    { name: 'specs', label: '项目参数', type: 'key-value-list', colSpan: 2 },
    { name: 'description', label: '详情', type: 'markdown', colSpan: 2, folder: 'cases' },
    {
      name: 'coverImage',
      label: '封面图',
      type: 'image',
      colSpan: 2,
      folder: 'cases',
      help: '建议比例 16:9',
    },
    {
      name: 'detailCoverImage',
      label: '详情页封面图',
      type: 'image',
      colSpan: 2,
      folder: 'cases',
      help: '详情页顶部宽幅大图（建议比例约 3:1）；留空则默认使用封面图',
    },
    { name: 'seoTitle', label: 'SEO 标题', type: 'text', colSpan: 2 },
    { name: 'seoDesc', label: 'SEO 描述', type: 'textarea', colSpan: 2 },
    {
      name: 'isFeatured',
      label: '精选',
      type: 'switch',
      placeholder: '设为精选，展示时置顶',
    },
  ],
  schema,
  publishable: true,
  previewPath: (r) => `/cases/${r.slug}`,
  defaultSort: { column: 'completionDate', order: 'desc' },
  // 含审计列（创建/更新时间、创建人）后列多易溢出，固定操作列到右侧保持可达。
  pinActions: true,
  defaults: {
    title: '',
    slug: '',
    caseType: '',
    location: '',
    client: '',
    completionDate: '',
    summary: '',
    highlights: [],
    specs: [],
    description: '',
    coverImage: '',
    detailCoverImage: '',
    seoTitle: '',
    seoDesc: '',
    isFeatured: false,
  },
  toForm: (r) => ({
    title: r.title,
    slug: r.slug,
    caseType: r.caseType,
    location: r.location ?? '',
    client: r.client ?? '',
    completionDate: toDateInput(r.completionDate),
    summary: r.summary ?? '',
    highlights: Array.isArray(r.highlights) ? r.highlights.map((h) => String(h ?? '')) : [],
    specs: Array.isArray(r.specs)
      ? r.specs.map((s) => ({
          label: String(s?.label ?? ''),
          value: String(s?.value ?? ''),
        }))
      : [],
    description: r.description ?? '',
    coverImage: r.coverImage ?? '',
    detailCoverImage: r.detailCoverImage ?? '',
    seoTitle: r.seoTitle ?? '',
    seoDesc: r.seoDesc ?? '',
    isFeatured: r.isFeatured,
  }),
};
