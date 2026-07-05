import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BlockIpDuration, BlockedIpItem, CreateBlockedIpDto } from "@tzj/types";
import { paginateMeta } from "../analytics/utils/analytics-list";
import { PrismaService } from "../prisma/prisma.service";
import { hashIp, isValidIp, maskIp, normalizeIp } from "../common/utils/client-ip";

const CACHE_TTL_MS = 60_000;

const DURATION_MS: Record<Exclude<BlockIpDuration, "permanent">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function resolveExpiresAt(duration: BlockIpDuration): Date | null {
  if (duration === "permanent") return null;
  return new Date(Date.now() + DURATION_MS[duration]);
}

@Injectable()
export class IpBanService implements OnModuleInit {
  private cache = new Set<string>();
  private cacheLoadedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.refreshCache(true);
  }

  private getSalt(): string {
    return this.config.get<string>("ANALYTICS_IP_SALT") ?? "tzj-analytics-default";
  }

  hashIp(ip: string): string {
    return hashIp(normalizeIp(ip), this.getSalt());
  }

  async isBlocked(ip: string | undefined): Promise<boolean> {
    if (!ip?.trim()) return false;
    const ipHash = this.hashIp(ip);
    await this.refreshCache();
    if (!this.cache.has(ipHash)) return false;

    const row = await this.prisma.blockedIp.findUnique({ where: { ipHash } });
    if (!row) {
      this.cache.delete(ipHash);
      return false;
    }
    if (row.expiresAt && row.expiresAt <= new Date()) {
      await this.removeExpired(row.id, ipHash);
      return false;
    }
    return true;
  }

  async listBlocked(page = 1, limit = 10) {
    await this.purgeExpired();
    const skip = (page - 1) * limit;
    const [total, rows] = await Promise.all([
      this.prisma.blockedIp.count(),
      this.prisma.blockedIp.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, username: true, nickname: true } },
        },
      }),
    ]);
    return {
      data: rows.map((row) => this.toItem(row)),
      pagination: paginateMeta(page, limit, total),
    };
  }

  async blockIp(dto: CreateBlockedIpDto, createdById?: string): Promise<BlockedIpItem> {
    const ip = normalizeIp(dto.ip);
    if (!isValidIp(ip)) {
      throw new BadRequestException("请输入有效的 IPv4 或 IPv6 地址");
    }

    const ipHash = this.hashIp(ip);
    const existing = await this.prisma.blockedIp.findUnique({ where: { ipHash } });
    if (existing) {
      throw new ConflictException("该 IP 已在封禁列表中");
    }

    const duration = dto.duration ?? "permanent";
    const row = await this.prisma.blockedIp.create({
      data: {
        ipHash,
        ipMasked: maskIp(ip),
        reason: dto.reason?.trim() || null,
        expiresAt: resolveExpiresAt(duration),
        createdById: createdById ?? null,
      },
      include: {
        createdBy: { select: { id: true, username: true, nickname: true } },
      },
    });

    this.cache.add(ipHash);
    return this.toItem(row);
  }

  async unblock(id: string): Promise<void> {
    const row = await this.prisma.blockedIp.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("封禁记录不存在");

    await this.prisma.blockedIp.delete({ where: { id } });
    this.cache.delete(row.ipHash);
  }

  private async refreshCache(force = false) {
    if (!force && Date.now() - this.cacheLoadedAt < CACHE_TTL_MS) return;
    await this.purgeExpired();
    const now = new Date();
    const rows = await this.prisma.blockedIp.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { ipHash: true },
    });
    this.cache = new Set(rows.map((row) => row.ipHash));
    this.cacheLoadedAt = Date.now();
  }

  private async purgeExpired() {
    const now = new Date();
    const expired = await this.prisma.blockedIp.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, ipHash: true },
    });
    if (expired.length === 0) return;
    await this.prisma.blockedIp.deleteMany({
      where: { id: { in: expired.map((row) => row.id) } },
    });
    for (const row of expired) {
      this.cache.delete(row.ipHash);
    }
  }

  private async removeExpired(id: string, ipHash: string) {
    await this.prisma.blockedIp.delete({ where: { id } }).catch(() => undefined);
    this.cache.delete(ipHash);
  }

  private toItem(row: {
    id: string;
    ipHash: string;
    ipMasked: string;
    reason: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    createdBy: { id: string; username: string; nickname: string | null } | null;
  }): BlockedIpItem {
    return {
      id: row.id,
      ipMasked: row.ipMasked,
      reason: row.reason,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      isPermanent: row.expiresAt == null,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            username: row.createdBy.username,
            nickname: row.createdBy.nickname,
          }
        : null,
    };
  }
}
