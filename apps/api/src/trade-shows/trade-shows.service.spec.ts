import { NotFoundException } from '@nestjs/common';
import { ContentStatus } from '../common/enums/content-status.enum';
import type { PrismaService } from '../prisma/prisma.service';
import { TradeShowsService } from './trade-shows.service';

/**
 * 营销弹窗活动回归（docs/activity-system-design.md §4/§9）：
 * - findActiveMarketing：isMarketing + 已发布 + 时间窗过滤、sortOrder 优先、
 *   publishedAt nulls last、take 1、字段白名单（不泄露 location/计数/审计）；
 * - 30s 内存缓存命中与 remove 后失效；
 * - recordPopupEvent：updateMany 原子「校验 + 计数」，窗口外/未发布/非营销一律 404 且不计数。
 */

interface FakeRow {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  coverImage: string | null;
  popupImage: string | null;
  location: string | null;
  boothNumber: string | null;
  eventType: string;
  isMarketing: boolean;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  sortOrder: number;
  publishedAt: Date | null;
  triggerMode: string;
  delaySeconds: number;
  frequency: string;
  excludePages: string[];
  targetDevice: string;
  ctaText: string;
  externalUrl: string | null;
  viewCount: number;
  popupViewCount: number;
  popupClickCount: number;
}

let seq = 0;
function row(overrides: Partial<FakeRow>): FakeRow {
  seq += 1;
  return {
    id: `t${seq}`,
    slug: `show-${seq}`,
    title: `活动${seq}`,
    content: '正文',
    coverImage: null,
    popupImage: null,
    location: '郑州国际会展中心',
    boothNumber: 'A101',
    eventType: 'promotion',
    isMarketing: true,
    status: ContentStatus.PUBLISHED,
    startDate: null,
    endDate: null,
    sortOrder: 0,
    publishedAt: new Date('2026-07-01T00:00:00Z'),
    triggerMode: 'delay',
    delaySeconds: 3,
    frequency: 'daily',
    excludePages: [],
    targetDevice: 'all',
    ctaText: '了解详情',
    externalUrl: null,
    viewCount: 0,
    popupViewCount: 0,
    popupClickCount: 0,
    ...overrides,
  };
}

/** 复刻 Prisma where 语义的内存版 tradeShow（仅覆盖营销活动查询/计数用到的形态） */
type MarketingWhere = {
  id?: string;
  isMarketing?: boolean;
  status?: string;
  OR?: { startDate?: null | { lte: Date } }[];
  AND?: { OR: { endDate?: null | { gte: Date } }[] }[];
};

function matchWindow(r: FakeRow, where: MarketingWhere): boolean {
  if (where.id !== undefined && r.id !== where.id) return false;
  if (where.isMarketing !== undefined && r.isMarketing !== where.isMarketing) return false;
  if (where.status !== undefined && r.status !== where.status) return false;
  if (where.OR) {
    const ok = where.OR.some((c) =>
      c.startDate === null
        ? r.startDate === null
        : r.startDate !== null && c.startDate && r.startDate.getTime() <= c.startDate.lte.getTime(),
    );
    if (!ok) return false;
  }
  for (const and of where.AND ?? []) {
    const ok = and.OR.some((c) =>
      c.endDate === null
        ? r.endDate === null
        : r.endDate !== null && c.endDate && r.endDate.getTime() >= c.endDate.gte.getTime(),
    );
    if (!ok) return false;
  }
  return true;
}

function buildFakePrisma(rows: FakeRow[]) {
  const calls = { findMany: 0 };
  const prisma = {
    tradeShow: {
      findMany: async ({
        where,
        orderBy: _orderBy,
        take,
        select,
      }: {
        where: MarketingWhere;
        orderBy: unknown;
        take: number;
        select: Record<string, true>;
      }) => {
        calls.findMany += 1;
        const sorted = rows
          .filter((r) => matchWindow(r, where))
          .sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
            // publishedAt desc nulls last
            if (a.publishedAt === null) return b.publishedAt === null ? 0 : 1;
            if (b.publishedAt === null) return -1;
            return b.publishedAt.getTime() - a.publishedAt.getTime();
          })
          .slice(0, take);
        return sorted.map((r) =>
          Object.fromEntries(Object.keys(select).map((k) => [k, r[k as keyof FakeRow]])),
        );
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: MarketingWhere;
        data: { popupViewCount?: { increment: number }; popupClickCount?: { increment: number } };
      }) => {
        const hits = rows.filter((r) => matchWindow(r, where));
        for (const r of hits) {
          if (data.popupViewCount) r.popupViewCount += data.popupViewCount.increment;
          if (data.popupClickCount) r.popupClickCount += data.popupClickCount.increment;
        }
        return { count: hits.length };
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        rows.find((r) => r.id === where.id) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        return rows.splice(idx, 1)[0];
      },
    },
  };
  return { prisma: prisma as unknown as PrismaService, calls };
}

function build(rows: FakeRow[]) {
  const { prisma, calls } = buildFakePrisma(rows);
  return { service: new TradeShowsService(prisma), calls, rows };
}

describe('TradeShowsService 营销弹窗', () => {
  const past = new Date(Date.now() - 86_400_000);
  const future = new Date(Date.now() + 86_400_000);

  describe('findActiveMarketing', () => {
    it('过滤非营销/未发布/窗口外，仅返回生效活动', async () => {
      const active = row({ startDate: past, endDate: future });
      const { service } = build([
        row({ isMarketing: false }),
        row({ status: ContentStatus.DRAFT }),
        row({ startDate: future }), // 未开始
        row({ endDate: past }), // 已结束
        active,
      ]);
      const data = (await service.findActiveMarketing()) as { id: string }[];
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(active.id);
    });

    it('startDate/endDate 均为 null 视作长期有效', async () => {
      const { service } = build([row({})]);
      expect(await service.findActiveMarketing()).toHaveLength(1);
    });

    it('多候选取 sortOrder 最高且最多 1 条；publishedAt null 排最后', async () => {
      const top = row({ sortOrder: 5 });
      const { service } = build([
        row({ sortOrder: 5, publishedAt: null }), // 同权重但 null 排 top 之后
        row({ sortOrder: 1 }),
        top,
      ]);
      const data = (await service.findActiveMarketing()) as { id: string }[];
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(top.id);
    });

    it('返回字段严格等于公开白名单（不泄露 location/计数/审计）', async () => {
      const { service } = build([row({})]);
      const [item] = (await service.findActiveMarketing()) as Record<string, unknown>[];
      expect(Object.keys(item).sort()).toEqual(
        [
          'id',
          'title',
          'slug',
          'content',
          'coverImage',
          'popupImage',
          'popupContent',
          'eventType',
          'triggerMode',
          'delaySeconds',
          'frequency',
          'excludePages',
          'targetDevice',
          'ctaText',
          'externalUrl',
        ].sort(),
      );
    });

    it('30s 内二次调用命中缓存不再查库；remove 后缓存失效', async () => {
      const a = row({});
      const b = row({});
      const { service, calls } = build([a, b]);
      await service.findActiveMarketing();
      await service.findActiveMarketing();
      expect(calls.findMany).toBe(1);

      await service.remove(a.id);
      const data = (await service.findActiveMarketing()) as { id: string }[];
      expect(calls.findMany).toBe(2);
      expect(data[0].id).toBe(b.id);
    });
  });

  describe('recordPopupEvent', () => {
    it('view/click 分别累加对应计数', async () => {
      const a = row({ startDate: past, endDate: future });
      const { service } = build([a]);
      await service.recordPopupEvent(a.id, 'view');
      await service.recordPopupEvent(a.id, 'view');
      await service.recordPopupEvent(a.id, 'click');
      expect(a.popupViewCount).toBe(2);
      expect(a.popupClickCount).toBe(1);
    });

    it.each([
      ['不存在', row({}), 'nonexistent'],
      ['窗口已过期', row({ endDate: past }), undefined],
      ['未发布', row({ status: ContentStatus.DRAFT }), undefined],
      ['非营销活动', row({ isMarketing: false }), undefined],
    ] as const)('%s 时抛 404 且不计数', async (_name, r, idOverride) => {
      const { service } = build([r]);
      await expect(service.recordPopupEvent(idOverride ?? r.id, 'view')).rejects.toThrow(
        NotFoundException,
      );
      expect(r.popupViewCount).toBe(0);
    });
  });
});
