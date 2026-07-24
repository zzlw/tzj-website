const regionNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });

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

  if (city?.trim()) {
    return countryLabel ? `${countryLabel} · ${city.trim()}` : city.trim();
  }

  if (region?.trim()) {
    const regionLabel = region.trim();
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
