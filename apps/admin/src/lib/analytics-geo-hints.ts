import type { AnalyticsIpGeoSource } from '@tzj/types';

/** 访客分析 GPS 逆地理策略说明（站点设置、访客分析页共用） */

export const GPS_GEO_MODE_HINT =
  '浏览器 Geolocation 获取坐标后，服务端调用高德逆地理（仅高德，Key 在「集成与凭证 → 高德地图」配置）。高德未配置或请求失败时，回退 IP 定位结果。';

export const GPS_GEO_RESOLVE_NOTE =
  'GPS 模式：仅高德逆地理（Key 可配），失败保留 IP 定位结果；IP 模式：数据源可在站点设置手动选择（离线优先默认 / BigDataCloud / 高德）。地区数据自本次升级后新产生的访问起记录。';

/** IP 定位数据源选项（站点设置「地区定位方式=IP」时展示） */
export const IP_GEO_SOURCES: { id: AnalyticsIpGeoSource; label: string; hint: string }[] = [
  {
    id: 'offline',
    label: '离线优先（默认）',
    hint: '内置 ip2region 离线库（免费、无需授权），国内可到省/市 + 运营商；海外 IP 无法解析',
  },
  {
    id: 'bigdata',
    label: 'BigDataCloud',
    hint: '免费 IP 归属地（无需 Key），国内/海外均可解析',
  },
  {
    id: 'amap',
    label: '高德',
    hint: '高德 IP 定位（需在「集成与凭证 → 高德地图」配置 Web 服务 Key），仅支持国内 IPv4',
  },
];
