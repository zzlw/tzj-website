import { z } from 'zod';
import type { ResourceConfig } from '@/components/crud/config';
import { contentAuditColumns } from '@/components/LastOperatorCell';
import {
  CUSTOMER_LEVEL_OPTIONS,
  CUSTOMER_SOURCE_OPTIONS,
  CUSTOMER_STAGE_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  formatDate,
  LevelBadge,
  labelOf,
  StageBadge,
} from '@/features/constants';
import type { CustomerItem } from '@/features/types';

const schema = z.object({
  name: z.string().min(1, '请输入联系人姓名'),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  customerType: z.string().optional(),
  source: z.string().optional(),
  level: z.string().optional(),
  stage: z.string().optional(),
  amount: z.number().int().min(0).optional(),
  region: z.string().optional(),
  address: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lastContactAt: z.string().optional(),
  nextFollowAt: z.string().optional(),
  notes: z.string().optional(),
});

export const customersConfig: ResourceConfig<CustomerItem> = {
  resource: 'customers',
  basePath: '/customers',
  title: '客户管理',
  singular: '客户',
  searchable: true,
  searchPlaceholder: '搜索姓名、单位、电话、邮箱、地区、访客ID…',
  filters: [
    { key: 'customerType', label: '全部类型', options: CUSTOMER_TYPE_OPTIONS },
    { key: 'stage', label: '全部阶段', options: CUSTOMER_STAGE_OPTIONS },
    { key: 'level', label: '全部等级', options: CUSTOMER_LEVEL_OPTIONS },
    { key: 'source', label: '全部来源', options: CUSTOMER_SOURCE_OPTIONS },
  ],
  columns: [
    {
      key: 'name',
      header: '联系人',
      sortable: true,
      className: 'whitespace-nowrap',
      // 姓名主行 + 职务副行，避免为低频字段单开一列
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.name}</div>
          {r.title ? <div className="text-xs text-muted-foreground">{r.title}</div> : null}
        </div>
      ),
    },
    {
      key: 'company',
      header: '客户单位',
      sortable: true,
      cell: (r) => r.company ?? '—',
    },
    {
      key: 'contact',
      header: '联系方式',
      className: 'whitespace-nowrap',
      cell: (r) =>
        r.phone || r.email ? (
          <div className="space-y-0.5 text-xs">
            {r.phone ? <div>{r.phone}</div> : null}
            {r.email ? <div className="text-muted-foreground">{r.email}</div> : null}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'customerType',
      header: '类型',
      sortable: true,
      cell: (r) => labelOf(CUSTOMER_TYPE_OPTIONS, r.customerType),
    },
    {
      key: 'source',
      header: '来源',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (r) => (r.source ? labelOf(CUSTOMER_SOURCE_OPTIONS, r.source) : '—'),
    },
    {
      key: 'level',
      header: '等级',
      sortable: true,
      cell: (r) => <LevelBadge level={r.level} />,
    },
    {
      key: 'stage',
      header: '阶段',
      sortable: true,
      cell: (r) => <StageBadge stage={r.stage} />,
    },
    {
      key: 'amount',
      header: '预估金额',
      sortable: true,
      cell: (r) => (r.amount != null ? `¥${r.amount.toLocaleString('zh-CN')}` : '—'),
    },
    {
      key: 'region',
      header: '地区',
      sortable: true,
      className: 'whitespace-nowrap',
      // 详细地址不单开列，悬停地区即可查看
      cell: (r) => <span title={r.address ?? undefined}>{r.region ?? '—'}</span>,
    },
    {
      key: 'tags',
      header: '标签',
      className: 'whitespace-nowrap',
      cell: (r) => {
        const tags = Array.isArray(r.tags) ? r.tags.filter(Boolean) : [];
        if (tags.length === 0) return '—';
        const shown = tags.slice(0, 2);
        return (
          <span className="inline-flex items-center gap-1" title={tags.join('、')}>
            {shown.map((t) => (
              <span
                key={t}
                className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {tags.length > shown.length ? (
              <span className="text-xs text-muted-foreground">+{tags.length - shown.length}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'owner',
      header: '归属',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (r) =>
        r.owner ? (
          <span className="font-medium">{r.owner.nickname || r.owner.username}</span>
        ) : (
          <span className="text-muted-foreground">公海</span>
        ),
    },
    {
      key: 'lastContactAt',
      header: '最近联系',
      sortable: true,
      cell: (r) => formatDate(r.lastContactAt),
    },
    {
      key: 'nextFollowAt',
      header: '下次跟进',
      sortable: true,
      cell: (r) => formatDate(r.nextFollowAt),
    },
    {
      key: 'notes',
      header: '备注',
      className: 'max-w-[200px]',
      cell: (r) =>
        r.notes ? (
          <span className="block truncate text-xs text-muted-foreground" title={r.notes}>
            {r.notes}
          </span>
        ) : (
          '—'
        ),
    },
    ...contentAuditColumns<CustomerItem>(),
  ],
  fields: [
    { name: 'name', label: '联系人姓名', type: 'text', required: true, colSpan: 2 },
    { name: 'company', label: '客户单位', type: 'text' },
    { name: 'title', label: '联系人职务', type: 'text' },
    { name: 'phone', label: '联系电话', type: 'text' },
    { name: 'email', label: '邮箱', type: 'text' },
    {
      name: 'customerType',
      label: '客户类型',
      type: 'select',
      options: CUSTOMER_TYPE_OPTIONS,
    },
    { name: 'source', label: '客户来源', type: 'select', options: CUSTOMER_SOURCE_OPTIONS },
    { name: 'level', label: '客户等级', type: 'select', options: CUSTOMER_LEVEL_OPTIONS },
    { name: 'stage', label: '跟进阶段', type: 'select', options: CUSTOMER_STAGE_OPTIONS },
    {
      name: 'amount',
      label: '预估金额（元）',
      type: 'number',
      placeholder: '如 500000',
    },
    { name: 'region', label: '地区', type: 'text' },
    { name: 'address', label: '详细地址', type: 'textarea', colSpan: 2 },
    { name: 'tags', label: '标签', type: 'tags', colSpan: 2, placeholder: '每行一条' },
    { name: 'lastContactAt', label: '最近联系', type: 'date' },
    { name: 'nextFollowAt', label: '下次跟进', type: 'date' },
    { name: 'notes', label: '备注 / 跟进摘要', type: 'textarea', colSpan: 2 },
  ],
  schema,
  autoSlug: false,
  defaultSort: { column: 'updatedAt', order: 'desc' },
  // 列多且追加了访客 ID / IP 等列，横向易溢出，固定操作列到右侧保持可见。
  pinActions: true,
  defaults: {
    name: '',
    company: '',
    title: '',
    phone: '',
    email: '',
    customerType: '',
    source: '',
    level: 'C',
    stage: 'new',
    amount: undefined,
    region: '',
    address: '',
    tags: [],
    lastContactAt: '',
    nextFollowAt: '',
    notes: '',
  },
  toForm: (r) => ({
    name: r.name,
    company: r.company ?? '',
    title: r.title ?? '',
    phone: r.phone ?? '',
    email: r.email ?? '',
    customerType: r.customerType,
    source: r.source ?? '',
    level: r.level,
    stage: r.stage,
    amount: r.amount ?? undefined,
    region: r.region ?? '',
    address: r.address ?? '',
    tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t ?? '')) : [],
    lastContactAt: r.lastContactAt ?? '',
    nextFollowAt: r.nextFollowAt ?? '',
    notes: r.notes ?? '',
  }),
};
