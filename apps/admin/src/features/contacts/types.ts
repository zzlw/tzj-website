/**
 * 询盘访客画像（GET /contact/:id/visitor-profile）：对齐「访客分析」的数据与
 * 「依据 IP 取位置」原理——地区在读取时按原始 IP 重解析（省市区 + 运营商），
 * 并聚合该访客站内 PV/UV/会话数/首末访问/营销归因。
 */
export interface ContactVisitorProfile {
  ipMasked: string | null;
  /** 读取时重解析的最精确地址，失败回退入库 GeoIP 值 */
  location: string | null;
  /** 运营商（仅 IP 解析命中时有值） */
  isp: string | null;
  /** 定位依据：ip（重解析）| geoip（入库粗定位）| unknown */
  geoSource: 'ip' | 'geoip' | 'unknown';
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  visitorId: string | null;
  /** 站内行为聚合（无关联访客/无浏览记录时为 null） */
  pageViews: number | null;
  sessions: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  trafficSource: string | null;
  /** 是否在分析中匹配到该询盘的浏览轨迹 */
  matched: boolean;
  /** 已转化的客户 ID（该询盘已转线索时有值） */
  convertedCustomerId: string | null;
}
