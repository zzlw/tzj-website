import { readFileSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SystemStatusResponse } from '@tzj/types';
import { HealthService } from '../health/health.service';

@Injectable()
export class SystemService {
  constructor(
    private readonly healthService: HealthService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(): Promise<SystemStatusResponse> {
    const ready = await this.healthService.ready();
    const mem = process.memoryUsage();
    const load = os.loadavg();
    const disk = await this.readDiskUsage(process.cwd());

    const depValues = Object.values(ready.checks);
    const status = depValues.every((v) => v === 'up' || v === 'skipped')
      ? 'healthy'
      : depValues.some((v) => v === 'up' || v === 'skipped')
        ? 'degraded'
        : 'down';

    return {
      status,
      version: this.readVersion(),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      process: {
        nodeVersion: process.version,
        pid: process.pid,
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        },
        cpu: {
          loadAvg1m: round(load[0] ?? 0),
          loadAvg5m: round(load[1] ?? 0),
          loadAvg15m: round(load[2] ?? 0),
        },
      },
      disk,
      dependencies: {
        database: ready.checks.database as SystemStatusResponse['dependencies']['database'],
        storage: ready.checks.storage as SystemStatusResponse['dependencies']['storage'],
        email: ready.checks.email as SystemStatusResponse['dependencies']['email'],
      },
    };
  }

  private readVersion(): string {
    const fromEnv = this.config.get<string>('APP_VERSION')?.trim();
    if (fromEnv) return fromEnv;
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
        version?: string;
      };
      return pkg.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  private async readDiskUsage(path: string): Promise<SystemStatusResponse['disk']> {
    try {
      const stats = await statfs(path);
      const total = Number(stats.blocks) * Number(stats.bsize);
      const free = Number(stats.bavail) * Number(stats.bsize);
      if (!total) return null;
      const usedPercent = Math.round(((total - free) / total) * 100);
      return {
        path,
        totalGb: round(total / 1024 ** 3, 1),
        freeGb: round(free / 1024 ** 3, 1),
        usedPercent,
      };
    } catch {
      return null;
    }
  }
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
