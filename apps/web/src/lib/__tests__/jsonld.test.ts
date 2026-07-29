import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonLd } from '@/components/JsonLd';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  eventJsonLd,
  organizationJsonLd,
  productJsonLd,
} from '@/lib/jsonld';
import { siteConfig } from '@/lib/site';

describe('organizationJsonLd', () => {
  it('输出 Organization 结构，url/logo 来自 siteConfig', () => {
    const data = organizationJsonLd({
      legalName: '河南拓之迹实业有限公司',
      brandName: '拓之迹',
      description: 'desc',
      phone: '0371-58691119',
      email: 'a@b.com',
      streetAddress: '科学大道',
      addressLocality: '郑州市',
      addressRegion: '河南省',
    });
    expect(data['@type']).toBe('Organization');
    expect(data.url).toBe(siteConfig.url);
    expect(data.contactPoint).toMatchObject({ telephone: '0371-58691119', email: 'a@b.com' });
    expect(data.address).toMatchObject({ addressLocality: '郑州市', addressCountry: 'CN' });
  });
});

describe('productJsonLd', () => {
  it('拼接站点 URL，image 缺省为 undefined', () => {
    const data = productJsonLd({ name: 'T1', description: 'd', path: '/zh-CN/towers' });
    expect(data.url).toBe(`${siteConfig.url}/zh-CN/towers`);
    expect(data.image).toBeUndefined();
    expect(data.brand).toMatchObject({ name: siteConfig.name });
  });

  it('image 传相对 key 时经 resolveMediaUrl 解析为绝对 URL', () => {
    const data = productJsonLd({
      name: 'T1',
      description: 'd',
      path: '/p',
      image: 'images/202601/a.jpg',
    });
    expect(data.image).toMatch(/^https?:\/\/.+\/images\/202601\/a\.jpg$/);
  });
});

describe('breadcrumbJsonLd', () => {
  it('position 从 1 开始且 item 为绝对 URL', () => {
    const data = breadcrumbJsonLd([
      { name: '首页', path: '/zh-CN' },
      { name: '产品', path: '/zh-CN/towers' },
    ]);
    expect(data.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: '首页', item: `${siteConfig.url}/zh-CN` },
      { '@type': 'ListItem', position: 2, name: '产品', item: `${siteConfig.url}/zh-CN/towers` },
    ]);
  });
});

describe('articleJsonLd / eventJsonLd', () => {
  it('Article 的 author/publisher 均为公司主体', () => {
    const data = articleJsonLd({ title: 't', description: 'd', path: '/a' });
    expect(data.author).toMatchObject({ name: siteConfig.legalName });
    expect(data.publisher).toMatchObject({ name: siteConfig.legalName });
  });

  it('Event 无 location 时省略 Place，有 location 时补全 PostalAddress', () => {
    const noLoc = eventJsonLd({ title: 't', description: 'd', path: '/e' });
    expect(noLoc.location).toBeUndefined();
    const withLoc = eventJsonLd({ title: 't', description: 'd', path: '/e', location: '郑州' });
    expect(withLoc.location).toMatchObject({
      '@type': 'Place',
      name: '郑州',
      address: { addressCountry: 'CN' },
    });
  });
});

describe('JsonLd 组件（XSS 转义）', () => {
  it('内容中的 </script> 被转义为 \\u003c，无法提前闭合脚本标签', () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { name: '恶意</script><img src=x onerror=alert(1)>' } }),
    );
    expect(html).not.toContain('</script><img');
    expect(html).toContain('\\u003c/script>');
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
  });

  it('数组输入保持数组输出，单元素解包为对象', () => {
    const single = renderToStaticMarkup(createElement(JsonLd, { data: [{ a: 1 }] }));
    expect(single).toContain('{"a":1}');
    expect(single).not.toContain('[{"a":1}]');
    const multi = renderToStaticMarkup(createElement(JsonLd, { data: [{ a: 1 }, { b: 2 }] }));
    expect(multi).toContain('[{"a":1},{"b":2}]');
  });
});
