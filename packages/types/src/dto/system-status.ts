export type DependencyStatus = "up" | "down" | "degraded" | "skipped";

export interface SystemStatusResponse {
  status: "healthy" | "degraded" | "down";
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
  disk: {
    path: string;
    totalGb: number;
    freeGb: number;
    usedPercent: number;
  } | null;
  dependencies: {
    database: DependencyStatus;
    storage: DependencyStatus;
    redis: DependencyStatus;
    email: DependencyStatus;
  };
}
