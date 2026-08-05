import { formatGeoLabel } from './geo-label';

describe('formatGeoLabel', () => {
  it('国家代码转中文', () => {
    expect(formatGeoLabel({ country: 'US' })).toBe('美国');
    expect(formatGeoLabel({ country: 'CN' })).toBe('中国');
    expect(formatGeoLabel({ country: 'DE' })).toBe('德国');
  });

  it('中国省份代码转中文，城市存在时保留省份前缀', () => {
    expect(formatGeoLabel({ country: 'CN', region: 'GD', city: 'Guangzhou' })).toBe(
      '中国 · 广东 · Guangzhou',
    );
    expect(formatGeoLabel({ country: 'CN', region: 'BJ', city: 'Beijing' })).toBe(
      '中国 · 北京 · Beijing',
    );
    expect(formatGeoLabel({ country: 'CN', region: 'SH' })).toBe('中国 · 上海');
  });

  it('LOCAL / 空值哨兵', () => {
    expect(formatGeoLabel({ country: 'LOCAL' })).toBe('本地网络');
    expect(formatGeoLabel({})).toBe('未知');
    expect(formatGeoLabel({ country: null, region: null, city: null })).toBe('未知');
  });
});
