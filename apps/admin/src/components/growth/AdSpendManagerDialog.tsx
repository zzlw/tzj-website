'use client';

import {
  Badge,
  Button,
  ConfirmDialog,
  DateRangePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@tzj/ui';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  type AdSpendRecord,
  useAdSpendRecords,
  useCreateAdSpend,
  useDeleteAdSpend,
  useUpdateAdSpend,
} from '@/features/growth';
import { notifyError, notifySuccess } from '@/lib/notify';

/** admin 侧 UI 常量（不导入 @tzj/types 值常量，维持 type-only 边界） */
const PLATFORM_OPTIONS: Array<{ value: AdSpendRecord['platform']; label: string }> = [
  { value: 'baidu', label: '百度' },
  { value: 'google', label: 'Google' },
  { value: 'wechat', label: '微信' },
  { value: 'other', label: '其他' },
];
const PLATFORM_LABELS = Object.fromEntries(PLATFORM_OPTIONS.map((o) => [o.value, o.label]));
const SOURCE_LABELS: Record<AdSpendRecord['source'], string> = {
  manual: '手工',
  baidu_api: '百度API',
};

interface FormState {
  platform: AdSpendRecord['platform'];
  periodStart: string;
  periodEnd: string;
  spend: string;
  note: string;
}

const EMPTY_FORM: FormState = {
  platform: 'baidu',
  periodStart: '',
  periodEnd: '',
  spend: '',
  note: '',
};

interface AdSpendManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 广告花费台账管理（docs/ad-spend-ledger-design.md §7）：
 * 上半部记录列表（默认最近 12 个月）+ 下半部新增/编辑表单（含整月快捷选择）。
 * 写操作需 settings.manage（调用方用 Can 门禁包裹入口）；同平台区间重叠后端返回 409。
 */
export function AdSpendManagerDialog({ open, onOpenChange }: AdSpendManagerDialogProps) {
  const { data, isLoading } = useAdSpendRecords();
  const createSpend = useCreateAdSpend();
  const updateSpend = useUpdateAdSpend();
  const deleteSpend = useDeleteAdSpend();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdSpendRecord | null>(null);

  const submitting = createSpend.isPending || updateSpend.isPending;
  const spendNum = Number(form.spend);
  const valid =
    form.periodStart !== '' &&
    form.periodEnd !== '' &&
    form.spend.trim() !== '' &&
    Number.isFinite(spendNum) &&
    spendNum >= 0;

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(record: AdSpendRecord) {
    setEditingId(record.id);
    setForm({
      platform: record.platform,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      spend: String(record.spend),
      note: record.note ?? '',
    });
  }

  /** 整月快捷选择：选月份自动填首末日（按月记账的主流习惯） */
  function fillMonth(month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const lastDay = new Date(y, m, 0).getDate(); // 本地日历取当月天数
    setForm((f) => ({
      ...f,
      periodStart: `${month}-01`,
      periodEnd: `${month}-${String(lastDay).padStart(2, '0')}`,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const payload = {
      platform: form.platform,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      spend: Math.round(spendNum * 100) / 100, // 与后端 DTO 口径一致：最多两位小数
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    };
    try {
      if (editingId) {
        await updateSpend.mutateAsync({ id: editingId, ...payload });
        notifySuccess('台账记录已更新，看板将按新口径重算');
      } else {
        await createSpend.mutateAsync(payload);
        notifySuccess('台账记录已新增');
      }
      resetForm();
    } catch (err) {
      // 409 重叠冲突等：展示后端返回的冲突详情
      notifyError(err, '保存失败');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSpend.mutateAsync(deleteTarget.id);
      notifySuccess('台账记录已删除');
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
    } catch (err) {
      notifyError(err, '删除失败');
    }
  }

  const items = data?.items ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理广告花费</DialogTitle>
            <DialogDescription>
              分平台分时段记账（最近 12 个月）。看板与灵犀报告按查询区间对台账做按天分摊聚合。
            </DialogDescription>
          </DialogHeader>

          {/* 记录列表 */}
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                暂无台账记录，请在下方录入
              </p>
            ) : (
              items.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-md border border-border/80 px-3 py-2 text-sm"
                >
                  <Badge variant="secondary" className="shrink-0">
                    {PLATFORM_LABELS[r.platform] ?? r.platform}
                  </Badge>
                  <span className="whitespace-nowrap text-muted-foreground">
                    {r.periodStart} ~ {r.periodEnd}
                  </span>
                  <span className="font-medium">¥{r.spend.toLocaleString('zh-CN')}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {SOURCE_LABELS[r.source] ?? r.source}
                  </span>
                  {r.note ? (
                    <span className="min-w-0 truncate text-xs text-muted-foreground" title={r.note}>
                      {r.note}
                    </span>
                  ) : null}
                  <span className="ml-auto flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="编辑"
                      onClick={() => startEdit(r)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      aria-label="删除"
                      onClick={() => setDeleteTarget(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </div>
              ))
            )}
          </div>

          <Separator />

          {/* 新增/编辑表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm font-medium">{editingId ? '编辑记录' : '新增记录'}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ad-spend-platform">平台</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, platform: v as AdSpendRecord['platform'] }))
                  }
                >
                  <SelectTrigger id="ad-spend-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-spend-month">整月快捷选择</Label>
                <Input
                  id="ad-spend-month"
                  type="month"
                  onChange={(e) => fillMonth(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>记账区间</Label>
              <DateRangePicker
                className="w-full"
                from={form.periodStart || undefined}
                to={form.periodEnd || undefined}
                onChange={({ from, to }) =>
                  setForm((f) => ({ ...f, periodStart: from, periodEnd: to }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ad-spend-amount">花费金额（元）</Label>
                <Input
                  id="ad-spend-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.spend}
                  onChange={(e) => setForm((f) => ({ ...f, spend: e.target.value }))}
                  placeholder="如 3200"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-spend-note">备注（可选）</Label>
                <Input
                  id="ad-spend-note"
                  value={form.note}
                  maxLength={200}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="如账单号、投放说明"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingId ? (
                <Button type="button" variant="ghost" onClick={resetForm} disabled={submitting}>
                  取消编辑
                </Button>
              ) : null}
              <Button type="submit" disabled={submitting || !valid}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? '保存修改' : '新增记录'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="删除台账记录"
        description={
          deleteTarget
            ? `确定删除 ${PLATFORM_LABELS[deleteTarget.platform] ?? deleteTarget.platform} ${deleteTarget.periodStart} ~ ${deleteTarget.periodEnd}（¥${deleteTarget.spend.toLocaleString('zh-CN')}）吗？删除后看板花费口径立即重算。`
            : undefined
        }
        confirmLabel="删除"
        loading={deleteSpend.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
