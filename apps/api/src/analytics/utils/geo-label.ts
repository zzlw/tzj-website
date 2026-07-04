const regionNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });

export interface GeoParts {
  country?: string | null;
  region?: string | null;
  city?: string | null;
}

/** 将 GeoIP 字段格式化为中文地区标签。 */
export function formatGeoLabel(parts: GeoParts): string {
  const { country, region, city } = parts;
  if (!country && !region && !city) return "未知";

  const countryLabel = country
    ? (regionNames.of(country.toUpperCase()) ?? country)
    : null;

  if (city?.trim()) {
    return countryLabel ? `${countryLabel} · ${city.trim()}` : city.trim();
  }

  if (region?.trim()) {
    const regionLabel = region.trim();
    return countryLabel ? `${countryLabel} · ${regionLabel}` : regionLabel;
  }

  return countryLabel ?? "未知";
}
