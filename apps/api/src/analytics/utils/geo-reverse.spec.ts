import { lookupGeoFromCoordinates } from './geo-reverse';

const AMAP_REVERSE_OK = {
  status: '1',
  regeocode: {
    addressComponent: {
      province: '江苏省',
      city: '南京市',
      district: '玄武区',
    },
  },
};

const BIGDATA_REVERSE_OK = {
  countryCode: 'US',
  principalSubdivision: 'California',
  city: 'Mountain View',
};

const fetchMock = jest.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function calledUrls(): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

describe('lookupGeoFromCoordinates（高德优先，BigDataCloud 兜底）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('未配置高德 Key → 直接使用 BigDataCloud', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('bigdatacloud.net')) return jsonResponse(BIGDATA_REVERSE_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const geo = await lookupGeoFromCoordinates(37.7749, -122.4194, null);

    expect(geo).toEqual({
      country: 'US',
      region: 'California',
      city: 'Mountain View',
    });
    expect(calledUrls().some((url) => url.includes('restapi.amap.com'))).toBe(false);
  });

  it('高德失败 → BigDataCloud 兜底', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('restapi.amap.com')) {
        return jsonResponse({ status: '0', info: 'INVALID_USER_KEY' });
      }
      if (url.includes('bigdatacloud.net')) return jsonResponse(BIGDATA_REVERSE_OK);
      throw new Error(`未知 URL ${url}`);
    });

    const geo = await lookupGeoFromCoordinates(34.7466, 113.6253, 'bad-key');

    expect(geo).toEqual({ country: 'US', region: 'California', city: 'Mountain View' });
  });

  it('高德成功 → 不再调用 BigDataCloud', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('restapi.amap.com')) return jsonResponse(AMAP_REVERSE_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const geo = await lookupGeoFromCoordinates(31.2304, 121.4737, 'amap-key');

    expect(geo).toEqual({ country: 'CN', region: '江苏省', city: '南京市' });
    expect(calledUrls().some((url) => url.includes('bigdatacloud.net'))).toBe(false);
  });

  it('两个来源都失败 → 返回空结果', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('restapi.amap.com')) return jsonResponse({ status: '0' });
      if (url.includes('bigdatacloud.net')) return jsonResponse({});
      throw new Error(`未知 URL ${url}`);
    });

    await expect(lookupGeoFromCoordinates(48.8566, 2.3522, 'amap-key')).resolves.toEqual({
      country: null,
      region: null,
      city: null,
    });
  });

  it('非法坐标直接返回空，不产生外呼', async () => {
    await expect(lookupGeoFromCoordinates(200, 200, 'amap-key')).resolves.toEqual({
      country: null,
      region: null,
      city: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
