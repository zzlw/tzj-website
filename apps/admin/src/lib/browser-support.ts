/**
 * 浏览器兼容性分级（供访客中心表格「兼容性」列与日后统计分析复用）。
 *
 * 口径来源：与 web 端 `apps/web/public/browser-support.js` 的运行时特性探针保持一致。
 * 该探针勾选站点所需的现代 JS 能力（Promise.allSettled / Object.fromEntries /
 * globalThis / String.prototype.replaceAll / IntersectionObserver，≈ES2020 基线），
 * 其中最严门槛为 `String.prototype.replaceAll`，对应下列各浏览器的最低大版本。
 *
 * ⚠️ 修改本表时，请同步 web 端探针，避免「前台升级横幅」与「后台兼容性统计」口径漂移。
 *
 * 说明：这里用「版本阈值」而非「特性检测」，因为后台只能对历史采集的
 * browser + browserVersion 做离线判定（无法回溯运行时探测）——这也是 GA4 / Matomo /
 * browserslist 等业内工具对历史流量做兼容性归类的通用做法。
 */

export type BrowserSupportStatus = 'supported' | 'unsupported' | 'unknown';

export interface BrowserSupportResult {
  status: BrowserSupportStatus;
  /** 判定依据（用于列标签的 title 悬浮说明，便于人工核对/统计溯源） */
  reason: string;
}

/** 纳入支持基线的主流浏览器 key。 */
type SupportedBrowserKey = 'chrome' | 'edge' | 'firefox' | 'safari' | 'opera' | 'samsung';

/** 各主流浏览器满足 ES2020 基线的最低大版本（Safari 取 13.1，故用小数阈值）。 */
const MIN_SUPPORTED_VERSION: Record<SupportedBrowserKey, number> = {
  chrome: 85,
  edge: 85,
  firefox: 77,
  safari: 13.1,
  opera: 71,
  samsung: 14,
};

/**
 * 将 ua-parser-js 解析出的浏览器名归一到支持基线的 key。
 * 返回 'ie' 表示 IE（一律判定不支持）；返回 null 表示未纳入基线（内嵌/小众浏览器）。
 */
function normalizeBrowserKey(name: string): SupportedBrowserKey | 'ie' | null {
  const n = name.toLowerCase();
  if (n.includes('internet explorer') || n === 'ie' || n.includes('iemobile')) return 'ie';
  if (n.includes('edg')) return 'edge';
  if (n.includes('samsung')) return 'samsung';
  if (n.includes('opera') || n.includes('opr')) return 'opera';
  if (n.includes('firefox')) return 'firefox';
  if (n.includes('chrome') || n.includes('chromium')) return 'chrome';
  if (n.includes('safari')) return 'safari';
  return null;
}

/**
 * 取版本串的「大版本.小版本」浮点（如 "120.0.0.0" → 120，"13.1" → 13.1），
 * 便于与 Safari 13.1 这类带小版本的阈值比较。无法解析返回 null。
 */
function parseVersion(version: string | null | undefined): number | null {
  if (!version) return null;
  const m = version.match(/^(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = m[2] ? Number(m[2]) : 0;
  const parsed = Number(`${major}.${minor}`);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 依据浏览器名与版本判定站点兼容性。
 * - supported：版本达到该浏览器的 ES2020 基线；
 * - unsupported：IE，或版本低于基线（这些访客在前台会看到升级横幅）；
 * - unknown：浏览器信息/版本缺失，或未纳入基线的内嵌/小众浏览器（不武断判负）。
 */
export function classifyBrowserSupport(
  browser: string | null | undefined,
  version: string | null | undefined,
): BrowserSupportResult {
  if (!browser) return { status: 'unknown', reason: '浏览器信息缺失' };

  const key = normalizeBrowserKey(browser);
  if (key === 'ie') {
    return { status: 'unsupported', reason: 'Internet Explorer 不支持现代 Web 标准' };
  }
  if (!key) {
    return { status: 'unknown', reason: `${browser}：未纳入支持基线（多为内嵌/小众浏览器）` };
  }

  const parsed = parseVersion(version);
  if (parsed == null) {
    return { status: 'unknown', reason: `${browser}：版本信息缺失，无法判定` };
  }

  const min = MIN_SUPPORTED_VERSION[key];
  if (parsed >= min) {
    return { status: 'supported', reason: `${browser} ${version} ≥ 最低支持版本 ${min}` };
  }
  return { status: 'unsupported', reason: `${browser} ${version} < 最低支持版本 ${min}` };
}

/** 兼容性状态的中文标签（列展示 / 统计分组共用）。 */
export const BROWSER_SUPPORT_LABELS: Record<BrowserSupportStatus, string> = {
  supported: '支持',
  unsupported: '不支持',
  unknown: '未知',
};
