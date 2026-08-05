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

const fetchMock = jest.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('lookupGeoFromCoordinates（GPS 仅高德）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('未配置高德 Key → 空结果，不产生外呼', async () => {
    await expect(lookupGeoFromCoordinates(37.7749, -122.4194, null)).resolves.toEqual({
      country: null,
      region: null,
      city: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('高德失败 → 空结果，不回退第三方', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('restapi.amap.com')) {
        return jsonResponse({ status: '0', info: 'INVALID_USER_KEY' });
      }
      throw new Error(`不应调用 ${url}`);
    });

    await expect(lookupGeoFromCoordinates(34.7466, 113.6253, 'bad-key')).resolves.toEqual({
      country: null,
      region: null,
      city: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('高德成功 → 返回省市区', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('restapi.amap.com')) return jsonResponse(AMAP_REVERSE_OK);
      throw new Error(`不应调用 ${url}`);
    });

    const geo = await lookupGeoFromCoordinates(31.2304, 121.4737, 'amap-key');

    expect(geo).toEqual({ country: 'CN', region: '江苏省', city: '南京市' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
