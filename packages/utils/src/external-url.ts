/**
 * 判断运营填写的「官网链接」等外链字段是否为可用的外链。
 * `https://` / `http://` 等仅有协议、没有域名的占位值视为未填写，
 * 使前台行为与后台表单文案「留空则去站内详情页」一致（仅 `?.trim()`
 * 非空判断时，`https://` 会被误判为已填写并打开无效链接）。
 *
 * 消费点：web 展会列表卡片外链、营销弹窗 CTA 三级兜底的外链分支；
 * admin 表单帮助文案口径以此为准。新增同类判断一律复用本函数。
 */
export function isUsableExternalUrl(value?: string | null): value is string {
  const v = value?.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    // 要求 http(s) 协议且 hostname 含域名（排除 `https://` 空 host 与 localhost 等无域值）
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}
