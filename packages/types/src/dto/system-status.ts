export type DependencyStatus = 'up' | 'down' | 'degraded' | 'skipped';

export interface SystemStatusResponse {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  timestamp: string;
  uptime: number;
  process: {
    nodeVersion: string;
    pid: number;
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
    };
    cpu: {
      loadAvg1m: number;
      loadAvg5m: number;
      loadAvg15m: number;
    };
  };
  serverMemory: {
    host: {
      totalMb: number;
      freeMb: number;
      usedMb: number;
      usedPercent: number;
    };
    container: {
      limitMb: number | null;
      usageMb: number | null; // 匿名内存（进程实际占用，不含可回收页缓存）
      cacheMb: number | null; // 页缓存（可回收）
      totalMb: number | null; // cgroup 当前总计（含缓存）
      usedPercent: number | null;
    };
  };
  disk: {
    path: string;
    totalGb: number;
    freeGb: number;
    usedPercent: number;
  } | null;
  dependencies: {
    database: DependencyStatus;
    storage: DependencyStatus;
    email: DependencyStatus;
  };
}
