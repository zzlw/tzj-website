interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLd({ data }: JsonLdProps) {
  const json = Array.isArray(data) ? data : [data];
  // 转义 `<` 防止 CMS 内容中出现 </script> 提前闭合标签造成 XSS（JSON 语义不变）
  const html = JSON.stringify(json.length === 1 ? json[0] : json).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD 结构化数据注入（Next 官方同款做法），输出已经 JSON.stringify + `<` 转义
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
