'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  cn,
  DataTable,
  type DataTableColumn,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SimpleDialog,
  TablePagination,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tzj/ui';
import { Eye, RotateCcw, Search, Trash2, UserRoundCheck, UserRoundPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Can } from '@/components/Can';
import { CopyableText } from '@/components/CopyableText';
import { LastOperatorCell } from '@/components/LastOperatorCell';
import { useSession } from '@/components/session';
import type { VisitorDrawerApi } from '@/components/visitor-drawer/context';
import { useVisitorDrawer } from '@/components/visitor-drawer/context';
import { SOURCE_FACET_OPTIONS } from '@/components/visitors/facet-options';
import { sourceLabel } from '@/features/analytics';
import { formatDateTime } from '@/features/constants';
import { ConvertToLeadDialog } from '@/features/contacts/components/ConvertToLeadDialog';
import { useList, useRemove, useUpdate } from '@/features/hooks';
import type { ContactItem } from '@/features/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError, api } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  enumField,
  intField,
  sortField,
  stringField,
  type UrlFieldSpec,
  useUrlState,
} from '@/lib/use-url-state';

const FILTERS = [
  { key: 'unread', label: '未读', params: { isRead: false } },
  { key: 'unhandled', label: '待处理', params: { isHandled: false } },
] as const;

const CONTACT_STATUS = {
  pending: {
    label: '待处理',
    dot: 'bg-amber-500',
    trigger:
      'border-amber-300/80 bg-amber-50 text-amber-800 hover:bg-amber-50 focus:ring-amber-200/60',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  handled: {
    label: '已处理',
    dot: 'bg-emerald-500',
    trigger:
      'border-emerald-300/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 focus:ring-emerald-200/60',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
} as const;

type ContactStatusKey = keyof typeof CONTACT_STATUS;

function ContactHandleBadge({ handled }: { handled: boolean }) {
  const status = CONTACT_STATUS[handled ? 'handled' : 'pending'];
  return (
    <Badge variant="outline" className={cn('gap-1.5 pl-2', status.badge)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', status.dot)} />
      {status.label}
    </Badge>
  );
}

function ContactHandleStatusSelect({
  handled,
  onChange,
}: {
  handled: boolean;
  onChange: (handled: boolean) => void;
}) {
  const value: ContactStatusKey = handled ? 'handled' : 'pending';
  const current = CONTACT_STATUS[value];

  return (
    <Select value={value} onValueChange={(v) => onChange(v === 'handled')}>
      <SelectTrigger className={cn('h-9 w-[148px] font-medium shadow-none', current.trigger)}>
        <span className="flex items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', current.dot)} />
          {current.label}
        </span>
      </SelectTrigger>
      <SelectContent>
        {(
          Object.entries(CONTACT_STATUS) as [
            ContactStatusKey,
            (typeof CONTACT_STATUS)[ContactStatusKey],
          ][]
        ).map(([key, status]) => (
          <SelectItem key={key} value={key}>
            <span className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', status.dot)} />
              {status.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const CONTACT_COLUMNS: DataTableColumn<ContactItem>[] = [
  {
    key: 'name',
    header: '联系人',
    className: 'font-medium',
    sortable: true,
    // 主标识列固定到左侧：注入访客 ID / IP 后列多易溢出，横向滚动时保持联系人可辨认。
    pinLeft: true,
    cell: (r) => (
      <>
        {!r.isRead && (
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
        )}
        {r.name}
      </>
    ),
  },
  {
    key: 'company',
    header: '单位',
    className: 'text-muted-foreground',
    sortable: true,
    cell: (r) => r.company ?? '—',
  },
  {
    key: 'contact',
    header: '联系方式',
    className: 'text-muted-foreground',
    cell: (r) => r.phone || r.email || '—',
  },
  {
    key: 'region',
    header: '地区',
    className: 'whitespace-nowrap text-muted-foreground',
    // 富化字段：后端全量富化后内存排序分页（空值置后）
    sortable: true,
    cell: (r) => r.lastRegion ?? '—',
  },
  {
    key: 'channel',
    header: '来源渠道',
    // 与访客中心「来源渠道」列同款：首触渠道 + 引荐域名副行（首触归因）；排序同为富化字段内存排序。
    // 命名区分：「来源渠道」=流量归因维度；客户表的「客户来源」=业务获客维度，两者语义不同。
    sortable: true,
    cell: (r) => (
      <div className="min-w-[110px]">
        <div className="text-foreground">{r.channel ? sourceLabel(r.channel) : '—'}</div>
        {r.referrerHost ? (
          <div className="mt-0.5 max-w-[160px] truncate text-xs text-muted-foreground">
            {r.referrerHost}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    key: 'message',
    header: '主题 / 留言',
    className: 'max-w-[260px]',
    cell: (r) => (
      <div>
        {r.subject && <div className="truncate">{r.subject}</div>}
        <div
          className={cn('truncate text-muted-foreground', r.subject && 'mt-0.5 text-xs')}
          title={r.message}
        >
          {r.message}
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: '状态',
    sortable: true,
    cell: (r) => <ContactHandleBadge handled={r.isHandled} />,
  },
  {
    key: 'converted',
    header: '转化状态',
    // 后端按「已转/未转」两段分页拼接排序（desc=已转客户在前）
    sortable: true,
    className: 'whitespace-nowrap',
    cell: (r) =>
      r.convertedCustomerId ? (
        <Link href={`/customers/${r.convertedCustomerId}`}>
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            已转客户
          </Badge>
        </Link>
      ) : (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          未转化
        </Badge>
      ),
  },
  {
    key: 'createdAt',
    header: '创建时间',
    className: 'whitespace-nowrap text-muted-foreground',
    sortable: true,
    cell: (r) => formatDateTime(r.createdAt),
  },
  {
    key: 'updatedAt',
    header: '更新时间',
    className: 'whitespace-nowrap text-muted-foreground',
    sortable: true,
    cell: (r) => formatDateTime(r.updatedAt),
  },
  {
    key: 'lastOperator',
    header: '最后操作人',
    cell: (r) => <LastOperatorCell user={r.lastOperatorUser} fallback={r.lastOperator} />,
  },
];

/**
 * 动态注入「访客 ID / 最后访问 IP」两列（依赖全局抽屉回调，故用工厂而非常量）。
 * 插在「联系方式」之后便于识别归并；点击复用全局访客/IP 抽屉。
 */
function buildContactColumns(
  openPerson: VisitorDrawerApi['openPerson'],
  openIp: VisitorDrawerApi['openIp'],
): DataTableColumn<ContactItem>[] {
  const visitorCol: DataTableColumn<ContactItem> = {
    key: 'visitorId',
    header: '访客 ID',
    className: 'whitespace-nowrap',
    cell: (r) =>
      r.visitorId ? (
        <CopyableText
          value={r.visitorId}
          display={`#${r.visitorId.slice(0, 8)}`}
          onActivate={() =>
            openPerson(r.visitorId as string, {
              name: r.name,
              email: r.email ?? null,
              phone: r.phone ?? null,
              company: r.company ?? null,
            })
          }
        />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  };
  const ipCol: DataTableColumn<ContactItem> = {
    key: 'lastIp',
    header: '最后访问 IP',
    // 富化字段排序：后端全量富化后内存排序（空值置后，IP 按段数值序，同客户表）
    sortable: true,
    className: 'whitespace-nowrap',
    cell: (r) => (
      <CopyableText
        value={r.lastIp ?? null}
        onActivate={
          r.lastIpHash
            ? () => openIp(r.lastIpHash as string, { ipMasked: r.lastIpMasked ?? null })
            : undefined
        }
      />
    ),
  };
  const cols = [...CONTACT_COLUMNS];
  const contactIdx = cols.findIndex((c) => c.key === 'contact');
  cols.splice(contactIdx + 1, 0, visitorCol, ipCol);
  return cols;
}

/** 删除确认文案：已转化询盘需告知客户档案侧的联动后果（行内已有转化标记，无需预检接口）。 */
function contactDeleteDescription(row: ContactItem): string {
  const base = '询盘将移入回收站，30 天后自动永久清理，期间可恢复。';
  return row.convertedCustomerId
    ? `该询盘已转化为客户，删除后客户档案中的关联询盘链接将失效，客户记录本身保留。${base}`
    : base;
}

/** 回收站行操作（查看 / 恢复 / 永久删除）；永久删除仅管理员可见（后端同步校验）。 */
function ContactTrashRowActions({
  row,
  isAdmin,
  onView,
  onRestore,
  onPurge,
}: {
  row: ContactItem;
  isAdmin: boolean;
  onView: (r: ContactItem) => void;
  onRestore: (r: ContactItem) => void;
  onPurge: (r: ContactItem) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(row)}>
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>查看</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRestore(row)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>恢复</TooltipContent>
      </Tooltip>
      {isAdmin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:text-destructive"
              onClick={() => onPurge(row)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>永久删除</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/** 行操作列（查看 / 转化或查看客户档案 / 删除），抽为独立组件降低页面复杂度。 */
function ContactRowActions({
  row,
  onView,
  onConvert,
  onDelete,
}: {
  row: ContactItem;
  onView: (r: ContactItem) => void;
  onConvert: (r: ContactItem) => void;
  onDelete: (r: ContactItem) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(row)}>
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>查看</TooltipContent>
      </Tooltip>
      {row.convertedCustomerId ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <Link href={`/customers/${row.convertedCustomerId}`}>
                <UserRoundCheck className="h-4 w-4 text-primary" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>查看客户档案</TooltipContent>
        </Tooltip>
      ) : (
        <Can perm="contacts.manage">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onConvert(row)}
              >
                <UserRoundPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>转为客户线索</TooltipContent>
          </Tooltip>
        </Can>
      )}
      <Can perm="contacts.delete">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:text-destructive"
              onClick={() => onDelete(row)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>删除</TooltipContent>
        </Tooltip>
      </Can>
    </div>
  );
}

/** 搜索 + 下拉筛选栏（交互对齐 ResourceListView：300ms 防抖实时检索 + 筛选芯片 + 一键清除）。 */

/** 下拉筛选定义（label 形如「全部××」，芯片前缀自动去掉「全部」）。 */
interface DropdownFilter {
  key: 'channel' | 'converted';
  label: string;
  options: { value: string; label: string }[];
}

const CONVERTED_OPTIONS = [
  { value: 'true', label: '已转客户' },
  { value: 'false', label: '未转化' },
] as const;

const DROPDOWN_FILTERS: DropdownFilter[] = [
  // 渠道选项与访客中心同源（直接访问/自然搜索/付费广告…），按首触渠道过滤
  { key: 'channel', label: '全部来源渠道', options: SOURCE_FACET_OPTIONS },
  { key: 'converted', label: '全部转化状态', options: [...CONVERTED_OPTIONS] },
];

/** 受限字符串 URL 字段：仅接受白名单值，空串省略（同 ResourceListView 的筛选字段口径）。 */
function filterField(values: readonly string[]): UrlFieldSpec<string> {
  return {
    default: '',
    parse: (raw) => (raw && values.includes(raw) ? raw : ''),
    serialize: (v) => (v ? v : null),
  };
}

interface ContactFilterState {
  search: string;
  channel: string;
  converted: string;
}

function ContactFilterBar({
  state,
  total,
  onChange,
}: {
  state: ContactFilterState;
  /** 当前命中总数（有活动筛选时展示「找到 N 条结果」） */
  total?: number;
  onChange: (patch: Partial<ContactFilterState>) => void;
}) {
  const [input, setInput] = useState(state.search);

  // 击键防抖：停止输入 300ms 后才落地检索词（初次挂载恒等于已应用值，跳过写入）。
  const debounced = useDebouncedValue(input.trim(), 300);
  useEffect(() => {
    if (debounced !== state.search) onChange({ search: debounced });
  }, [debounced, state.search, onChange]);

  // 活动筛选芯片：搜索词 + 各下拉选中值，各自可单独移除。
  const chips: { key: string; label: string; value: string; onRemove: () => void }[] = [];
  if (state.search) {
    chips.push({
      key: '__search__',
      label: '搜索',
      value: state.search,
      onRemove: () => {
        setInput('');
        onChange({ search: '' });
      },
    });
  }
  for (const flt of DROPDOWN_FILTERS) {
    const v = state[flt.key];
    if (!v) continue;
    const opt = flt.options.find((o) => o.value === v);
    chips.push({
      key: flt.key,
      label: flt.label.replace(/^全部/, ''),
      value: opt?.label ?? v,
      onRemove: () => onChange({ [flt.key]: '' }),
    });
  }

  return (
    <Card className="mb-6 border-border/80 py-0 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-3">
          <form
            className="relative min-w-[220px] max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              onChange({ search: input.trim() });
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="搜索联系人、单位、电话、邮箱、留言…"
              className="pl-9 pr-9"
            />
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput('');
                  onChange({ search: '' });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="清除搜索"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
          {DROPDOWN_FILTERS.map((flt) => (
            <Select
              key={flt.key}
              value={state[flt.key] || '__all__'}
              onValueChange={(v) => {
                onChange({ [flt.key]: v && v !== '__all__' ? v : '' });
              }}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder={flt.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{flt.label}</SelectItem>
                {flt.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {total !== undefined && (
              <span className="mr-1 text-xs text-muted-foreground">
                找到{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {total.toLocaleString('zh-CN')}
                </span>{' '}
                条结果
              </span>
            )}
            {chips.map((chip) => (
              <Badge
                key={chip.key}
                variant="outline"
                className="gap-1 border-border bg-muted/60 font-normal text-muted-foreground"
              >
                <span className="text-foreground/60">{chip.label}：</span>
                {chip.value}
                <button
                  type="button"
                  aria-label={`移除${chip.label}筛选`}
                  onClick={chip.onRemove}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput('');
                onChange({ search: '', channel: '', converted: '' });
              }}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              清除全部
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 列表加载错误提示，含 401/403 友好补充说明；抽出以收敛页面的嵌套三元。 */
function ContactErrorAlert({ error }: { error: unknown }) {
  const base = error instanceof Error ? error.message : '未知错误';
  let hint = '';
  if (error instanceof ApiError) {
    if (error.status === 401) hint = '（会话已过期，请重新登录）';
    else if (error.status === 403) hint = '（无询盘查看权限，请联系管理员）';
  }
  return (
    <Alert variant="destructive" icon="error" className="mb-4">
      加载失败：{base}
      {hint}
    </Alert>
  );
}

/**
 * 询盘详情弹窗：自管备注 / 处理状态草稿与保存（useUpdate 成功后自动失效列表缓存），
 * 抽出以从页面剥离大段 JSX 与保存逻辑，降低 ContactsPage 认知复杂度。
 */
function ContactDetailDialog({
  contact,
  onClose,
}: {
  contact: ContactItem | null;
  onClose: () => void;
}) {
  const [remark, setRemark] = useState('');
  const [handledDraft, setHandledDraft] = useState(false);
  const updateMut = useUpdate<ContactItem>('contact');

  useEffect(() => {
    if (!contact) return;
    setRemark(contact.remark ?? '');
    setHandledDraft(contact.isHandled);
  }, [contact]);

  const dirty =
    contact !== null && (remark !== (contact.remark ?? '') || handledDraft !== contact.isHandled);

  async function save() {
    if (!contact) return;
    try {
      await updateMut.mutateAsync({
        id: contact.id,
        payload: { remark, isHandled: handledDraft },
      });
      notifySuccess('询盘已保存');
      onClose();
    } catch (e) {
      notifyError(e, '保存失败');
    }
  }

  return (
    <SimpleDialog
      open={contact !== null}
      onClose={onClose}
      wide
      title="询盘详情"
      footer={
        contact && (
          <Can perm="contacts.manage">
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateMut.isPending}
              >
                取消
              </Button>
              <Button onClick={save} disabled={updateMut.isPending || !dirty}>
                保存
              </Button>
            </div>
          </Can>
        )
      }
    >
      {contact && (
        <div className="space-y-4 text-sm">
          <DetailRow label="联系人" value={contact.name} />
          <DetailRow label="单位" value={contact.company ?? '—'} />
          <DetailRow label="电话" value={contact.phone ?? '—'} />
          <DetailRow label="邮箱" value={contact.email ?? '—'} />
          <DetailRow label="主题" value={contact.subject ?? '—'} />
          <DetailRow label="来源" value={contact.channel ? sourceLabel(contact.channel) : '—'} />
          <DetailRow label="创建时间" value={formatDateTime(contact.createdAt)} />
          <DetailRow label="更新时间" value={formatDateTime(contact.updatedAt)} />
          <div className="flex gap-3">
            <span className="w-16 shrink-0 text-muted-foreground">最后操作人</span>
            <LastOperatorCell
              user={contact.lastOperatorUser}
              fallback={contact.lastOperator}
              profileOnHover={false}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-muted-foreground">状态</span>
            <Can perm="contacts.manage" fallback={<ContactHandleBadge handled={handledDraft} />}>
              <ContactHandleStatusSelect handled={handledDraft} onChange={setHandledDraft} />
            </Can>
          </div>
          <div>
            <Label className="text-muted-foreground">留言内容</Label>
            <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap text-foreground">
              {contact.message}
            </div>
          </div>
          <div>
            <Label htmlFor="remark">处理备注</Label>
            <Textarea
              id="remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              placeholder="填写处理情况…"
              className="mt-2"
            />
          </div>
        </div>
      )}
    </SimpleDialog>
  );
}

export default function ContactsPage() {
  const [urlState, setUrlState] = useUrlState({
    page: intField(1, { min: 1 }),
    pageSize: intField(10, { min: 1 }),
    tab: enumField(['all', 'unread', 'unhandled', 'trash'] as const, 'all'),
    search: stringField(),
    channel: filterField(SOURCE_FACET_OPTIONS.map((o) => o.value)),
    converted: filterField(CONVERTED_OPTIONS.map((o) => o.value)),
    sort: sortField({ column: 'createdAt', order: 'desc' }),
  });
  const { page, pageSize, tab, search, channel, converted, sort } = urlState;
  const [detail, setDetail] = useState<ContactItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactItem | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<ContactItem | null>(null);
  const [convertTarget, setConvertTarget] = useState<ContactItem | null>(null);
  const { openPerson, openIp } = useVisitorDrawer();
  const queryClient = useQueryClient();
  const { role, permissions } = useSession();
  const isAdmin = role === 'admin';
  const canDelete = permissions.includes('contacts.delete') || permissions.includes('*');
  const isTrash = tab === 'trash';

  // 追加「访客 ID」「最后访问 IP」两列（定义见模块级 buildContactColumns）。
  const columns = useMemo<DataTableColumn<ContactItem>[]>(
    () => buildContactColumns(openPerson, openIp),
    [openPerson, openIp],
  );

  const params = useMemo(() => {
    const base: Record<string, string | number | boolean> = { page, limit: pageSize };
    if (search.trim()) base.search = search.trim();
    if (channel) base.channel = channel;
    if (converted) base.converted = converted === 'true';
    if (tab === 'trash') base.deleted = true;
    if (sort) {
      base.sortBy = sort.column;
      base.sortOrder = sort.order;
    }
    const f = FILTERS.find((x) => x.key === tab);
    return f ? { ...base, ...f.params } : base;
  }, [page, pageSize, tab, search, channel, converted, sort]);

  const { data, isLoading, isError, error } = useList<ContactItem>('contact', params);
  const updateMut = useUpdate<ContactItem>('contact');
  const removeMut = useRemove('contact');
  const restoreMut = useMutation({
    mutationFn: (id: string) => api.post(`contact/${id}/restore`, {}),
    onSuccess: () => {
      notifySuccess('询盘已恢复');
      queryClient.invalidateQueries({ queryKey: ['contact'] });
    },
    onError: (e) => notifyError(e, '恢复失败'),
  });
  const purgeMut = useMutation({
    mutationFn: (id: string) => api.remove('contact', id, { purge: true }),
    onSuccess: () => {
      setPurgeTarget(null);
      notifySuccess('已永久删除');
      queryClient.invalidateQueries({ queryKey: ['contact'] });
    },
    onError: (e) => notifyError(e, '永久删除失败'),
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  // 筛选变更统一回到第 1 页；稳定引用避免 FilterBar 防抖 effect 无谓重跑。
  const handleFilterChange = useCallback(
    (patch: Partial<ContactFilterState>) => setUrlState({ ...patch, page: 1 }),
    [setUrlState],
  );

  function openDetail(row: ContactItem) {
    setDetail(row);
    // 回收站行禁止常规更新（后端 409 守卫），不回写已读
    if (!row.isRead && !isTrash) {
      updateMut.mutate({ id: row.id, payload: { isRead: true } });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await removeMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      notifySuccess('询盘已移入回收站');
    } catch (e) {
      notifyError(e, '删除失败');
    }
  }

  return (
    <TooltipProvider>
      <PageHeader title="询盘管理" description="查看并处理来自官网的客户咨询" />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setUrlState({ tab: v as typeof tab, page: 1 });
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="unread">未读</TabsTrigger>
          <TabsTrigger value="unhandled">待处理</TabsTrigger>
          {canDelete && <TabsTrigger value="trash">回收站</TabsTrigger>}
        </TabsList>
      </Tabs>

      <ContactFilterBar
        state={{ search, channel, converted }}
        total={pagination?.total}
        onChange={handleFilterChange}
      />

      {isError && <ContactErrorAlert error={error} />}

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        emptyText={isTrash ? '回收站为空' : '暂无询盘'}
        getRowClassName={(r) => (!r.isRead && !isTrash ? 'bg-primary/[0.03]' : undefined)}
        renderActions={(r) =>
          isTrash ? (
            <ContactTrashRowActions
              row={r}
              isAdmin={isAdmin}
              onView={openDetail}
              onRestore={(row) => restoreMut.mutate(row.id)}
              onPurge={setPurgeTarget}
            />
          ) : (
            <ContactRowActions
              row={r}
              onView={openDetail}
              onConvert={setConvertTarget}
              onDelete={setDeleteTarget}
            />
          )
        }
        sort={sort}
        defaultSort={{ column: 'createdAt', order: 'desc' }}
        onSortChange={(s) => setUrlState({ sort: s, page: 1 })}
        pinActions
      />

      {pagination && (
        <TablePagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          onPageChange={(p) => setUrlState({ page: p })}
          onPageSizeChange={(size) => {
            setUrlState({ pageSize: size, page: 1 });
          }}
        />
      )}

      <ContactDetailDialog contact={detail} onClose={() => setDetail(null)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除询盘"
        description={deleteTarget ? contactDeleteDescription(deleteTarget) : undefined}
        confirmLabel="移入回收站"
        onConfirm={handleDeleteConfirm}
        loading={removeMut.isPending}
      />

      <ConfirmDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
        title="永久删除询盘"
        description={
          purgeTarget
            ? `确认永久删除「${purgeTarget.name}」的询盘？此操作不可撤销；若仍有客户关联该询盘，关联将被解除并在客户备注中留痕。`
            : undefined
        }
        confirmLabel="永久删除"
        onConfirm={() => {
          if (purgeTarget) purgeMut.mutate(purgeTarget.id);
        }}
        loading={purgeMut.isPending}
      />

      {convertTarget && (
        <ConvertToLeadDialog
          contact={convertTarget}
          open={convertTarget !== null}
          onOpenChange={(open) => !open && setConvertTarget(null)}
          onConverted={() => {
            setConvertTarget(null);
            queryClient.invalidateQueries({ queryKey: ['contact'] });
          }}
        />
      )}
    </TooltipProvider>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
