/** 将官网缓存 TTL（秒）格式化为用户可读文案；undefined/非法按默认 300s */
export function formatCacheTtl(ttl?: number): string {
  if (ttl === 0) return '实时生效';
  const t = typeof ttl === 'number' && ttl > 0 ? Math.floor(ttl) : 300;
  return t % 60 === 0 ? `最长 ${t / 60} 分钟生效` : `最长 ${t} 秒生效`;
}
