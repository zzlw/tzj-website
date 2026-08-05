import { readFile, statfs } from 'node:fs/promises';
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
    const serverMemory = await this.readServerMemory();

    const depValues = Object.values(ready.checks);
    const status = depValues.every((v) => v === 'up' || v === 'skipped')
      ? 'healthy'
      : depValues.some((v) => v === 'up' || v === 'skipped')
        ? 'degraded'
        : 'down';

    return {
      status,
      version: await this.readVersion(),
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
      serverMemory,
      disk,
      dependencies: {
        database: ready.checks.database as SystemStatusResponse['dependencies']['database'],
        storage: ready.checks.storage as SystemStatusResponse['dependencies']['storage'],
        email: ready.checks.email as SystemStatusResponse['dependencies']['email'],
      },
    };
  }

  private async readVersion(): Promise<string> {
    const fromEnv = this.config.get<string>('APP_VERSION')?.trim();
    if (fromEnv) return fromEnv;
    try {
      const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
        version?: string;
      };
      return pkg.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  private async readServerMemory(): Promise<SystemStatusResponse['serverMemory']> {
    let hostTotalMb = os.totalmem() / 1024 ** 2;
    let hostFreeMb = os.freemem() / 1024 ** 2;
    let hostAvailableMb = hostFreeMb;
    try {
      // 宿主机口径与云厂商一致：MemAvailable（可回收缓存计入可用），不用 MemFree
      const meminfo = await readFile('/proc/meminfo', 'utf8');
      const readKb = (key: string): number | null => {
        const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm'));
        return match ? Number(match[1]) / 1024 : null;
      };
      const total = readKb('MemTotal');
      const available = readKb('MemAvailable');
      const free = readKb('MemFree');
      if (total !== null && total > 0) hostTotalMb = total;
      if (available !== null && available >= 0) hostAvailableMb = available;
      if (free !== null && free >= 0) hostFreeMb = free;
    } catch {
      // 非 Linux / 无法读取时回退 os 接口
    }
    const usedMb = Math.max(0, hostTotalMb - hostAvailableMb);
    const hostUsedPercent =
      hostTotalMb > 0 ? clampPercent(Math.round((usedMb / hostTotalMb) * 100)) : 0;

    let containerLimitMb: number | null = null;
    let containerUsageMb: number | null = null;
    let containerCacheMb: number | null = null;
    let containerInactiveCacheMb: number | null = null;
    let containerTotalMb: number | null = null;
    let containerWorkingSetMb: number | null = null;

    // Docker/容器环境优先读 cgroup v2；老内核或 v1 挂载再回退。
    try {
      const limit = Number((await readFile('/sys/fs/cgroup/memory.max', 'utf8')).trim());
      const total = Number((await readFile('/sys/fs/cgroup/memory.current', 'utf8')).trim());
      const statText = await readFile('/sys/fs/cgroup/memory.stat', 'utf8');
      const stat = new Map<string, number>();
      for (const line of statText.split('\n')) {
        const [key, raw] = line.trim().split(/\s+/);
        if (key && raw !== undefined) stat.set(key, Number(raw));
      }
      // memory.current 包含可回收页缓存（file），监控主口径用匿名内存（anon）
      const anon = stat.get('anon') ?? total;
      const file = stat.get('file') ?? 0;
      const inactiveFile = stat.get('inactive_file') ?? 0;
      // K8s working set 口径：不可回收的活跃内存 = current − inactive_file
      const workingSet = Math.max(0, total - inactiveFile);
      if (Number.isFinite(limit) && limit > 0) containerLimitMb = round(limit / 1024 ** 2, 1);
      if (Number.isFinite(anon) && anon > 0) containerUsageMb = round(anon / 1024 ** 2, 1);
      if (Number.isFinite(file) && file > 0) containerCacheMb = round(file / 1024 ** 2, 1);
      if (Number.isFinite(inactiveFile) && inactiveFile > 0)
        containerInactiveCacheMb = round(inactiveFile / 1024 ** 2, 1);
      if (Number.isFinite(total) && total > 0) containerTotalMb = round(total / 1024 ** 2, 1);
      if (Number.isFinite(workingSet) && workingSet > 0)
        containerWorkingSetMb = round(workingSet / 1024 ** 2, 1);
    } catch {
      try {
        const limit = Number(
          (await readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8')).trim(),
        );
        const usage = Number(
          (await readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8')).trim(),
        );
        const statText = await readFile('/sys/fs/cgroup/memory/memory.stat', 'utf8');
        const inactiveMatch = statText.match(/^total_inactive_file\s+(\d+)/m);
        const inactiveFile = inactiveMatch ? Number(inactiveMatch[1]) : 0;
        const workingSet = Math.max(0, usage - inactiveFile);
        if (Number.isFinite(limit) && limit > 0) containerLimitMb = round(limit / 1024 ** 2, 1);
        if (Number.isFinite(usage) && usage > 0) {
          containerUsageMb = round(usage / 1024 ** 2, 1);
          containerTotalMb = containerUsageMb;
        }
        if (Number.isFinite(workingSet) && workingSet > 0)
          containerWorkingSetMb = round(workingSet / 1024 ** 2, 1);
        if (Number.isFinite(inactiveFile) && inactiveFile > 0)
          containerInactiveCacheMb = round(inactiveFile / 1024 ** 2, 1);
      } catch {
        // 非容器环境：保留 null，由前端显示“无容器限制”
      }
    }

    const containerUsedPercent =
      containerLimitMb !== null && containerWorkingSetMb !== null
        ? clampPercent(Math.round((containerWorkingSetMb / containerLimitMb) * 100))
        : null;

    return {
      host: {
        totalMb: round(hostTotalMb),
        freeMb: round(hostFreeMb),
        availableMb: round(hostAvailableMb),
        usedMb: round(usedMb),
        usedPercent: hostUsedPercent,
      },
      container: {
        limitMb: containerLimitMb,
        usageMb: containerUsageMb,
        cacheMb: containerCacheMb,
        inactiveCacheMb: containerInactiveCacheMb,
        totalMb: containerTotalMb,
        workingSetMb: containerWorkingSetMb,
        usedPercent: containerUsedPercent,
      },
    };
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

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}
