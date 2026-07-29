import type { BusinessHours } from '@tzj/types';

// 客服工作时间兜底默认值（后端未下发 businessHours 时使用）
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  enabled: true,
  timezone: 'Asia/Shanghai',
  weekdays: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 18,
  holidays: [],
};

// 依据站点设置的工作时间，判断当前是否处于客服在线时段（按业务时区）。
// 作为 presence 兜底层：后端未推送离线时，非工作时间前端自动判定离线。
//  - enabled=false → 不判定，始终视为在线
//  - 命中节假日（MM-DD）或非工作日 → 视为非工作时间（离线）
export function isWithinBusinessHours(
  cfg: BusinessHours = DEFAULT_BUSINESS_HOURS,
  now: Date = new Date(),
): boolean {
  if (!cfg.enabled) return true;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: cfg.timezone,
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = dayMap[get('weekday')] ?? 0;
  if (!cfg.weekdays.includes(day)) return false;
  const mmdd = `${get('month')}-${get('day')}`;
  if (cfg.holidays.includes(mmdd)) return false;
  const hour = Number(get('hour').replace(/\D/g, '')) || 0;
  return hour >= cfg.startHour && hour < cfg.endHour;
}
