/** 访客分析 GPS 逆地理策略说明（站点设置、访客分析页共用） */

export const GPS_GEO_MODE_HINT =
  '浏览器 Geolocation 获取坐标后，服务端先调用高德逆地理（国内精度高，Key 在「集成与凭证 → 高德地图」配置）；高德未配置或请求失败时，自动回退 [BigDataCloud 免费 API](https://www.bigdatacloud.com/free-api/free-reverse-geocode-client)（无需 Key，适合海外访客兜底）。用户拒绝授权或全部解析失败时，回退 IP 离线定位。';

export const GPS_GEO_RESOLVE_NOTE =
  'GPS 模式下：优先高德逆地理 → 失败则 [BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-client) 兜底（无需配置）；IP 模式使用 geoip-lite 离线库。地区数据自本次升级后新产生的访问起记录。';
