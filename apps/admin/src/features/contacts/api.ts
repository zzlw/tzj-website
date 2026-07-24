import { api } from '@/lib/apiClient';
import type { ContactVisitorProfile } from './types';

/**
 * 拉取询盘访客画像：地区按原始 IP 读取时重解析（省市区 + 运营商），
 * 并聚合站内 PV/UV/会话/首末访问/营销归因（口径对齐「访客分析」）。
 */
export function getContactVisitorProfile(id: string): Promise<ContactVisitorProfile> {
  return api.query<ContactVisitorProfile>(`contact/${encodeURIComponent(id)}/visitor-profile`);
}
