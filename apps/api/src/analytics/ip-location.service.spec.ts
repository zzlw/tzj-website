import type { IntegrationsService } from '../integrations/integrations.service';
import { IpLocationService } from './ip-location.service';

let mockIp2Search: jest.Mock;
let mockIp2Load: jest.Mock;

jest.mock('ip2region-ts', () => ({
  defaultDbFile: '/mock/ip2region.xdb',
  loadContentFromFile: (...args: unknown[]) => mockIp2Load(...args),
  newWithBuffer: () => ({ search: mockIp2Search }),
}));

const AMAP_OK = {
  status: '1',
  info: 'OK',
  province: '江苏省',
  city: '南京市',
};

const BIGDATA_OK = {
  countryName: '美国',
  countryCode: 'US',
  principalSubdivision: '加利福尼亚州',
  city: '圣克拉拉',
};

const BIGDATA_CN = {
  countryName: '中国',
  countryCode: 'CN',
  principalSubdivision: '江苏省',
  city: '南京市',
};

const integrations = {
  isActive: jest.fn(),
  resolveSecret: jest.fn(),
  resolveConfig: jest.fn(),
} as unknown as IntegrationsService;

const fetchMock = jest.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function calledUrls(): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

describe('IpLocationService（仅高德 IP 定位）', () => {
  let service: IpLocationService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockIp2Search = jest.fn().mockResolvedValue({ region: null, ioCount: 0, took: 0 });
    mockIp2Load = jest.fn().mockReturnValue(Buffer.alloc(0));
    integrations.isActive.mockResolvedValue(true);
    integrations.resolveSecret.mockResolvedValue('amap-web-key');
    integrations.resolveConfig.mockResolvedValue('on');
    service = new IpLocationService(integrations);
  });

  it('ip2region 国内命中 → 直接返回省/市/运营商，不再外呼', async () => {
    mockIp2Search.mockResolvedValue({
      region: '中国|0|江苏省|苏州市|电信',
      ioCount: 0,
      took: 0,
    });

    const result = await service.resolve('218.4.167.70');

    expect(result).toMatchObject({
      country: '中国',
      countryCode: 'CN',
      region: '江苏省',
      city: '苏州市',
      isp: '电信',
    });
    expect(result?.location).toBe('江苏省 苏州市');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ip2region 直辖市层级去重', async () => {
    mockIp2Search.mockResolvedValue({
      region: '中国|0|北京|北京市|联通',
      ioCount: 0,
      took: 0,
    });

    const result = await service.resolve('114.247.50.2');

    expect(result).toMatchObject({ region: '北京市', city: '', isp: '联通' });
    expect(result?.location).toBe('北京市');
  });

  it('ip2region 国外命中 → 跳过，交给 BigDataCloud 拿结构化国家码', async () => {
    mockIp2Search.mockResolvedValue({
      region: '美国|0|华盛顿|雷德蒙德|微软',
      ioCount: 0,
      took: 0,
    });
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) {
        return jsonResponse({ status: '1', info: 'OK', province: '', city: '' });
      }
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) return jsonResponse(BIGDATA_OK);
      throw new Error(`未知 URL ${url}`);
    });

    const result = await service.resolve('13.107.42.14');

    expect(result).toMatchObject({ countryCode: 'US', region: '加利福尼亚州' });
  });

  it('ip2region 离线库加载失败 → 降级到高德链路', async () => {
    mockIp2Load.mockImplementationOnce(() => {
      throw new Error('load failed');
    });
    const degraded = new IpLocationService(integrations);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) return jsonResponse(AMAP_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const result = await degraded.resolve('1.2.3.4');

    expect(result).toMatchObject({ region: '江苏省' });
  });

  it('on（默认）：高德成功时返回中国/省/市，不再调用 BigDataCloud', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) return jsonResponse(AMAP_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const result = await service.resolve('1.2.3.4');

    expect(result).toMatchObject({
      country: '中国',
      countryCode: 'CN',
      region: '江苏省',
      city: '南京市',
      isp: '',
    });
    expect(result?.location).toBe('江苏省 南京市');
    expect(calledUrls()).toHaveLength(1);
    expect(calledUrls()[0]).toContain('restapi.amap.com/v3/ip');
  });

  it('on：高德失败 → BigDataCloud 兜底', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) return jsonResponse({ status: '0', info: 'INVALID_USER_KEY' });
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) return jsonResponse(BIGDATA_OK);
      throw new Error(`未知 URL ${url}`);
    });

    const result = await service.resolve('8.8.8.8');

    expect(result).toMatchObject({
      country: '美国',
      countryCode: 'US',
      region: '加利福尼亚州',
      city: '圣克拉拉',
    });
    expect(result?.location).toBe('美国 加利福尼亚州 圣克拉拉');
  });

  it('on：海外 IP 高德返回空字段 → BigDataCloud 兜底', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) {
        return jsonResponse({ status: '1', info: 'OK', province: '', city: '' });
      }
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) return jsonResponse(BIGDATA_OK);
      throw new Error(`未知 URL ${url}`);
    });

    const result = await service.resolve('8.8.8.8');
    expect(result).toMatchObject({ countryCode: 'US', region: '加利福尼亚州' });
  });

  it('off：不调用高德，直接走 BigDataCloud', async () => {
    integrations.resolveConfig.mockResolvedValue('off');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) return jsonResponse(BIGDATA_CN);
      throw new Error(`不应调用 ${url}`);
    });

    const result = await service.resolve('1.2.3.4');

    expect(result).toMatchObject({ countryCode: 'CN', region: '江苏省', city: '南京市' });
    expect(result?.location).toBe('江苏省 南京市');
    expect(calledUrls().some((url) => url.includes('/v3/ip'))).toBe(false);
  });

  it('未配置高德 Key：直接走 BigDataCloud', async () => {
    integrations.isActive.mockResolvedValue(false);
    integrations.resolveSecret.mockResolvedValue(null);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) return jsonResponse(BIGDATA_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const result = await service.resolve('8.8.8.8');
    expect(result).toMatchObject({ countryCode: 'US' });
    expect(calledUrls().some((url) => url.includes('/v3/ip'))).toBe(false);
  });

  it('高德与 BigDataCloud 均失败 → null', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) return jsonResponse({ status: '0', info: 'INVALID_USER_KEY' });
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) {
        return jsonResponse({});
      }
      throw new Error(`未知 URL ${url}`);
    });

    await expect(service.resolve('8.8.8.8')).resolves.toBeNull();
  });

  it('未知模式值默认启用', async () => {
    integrations.resolveConfig.mockResolvedValue('unknown-value');
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) return jsonResponse(AMAP_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const result = await service.resolve('1.2.3.4');
    expect(result?.region).toBe('江苏省');
  });

  it('同 IP 并发解析合并为单次外呼', async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL) =>
        new Promise<Response>((resolve) => {
          setTimeout(() => {
            resolve(String(input).includes('/v3/ip') ? jsonResponse(AMAP_OK) : jsonResponse({}));
          }, 10);
        }),
    );

    const [a, b] = await Promise.all([service.resolve('1.2.3.4'), service.resolve('1.2.3.4')]);

    expect(a).toMatchObject({ region: '江苏省' });
    expect(b).toMatchObject({ region: '江苏省' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('内网 IP 直接跳过，不产生任何外呼', async () => {
    await expect(service.resolve('127.0.0.1')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolveMany 批量解析并返回按 IP 的映射', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) return jsonResponse(AMAP_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const map = await service.resolveMany(['1.2.3.4', '1.2.3.4', '5.6.7.8', null]);

    expect(map.size).toBe(2);
    expect(map.get('1.2.3.4')?.region).toBe('江苏省');
    expect(map.get('5.6.7.8')?.city).toBe('南京市');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
