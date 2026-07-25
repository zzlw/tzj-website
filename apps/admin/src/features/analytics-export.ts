/**
 * 访客中心「导出 CSV」：面向第三方 AI 的流量 / 广告投放分析，
 * 仅导出聚合与环境维度，严格排除 PII（visitorId / 姓名 / 邮箱 / 电话 / 公司 / 精确 IP 等）。
 * 纯前端 Blob 实现（项目无 CSV 依赖库），UTF-8 BOM 头保证 Excel 打开中文不乱码。
 */
import type { AnalyticsVisitorDetailRow, AnalyticsVisitorRow } from './analytics';
import { deviceLabel, sourceLabel } from './analytics';

/** CSV 列定义：表头文案 + 从行提取「脱敏值」的取值函数。 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** 单元格转义：含逗号 / 引号 / 换行时用双引号包裹并转义内部引号；布尔归一为 是/否。 */
function escapeCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? '是' : '否';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** 拼装 CSV 文本（表头 + 数据行，CRLF 行分隔以兼容 Excel）。 */
function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(',')).join('\r\n');
  return body ? `${head}\r\n${body}` : head;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 文件名时间戳：YYYYMMDD_HHmmss（本地时区）。 */
function timestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

/** 触发浏览器下载：UTF-8 BOM + 时间戳文件名。 */
export function downloadCsv<T>(filenamePrefix: string, rows: T[], columns: CsvColumn<T>[]): void {
  const blob = new Blob(['\ufeff', toCsv(rows, columns)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${timestamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** ISO 时间转本地可读串（供 CSV 单元格；空值归一为空串）。 */
function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN');
}

/**
 * 「按访客」lens 脱敏白名单列。
 * 排除：visitorId / name / email / phone / company / lastIp（及其脱敏 / hash）等 PII，
 * 仅保留时间、渠道、入口、设备、地区（到城市级）与聚合指标。
 */
export const PEOPLE_EXPORT_COLUMNS: CsvColumn<AnalyticsVisitorRow>[] = [
  { header: '最近活跃', value: (r) => isoToLocal(r.lastSeenAt) },
  { header: '首次访问', value: (r) => isoToLocal(r.firstSeenAt) },
  { header: '是否识别', value: (r) => r.identified },
  { header: '来源渠道', value: (r) => (r.channel ? sourceLabel(r.channel) : '') },
  { header: '引荐域名', value: (r) => r.referrerHost ?? '' },
  { header: '入口页', value: (r) => r.landingPath },
  { header: '设备类型', value: (r) => deviceLabel(r.deviceType) },
  { header: '浏览器', value: (r) => r.browser ?? '' },
  { header: '操作系统', value: (r) => r.os ?? '' },
  { header: '国家', value: (r) => r.country },
  { header: '地区', value: (r) => r.region ?? '' },
  { header: '城市', value: (r) => r.city ?? '' },
  { header: '页面浏览量', value: (r) => r.pageViews },
  { header: '访问次数', value: (r) => r.sessions },
  { header: '触达联系页', value: (r) => Boolean(r.touchedContact) },
  { header: '触达案例页', value: (r) => Boolean(r.touchedCase) },
];

/**
 * 「按 IP」lens 脱敏白名单列。
 * 排除：精确 IP（ip）与脱敏 IP（ipMasked），仅保留地区 / 运营商 / 渠道等网络与聚合维度，
 * 供流量质量与广告投放分析（不含可回溯到具体网络地址的 IP）。
 */
export const IP_EXPORT_COLUMNS: CsvColumn<AnalyticsVisitorDetailRow>[] = [
  { header: '最近访问', value: (r) => isoToLocal(r.lastSeenAt) },
  { header: '首次访问', value: (r) => isoToLocal(r.firstSeenAt) },
  { header: '地区', value: (r) => r.region },
  { header: '运营商', value: (r) => r.isp ?? '' },
  { header: '定位依据', value: (r) => r.geoSource },
  { header: '来源渠道', value: (r) => (r.channel ? sourceLabel(r.channel) : '') },
  { header: '来源', value: (r) => r.source ?? '' },
  { header: '媒介', value: (r) => r.medium ?? '' },
  { header: '引荐域名', value: (r) => r.referrerHost },
  { header: '设备类型', value: (r) => (r.deviceType ? deviceLabel(r.deviceType) : '') },
  { header: '浏览器', value: (r) => r.browser ?? '' },
  { header: '操作系统', value: (r) => r.os ?? '' },
  { header: '落地页', value: (r) => r.landingPath ?? '' },
  { header: '页面浏览量', value: (r) => r.pageViews },
  { header: '会话数', value: (r) => r.sessions },
];
