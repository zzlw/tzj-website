# TZJ C 端官网（apps/web）优化方案

> 基于 `tzj-website-reconstruction/apps/web` 现状代码审查，参考业内最佳实践整理。
> 本文档仅为方案规划，不含代码改动。

---

## 一、现状快照

- **技术栈**：Next.js 16（App Router）+ React 19 + Tailwind v4 + shadcn/radix + Turbo monorepo，视觉对标 Rosenbauer 工业浅色风格，完成度不错。
- **页面**：约 30+ 个静态路由（固定塔 / 模块化塔 / 燃烧室 / 配件 / 资源中心 / 为什么选我们 / 联系我们），内容目前**全部硬编码**在页面里。
- **已有基础**：`lib/seo.ts`（OG/canonical 封装）、`lib/api.ts`（对接后端的封装）、统一 UI 原语（Container / Eyebrow / RbButton 等）、响应式导航抽屉。

---

## 二、关键问题清单（按优先级）

### P0 — 上线前必须修（影响可用性 / 收录 / 转化）

| #   | 问题                                            | 说明                                                                                                                           |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/web/public` **目录不存在**                   | `HeroSection` 的 `/media/hero.mp4`、案例图 `/media/tower-*.jpg`、`og-default.jpg` 等静态资源无处可取，线上会 404 / 破图 / 白屏首屏。这是最优先项。            |
| 2   | **首页** `<html>` **metadata 未走** `generateSeo` | `layout.tsx` 手写了 title/description/keywords，缺 `metadataBase`、OG、canonical、twitter。会导致 OG 相对路径告警、分享无预览。                       |
| 3   | **SEO 约定文件全缺**                                | 没有 `sitemap.ts` / `robots.ts` / `manifest.ts`，也没有任何 JSON-LD 结构化数据（Organization / Product / BreadcrumbList）。搜索引擎收录与富摘要能力基本为零。 |
| 4   | **缺错误 / 加载 / 404 边界**                         | 没有 `error.tsx` / `global-error.tsx` / `loading.tsx` / `not-found.tsx`。任一异常直接白屏。                                              |
| 5   | **联系表单是"半成品"**                                | 电话/邮箱是假数据（`400-000-0000`、`info@tzjii.com`）；无防垃圾（honeypot/Turnstile）、无提交结果的无障碍反馈（`aria-live`）、无字段级校验与错误提示。B2B 官网表单是核心转化入口。    |

### P1 — 强烈建议（性能 / SEO / 可访问性）

| #   | 问题                     | 说明                                                                                                     |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| 6   | **图片全部** `unoptimized` | 放弃了 `next/image` 的 AVIF/WebP、响应式尺寸、懒加载，直接拖累 LCP 与带宽。                                                   |
| 7   | **可访问性缺口**             | 抽屉菜单无 focus-trap、无 Esc 关闭、打开/关闭焦点未管理；表单状态无 `aria-live`；品牌红 `#e3000f` 在白底做正文/小字对比约 4.2:1，处于 WCAG AA 边缘。 |
| 8   | **字体方案待优化**            | Archivo 加载 6 个字重（400–900）全 latin subset；需在合规、非侵权、中国可访问三重约束下重整（见 [第五节](#五字体方案新增)）。                     |

### P2 — 中长期（架构 / 安全 / 转化）

| #   | 问题                       | 说明                                                                                    |
| --- | ------------------------ | ------------------------------------------------------------------------------------- |
| 9   | `lib/api.ts` **全** `any` | 无类型安全，建议用 `@tzj/types` 补齐 DTO 类型 + 统一错误处理/超时/重试（为后续接入 API 预留）。                         |
| 10  | **安全响应头缺失**              | `next.config.ts` 未配置 `headers()`（CSP、X-Frame-Options、HSTS、Referrer-Policy 等）。         |
| 11  | **转化链路偏薄（B2B）**          | 缺产品规格 PDF 下载、案例详情页、认证徽章与客户背书墙、数据统计动效。                                                   |
| 12  | **滚动监听未优化**              | Header 的 `scroll` 监听未加 `{ passive: true }`，可用 rAF 节流。                                  |

---

## 三、本期暂缓 / 不做（记录在案，后期再评估）

以下项本期**不实施**：

1. **i18n「假开关」修复 / 真 i18n**（`CN/EN` 切换、locale 路由、`hreflang`）——暂缓。
2. **分析与监控接入**（GA4 / 百度统计 / Web Vitals 上报 / Sentry）——暂缓。
3. **CMS / API 内容接入**（资源中心、博客、新闻、案例改为后端拉取）——暂缓，页面继续维持静态内容。
4. **在线客服 / 在线咨询**（企业微信 / 商桥等即时沟通）——暂缓。
5. **站内搜索功能**——保持现状（Header 搜索框维持纯 UI），后期再说。

---

## 四、分阶段实施方案（Roadmap）

### 阶段一：修复与地基（1 周）

1. **补齐静态资源**：新建 `apps/web/public/media/`，放入 Hero 视频（`hero.mp4`，**不压缩、不做移动端降级**，桌面与移动端统一加载完整视频）与全部案例图；补 `og-default.jpg`、`favicon`、`apple-touch-icon`。缺素材的先用占位图，避免破图。
2. **统一首页 SEO**：`layout.tsx` 增加 `metadataBase`，首页改用 `generateSeo`，补全 OG/canonical。
3. **新增约定文件**：`app/sitemap.ts`（自动列出全部路由）、`app/robots.ts`、`app/manifest.ts`、`app/not-found.tsx`、`app/error.tsx`、`app/global-error.tsx`、`app/loading.tsx`。
4. **结构化数据**：全站注入 `Organization` JSON-LD（公司名/logo/联系方式/地址），产品页注入 `Product`，内页注入 `BreadcrumbList`。
5. **表单闭环**：接真实联系方式；加 honeypot + Cloudflare Turnstile；提交结果用 `role="status"`/`aria-live` 播报；加字段校验与错误态。

### 阶段二：性能与可访问性（1–2 周）

1. **图片优化**：去掉 `unoptimized`，配置 `images.formats: ['image/avif','image/webp']`，首屏关键图加 `priority`，其余保持懒加载并补 `sizes`。
   - 注：Hero 视频维持现状（不压缩、不降级、移动端同样播放完整视频、不使用图片兜底）。
2. **无障碍**：抽屉菜单加 focus-trap + Esc 关闭 + 焦点归还；`<video>` 加 `aria-hidden`；复核并微调品牌红在小字上的对比度（正文用更深的红或加粗）。
3. **字体优化**：按[第五节](#五字体方案新增)方案落地（字重精简、`display: swap`、自托管）。

### 阶段三：加固（穿插进行）

1. `next.config.ts` 配置安全响应头（CSP/HSTS/X-Frame-Options/Referrer-Policy/Permissions-Policy）。
2. `lib/api.ts` 用 `@tzj/types` 替换 `any`，加超时/重试/统一错误（为后续接入预留）。
3. Header 滚动监听改 `{ passive: true }` + rAF。
4. **B2B 转化增强**：产品规格 PDF 下载、案例详情页（静态）、认证徽章与客户 logo 墙、统计数字滚动动效。
5. 建 CI 检查：Lighthouse CI（性能/可访问性阈值）、`biome check`、`turbo typecheck` 卡在 PR 上。

---

## 五、字体方案（新增）

**目标**：参考业内最佳实践，兼顾①版权合规（不侵权）、②中国大陆可访问、③性能。

### 结论（推荐组合）

- **中文正文**：使用**系统字体栈**，零下载、零版权风险、中国大陆必然可用：
  `"PingFang SC"`（苹果）→ `"Microsoft YaHei"`（Windows）→ `"Noto Sans SC"` → `system-ui`。
  这也是当前 `globals.css` 已有的回退策略，保留即可。
- **英文 / 数字 / 展示标题**：使用**开源可商用**字体，通过 `next/font` **自托管**：
  - 展示标题：保留 **Archivo**（SIL OFL 许可，可免费商用，非侵权），或替换为 **Inter**。
  - `next/font/google` 会在**构建时下载字体并从自有域名提供**（不在运行时请求 Google CDN），因此**在中国可正常访问**，无需担心 Google Fonts 被墙。
  - 精简字重到实际使用的 **3–4 个**（如 400 / 600 / 700 / 800），并统一 `display: swap`。

### 可选（若品牌需统一中文标题字形）

仅对**标题文案**引入一款免费商用中文字体，并做**子集化（subset）**以控制体积（中文整包常达数 MB，不可整体 webfont）。免费商用、许可清晰的候选：

- **思源黑体 / Noto Sans SC**（Adobe × Google，SIL OFL）
- **HarmonyOS Sans**（华为，免费商用）
- **MiSans**（小米，免费商用）
- **阿里巴巴普惠体**（阿里，免费商用）

### 明确规避（侵权 / 访问风险）

- **不使用**需商业授权的字体：方正、汉仪、造字工房等（未授权即侵权，风险高）。
- **不直接引用** Google Fonts / 其他境外字体 CDN 的运行时链接（中国访问不稳定）——一律走构建期自托管。
- 未经确认许可范围的字体，一律不上生产。

---

## 六、预期收益

- **收录与流量**：sitemap + 结构化数据 + 规范 metadata → 收录量与富摘要曝光提升。
- **Core Web Vitals**：图片优化 + 字体瘦身 → LCP/INP/CLS 改善（移动端首屏尤甚；Hero 视频维持现状不做降级）。
- **转化**：表单闭环 + 案例/资质背书 → 线索量与线索质量提升。
- **稳定性**：错误边界 → 线上异常不再白屏。
- **合规**：字体全部开源可商用 / 自托管，规避侵权与境外 CDN 访问风险。
