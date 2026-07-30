# C 端网站（www.tzjii.com）SEO 现状评估与优化方案

> 评估日期：2026-07-29（代码走查 + 生产站实测双重验证）
> 范围：`apps/web`（Next.js App Router + next-intl 三语言，生产域名 https://www.tzjii.com）
> 结论先行：**基础设施层（sitemap/robots/JSON-LD/SSR/301 规范化）已经相当完整，
> 但存在 2 个 P0 级硬伤——首页完全没有 metadata、canonical 与 sitemap 的 URL
> 与真实 URL（带 locale 前缀）不一致导致全站收录信号失效。修好这两条，
> SEO 基本盘即可及格；其余为增量优化。**

---

## 一、现状评估

### 1.1 已具备的能力（做得好的部分）

| 能力 | 实现位置 | 说明 |
|------|---------|------|
| 集中式 SEO 工具层 | `apps/web/src/lib/seo.ts`（`generateSeo`）、`src/lib/i18n/metadata.ts`（`createPageMetadata`） | title/description/OG/Twitter/canonical 一处生成，全站复用 |
| metadataBase | `seo.ts` L15，取 `NEXT_PUBLIC_SITE_URL`（`src/lib/site.ts`） | 相对路径资源可正确解析为绝对 URL |
| 动态 sitemap | `src/app/sitemap.ts` | 静态路由（含 changefreq/priority 分级）+ cases/blog/news 各 500 条动态 slug + solutions 本地 slug |
| robots | `src/app/robots.ts` | allow `/`、disallow `/api/`、声明 sitemap 地址 |
| PWA manifest | `src/app/manifest.ts` | 名称/图标/品牌色齐备 |
| 结构化数据 | `src/lib/jsonld.ts` + `src/components/JsonLd.tsx`（含单测） | Organization（全站，`[locale]/layout.tsx`）、Article+BreadcrumbList（案例详情）、Event+Breadcrumb（展会详情）；`<` 转义防 XSS |
| OG / Twitter 卡 | `generateSeo` 统一输出 | 1200×630 og 图，`public/media/og-default.jpg` 兜底 |
| 服务端渲染完整 | 全部 page.tsx 为 RSC，`'use client'` 仅限交互组件 | 正文、导航、页脚均在 HTML 中直出（对百度等 JS 渲染弱的引擎友好）；实测首页 HTML 含完整中文内容 |
| 数据获取带缓存 | `src/lib/api.ts`（GET revalidate 60s）、site-settings revalidate 300s | SSR 页面有 fetch 层缓存兜底 |
| 域名规范化 | `infra/docker/nginx/templates/tzj.conf.template` | http→https 301；裸域 `tzjii.com` 301 → `www.tzjii.com`（L104-110），无双入口 |
| HSTS | `next.config.ts` securityHeaders | `max-age=63072000; includeSubDomains; preload` |
| 图片优化 | next/image（`MediaImage` 封装）avif/webp、响应式 srcset、首屏 preload/eager，抽样 alt 覆盖良好 | 实测首页 hero 输出 8 档 srcset + OSS 图片处理参数 |
| 性能细节 | 字体 `display: swap`、`optimizePackageImports: ['lucide-react']`、聊天/Markdown 大依赖按需加载、埋点延迟加载 | 首屏包体控制意识良好 |
| 草稿保护 | 详情页 `previewToken` 请求输出 `robots: noindex`（如 `cases/[slug]/page.tsx` L41） | 预览页不会被收录 |
| 语义化 | 关键页有唯一 `<h1>`（rb-h1），装饰图标 `aria-hidden` | — |

### 1.2 问题清单（按严重度）

#### 🔴 P0-1 首页没有任何 metadata（最高权重页面裸奔）

- `src/app/layout.tsx`（根）、`src/app/[locale]/layout.tsx`、`src/app/[locale]/page.tsx`
  **三处均未导出 `metadata` / `generateMetadata`**。
- `seo.ts` L55-60 定义了 `defaultMetadata`，但没有任何挂载点引用它（死代码）。
- **生产实测确认**：`curl https://www.tzjii.com/zh-CN` 的完整 HTML 中
  **没有 `<title>`、没有 description、没有 canonical、没有 og 标签**。
- 影响：搜索结果标题由引擎随意生成；首页作为品牌词着陆页的排名与点击率直接受损。
  同时因 layout 无 metadata，任何**忘记写 `generateMetadata` 的子页**也一并裸奔（无兜底）。

#### 🔴 P0-2 canonical / sitemap URL 与真实 URL 不一致（收录信号全部失效）

- i18n 路由是 `localePrefix: 'always'`（`src/i18n/routing.ts`），真实页面 URL 是
  `/zh-CN/cases`、`/en/cases` 等。
- 但 `generateSeo` 的 canonical（`seo.ts` L27/L51）与 `sitemap.ts` 的所有 URL
  **均不带 locale 前缀**（如 `https://www.tzjii.com/cases`）。
- **生产实测确认**：
  - sitemap 中的 `https://www.tzjii.com/cases` 实际返回 **307 → /zh-CN/cases**；
  - `/zh-CN/cases` 页面的 canonical 却指回 `https://www.tzjii.com/cases`（一个跳转页）。
- 影响：
  1. sitemap 提交的每一条 URL 都是重定向，搜索引擎会标记"已提交但重定向"，等于白提交；
  2. canonical 指向重定向 URL 属于无效 canonical，规范化信号作废；
  3. 三个语言版本页面的 canonical 相同，zh-TW/en 页面会被判定为 zh-CN 的重复页而不收录。

#### 🟠 P1-1 无 hreflang 互指（三语言站点的国际化 SEO 缺失）

- 全仓无 `alternates.languages`；`og:locale` 硬编码 `zh_CN`（`seo.ts` L43）。
- zh-CN / zh-TW / en 三版页面之间没有 hreflang 成对互指，Google 无法把
  英文页面匹配给英文搜索用户（对做外贸获客的 B2B 站是实际损失）。

#### 🟠 P1-2 sitemap lastModified 恒为当前时间，且缺 zh-TW/en 条目

- `sitemap.ts` 所有条目 `lastModified: new Date()` —— 每次抓取都"全站刚更新"，
  引擎会直接忽略该信号，失去"增量抓取提示"价值。
- sitemap 只含（无前缀的）单语言 URL，zh-TW/en 页面完全不在 sitemap 中。

#### 🟠 P1-3 内容详情页强制 SSR（抓取预算与 TTFB）

- `cases/[slug]`、`resources/blog|news|trade-shows/[slug]` 无 `generateStaticParams`，
  且 `searchParams`（previewToken）同时参与 `generateMetadata` 与页面渲染，
  使这些页面**每请求 SSR**（无法 ISR/静态化）。
- 2C2G 单机下爬虫批量抓取详情页时 TTFB 波动大，影响抓取效率与 CWV（TTFB/LCP）。

#### 🟡 P2（增量项）

| # | 问题 | 事实 |
|---|------|------|
| P2-1 | 产品线页面无 Product 结构化数据 | `jsonld.ts` 已有 `productJsonLd` 工具，但 fixed-tower / modular-tower / burn-rooms 等产品页未注入 |
| P2-2 | 无可见面包屑 UI | 面包屑仅存在于 JSON-LD，页面上无对应导航（内链与用户路径双损失） |
| P2-3 | keywords 全站同一组 7 个词 | 现代引擎基本忽略 keywords meta，全站同词更无意义；title 后缀为手工拼接而非 `title.template` 机制 |
| P2-4 | 无搜索引擎侧运营设施 | 未见 Google Search Console / Bing / 百度站长平台验证痕迹；sitemap 未主动提交；无百度主动推送 |
| P2-5 | 无 C 端 Lighthouse/CWV 卡口 | `.github/workflows/perf.yml` 实为 Admin 后台性能度量，C 端无性能回归防线 |
| P2-6 | 压缩链路未验证 | nginx 模板无 gzip/brotli 指令；Next standalone 默认 `compress: true` 应已对 HTML gzip，但需实测确认（见 §3 验证清单） |
| P2-7 | robots.txt 偶发异常一次 | 实测中首次请求 `/robots.txt` 曾返回 404 HTML（含 noindex meta），复测稳定 200 text/plain。疑为冷启动瞬态，需复核（见 §3） |

---

## 二、优化方案

> 原则：不改 URL 结构（保持 `localePrefix: 'always'`）、不引第三方 SEO 库、
> 改动收敛在既有集中式 SEO 层（`seo.ts` / `i18n/metadata.ts` / `sitemap.ts`），
> 符合小站"小而美"约束。所有权：`apps/web/src/**` 属 A2，无需架构审批。

### 阶段一：P0 修复（半天工作量，优先上线）

**1. `generateSeo` 支持 locale，修正 canonical + 输出 hreflang**（`src/lib/seo.ts`）

- 新增 `locale` 参数；canonical 改为 `${siteConfig.url}/${locale}${path}`；
- 同步输出 `alternates.languages`：三语言 URL + `x-default`（指向默认语 zh-CN）；
- `og:locale` 按 locale 映射（`zh_CN` / `zh_TW` / `en_US`），并输出 `alternateLocale`；
- `createPageMetadata`（`src/lib/i18n/metadata.ts`）内部 `getLocale()` 取值下传，
  **所有既有调用方零改动**；详情页等直接调 `generateSeo` 的少数点位补传 locale。

**2. 给 `[locale]/layout.tsx` 加 `generateMetadata` 作全站兜底**

- 用 i18n 命名空间（common）输出本地化的默认 title/description；
- 启用 `title: { default, template: '%s | 拓之迹' }`，替代手工拼接后缀
  （`generateSeo` 内保留现拼接以兼容，逐步过渡）；
- 首页 `[locale]/page.tsx` 加 `generateMetadata`（走 `createPageMetadata`，
  在 messages 中补 `pages.home.meta.*` 三语言文案）；
- 删除或改造 `seo.ts` 中悬空的 `defaultMetadata`。

**3. `sitemap.ts` 补 locale 前缀 + 三语言 + hreflang**

- 每条路由展开为三语言条目（或使用 Next sitemap 的 `alternates.languages` 单条多语言形式）；
- URL 全部带 locale 前缀，保证 **sitemap 内 URL 直接 200、零跳转**。

**验收（上线后 curl 实测）**：
- `curl https://www.tzjii.com/zh-CN` 出现 `<title>`、description、canonical=`.../zh-CN`、hreflang×4；
- sitemap 抽样 10 条 URL 全部 200 无 30x；
- 三语言同一页面 canonical 各自指向自身、hreflang 成对互指。

### 阶段二：P1 修复（1-2 天）

**4. sitemap 使用真实更新时间**

- cases/blog/news 列表 API 响应已含时间字段的直接使用（`updatedAt ?? publishedAt`）；
  若列表接口未返回，则 api 侧补充该字段（A2 职责，API 为新增字段不动既有契约）；
- 静态路由 `lastModified` 移除（不输出比恒为 now 更诚实）或用发版日期。

**5. 详情页可静态化：预览与正式路径解耦**

- 推荐方案：预览走独立路由 `/[locale]/preview/{cases|blog|news|trade-shows}/[slug]`
  （admin 后台生成的预览链接改指新路径，预览路由整体 `noindex` + `dynamic = 'force-dynamic'`）；
- 正式详情页移除 `searchParams` 依赖 → 可加 `generateStaticParams`（首屏拉热门 slug）
  \+ ISR（`revalidate = 300`），CMS 发布后最多 5 分钟生效，与现网 fetch 缓存节奏一致；
- 替代方案（改动最小）：仅把 `generateMetadata` 与页面中的 previewToken 读取改为
  `draftMode()` / cookie 方案。两案选一，推荐前者（语义清晰、爬虫路径纯净）。

**6. 产品页注入 Product JSON-LD + 可见面包屑**

- 产品线页（fixed-tower / modular-tower / burn-rooms / accessories / specialized-training）
  用现成 `productJsonLd` 注入（brand=拓之迹、image、description）；
- 新增轻量 `Breadcrumbs` 组件（服务端组件，与 `breadcrumbJsonLd` 同一数据源），
  在产品/内容详情页头部渲染，兼顾内链与移动端可用性。

### 阶段三：P2 运营与防线（持续，代码量小）

7. **站长平台接入**：GSC + Bing Webmaster + 百度站长平台完成站点验证
   （DNS TXT 或 meta 验证，meta 方式可挂在 layout metadata `verification` 字段），
   提交 sitemap；百度侧配置主动推送（API push，可在内容发布 hook 中调用，后续单独评估）。
8. **keywords 治理**：`generateSeo` 的 keywords 改为可选参数按页覆盖，长期可直接移除全站统一词。
9. **C 端性能防线**：新增手动触发的 Lighthouse 工作流（复用 perf.yml 模式），
   预算参考：首页/产品页 LCP < 2.5s、CLS < 0.1、SEO 分 ≥ 95，只记录不卡口。
10. **验证清单落地**（见下节）后按季度复查。

---

## 三、上线后验证清单

```bash
# 1. 首页 metadata（应有 title/canonical/hreflang）
curl -s https://www.tzjii.com/zh-CN | grep -oE '<title>[^<]*|canonical" href="[^"]*|hreflang="[^"]*"'

# 2. sitemap URL 零跳转（抽样应全为 200）
curl -s https://www.tzjii.com/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' \
  | head -20 | xargs -I{} curl -s -o /dev/null -w "%{http_code} {}\n" {}

# 3. robots.txt 稳定性（连续 5 次应全为 200 text/plain，复核 P2-7 瞬态 404）
for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{http_code}\n" https://www.tzjii.com/robots.txt; done

# 4. HTML 压缩是否生效（应出现 content-encoding: gzip 或 br）
curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip, br' https://www.tzjii.com/zh-CN | grep -i content-encoding

# 5. 结构化数据：Google Rich Results Test 首页/案例详情/产品页各测一次
```

---

## 四、工作量与风险

| 阶段 | 内容 | 预估 | 风险 |
|------|------|------|------|
| 一 | canonical/hreflang/首页 metadata/sitemap 前缀 | 0.5 天 | 低；集中在 seo.ts 与 sitemap.ts，调用方几乎零改动 |
| 二 | lastmod 真实化、详情页 ISR 化（预览路由解耦）、Product JSON-LD、面包屑 | 1-2 天 | 中；预览链接改路径需 admin 侧同步改预览 URL 生成 |
| 三 | 站长平台、keywords 治理、Lighthouse 防线 | 零散 | 低；多为配置与运营动作 |

不做的事（明确排除）：不改 URL 结构 / 不上第三方 SEO SaaS / 不做伪静态多语言子域名 /
不引入 next-sitemap 等额外依赖（Next 原生 Metadata API 足够）。

---

## 附：关键事实索引

- 首页无 metadata：`apps/web/src/app/[locale]/page.tsx`、`[locale]/layout.tsx`（均无导出）；生产 HTML 实测无 `<title>`
- canonical 无前缀：`apps/web/src/lib/seo.ts` L27、L51
- sitemap 无前缀 + lastmod=now：`apps/web/src/app/sitemap.ts` L21-L60；实测 `/cases` → 307 `/zh-CN/cases`
- locale 策略：`apps/web/src/i18n/routing.ts`（`localePrefix: 'always'`）
- 详情页强制 SSR：`apps/web/src/app/[locale]/cases/[slug]/page.tsx` L17-L46（searchParams 进 metadata）
- 域名 301 规范化：`infra/docker/nginx/templates/tzj.conf.template` L11-L18、L104-L110
- JSON-LD 工具：`apps/web/src/lib/jsonld.ts`（productJsonLd 尚未被产品页使用）
- 站点 URL 源：`apps/web/src/lib/site.ts`（`NEXT_PUBLIC_SITE_URL`，构建期注入见 `apps/web/Dockerfile` L40/L44）
