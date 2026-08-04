import { describe, expect, it } from 'vitest';
import { loadMessages } from '@/lib/i18n/load-messages';
import { resolveMessageLoadPlan, stripLocalePrefix } from '@/lib/i18n/message-modules';
import { kebabToCamelCase, pageContentIdFromPath } from '@/lib/i18n/page-ids';

describe('stripLocalePrefix', () => {
  it('剥离已知 locale 前缀', () => {
    expect(stripLocalePrefix('/zh-CN')).toBe('/');
    expect(stripLocalePrefix('/zh-TW/why-us')).toBe('/why-us');
    expect(stripLocalePrefix('/en/towers/steel')).toBe('/towers/steel');
  });

  it('非 locale 首段原样保留，尾斜杠归一', () => {
    expect(stripLocalePrefix('/why-us')).toBe('/why-us');
    expect(stripLocalePrefix('/zh-CN/why-us/')).toBe('/why-us');
    expect(stripLocalePrefix('/')).toBe('/');
  });
});

describe('kebabToCamelCase / pageContentIdFromPath', () => {
  it('kebab → camel 转换', () => {
    expect(kebabToCamelCase('fixed-tower-custom')).toBe('fixedTowerCustom');
    expect(kebabToCamelCase('home')).toBe('home');
  });

  it('路由路径 → 页面 id', () => {
    expect(pageContentIdFromPath('/why-us/story')).toBe('why-us-story');
    expect(pageContentIdFromPath('/')).toBe('home');
  });
});

describe('resolveMessageLoadPlan', () => {
  it('任意路径均包含常驻模块（blocks/error/catalog/content）', () => {
    const { extraModules } = resolveMessageLoadPlan('/zh-CN/contact');
    for (const m of ['blocks', 'error', 'catalog', 'content']) {
      expect(extraModules).toContain(m);
    }
  });

  it('首页追加 home + solutions', () => {
    const { extraModules } = resolveMessageLoadPlan('/zh-CN');
    expect(extraModules).toContain('home');
    expect(extraModules).toContain('solutions');
  });

  it('产品路径命中静态页 id，非产品路径不误伤', () => {
    const plan = resolveMessageLoadPlan('/en/fixed-tower/custom');
    expect(plan.pageIds).toContain('fixed-tower-custom');
    const other = resolveMessageLoadPlan('/en/contact');
    expect(other.pageIds).toHaveLength(0);
  });

  it('固定塔 Hub 额外加载 series 模块（系列网格复用）', () => {
    const hub = resolveMessageLoadPlan('/zh-CN/fixed-tower');
    expect(hub.pageIds).toContain('fixed-tower');
    expect(hub.pageIds).toContain('fixed-tower-series');
    const seriesOnly = resolveMessageLoadPlan('/zh-CN/fixed-tower/series');
    expect(seriesOnly.pageIds).toContain('fixed-tower-series');
    expect(seriesOnly.pageIds).not.toContain('fixed-tower');
  });

  it('资讯/博客/方案详情页复用列表页 id（动态 slug 归并）', () => {
    expect(resolveMessageLoadPlan('/zh-CN/resources/news/some-slug').pageIds).toContain(
      'resources-news',
    );
    expect(resolveMessageLoadPlan('/zh-CN/resources/blog/a-b-c').pageIds).toContain(
      'resources-blog',
    );
    expect(resolveMessageLoadPlan('/en/solutions/fire-station').pageIds).toContain(
      'solution-detail',
    );
    // 二级以上不匹配
    expect(resolveMessageLoadPlan('/en/resources/news/a/b').pageIds).toHaveLength(0);
  });
});

describe('loadMessages（回退链集成）', () => {
  it('首页合并 core + home 模块，pages 命名空间存在', async () => {
    const messages = await loadMessages('zh-CN', '/zh-CN');
    // core 全局命名空间
    expect(Object.keys(messages).length).toBeGreaterThan(0);
    // home 模块被合并进顶层
    expect(messages).toHaveProperty('home');
    expect(messages).toHaveProperty('pages');
  });

  it('静态页路径将页面 JSON 挂到 pages.<camelCase>', async () => {
    const messages = await loadMessages('en', '/en/why-us/story');
    const pages = messages.pages as Record<string, unknown>;
    expect(pages).toHaveProperty('whyUsStory');
  });

  it('未知路径不加载多余页面模块（pages 为空对象），不抛错', async () => {
    const messages = await loadMessages('zh-TW', '/zh-TW/not-a-real-page');
    expect(messages.pages).toEqual({});
  });
});
