import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

/** remark 插件：GFM 表格、删除线、任务列表、自动链接等 */
export const markdownRemarkPlugins = [remarkGfm];

/** rehype 插件：输出 HTML 白名单消毒，防止 CMS 内容 XSS */
export const markdownRehypePlugins = [rehypeSanitize];

function isExternalHref(href?: string): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href);
}

export { isExternalHref };
