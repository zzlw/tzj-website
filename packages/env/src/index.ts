/** 构建模式：生产构建（next build/start、node 生产运行）为 true；development/test 为非生产。 */
export const isProduction = process.env.NODE_ENV === 'production';
/** 非生产构建（development/test），用于日志、调试与本地资源兜底。 */
export const isDev = !isProduction;

/**
 * statics/ 资源公开 URL（规则收口点，业务代码禁止自行判断 NODE_ENV）：
 * - 生产：{publicDomain}/statics/{path}（OSS/CDN 托管）
 * - 开发/测试：应用自身 public/{path}
 *
 * @param publicDomain 对象存储公开访问域名（各端由自身 env 提供，如 NEXT_PUBLIC_S3_PUBLIC_DOMAIN）
 * @param path statics 下的相对路径，如 vditor-assets/dist/js/lute/lute.min.js
 */
export function getStaticsUrl(publicDomain: string, path: string): string {
  const base = publicDomain.replace(/\/+$/, '');
  const relative = path.replace(/^\/+/, '');
  return isProduction ? `${base}/statics/${relative}` : `/${relative}`;
}
