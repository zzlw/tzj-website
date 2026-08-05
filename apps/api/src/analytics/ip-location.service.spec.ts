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

describe('IpLocationService（IP 数据源：offline / bigdata / amap）', () => {
  let service: IpLocationService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockIp2Search = jest.fn().mockResolvedValue({ region: null, ioCount: 0, took: 0 });
    mockIp2Load = jest.fn().mockReturnValue(Buffer.alloc(0));
    integrations.isActive.mockResolvedValue(true);
    integrations.resolveSecret.mockResolvedValue('amap-web-key');
    integrations.resolveConfig.mockResolvedValue(null);
    service = new IpLocationService(integrations);
  });

  it('offline（默认）：ip2region 命中 → 返回省/市/运营商，不产生网络外呼', async () => {
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

  it('offline：ip2region 未命中 → null（不回退其他数据源）', async () => {
    const result = await service.resolve('8.8.8.8');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bigdata：直接调用 BigDataCloud，不查离线库', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) return jsonResponse(BIGDATA_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const result = await service.resolve('8.8.8.8', 'bigdata');

    expect(result).toMatchObject({
      country: '美国',
      countryCode: 'US',
      region: '加利福尼亚州',
      city: '圣克拉拉',
    });
    expect(result?.location).toBe('美国 加利福尼亚州 圣克拉拉');
    expect(mockIp2Search).not.toHaveBeenCalled();
  });

  it('amap：Key 已配置且高德成功 → 返回结果，不查离线库/BigDataCloud', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) return jsonResponse(AMAP_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const result = await service.resolve('1.2.3.4', 'amap');

    expect(result).toMatchObject({ countryCode: 'CN', region: '江苏省', city: '南京市' });
    expect(mockIp2Search).not.toHaveBeenCalled();
    expect(calledUrls()).toHaveLength(1);
  });

  it('amap：高德失败 → null（不回退其他数据源）', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v3/ip')) return jsonResponse({ status: '0', info: 'INVALID_USER_KEY' });
      throw new Error(`不应调用 ${url}`);
    });

    await expect(service.resolve('8.8.8.8', 'amap')).resolves.toBeNull();
    expect(calledUrls()).toHaveLength(1);
  });

  it('amap：未配置 Key → null，不产生外呼', async () => {
    integrations.isActive.mockResolvedValue(false);
    integrations.resolveSecret.mockResolvedValue(null);

    await expect(service.resolve('1.2.3.4', 'amap')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('离线库加载失败：offline 返回 null，bigdata 仍可用', async () => {
    mockIp2Load.mockImplementationOnce(() => {
      throw new Error('load failed');
    });
    const degraded = new IpLocationService(integrations);

    await expect(degraded.resolve('1.2.3.4', 'offline')).resolves.toBeNull();

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) return jsonResponse(BIGDATA_OK);
      throw new Error(`不应调用 ${url}`);
    });
    const result = await degraded.resolve('8.8.8.8', 'bigdata');
    expect(result).toMatchObject({ countryCode: 'US' });
  });

  it('同 IP 同数据源并发解析合并为单次外呼', async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL) =>
        new Promise<Response>((resolve) => {
          setTimeout(() => {
            resolve(
              String(input).includes('bigdatacloud.net')
                ? jsonResponse(BIGDATA_OK)
                : jsonResponse({}),
            );
          }, 10);
        }),
    );

    const [a, b] = await Promise.all([
      service.resolve('1.2.3.4', 'bigdata'),
      service.resolve('1.2.3.4', 'bigdata'),
    ]);

    expect(a).toMatchObject({ countryCode: 'US' });
    expect(b).toMatchObject({ countryCode: 'US' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('内网 IP 直接跳过，不产生任何外呼', async () => {
    await expect(service.resolve('127.0.0.1', 'bigdata')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolveMany 按数据源批量解析并去重', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('bigdatacloud.net/data/ip-geolocation')) return jsonResponse(BIGDATA_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const map = await service.resolveMany(['1.2.3.4', '1.2.3.4', '5.6.7.8', null], 'bigdata');

    expect(map.size).toBe(2);
    expect(map.get('1.2.3.4')?.countryCode).toBe('US');
    expect(map.get('5.6.7.8')?.city).toBe('圣克拉拉');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
