'use client';

/**
 * 访客浏览行为时间线（纯展示）：技术信息条 + 按会话分组的页面轨迹。
 * 作为时间线 UI 的唯一实现来源，供「访客会话」抽屉（按 visitorId）与
 * 「访客分析 · 访客明细」抽屉（按 IP/ipHash）复用，二者仅取数 hook 不同。
 */
import { Badge, Skeleton } from '@tzj/ui';
import { Activity, ChevronDown, ChevronRight, Megaphone, Network } from 'lucide-react';
import { useState } from 'react';
import { BrowserSupportBadge } from '@/components/analytics/device-columns';
import { CopyableIp } from '@/components/CopyableText';
import {
  type AnalyticsVisitorActivity,
  type AnalyticsVisitorNetwork,
  type AnalyticsVisitorSession,
  deviceLabel,
  formatDeviceModel,
  formatDuration,
  formatLastSeen,
  formatTimeOfDay,
  regionLabel,
  sourceLabel,
} from '@/features/analytics';

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

/** 技术信息条中的单项（label / value），value 支持纯文本或自定义节点（徽标/可复制 IP 等） */
function TechRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

/** 关键页触达标签（触达联系页 / 浏览案例·方案），无触达时不渲染 */
function TouchedBadges({
  touchedContact,
  touchedCase,
}: {
  touchedContact: boolean;
  touchedCase: boolean;
}) {
  if (!touchedContact && !touchedCase) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1 border-t pt-3">
      {touchedContact ? (
        <Badge
          variant="outline"
          className="border-warning/40 bg-warning-muted text-warning-foreground"
        >
          触达联系页
        </Badge>
      ) : null}
      {touchedCase ? (
        <Badge variant="outline" className="border-info/30 bg-info-muted text-info-foreground">
          浏览案例/方案
        </Badge>
      ) : null}
    </div>
  );
}

/** 技术信息条：设备型号/系统/浏览器/兼容性/访问软件、地区、来源、访问次数、首末访问、入口页、最后 IP + 关键页触达标签 */
function TechInfoBar({ activity }: { activity: AnalyticsVisitorActivity }) {
  const { techInfo, summary, sessions, networks, attribution } = activity;
  const deviceType = techInfo.deviceType ? deviceLabel(techInfo.deviceType) : null;
  // 型号带厂商（型号串未含厂商名时补注），如「SM-S911B（Samsung）」
  const model = formatDeviceModel(techInfo.deviceModel, techInfo.deviceVendor);
  const device = [deviceType, model].filter(Boolean).join(' · ') || '未知';
  const osValue = [techInfo.os, techInfo.osVersion].filter(Boolean).join(' ') || '未知';
  const browserValue =
    [techInfo.browser, techInfo.browserVersion].filter(Boolean).join(' ') || '未知';
  const region = regionLabel(techInfo, '未知');
  const source = techInfo.channel ? sourceLabel(techInfo.channel) : '直接访问';
  // 入口页：后端首触权威值优先，回退到时间最早会话（sessions 降序，末位最早）的首条 view
  const landingPath = attribution?.landingPath ?? sessions[sessions.length - 1]?.views[0]?.path;
  // 最后访问 IP：历史网络按 lastSeenAt 降序，首条即最近；IP 抽屉无 networks 则不展示
  const lastNetwork = networks?.[0];
  return (
    <div className="bg-muted/30 rounded-lg border p-3 text-xs">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <TechRow label="设备" value={device} />
        <TechRow label="系统" value={osValue} />
        <TechRow label="浏览器" value={browserValue} />
        <TechRow
          label="兼容性"
          value={
            <BrowserSupportBadge browser={techInfo.browser} version={techInfo.browserVersion} />
          }
        />
        <TechRow label="访问软件" value={techInfo.clientApp ?? '独立浏览器'} />
        <TechRow label="地区" value={region} />
        <TechRow
          label="来源"
          value={techInfo.referrerHost ? `${source} · ${techInfo.referrerHost}` : source}
        />
        <TechRow
          label="访问次数"
          value={`${summary.totalSessions} 次 · ${summary.totalPageViews} 页`}
        />
        <TechRow
          label="首次访问"
          value={summary.firstSeenAt ? formatLastSeen(summary.firstSeenAt) : '—'}
        />
        <TechRow
          label="最近访问"
          value={
            summary.lastSeenAt ? (
              <span>
                {formatLastSeen(summary.lastSeenAt)}
                <span className="text-muted-foreground ml-1">
                  （{formatTimeOfDay(summary.lastSeenAt)}活跃）
                </span>
              </span>
            ) : (
              '—'
            )
          }
        />
        <TechRow
          label="入口页"
          value={
            landingPath ? (
              <span className="block truncate font-mono" title={landingPath}>
                {landingPath}
              </span>
            ) : (
              '—'
            )
          }
        />
        {lastNetwork ? (
          <TechRow
            label="最后访问 IP"
            value={<CopyableIp ip={lastNetwork.ip} ipMasked={lastNetwork.ipMasked} />}
          />
        ) : null}
      </dl>
      <TouchedBadges touchedContact={summary.touchedContact} touchedCase={summary.touchedCase} />
    </div>
  );
}

/** 单个会话（可折叠）：会话头显示时间/时长约/页面数/渠道，展开为有序页面轨迹 */
function SessionItem({
  session,
  defaultOpen,
}: {
  session: AnalyticsVisitorSession;
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const channel = session.channel ? sourceLabel(session.channel) : '直接访问';
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{formatLastSeen(session.startedAt)}</span>
            <span className="text-muted-foreground text-xs">
              {formatDuration(session.durationMs)}
            </span>
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {session.pageCount} 页 · {channel}
          </div>
        </div>
      </button>
      {expanded ? (
        <ol className="border-t px-3 py-2">
          {session.views.map((v, i) => (
            <li key={`${v.path}-${v.createdAt}-${i}`} className="flex gap-3 py-1 text-xs">
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatClock(v.createdAt)}
              </span>
              <div className="min-w-0 flex-1">
                {v.title ? <div className="text-foreground truncate">{v.title}</div> : null}
                <div className="text-muted-foreground truncate font-mono">{v.path}</div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** 历史网络 / 地区：该访客跨 IP 汇总（按 ipHash 去重），反映「同一个人换了网络」。
    IP 明文展示（内部后台口径，无明文回退掩码）+ 点击复制。
    仅人物抽屉（按 visitorId）有此数据；IP 抽屉为 undefined，不渲染。 */
function NetworksSection({ networks }: { networks: AnalyticsVisitorNetwork[] }) {
  if (networks.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border p-3 text-xs">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 font-medium">
        <Network className="h-3.5 w-3.5" />
        历史网络 / 地区（{networks.length}）· 同一访客换 IP 不影响身份识别
      </div>
      <ul className="space-y-1.5">
        {networks.map((n, i) => (
          <li key={`${n.ip ?? n.ipMasked ?? 'ip'}-${i}`} className="flex items-center gap-2">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="text-foreground shrink-0">{n.region || '未知地区'}</span>
              <CopyableIp ip={n.ip} ipMasked={n.ipMasked} />
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">{n.pageViews} 页</span>
            <span className="text-muted-foreground shrink-0">{formatLastSeen(n.lastSeenAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 渠道归因（首触）：UTM 五参数 + Google Ads 点击 ID，默认折叠。
 * 仅当存在任一非空参数时渲染（直接访问型访客无归因参数，整块不渲染，避免一排 —）。
 */
function AttributionSection({
  attribution,
}: {
  attribution: NonNullable<AnalyticsVisitorActivity['attribution']>;
}) {
  const [open, setOpen] = useState(false);
  const rows: Array<{ label: string; value: string | null }> = [
    { label: 'UTM Source', value: attribution.utmSource },
    { label: 'UTM Medium', value: attribution.utmMedium },
    { label: 'UTM Campaign', value: attribution.utmCampaign },
    { label: 'UTM Content', value: attribution.utmContent },
    { label: 'UTM Term', value: attribution.utmTerm },
    { label: '广告点击 ID', value: attribution.gclid },
    { label: '百度点击 ID', value: attribution.bdVid },
  ];
  const present = rows.filter((r) => r.value);
  if (present.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted/40 flex w-full items-center gap-1.5 rounded-lg p-3 font-medium"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Megaphone className="h-3.5 w-3.5" />
        渠道归因（{present.length}）
      </button>
      {open ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t p-3">
          {present.map((r) => (
            <TechRow key={r.label} label={r.label} value={r.value} />
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * 浏览行为时间线（纯展示）：技术信息条 + 会话时间线（含加载骨架 / 空态）。
 * 入参仅 { data, isLoading }，取数由外层 hook 负责，保证两处抽屉观感一致。
 */
export function VisitorActivityTimeline({
  data,
  isLoading,
}: {
  data: AnalyticsVisitorActivity | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <Skeleton className="h-32 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (!data || data.sessions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <Activity className="text-muted-foreground/40 h-10 w-10" />
        <p className="text-muted-foreground text-sm">暂无浏览记录</p>
        <p className="text-muted-foreground/70 max-w-[280px] text-xs">
          仅展示新版本客户端埋点后采集的页面浏览数据
        </p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <TechInfoBar activity={data} />
      {data.attribution ? <AttributionSection attribution={data.attribution} /> : null}
      {data.networks ? <NetworksSection networks={data.networks} /> : null}
      <div className="mt-4 space-y-2">
        {data.sessions.map((s, i) => (
          <SessionItem key={s.sessionId} session={s} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
