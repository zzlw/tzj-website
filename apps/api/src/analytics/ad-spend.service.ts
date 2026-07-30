import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AdSpendListResponse, AdSpendRecord, AdSpendSummary } from '@tzj/types';
import { PrismaService } from '../prisma/prisma.service';
import type { AdSpendRecordDto } from './dto/ad-spend-record.dto';

/**
 * 广告花费台账（docs/ad-spend-ledger-design.md）：
 * 分平台分时段记账（手工录入 + 升级 2 百度 API 同步共用），
 * 查询区间按天数比例分摊聚合，供转化看板与灵犀共用同一口径。
 *
 * 时间口径（设计文档 §3）：periodStart/periodEnd 为日历日（DB @db.Date，UTC 零点存储），
 * 区间与天数运算统一在 YYYY-MM-DD 字符串归一化后进行，避免本地时区 Date 直接比较的 ±1 天误差。
 */

const MS_PER_DAY = 86_400_000;

/** DB @db.Date 值（UTC 零点）→ YYYY-MM-DD（必须用 UTC getter） */
function utcDateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → UTC 零点 Date（与 @db.Date 存储口径一致） */
function ymdToUtcDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** 服务器本地今天的 YYYY-MM-DD（「不得晚于今天」判定口径，与 parseRange 一致） */
function todayLocalYmd(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 两个日历日之间的天数（两端含；a <= b 时 >= 1） */
function daysInclusive(fromYmd: string, toYmd: string): number {
  return (
    Math.round((ymdToUtcDate(toYmd).getTime() - ymdToUtcDate(fromYmd).getTime()) / MS_PER_DAY) + 1
  );
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

@Injectable()
export class AdSpendService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────────────

  /** 列表：区间相交的记录（periodStart 倒序）+ 分摊聚合；from/to 缺省默认近 365 天 */
  async list(from?: string, to?: string): Promise<AdSpendListResponse> {
    const range = this.normalizeRange(from, to);
    const rows = await this.prisma.adSpendRecord.findMany({
      where: {
        periodStart: { lte: ymdToUtcDate(range.to) },
        periodEnd: { gte: ymdToUtcDate(range.from) },
      },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
    const summary = this.aggregate(rows, range.from, range.to);
    return { items: rows.map(mapRecord), ...summary };
  }

  async create(dto: AdSpendRecordDto, userId: string): Promise<AdSpendRecord> {
    this.validatePeriod(dto);
    await this.ensureNoOverlap(dto);
    const row = await this.prisma.adSpendRecord.create({
      data: {
        platform: dto.platform,
        periodStart: ymdToUtcDate(dto.periodStart),
        periodEnd: ymdToUtcDate(dto.periodEnd),
        spend: dto.spend,
        note: dto.note?.trim() || null,
        createdBy: userId,
      },
    });
    return mapRecord(row);
  }

  async update(id: string, dto: AdSpendRecordDto): Promise<AdSpendRecord> {
    const existing = await this.prisma.adSpendRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('台账记录不存在');
    this.validatePeriod(dto);
    await this.ensureNoOverlap(dto, id);
    const row = await this.prisma.adSpendRecord.update({
      where: { id },
      data: {
        platform: dto.platform,
        periodStart: ymdToUtcDate(dto.periodStart),
        periodEnd: ymdToUtcDate(dto.periodEnd),
        spend: dto.spend,
        note: dto.note?.trim() || null,
      },
    });
    return mapRecord(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    const existing = await this.prisma.adSpendRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('台账记录不存在');
    await this.prisma.adSpendRecord.delete({ where: { id } });
    return { id };
  }

  // ── 聚合（核心算法，设计文档 §4） ──────────────────────────────

  /**
   * 查询区间内按天数比例分摊的花费汇总。
   * 跨区间记录按均匀日花费近似分摊（v1 不做 source 去重，重叠已被 409 校验挡住）。
   */
  async sumAdSpend(fromYmd: string, toYmd: string): Promise<AdSpendSummary> {
    const rows = await this.prisma.adSpendRecord.findMany({
      where: {
        periodStart: { lte: ymdToUtcDate(toYmd) },
        periodEnd: { gte: ymdToUtcDate(fromYmd) },
      },
    });
    return this.aggregate(rows, fromYmd, toYmd);
  }

  private aggregate(rows: DbAdSpendRecord[], fromYmd: string, toYmd: string): AdSpendSummary {
    const byPlatform = new Map<string, number>();
    for (const row of rows) {
      const recStart = utcDateToYmd(row.periodStart);
      const recEnd = utcDateToYmd(row.periodEnd);
      // 重叠区间 = [max(起点), min(终点)]（字符串比较对 YYYY-MM-DD 成立）
      const overlapStart = recStart > fromYmd ? recStart : fromYmd;
      const overlapEnd = recEnd < toYmd ? recEnd : toYmd;
      if (overlapStart > overlapEnd) continue;
      const ratio = daysInclusive(overlapStart, overlapEnd) / daysInclusive(recStart, recEnd);
      byPlatform.set(row.platform, (byPlatform.get(row.platform) ?? 0) + Number(row.spend) * ratio);
    }
    const platforms = [...byPlatform.entries()]
      .map(([platform, spend]) => ({
        platform: platform as AdSpendRecord['platform'],
        spend: round2(spend),
      }))
      .sort((a, b) => b.spend - a.spend);
    return {
      byPlatform: platforms,
      total: round2(platforms.reduce((sum, p) => sum + p.spend, 0)),
    };
  }

  // ── 校验 ────────────────────────────────────────────────────────

  private validatePeriod(dto: AdSpendRecordDto): void {
    if (dto.periodEnd < dto.periodStart) {
      throw new BadRequestException('periodEnd 不得早于 periodStart');
    }
    if (dto.periodEnd > todayLocalYmd()) {
      throw new BadRequestException('periodEnd 不得晚于今天（不允许预录未来花费）');
    }
  }

  /** 同 platform + 同 source（manual）区间相交 → 409（编辑时排除自身） */
  private async ensureNoOverlap(dto: AdSpendRecordDto, excludeId?: string): Promise<void> {
    const conflict = await this.prisma.adSpendRecord.findFirst({
      where: {
        platform: dto.platform,
        source: 'manual',
        periodStart: { lte: ymdToUtcDate(dto.periodEnd) },
        periodEnd: { gte: ymdToUtcDate(dto.periodStart) },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (conflict) {
      throw new ConflictException(
        `与已有记录区间重叠：${conflict.platform} ${utcDateToYmd(conflict.periodStart)} ~ ${utcDateToYmd(conflict.periodEnd)}（¥${Number(conflict.spend)}）`,
      );
    }
  }

  private normalizeRange(from?: string, to?: string): { from: string; to: string } {
    const ymdRe = /^\d{4}-\d{2}-\d{2}$/;
    const today = todayLocalYmd();
    const toYmd = to && ymdRe.test(to) ? to : today;
    const fromYmd =
      from && ymdRe.test(from)
        ? from
        : utcDateToYmd(new Date(ymdToUtcDate(toYmd).getTime() - 364 * MS_PER_DAY));
    return fromYmd <= toYmd ? { from: fromYmd, to: toYmd } : { from: toYmd, to: fromYmd };
  }
}

/** Prisma 行结构（Decimal 以 unknown 承接，出口统一 Number 转换） */
interface DbAdSpendRecord {
  id: string;
  platform: string;
  periodStart: Date;
  periodEnd: Date;
  spend: unknown;
  source: string;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** DB 行 → 共享类型（Decimal → number；日期 → YYYY-MM-DD） */
function mapRecord(row: DbAdSpendRecord): AdSpendRecord {
  return {
    id: row.id,
    platform: row.platform as AdSpendRecord['platform'],
    periodStart: utcDateToYmd(row.periodStart),
    periodEnd: utcDateToYmd(row.periodEnd),
    spend: Number(row.spend),
    source: row.source as AdSpendRecord['source'],
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
