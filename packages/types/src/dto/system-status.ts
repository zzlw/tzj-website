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
      availableMb: number;
      usedMb: number;
      usedPercent: number;
    };
    container: {
      limitMb: number | null;
      usageMb: number | null; // 匿名内存（进程实际占用）
      cacheMb: number | null; // 页缓存总计（file）
      inactiveCacheMb: number | null; // 可回收的 inactive 页缓存
      totalMb: number | null; // cgroup 当前总计（含缓存）
      workingSetMb: number | null; // working set = total − inactive_file（K8s 口径）
      usedPercent: number | null; // workingSetMb / limitMb
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
