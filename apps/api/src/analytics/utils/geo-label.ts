const regionNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });

/** 中国省级行政区 ISO 3166-2:CN 代码 → 中文名（geoip-lite 的 region 是代码而非名称）。 */
const CN_REGION_NAMES: Record<string, string> = {
  BJ: '北京',
  TJ: '天津',
  HE: '河北',
  SX: '山西',
  NM: '内蒙古',
  LN: '辽宁',
  JL: '吉林',
  HL: '黑龙江',
  SH: '上海',
  JS: '江苏',
  ZJ: '浙江',
  AH: '安徽',
  FJ: '福建',
  JX: '江西',
  SD: '山东',
  HA: '河南',
  HB: '湖北',
  HN: '湖南',
  GD: '广东',
  GX: '广西',
  HI: '海南',
  CQ: '重庆',
  SC: '四川',
  GZ: '贵州',
  YN: '云南',
  XZ: '西藏',
  SN: '陕西',
  GS: '甘肃',
  QH: '青海',
  NX: '宁夏',
  XJ: '新疆',
  TW: '台湾',
  HK: '香港',
  MO: '澳门',
};

/**
 * 将国家代码转中文名。Intl.DisplayNames.of 对结构非法的代码（非 ISO 3166 alpha-2 / UN M49）
 * 会抛 RangeError；此处兜底为原值，避免单行脏 GeoIP 数据 500 掉整个分析接口。
 */
function safeRegionName(country: string): string {
  try {
    return regionNames.of(country.toUpperCase()) ?? country;
  } catch {
    return country;
  }
}

export interface GeoParts {
  country?: string | null;
  region?: string | null;
  city?: string | null;
}

/** 将 GeoIP 字段格式化为中文地区标签。 */
export function formatGeoLabel(parts: GeoParts): string {
  const { country, region, city } = parts;
  if (country === 'LOCAL') return '本地网络';
  if (!country && !region && !city) return '未知';

  const countryLabel = country ? safeRegionName(country) : null;
  const cnRegion =
    country?.toUpperCase() === 'CN' && region ? CN_REGION_NAMES[region.toUpperCase()] : null;

  if (city?.trim()) {
    const parts = [countryLabel, cnRegion, city.trim()].filter(Boolean);
    return parts.length ? parts.join(' · ') : city.trim();
  }

  if (region?.trim()) {
    const regionLabel = cnRegion ?? region.trim();
    return countryLabel ? `${countryLabel} · ${regionLabel}` : regionLabel;
  }

  return countryLabel ?? '未知';
}

/** 定位依据展示标签 */
export function formatGeoSource(source?: string | null): string {
  if (source === 'gps') return 'GPS';
  if (source === 'ip') return 'IP';
  return '—';
}
