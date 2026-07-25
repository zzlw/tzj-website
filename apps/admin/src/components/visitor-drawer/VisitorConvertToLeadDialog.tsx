'use client';

/**
 * 人物级「转为客户线索」对话框（全局访客抽屉头部触发）：
 * 与「询盘」「会话」两个转化入口同源，但以访客身份块（identity）预填，
 * 去重锚点取该访客最近一条询盘的 contactId（无询盘则创建独立客户，不去重）。
 */
import { Button, Input, Label, SimpleDialog, Textarea } from '@tzj/ui';
import { UserRoundCheck } from 'lucide-react';
import { useState } from 'react';
import { CUSTOMER_LEVEL_OPTIONS, CUSTOMER_TYPE_OPTIONS } from '@/features/constants';
import type { CustomerItem } from '@/features/types';
import { api } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';

/** 转化种子：访客身份 + 去重锚点 + 地区预填。 */
export interface VisitorConvertSeed {
  visitorId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  /** 转化去重锚点：最近一条询盘 contactId（无则创建独立客户，不去重） */
  contactId: string | null;
  /** 地区预填（来自 activity techInfo，可空） */
  region?: string | null;
}

interface Props {
  seed: VisitorConvertSeed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: (customerId: string) => void;
}

/** 系统备注：来源访客 + 关联询盘（创建后可手动补充）。 */
function buildNotes(seed: VisitorConvertSeed): string {
  return [
    `来源：官网访客 visitorId=${seed.visitorId}`,
    seed.contactId ? `关联询盘：id=${seed.contactId}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 表单快照（提交时组装 payload 用，收敛 submit 的认知复杂度）。 */
interface LeadFormState {
  name: string;
  email: string;
  company: string;
  phone: string;
  customerType: string;
  level: string;
  region: string;
  dest: 'public' | 'mine';
}

/** 组装建客 payload：空串归一为 undefined，公海置空 ownerId，去重锚点带 contactId，一级归因带 visitorId。 */
function buildLeadPayload(form: LeadFormState, seed: VisitorConvertSeed): Record<string, unknown> {
  return {
    name: form.name.trim(),
    email: form.email || undefined,
    company: form.company || undefined,
    phone: form.phone || undefined,
    customerType: form.customerType || undefined,
    source: 'website',
    level: form.level,
    stage: 'new',
    region: form.region || undefined,
    tags: ['访客线索'],
    notes: buildNotes(seed),
    contactId: seed.contactId ?? undefined,
    visitorId: seed.visitorId,
    ownerId: form.dest === 'public' ? null : undefined,
  };
}

export function VisitorConvertToLeadDialog({ seed, open, onOpenChange, onConverted }: Props) {
  const [name, setName] = useState(seed.name ?? '');
  const [email, setEmail] = useState(seed.email ?? '');
  const [company, setCompany] = useState(seed.company ?? '');
  const [phone, setPhone] = useState(seed.phone ?? '');
  const [customerType, setCustomerType] = useState('');
  const [level, setLevel] = useState('B');
  const [region, setRegion] = useState(seed.region ?? '');
  const [dest, setDest] = useState<'public' | 'mine'>('public');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName(seed.name ?? '');
    setEmail(seed.email ?? '');
    setCompany(seed.company ?? '');
    setPhone(seed.phone ?? '');
    setCustomerType('');
    setLevel('B');
    setRegion(seed.region ?? '');
    setDest('public');
  }

  async function submit() {
    const n = name.trim();
    if (!n) {
      notifyError(new Error('请填写联系人姓名'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildLeadPayload(
        { name: n, email, company, phone, customerType, level, region, dest },
        seed,
      );
      const created = await api.create<CustomerItem>('customers', payload);
      notifySuccess(
        dest === 'public' ? '已转入公海池，销售团队可前往「客户公海」认领' : '已存入我的私海',
      );
      onConverted(created.id);
      onOpenChange(false);
      reset();
    } catch (e) {
      if (e instanceof Error && e.message.includes('unique constraint')) {
        notifySuccess('该访客已存在关联客户，无需重复转化');
        onOpenChange(false);
      } else {
        notifyError(e, '转化失败');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const selectCls =
    'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <SimpleDialog
      open={open}
      onClose={() => {
        if (!submitting) {
          onOpenChange(false);
          reset();
        }
      }}
      title="转为客户线索"
      overlayClassName="bg-transparent"
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            取消
          </Button>
          <Button type="button" disabled={submitting} onClick={submit}>
            {submitting ? '转化中...' : '确认转化'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 目的地选择：公海池 / 私海 */}
        <div>
          <Label className="mb-2 block text-xs font-medium">转入目标</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={dest === 'public' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setDest('public')}
            >
              <UserRoundCheck className="mr-1 h-3.5 w-3.5" />
              公海池
            </Button>
            <Button
              type="button"
              variant={dest === 'mine' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setDest('mine')}
            >
              我的私海
            </Button>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {dest === 'public' ? '转入公海后，任意坐席均可认领' : '归入你名下，仅你可跟进'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="mb-1.5 block text-xs font-medium">
              联系人姓名 <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 张经理" />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium">客户单位</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="公司名称"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium">联系电话</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="手机号" />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium">邮箱</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium">地区</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="如 上海"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium">客户类型</Label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className={selectCls}
            >
              <option value="">暂不设置</option>
              {CUSTOMER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium">客户等级</Label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
              {CUSTOMER_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <Label className="mb-1.5 block text-xs font-medium">备注</Label>
            <Textarea
              rows={3}
              className="text-xs"
              value={buildNotes(seed)}
              onChange={() => {}}
              disabled
            />
            <p className="text-muted-foreground mt-1 text-[11px]">
              系统自动记录（创建后可手动补充）
            </p>
          </div>
        </div>
      </div>
    </SimpleDialog>
  );
}
