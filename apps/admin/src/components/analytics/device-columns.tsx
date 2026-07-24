'use client';

/**
 * 设备维度拆分列：设备（型号）/ 系统 / 浏览器 / 访问软件。
 * 供「访客中心」的「按访客」与「按 IP」两个 lens 表格复用，保证设备信息展示口径一致
 * （参考 GA4 / Matomo：设备类别、操作系统、浏览器为独立维度，内嵌宿主 App 为国内补充维度）。
 */
import { Badge, type DataTableColumn } from '@tzj/ui';
import { deviceLabel, formatDeviceModel } from '@/features/analytics';
import {
  BROWSER_SUPPORT_LABELS,
  type BrowserSupportStatus,
  classifyBrowserSupport,
} from '@/lib/browser-support';

/** 拆分列所需的设备字段（两表行类型的公共子集） */
export interface DeviceColumnFields {
  deviceType: string | null;
  deviceModel: string | null;
  deviceVendor: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  clientApp: string | null;
}

const MUTED_DASH = <span className="text-muted-foreground">—</span>;

/** 兼容性徽标样式：支持=绿 / 不支持=红 / 未知=灰，与表内其它状态徽标同一视觉语汇。 */
const SUPPORT_BADGE_CLASS: Record<BrowserSupportStatus, string> = {
  supported: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  unsupported: 'border-rose-200 bg-rose-50 text-rose-700',
  unknown: 'border-border bg-muted text-muted-foreground',
};

/** 依据浏览器名+版本渲染站点兼容性徽标（title 悬浮显示判定依据，便于统计溯源）。 */
function BrowserSupportBadge({
  browser,
  version,
}: {
  browser: string | null;
  version: string | null;
}) {
  const { status, reason } = classifyBrowserSupport(browser, version);
  return (
    <Badge variant="outline" className={SUPPORT_BADGE_CLASS[status]} title={reason}>
      {BROWSER_SUPPORT_LABELS[status]}
    </Badge>
  );
}

export function deviceColumns<T extends DeviceColumnFields>(): DataTableColumn<T>[] {
  return [
    {
      key: 'device',
      header: '设备',
      cell: (r) => {
        const model = formatDeviceModel(r.deviceModel, r.deviceVendor);
        return (
          <div className="min-w-0">
            <span className="whitespace-nowrap">
              {r.deviceType ? deviceLabel(r.deviceType) : '—'}
            </span>
            {model ? (
              <span className="block truncate text-xs text-muted-foreground">{model}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'os',
      header: '系统',
      className: 'whitespace-nowrap',
      cell: (r) => [r.os, r.osVersion].filter(Boolean).join(' ') || MUTED_DASH,
    },
    {
      key: 'browser',
      header: '浏览器',
      className: 'whitespace-nowrap',
      cell: (r) => [r.browser, r.browserVersion].filter(Boolean).join(' ') || MUTED_DASH,
    },
    {
      key: 'browserSupport',
      header: '兼容性',
      className: 'whitespace-nowrap',
      cell: (r) => <BrowserSupportBadge browser={r.browser} version={r.browserVersion} />,
    },
    {
      key: 'clientApp',
      header: '访问软件',
      cell: (r) =>
        r.clientApp ? <span className="whitespace-nowrap">{r.clientApp}</span> : MUTED_DASH,
    },
  ];
}
