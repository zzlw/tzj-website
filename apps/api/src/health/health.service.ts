import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DependencyStatus } from '@tzj/types';
import { IntegrationsService } from '../integrations/integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';

export interface HealthProbeResult {
  status: 'healthy' | 'degraded' | 'down';
  checks: Record<string, DependencyStatus | Record<string, unknown>>;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
    private readonly integrations: IntegrationsService,
  ) {}

  live(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  async ready(): Promise<HealthProbeResult> {
    const [database, storage, redis, email] = await Promise.all([
      this.checkDatabase(),
      this.checkStorage(),
      this.checkRedis(),
      this.checkEmail(),
    ]);

    const checks = { database, storage, redis, email };
    const values = Object.values(checks);
    const status = values.every((v) => v === 'up' || v === 'skipped')
      ? 'healthy'
      : values.some((v) => v === 'up' || v === 'skipped')
        ? 'degraded'
        : 'down';

    return { status, checks };
  }

  async check(): Promise<HealthProbeResult & { uptime: number; memory: Record<string, string> }> {
    const ready = await this.ready();
    const mem = process.memoryUsage();
    return {
      ...ready,
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heap: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      },
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkStorage(): Promise<DependencyStatus> {
    try {
      const ok = await this.s3.ping();
      return ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) return 'skipped';
    // Redis 已在 compose 中预留，业务层尚未接入；标记为 skipped 避免误报
    return 'skipped';
  }

  private async checkEmail(): Promise<DependencyStatus> {
    try {
      const active = await this.integrations.isActive('aliyun-directmail');
      return active ? 'up' : 'skipped';
    } catch {
      return 'degraded';
    }
  }
}
