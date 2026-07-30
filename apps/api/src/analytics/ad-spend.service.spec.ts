import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { AdSpendService } from './ad-spend.service';
import type { AdSpendRecordDto } from './dto/ad-spend-record.dto';

/**
 * 广告花费台账分摊算法回归（docs/ad-spend-ledger-design.md §4/§10 步骤 1b）：
 * - 分摊聚合：完全包含 / 部分重叠 / 仅相切一天 / 不相交 / 单日记录 / 跨月含闰月 / 多平台汇总；
 * - 时间口径：@db.Date（UTC 零点）→ YYYY-MM-DD 归一化，验 ±1 天陷阱；
 * - 重叠校验：同平台区间相交 409（命中 / 首尾相接擦边）。
 */

interface FakeRow {
  id: string;
  platform: string;
  periodStart: Date;
  periodEnd: Date;
  spend: number;
  source: string;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** YYYY-MM-DD → UTC 零点 Date（模拟 Prisma @db.Date 读出值） */
function d(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

let seq = 0;
function row(platform: string, start: string, end: string, spend: number): FakeRow {
  seq += 1;
  return {
    id: `r${seq}`,
    platform,
    periodStart: d(start),
    periodEnd: d(end),
    spend,
    source: 'manual',
    note: null,
    createdBy: 'u1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

/** 复刻 Prisma where 语义的内存版 adSpendRecord（仅覆盖本服务用到的查询形态） */
function buildFakePrisma(rows: FakeRow[]) {
  type Where = {
    platform?: string;
    source?: string;
    id?: { not: string };
    periodStart?: { lte: Date };
    periodEnd?: { gte: Date };
  };
  const match = (r: FakeRow, where: Where): boolean =>
    (where.platform === undefined || r.platform === where.platform) &&
    (where.source === undefined || r.source === where.source) &&
    (where.id === undefined || r.id !== where.id.not) &&
    (where.periodStart === undefined ||
      r.periodStart.getTime() <= where.periodStart.lte.getTime()) &&
    (where.periodEnd === undefined || r.periodEnd.getTime() >= where.periodEnd.gte.getTime());

  const prisma = {
    adSpendRecord: {
      findMany: async ({ where }: { where: Where }) => rows.filter((r) => match(r, where)),
      findFirst: async ({ where }: { where: Where }) => rows.find((r) => match(r, where)) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        rows.find((r) => r.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = { ...row('x', '2026-01-01', '2026-01-01', 0), ...data } as FakeRow;
        rows.push(created);
        return created;
      },
    },
  };
  return prisma as unknown as PrismaService;
}

function service(rows: FakeRow[]): AdSpendService {
  return new AdSpendService(buildFakePrisma(rows));
}

describe('AdSpendService.sumAdSpend 分摊聚合', () => {
  it('记录完全落在查询区间内 → 全额计入', async () => {
    const svc = service([row('baidu', '2026-06-01', '2026-06-30', 3000)]);
    const sum = await svc.sumAdSpend('2026-06-01', '2026-06-30');
    expect(sum.total).toBe(3000);
    expect(sum.byPlatform).toEqual([{ platform: 'baidu', spend: 3000 }]);
  });

  it('部分重叠 → 按重叠天数比例分摊', async () => {
    // 6 月整月 3000 元（30 天），查询 6/16~6/30（15 天）→ 1500
    const svc = service([row('baidu', '2026-06-01', '2026-06-30', 3000)]);
    const sum = await svc.sumAdSpend('2026-06-16', '2026-06-30');
    expect(sum.total).toBe(1500);
  });

  it('仅相切一天 → 计 1/n', async () => {
    // 6 月整月 3000 元，查询区间只含 6/30 一天 → 3000/30 = 100
    const svc = service([row('baidu', '2026-06-01', '2026-06-30', 3000)]);
    const sum = await svc.sumAdSpend('2026-06-30', '2026-07-15');
    expect(sum.total).toBe(100);
  });

  it('区间不相交 → 不计入（首尾相邻但不重叠也不计）', async () => {
    const svc = service([row('baidu', '2026-06-01', '2026-06-30', 3000)]);
    const sum = await svc.sumAdSpend('2026-07-01', '2026-07-31');
    expect(sum.total).toBe(0);
    expect(sum.byPlatform).toEqual([]);
  });

  it('单日记录：在区间内全额计入，区间外为 0', async () => {
    const svc = service([row('wechat', '2026-06-15', '2026-06-15', 88.88)]);
    expect((await svc.sumAdSpend('2026-06-01', '2026-06-30')).total).toBe(88.88);
    expect((await svc.sumAdSpend('2026-06-16', '2026-06-30')).total).toBe(0);
  });

  it('跨月含闰月：2024-02（29 天）按真实日历天数分摊', async () => {
    // 2/1~3/1 共 30 天花 3000（日均 100），查询 2 月 29 天 → 2900
    const svc = service([row('google', '2024-02-01', '2024-03-01', 3000)]);
    const sum = await svc.sumAdSpend('2024-02-01', '2024-02-29');
    expect(sum.total).toBe(2900);
  });

  it('多平台汇总：byPlatform 按花费倒序，total 为各平台之和', async () => {
    const svc = service([
      row('wechat', '2026-06-01', '2026-06-30', 800),
      row('baidu', '2026-06-01', '2026-06-30', 3200),
    ]);
    const sum = await svc.sumAdSpend('2026-06-01', '2026-06-30');
    expect(sum.byPlatform).toEqual([
      { platform: 'baidu', spend: 3200 },
      { platform: 'wechat', spend: 800 },
    ]);
    expect(sum.total).toBe(4000);
  });

  it('YMD 归一化：UTC 零点 Date 不产生 ±1 天误差（东八区陷阱）', async () => {
    // @db.Date 读出 2026-06-01T00:00:00Z，若用本地 getter 归一化会在西半球时区回退成 05-31。
    // 单日记录相切查询区间首日：天数比例应精确为 1/1，而非因 ±1 天漂移变 0 或跨 2 天。
    const svc = service([row('baidu', '2026-06-01', '2026-06-01', 100)]);
    const sum = await svc.sumAdSpend('2026-06-01', '2026-06-01');
    expect(sum.total).toBe(100);
  });
});

describe('AdSpendService 重叠校验与区间合法性', () => {
  const dto = (platform: string, start: string, end: string): AdSpendRecordDto =>
    ({ platform, periodStart: start, periodEnd: end, spend: 100 }) as AdSpendRecordDto;

  it('同平台区间相交 → ConflictException（409）', async () => {
    const svc = service([row('baidu', '2026-06-01', '2026-06-30', 3000)]);
    await expect(svc.create(dto('baidu', '2026-06-15', '2026-07-15'), 'u1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('擦边：首尾相接（前一段 end + 1 天开始）不算重叠，可创建', async () => {
    const svc = service([row('baidu', '2026-06-01', '2026-06-30', 3000)]);
    const created = await svc.create(dto('baidu', '2026-07-01', '2026-07-05'), 'u1');
    expect(created.periodStart).toBe('2026-07-01');
  });

  it('擦边：与已有记录共享同一天（end 日重合）→ 409', async () => {
    const svc = service([row('baidu', '2026-06-01', '2026-06-30', 3000)]);
    await expect(svc.create(dto('baidu', '2026-06-30', '2026-07-05'), 'u1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('不同平台同区间不冲突', async () => {
    const svc = service([row('baidu', '2026-06-01', '2026-06-30', 3000)]);
    await expect(svc.create(dto('wechat', '2026-06-01', '2026-06-30'), 'u1')).resolves.toBeTruthy();
  });

  it('periodEnd 早于 periodStart → BadRequestException', async () => {
    const svc = service([]);
    await expect(svc.create(dto('baidu', '2026-06-30', '2026-06-01'), 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('periodEnd 晚于今天 → BadRequestException（不允许预录未来花费）', async () => {
    const svc = service([]);
    const future = new Date(Date.now() + 3 * 86_400_000);
    const ymd = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    await expect(svc.create(dto('baidu', ymd, ymd), 'u1')).rejects.toThrow(BadRequestException);
  });
});
