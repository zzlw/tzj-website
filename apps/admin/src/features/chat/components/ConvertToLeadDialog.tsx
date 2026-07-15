'use client';

import { Button, Input, Label, SimpleDialog, Textarea } from '@tzj/ui';
import { UserRoundCheck } from 'lucide-react';
import { useState } from 'react';
import { CUSTOMER_LEVEL_OPTIONS, CUSTOMER_TYPE_OPTIONS } from '@/features/constants';
import type { CustomerItem } from '@/features/types';
import { api } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { ChatRoom } from '../types';

interface Props {
  room: ChatRoom;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: (customerId: string) => void;
}

function geoString(r: ChatRoom): string {
  return [r.city, r.region, r.country].filter(Boolean).join(' ');
}

function sourceReferrer(r: ChatRoom): string {
  if (r.source) return r.source;
  if (r.referrerHost) return r.referrerHost;
  return '直接访问';
}

export function ConvertToLeadDialog({ room, open, onOpenChange, onConverted }: Props) {
  const initialName = (room.clientName ?? room.clientEmail.split('@')[0] ?? '').slice(0, 80);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(room.clientEmail);
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [level, setLevel] = useState('B');
  const [region, setRegion] = useState(geoString(room));
  const [dest, setDest] = useState<'public' | 'mine'>('public');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName(initialName);
    setEmail(room.clientEmail);
    setCompany('');
    setPhone('');
    setCustomerType('');
    setLevel('B');
    setRegion(geoString(room));
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
      const tags = new Set<string>();
      tags.add('聊天线索');
      if (room.referrerHost) tags.add(room.referrerHost);
      if (room.landingPath) tags.add(room.landingPath.split('/').filter(Boolean)[0] ?? '');
      const clean = [...tags].filter(Boolean).slice(0, 10);

      const notesLines = [
        `来源：在线客服会话 roomId=${room.roomId}`,
        `渠道：${sourceReferrer(room)}`,
        geoString(room) ? `位置：${geoString(room)}` : '',
      ].filter(Boolean);

      const payload: Record<string, unknown> = {
        name: n,
        email: email || undefined,
        company: company || undefined,
        phone: phone || undefined,
        customerType: customerType || undefined,
        source: 'website',
        level,
        stage: 'new',
        region: region || undefined,
        tags: clean,
        notes: notesLines.join('\n'),
        chatRoomId: room.roomId,
        ownerId: dest === 'public' ? null : undefined,
      };

      const created = await api.create<CustomerItem>('customers', payload);
      notifySuccess(
        dest === 'public' ? '已转入公海池，销售团队可前往「客户公海」认领' : '已存入我的私海',
      );
      onConverted(created.id);
      onOpenChange(false);
      reset();
    } catch (e) {
      if (e instanceof Error && e.message.includes('unique constraint')) {
        notifySuccess('该会话已存在关联客户，无需重复转化');
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
              value={[
                `来源：在线客服会话 roomId=${room.roomId}`,
                `渠道：${sourceReferrer(room)}`,
                geoString(room) ? `位置：${geoString(room)}` : '',
              ]
                .filter(Boolean)
                .join('\n')}
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
