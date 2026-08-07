import { z } from 'zod';
import type { ResourceConfig } from '@/components/crud/config';
import { contentAuditColumns } from '@/components/LastOperatorCell';
import {
  formatDateRange,
  labelOf,
  STATUS_OPTIONS,
  StatusBadge,
  TRADE_SHOW_TYPE_OPTIONS,
  toDateTimeLocal,
} from '@/features/constants';
import type { TradeShowItem } from '@/features/types';

const schema = z.object({
  title: z.string().min(1, '请输入名称'),
  slug: z.string().min(1, '请填写名称'),
  eventType: z.string().min(1, '请选择类型'),
  summary: z.string().optional(),
  content: z.string().optional(),
  location: z.string().optional(),
  eventDateLabel: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  boothNumber: z.string().optional(),
  externalUrl: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDesc: z.string().optional(),
  coverImage: z.string().optional(),
  detailCoverImage: z.string().optional(),
  popupImage: z.string().optional(),
  popupContent: z.string().optional(),
  isFeatured: z.boolean().optional(),
  // 营销弹窗：zod 端一律宽松（resolver 会校验被 visibleWhen 隐藏的字段，
  // 严格校验全部放服务端 DTO，避免报错落在已隐藏字段上无法定位）
  isMarketing: z.boolean().optional(),
  triggerMode: z.string().optional(),
  // 清空的 number 输入是 NaN（valueAsNumber），0 也转 undefined——服务端回退默认 3，
  // 避免被 DTO Min(1) 拒且错误提示落在隐藏字段
  delaySeconds: z.preprocess(
    (v) => (v === '' || (typeof v === 'number' && Number.isNaN(v)) || v === 0 ? undefined : v),
    z.coerce.number().optional(),
  ),
  frequency: z.string().optional(),
  excludePages: z.string().optional(),
  targetDevice: z.string().optional(),
  ctaText: z.string().optional(),
});

/** 弹窗数据列 tooltip：计数为趋势参考非审计级精确 */
const POPUP_STATS_TITLE =
  '计数为趋势参考：多标签页会各计一次曝光；无语言/设备维度拆分；缓存期可能少量少计';

export const tradeShowsConfig: ResourceConfig<TradeShowItem> = {
  resource: 'trade-shows',
  basePath: '/trade-shows',
  title: '活动管理',
  singular: '活动',
  searchable: true,
  searchPlaceholder: '搜索名称、摘要、正文、地点、展位号…',
  filters: [
    { key: 'eventType', label: '全部类型', options: TRADE_SHOW_TYPE_OPTIONS },
    { key: 'status', label: '全部状态', options: STATUS_OPTIONS },
  ],
  columns: [
    // 主标识列固定到左侧，宽表横向滚动时始终可辨认当前行（滚动阴影按需出现）。
    { key: 'title', header: '名称', sortable: true, pinLeft: true },
    { key: 'location', header: '地点', sortable: true },
    {
      key: 'eventDateLabel',
      header: '日期',
      sortable: true,
      sortKey: 'startDate',
      // 与前台一致：文字标签优先，否则显示精确日期（有结束日且不同天时显示区间）
      cell: (r) => r.eventDateLabel || formatDateRange(r.startDate, r.endDate),
    },
    {
      key: 'eventType',
      header: '类型',
      sortable: true,
      cell: (r) => labelOf(TRADE_SHOW_TYPE_OPTIONS, r.eventType),
    },
    {
      key: 'status',
      header: '状态',
      sortable: true,
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'popupStats',
      header: '弹窗数据',
      cell: (r) =>
        r.isMarketing ? (
          <span title={POPUP_STATS_TITLE}>
            {r.popupViewCount} 曝光 / {r.popupClickCount} 点击
            {r.popupViewCount > 0
              ? `（CTR ${((r.popupClickCount / r.popupViewCount) * 100).toFixed(1)}%）`
              : ''}
          </span>
        ) : (
          '—'
        ),
    },
    ...contentAuditColumns<TradeShowItem>(),
  ],
  fields: [
    { name: 'title', label: '名称', type: 'text', required: true, colSpan: 2 },
    {
      name: 'eventType',
      label: '类型',
      type: 'select',
      required: true,
      options: TRADE_SHOW_TYPE_OPTIONS,
    },
    { name: 'location', label: '地点', type: 'text', emptyAsNull: true },
    {
      name: 'eventDateLabel',
      label: '展示日期',
      type: 'text',
      help: '可与下方精确日期并存；清空后前台回退显示精确日期',
      // 清空须显式提交 null，否则 PATCH 省略该字段导致旧文案无法删除
      emptyAsNull: true,
    },
    { name: 'startDate', label: '开始日期', type: 'datetime' },
    {
      name: 'endDate',
      label: '结束日期',
      type: 'datetime',
      help: '精确到分钟；只选日期时默认为当天 09:00，如需结束日全天有效（含营销弹窗展示）请把时间改为 23:59',
    },
    { name: 'boothNumber', label: '展位号', type: 'text', emptyAsNull: true },
    {
      name: 'externalUrl',
      label: '官网链接',
      type: 'text',
      colSpan: 2,
      help: '填写后前台列表卡片与营销弹窗 CTA 均跳转该链接；留空（或仅填 https:// 等无域名占位值）则去站内详情页',
      // 可空文本字段统一 emptyAsNull：清空须显式提交 null，否则 PATCH 省略导致无法删除旧值
      emptyAsNull: true,
    },
    { name: 'summary', label: '简介', type: 'textarea', colSpan: 2 },
    { name: 'content', label: '详情', type: 'markdown', colSpan: 2, folder: 'trade-shows' },
    {
      name: 'coverImage',
      label: '封面图',
      type: 'image',
      colSpan: 2,
      folder: 'trade-shows',
      help: '用于列表卡片与详情页，建议比例 16:9（营销弹窗头图请用下方专用字段）',
      emptyAsNull: true,
    },
    {
      name: 'detailCoverImage',
      label: '详情页封面图',
      type: 'image',
      colSpan: 2,
      folder: 'trade-shows',
      help: '详情页顶部宽幅大图（建议比例约 3:1）；留空则默认使用封面图',
      emptyAsNull: true,
    },
    { name: 'seoTitle', label: 'SEO 标题', type: 'text', colSpan: 2, emptyAsNull: true },
    { name: 'seoDesc', label: 'SEO 描述', type: 'textarea', colSpan: 2, emptyAsNull: true },
    { name: 'isFeatured', label: '精选', type: 'switch', placeholder: '设为精选' },
    // ═══ 营销弹窗（isMarketing 开启后其余字段才显示；字段说明见 docs/activity-system-design.md §5.2）═══
    {
      name: 'isMarketing',
      label: '启用营销弹窗',
      type: 'switch',
      placeholder: '在官网自动弹窗',
      colSpan: 2,
      help: '启用后按下方规则在官网自动弹窗；展示时间窗口即上方「开始/结束日期」，两者留空则发布即长期展示',
    },
    {
      name: 'triggerMode',
      label: '触发方式',
      type: 'select',
      help: 'SEO 提示：移动端避免「立即显示」（搜索引擎对落地即遮挡内容的弹窗降权），建议延时 ≥5 秒或滚动触发；若必须立即显示，建议目标设备选「仅桌面端」；「滚动过半」在内容不足一屏的短页面自动回退为 3 秒延时',
      options: [
        { label: '进入页面立即显示', value: 'immediate' },
        { label: '延时显示', value: 'delay' },
        { label: '滚动过半时显示', value: 'scroll' },
      ],
      visibleWhen: (v) => v.isMarketing === true,
    },
    {
      name: 'delaySeconds',
      label: '延时秒数',
      type: 'number',
      help: '1~60 秒，留空按 3 秒处理',
      visibleWhen: (v) => v.isMarketing === true && v.triggerMode === 'delay',
    },
    {
      name: 'frequency',
      label: '频次控制',
      type: 'select',
      options: [
        { label: '每次会话一次', value: 'session' },
        { label: '每日一次', value: 'daily' },
        { label: '仅一次', value: 'once' },
      ],
      visibleWhen: (v) => v.isMarketing === true,
    },
    {
      name: 'excludePages',
      label: '排除页面',
      type: 'tags',
      colSpan: 2,
      help: '逗号或换行分隔、以 / 开头的路径（不含语言前缀），如 /products；访客落地页命中排除则本次会话不弹',
      visibleWhen: (v) => v.isMarketing === true,
    },
    {
      name: 'targetDevice',
      label: '目标设备',
      type: 'select',
      options: [
        { label: '全部', value: 'all' },
        { label: '仅移动端', value: 'mobile' },
        { label: '仅桌面端', value: 'desktop' },
      ],
      visibleWhen: (v) => v.isMarketing === true,
    },
    {
      name: 'popupImage',
      label: '弹窗头图',
      type: 'image',
      colSpan: 2,
      folder: 'trade-shows',
      help: '营销弹窗专用横幅，建议比例 2:1；留空则复用上方封面图',
      emptyAsNull: true,
      visibleWhen: (v) => v.isMarketing === true,
    },
    {
      name: 'popupContent',
      label: '弹窗文案',
      type: 'markdown',
      colSpan: 2,
      folder: 'trade-shows',
      help: '营销弹窗专用短文案，建议精简（弹窗空间有限）；留空则复用上方「详情」正文',
      visibleWhen: (v) => v.isMarketing === true,
    },
    {
      name: 'ctaText',
      label: 'CTA 按钮文字',
      type: 'text',
      help: '面向海外受众时请自行填写对应语言文案（中英 locale 弹同一内容）；CTA 点击后按三级兜底跳转：① 有客服坐席可接待 → 打开在线客服并自动咨询本活动；② 无坐席且为可拨号移动端 → 直接拨打站点主电话；③ 前两级都不满足 → 新标签页打开上方「官网链接」，未填则去站内活动详情页',
      visibleWhen: (v) => v.isMarketing === true,
    },
  ],
  schema,
  publishable: true,
  previewPath: (r) => `/resources/trade-shows/${r.slug}`,
  defaultSort: { column: 'publishedAt', order: 'desc' },
  // 含审计列（创建/更新时间、创建人）后列多易溢出，固定操作列到右侧保持可达。
  pinActions: true,
  defaults: {
    title: '',
    slug: '',
    eventType: 'exhibition',
    location: '',
    eventDateLabel: '',
    startDate: '',
    endDate: '',
    boothNumber: '',
    externalUrl: '',
    summary: '',
    content: '',
    coverImage: '',
    detailCoverImage: '',
    popupImage: '',
    popupContent: '',
    seoTitle: '',
    seoDesc: '',
    isFeatured: false,
    isMarketing: false,
    triggerMode: 'immediate',
    delaySeconds: 3,
    frequency: 'session',
    excludePages: '',
    targetDevice: 'all',
    ctaText: '立即参与',
  },
  toForm: (r) => ({
    title: r.title,
    slug: r.slug,
    eventType: r.eventType,
    location: r.location ?? '',
    eventDateLabel: r.eventDateLabel ?? '',
    startDate: toDateTimeLocal(r.startDate),
    endDate: toDateTimeLocal(r.endDate),
    boothNumber: r.boothNumber ?? '',
    externalUrl: r.externalUrl ?? '',
    summary: r.summary ?? '',
    content: r.content ?? '',
    coverImage: r.coverImage ?? '',
    detailCoverImage: r.detailCoverImage ?? '',
    popupImage: r.popupImage ?? '',
    popupContent: r.popupContent ?? '',
    seoTitle: r.seoTitle ?? '',
    seoDesc: r.seoDesc ?? '',
    isFeatured: r.isFeatured,
    isMarketing: r.isMarketing,
    triggerMode: r.triggerMode,
    delaySeconds: r.delaySeconds,
    frequency: r.frequency,
    // tags 字段表单值为逗号分隔字符串（normalizeValues 提交时才 split 成数组）
    excludePages: (r.excludePages ?? []).join(', '),
    targetDevice: r.targetDevice,
    ctaText: r.ctaText,
  }),
};
