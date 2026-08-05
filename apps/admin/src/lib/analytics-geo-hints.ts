/** 访客分析 GPS 逆地理策略说明（站点设置、访客分析页共用） */

export const GPS_GEO_MODE_HINT =
  '浏览器 Geolocation 获取坐标后，服务端先调用高德逆地理（Key 在「集成与凭证 → 高德地图」配置）；高德未配置或请求失败时，自动回退 [BigDataCloud 免费 API](https://www.bigdatacloud.com/free-api/free-reverse-geocode-client)（无需 Key，适合海外访客兜底）。用户拒绝授权或全部解析失败时，回退 IP 定位结果。';

export const GPS_GEO_RESOLVE_NOTE =
  'GPS 模式：高德逆地理 → 失败回退 [BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-client)（无需配置）；IP 模式：内置 ip2region 离线库（免费）→ 高德 IP 定位（可在「集成与凭证 → 高德地图」开关，默认启用）→ BigDataCloud IP 归属地兜底海外。地区数据自本次升级后新产生的访问起记录。';
