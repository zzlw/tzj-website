export type BlockIpDuration = '1h' | '24h' | '7d' | '30d' | 'permanent';

export interface CreateBlockedIpDto {
  ip: string;
  reason?: string;
  duration?: BlockIpDuration;
}

export interface BlockedIpItem {
  id: string;
  /** IP 哈希（用于打开 IP 详情抽屉下钻；原始 IP 不外泄） */
  ipHash: string;
  ipMasked: string;
  reason: string | null;
  expiresAt: string | null;
  isPermanent: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    username: string;
    nickname: string | null;
  } | null;
}

export interface AnalyticsIpTrafficRow {
  id: string;
  /** 完整 IP（仅后台可见；历史数据可能为空） */
  ip: string | null;
  ipMasked: string | null;
  region: string;
  pageViews: number;
  uniqueVisitors: number;
  lastSeenAt: string;
}

export const BLOCK_IP_DURATION_LABELS: Record<BlockIpDuration, string> = {
  '1h': '1 小时',
  '24h': '24 小时',
  '7d': '7 天',
  '30d': '30 天',
  permanent: '永久',
};
