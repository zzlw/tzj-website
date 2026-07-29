import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_HOURS, isWithinBusinessHours } from '../business-hours';

// 2026-07-29 为周三；Asia/Shanghai = UTC+8
const WEDNESDAY_10AM_CST = new Date('2026-07-29T02:00:00Z'); // 10:00 上海
const WEDNESDAY_8PM_CST = new Date('2026-07-29T12:00:00Z'); // 20:00 上海
const SATURDAY_10AM_CST = new Date('2026-08-01T02:00:00Z'); // 周六 10:00 上海

describe('isWithinBusinessHours', () => {
  it('enabled=false 时不判定，始终视为在线', () => {
    expect(
      isWithinBusinessHours({ ...DEFAULT_BUSINESS_HOURS, enabled: false }, SATURDAY_10AM_CST),
    ).toBe(true);
  });

  it('工作日工作时段内为 true', () => {
    expect(isWithinBusinessHours(DEFAULT_BUSINESS_HOURS, WEDNESDAY_10AM_CST)).toBe(true);
  });

  it('工作日下班后为 false（endHour 为开区间）', () => {
    expect(isWithinBusinessHours(DEFAULT_BUSINESS_HOURS, WEDNESDAY_8PM_CST)).toBe(false);
  });

  it('非工作日（周六）为 false', () => {
    expect(isWithinBusinessHours(DEFAULT_BUSINESS_HOURS, SATURDAY_10AM_CST)).toBe(false);
  });

  it('命中节假日（MM-DD）为 false', () => {
    expect(
      isWithinBusinessHours({ ...DEFAULT_BUSINESS_HOURS, holidays: ['07-29'] }, WEDNESDAY_10AM_CST),
    ).toBe(false);
  });

  it('按业务时区判定（同一 UTC 时刻在不同时区结果不同）', () => {
    // 2026-07-29T12:00Z 在纽约（UTC-4，夏令时）为 08:00 → 未到 9 点开工
    expect(
      isWithinBusinessHours(
        { ...DEFAULT_BUSINESS_HOURS, timezone: 'America/New_York' },
        WEDNESDAY_8PM_CST,
      ),
    ).toBe(false);
    // 同一时刻伦敦（UTC+1）为 13:00 → 工作时段内
    expect(
      isWithinBusinessHours(
        { ...DEFAULT_BUSINESS_HOURS, timezone: 'Europe/London' },
        WEDNESDAY_8PM_CST,
      ),
    ).toBe(true);
  });
});
