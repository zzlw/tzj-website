import sanitizeHtml from 'sanitize-html';

/**
 * 富文本 HTML 清洗：白名单标签/属性，移除脚本、事件处理器、危险协议，
 * 防止存储型 XSS。用于所有会渲染到前台的富文本字段。
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'blockquote',
    'pre',
    'code',
    'span',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'mark',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  // 仅保留安全的内联样式，防止 style 注入
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      color: [/^#(0x)?[0-9a-fA-F]+$/, /^rgb\(/],
      'background-color': [/^#(0x)?[0-9a-fA-F]+$/, /^rgb\(/],
    },
  },
  transformTags: {
    // 外链统一加安全 rel，避免 tabnabbing
    a: (tagName, attribs) => {
      const isBlank = attribs.target === '_blank';
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(isBlank ? { rel: 'noopener noreferrer' } : {}),
        },
      };
    },
  },
};

export function sanitizeRichText(html: string | null | undefined): string | null {
  if (html == null) return null;
  const trimmed = String(html).trim();
  if (!trimmed) return null;
  return sanitizeHtml(trimmed, OPTIONS);
}
