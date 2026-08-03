# C 端网站图片加载体验优化方案

> 日期：2026-08-03
> 状态：方案待评审，未开始实施
> 影响范围：`apps/web`（www.tzjii.com C 端官网）
> 关联文档：`docs/web-legacy-images-migration-plan.md`（图片资产迁移）、`docs/web-seo-assessment-and-plan.md`

---

## 一、现状分析

### 1.1 当前图片加载链路

```
浏览器 → Next.js <Image> → ossImageLoader → MinIO（本地）/ 对象存储（生产）
```

| 组件 / 文件 | 当前能力 | 缺失 |
|---|---|---|
| `MediaImage.tsx` | `next/image` 封装、自定义 loader、默认 lazy | ❌ 无 `placeholder`、无 blurDataURL、无加载过渡动画 |
| `oss-image-loader.ts` | 按宽/质量/格式拼装处理参数 | ❌ 不生成模糊缩略图、不返回 blurDataURL |
| `next.config.ts` | `formats: ['image/avif', 'image/webp']`、qualities 分档 | ✅ 格式已到位，但 placeholder 未启用 |
| 案例/新闻列表卡片 | `fill` + `aspect-[4/3]` + `object-cover` | ❌ 加载时黑块/空白，无视觉过渡 |
| 详情页 Hero | `loading="eager"` + `fetchPriority="high"` | ❌ 大图加载无占位，直接跳出 |
| Markdown 正文图 | `fill` + `aspect-[16/9]` 容器 | ❌ 同上 |
| `generate-placeholders.mjs` | 为缺失源图生成纯色 1600×900 PNG 兜底 | ⚠️ 仅解决"源文件不存在"的破图问题，不是加载体验占位 |

### 1.2 用户体验痛点

1. **黑块/空白闪烁**：列表页 9 张卡片同时 lazy 加载，网络慢时整屏灰色/黑色方块
2. **无过渡动画**：图片解码完成后瞬间"跳出"，与周围已有文字的页面产生视觉断裂
3. **CLS 隐患**：虽有 `aspect-[4/3]` 容器，但 `bg-neutral-900` 背景与最终图片色差大，感知上仍有"闪"
4. **Hero 大图无模糊预热**：详情页首屏 Hero 图（1920×500+）加载期间整块黑色，LCP 体感差
5. **lazy 图片 `unoptimized` 副作用**：当前 lazy 图跳过 Next.js 优化管线，意味着浏览器拿到的是原图尺寸，无 `srcSet` 多尺寸适配

### 1.3 技术债根因

- `MediaImage` 在 spread `...props` 时未暴露 `placeholder` / `blurDataURL`，调用方无法传入
- 没有"模糊缩略图"的独立生成通道
- 项目未引入 `sharp` 或类似工具做构建期 / 请求期 blur 处理

---

## 二、2026 年图片加载最佳实践综述

> 来源：web.dev、SitePoint、Next.js 官方文档、DebugBear 等 2025–2026 年度综述

### 2.1 技术全景

| 技术 | 成熟度 | 浏览器支持 | 本项目适用性 |
|---|---|---|---|
| **AVIF 格式** | 成熟 | Chrome 96+, Firefox 93+, Safari 16+ (94%+) | ✅ `next.config.ts` 已启用 |
| **WebP 格式** | 成熟 | 全主流浏览器 (97%+) | ✅ loader 已输出 |
| **CSS shimmer / skeleton** | 行业标准 | 全浏览器 | ✅ 零依赖，本次重点 |
| **CSS fade-in 过渡** | 行业标准 | 全浏览器 | ✅ 零依赖 |
| **`placeholder="blur"` + blurDataURL** | Next.js 原生 | 依赖 Next.js Image | ⚠️ 需要 blurDataURL 来源 |
| **`onLoad` 回调 + CSS filter 过渡** | 行业标准 | 全浏览器 | ✅ 客户端 blur-up |
| **CSS `content-visibility: auto`** | 成熟 | Chrome 85+, Edge 85+ (90%+) | ✅ 列表页适用 |
| **`fetchpriority="high"`** | 成熟 | Chrome 101+, Safari 17+ (90%+) | ✅ Hero/LCP 已用 |
| **`<link rel="preload">` for images** | 成熟 | 全主流浏览器 | ✅ LCP 图预加载 |
| **CSS `aspect-ratio`** | 成熟 | 全浏览器 (96%+) | ✅ 已有 aspect-[4/3] |
| **Native `loading="lazy"`** | 成熟 | 全浏览器 (94%+) | ✅ 已用 |
| **`decoding="async"`** | 成熟 | 全浏览器 | ✅ Next.js 默认 |

### 2.2 推荐组合策略（2026 共识）

```
┌──────────────────────────────────────────────────────────────────┐
│                    图片加载体验分层                                │
├──────────────┬───────────────────────────────────────────────────┤
│ LCP 图       │ eager + fetchPriority=high + preload              │
│              │ + shimmer 骨架 → onLoad 后 fade-in 过渡            │
├──────────────┼───────────────────────────────────────────────────┤
│ 列表卡片图    │ lazy + shimmer 骨架背景                           │
│              │ + onLoad 后 opacity fade-in 过渡                   │
├──────────────┼───────────────────────────────────────────────────┤
│ 正文配图      │ lazy + shimmer 骨架                               │
│              │ + content-visibility: auto                        │
├──────────────┼───────────────────────────────────────────────────┤
│ 格式优先级    │ AVIF > WebP > JPEG/PNG                            │
│              │ 响应式 srcSet（next/image 自动生成）                │
└──────────────┴───────────────────────────────────────────────────┘
```

### 2.3 占位方案对比（不依赖 OSS 图片处理）

| 方案 | 优点 | 缺点 | 推荐度 |
|---|---|---|---|
| **A. CSS shimmer 骨架 + onLoad fade-in** | 零依赖、零额外请求、全环境一致、实现简单 | 无"模糊→清晰"的 LQIP 效果 | ⭐⭐⭐⭐⭐ |
| **B. 构建期 sharp 生成 blurDataURL** | 有完整 blur-up 效果 | 需引入 sharp（~60MB native devDep）、构建期需访问图片源 | ⭐⭐⭐⭐ |
| C. 前端 Canvas 降采样 | 无服务端依赖 | 需先加载原图再降采样，违背初衷 | ⭐⭐ |
| D. 纯色背景占位 | 最简单 | 无过渡感，与现状差异不大 | ⭐⭐ |

**结论：采用方案 A — CSS shimmer 骨架 + onLoad fade-in 过渡**。零新依赖、零额外网络请求、本地/生产体验完全一致。后续若启用 OSS 图片处理或引入 sharp，可平滑升级到 `placeholder="blur"` 方案（见 §七）。

---

## 三、优化方案

### 3.1 总体目标

1. **消除"黑块闪烁"**：所有图片加载期间展示 shimmer 骨架占位
2. **平滑过渡**：图片就绪后 shimmer → 清晰图的 opacity fade-in 动画
3. **CLS 归零**：所有图片容器保持 `aspect-ratio`，占位背景与最终图同尺寸
4. **LCP 提升**：Hero 图通过 preload + shimmer 占位加速感知
5. **零新依赖**：不引入 sharp / plaiceholder 等包，纯 CSS + React 状态

### 3.2 核心机制

#### 3.2.1 加载状态模型

```
┌──────────┐   图片开始加载   ┌──────────┐   onLoad 触发   ┌──────────┐
│ shimmer  │ ──────────────→ │ fade-in  │ ──────────────→ │ 清晰图   │
│ 骨架动画  │                 │ 过渡动画  │                 │ 正常显示  │
└──────────┘                 └──────────┘                 └──────────┘
     ↑                            ↑
  opacity: 0                 opacity: 0 → 1
  filter: blur(0)            filter: blur(6px) → blur(0)
                             transition: 400ms
```

#### 3.2.2 MediaImage 组件增强

新增 `onLoad` 回调驱动的 fade-in 过渡：

```typescript
// apps/web/src/components/MediaImage.tsx 关键改动
'use client';

import { useState } from 'react';
import type { ImageProps } from 'next/image';
import NextImage from 'next/image';
import { resolveMediaUrl } from '@/lib/media-url';
import { ossImageLoader } from '@/lib/oss-image-loader';
import { cn } from '@/lib/utils';

type MediaImageProps = ImageProps & {
  /** 是否启用加载过渡动画（默认 true） */
  fadeOnLoad?: boolean;
};

export function MediaImage({
  preload,
  loading,
  unoptimized,
  fadeOnLoad = true,
  className,
  onLoad,
  ...props
}: MediaImageProps) {
  const [loaded, setLoaded] = useState(false);
  const rawSrc = typeof props.src === 'string' ? props.src : '';
  const src = rawSrc ? resolveMediaUrl(rawSrc) : rawSrc;
  const resolvedLoading = loading ?? (preload ? 'eager' : 'lazy');
  const isLazy = resolvedLoading === 'lazy';

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    onLoad?.(e);
  };

  return (
    <NextImage
      {...props}
      src={src || props.src}
      preload={preload}
      loading={resolvedLoading}
      unoptimized={unoptimized ?? isLazy}
      loader={ossImageLoader}
      className={cn(
        className,
        fadeOnLoad && !loaded && 'opacity-0',
        fadeOnLoad && loaded && 'rb-img-fadein',
      )}
      onLoad={handleLoad}
    />
  );
}
```

> **设计要点**：
> - 图片未加载完成时 `opacity-0`（容器背景/shimmer 可见）
> - `onLoad` 触发后添加 `rb-img-fadein` 类，执行 400ms 渐入动画
> - `fadeOnLoad={false}` 可关闭过渡（用于不需要动画的场景）
> - 不依赖 `placeholder="blur"` 和 `blurDataURL`，零额外请求

### 3.3 CSS 过渡动画

```css
/* apps/web/src/app/globals.css 新增 */

/* ── 图片加载淡入动画 ── */
.rb-img-fadein {
  animation: rb-img-fadein 400ms ease-out forwards;
}

@keyframes rb-img-fadein {
  from {
    opacity: 0;
    filter: blur(8px) saturate(0.8);
  }
  to {
    opacity: 1;
    filter: blur(0) saturate(1);
  }
}

/* 减弱动画模式（无障碍） */
@media (prefers-reduced-motion: reduce) {
  .rb-img-fadein {
    animation: none;
    opacity: 1;
    filter: none;
  }
}

/* ── 骨架闪烁（用于图片容器背景） ── */
.rb-img-shimmer {
  position: relative;
  overflow: hidden;
}
.rb-img-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 40%,
    rgba(255, 255, 255, 0.12) 50%,
    rgba(255, 255, 255, 0.06) 60%,
    transparent 100%
  );
  animation: rb-shimmer 1.8s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}
@keyframes rb-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 图片加载完成后隐藏 shimmer */
.rb-img-shimmer[data-loaded="true"]::after {
  animation: none;
  opacity: 0;
  transition: opacity 300ms;
}
```

### 3.4 列表卡片 — 应用 shimmer 占位

以案例列表为例（`apps/web/src/app/[locale]/cases/page.tsx`）：

```tsx
// 改动前
<div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
  <Image
    src={pickCoverImage(item.coverImage)}
    alt={item.title}
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
    className="object-cover transition-transform duration-700 group-hover:scale-105"
  />
</div>

// 改动后
<div className="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
  <Image
    src={pickCoverImage(item.coverImage)}
    alt={item.title}
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
    className="object-cover transition-transform duration-700 group-hover:scale-105"
    /* fadeOnLoad 默认 true，自动渐入 */
  />
</div>
```

> **改动要点**：
> - 容器加 `rb-img-shimmer`：加载期间有光泽扫过动画
> - 背景色从 `bg-neutral-900`（深色）改为 `bg-neutral-200`（浅灰），与 shimmer 光线协调
> - `MediaImage` 默认 `fadeOnLoad={true}`，图片就绪后自动 fade-in

### 3.5 详情页 Hero — preload + shimmer + fade-in

```tsx
// 改动前
<section className="relative h-[420px] overflow-hidden bg-neutral-900 lg:h-[520px]">
  <Image
    src={coverImage}
    alt={caseStudy.title}
    fill
    preload
    loading="eager"
    sizes="100vw"
    className="object-cover"
  />
</section>

// 改动后
<section className="rb-img-shimmer relative h-[420px] overflow-hidden bg-neutral-800 lg:h-[520px]">
  <Image
    src={coverImage}
    alt={caseStudy.title}
    fill
    preload
    loading="eager"
    fetchPriority="high"
    sizes="100vw"
    quality={90}
    className="object-cover"
    /* fadeOnLoad 默认 true */
  />
</section>
```

### 3.6 Markdown 正文图 — shimmer 骨架

正文配图数量多、非 LCP，使用 shimmer 骨架 + fade-in：

```tsx
// apps/web/src/components/content/markdown-components.tsx
img: ({ src, alt }) => {
  if (!src || typeof src !== 'string') return null;
  return (
    <span className="rb-img-shimmer relative my-8 block aspect-[16/9] overflow-hidden bg-neutral-200">
      <Image
        src={src}
        alt={alt ?? '正文配图'}
        fill
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
      />
    </span>
  );
},
```

### 3.7 lazy 图片 `unoptimized` 问题

当前 `MediaImage` 对 lazy 图设 `unoptimized={true}`，导致浏览器拿不到 `srcSet`，只能加载单一尺寸。

**问题根源**：注释说明是为了避免 `allImgs` Map key 覆盖导致 LCP 误报。但 `unoptimized` 的代价是失去 Next.js 自动 `srcSet` + AVIF/WebP 格式协商。

**解决方案**：

1. 通过给 eager 和 lazy 图片使用不同的 `src` 键值（eager 用原 URL，lazy 加 `?lazy=1` 后缀）避免 key 冲突
2. 或者升级 Next.js 后验证该 bug 是否已修复（Next.js 15+ 可能已修复 allImgs 追踪逻辑）
3. 短期折中：保留 `unoptimized`，但通过 loader 的格式参数手动实现格式优化（当前已在做）

> 此项需评估 Next.js 版本，如已修复则直接移除 `unoptimized` 逻辑。

---

### 3.8 预加载策略

#### 3.8.1 LCP 图 `<link rel="preload">`

对 Hero / 详情页首屏大图，通过 Next.js 的 `preload` prop 已自动生成 `<link rel="preload" as="image">`。需确认以下页面均已设置：

| 页面 | LCP 图 | preload 状态 |
|---|---|---|
| 首页 Hero | `hero.mp4` poster | ✅ 已设置 |
| 案例详情 | `coverImage` | ✅ 已设置 |
| 新闻详情 | `coverImage` | ✅ 已设置 |
| 博客详情 | `coverImage` | ✅ 已设置 |
| 产品子页面 | PageHero poster | ✅ 已设置 |

#### 3.8.2 关键资源 DNS 预解析

`next.config.ts` 已有 `X-DNS-Prefetch-Control: on`，确保存储域名被预解析：

```html
<!-- 在 layout.tsx 的 <head> 中追加（如尚未自动注入） -->
<link rel="dns-prefetch" href="https://static.tzjii.com" />
<link rel="preconnect" href="https://static.tzjii.com" crossorigin />
```

---

### 3.9 高级优化（可选，后续迭代）

#### 3.9.1 `content-visibility: auto`

对列表页视口外的卡片启用渲染跳过：

```css
/* 列表卡片：视口外不渲染内部细节，滚动到附近时才渲染 */
.content-card-offscreen {
  content-visibility: auto;
  contain-intrinsic-size: auto 320px; /* 预估卡片高度 */
}
```

> 注意：需配合 `IntersectionObserver` 或 CSS 原生 `content-visibility` 使用，避免影响 SEO 爬虫渲染。

#### 3.9.2 构建期 blurDataURL 生成（引入 sharp）

若后续需要完整 blur-up 效果（模糊缩略图 → 清晰图），可在构建期用 `sharp` 生成：

```typescript
// scripts/generate-blur-data.mjs（构建期运行）
import sharp from 'sharp';

async function generateBlurDataUrl(imagePath: string): Promise<string> {
  const buffer = await sharp(imagePath)
    .resize(20, undefined, { withoutEnlargement: true })
    .blur(2)
    .webp({ quality: 10 })
    .toBuffer();
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}
```

生成的 base64 字符串（~200~500B）可存入 JSON 文件或数据库字段，运行时传给 `placeholder="blur"` + `blurDataURL={...}`。

> 此项为可选升级路径，需引入 `sharp` 作为 devDependency（~60MB），适合后续独立迭代。

---

## 四、改造清单与优先级

### P0 — 核心体验（1 天）

| # | 改造项 | 文件 | 说明 |
|---|---|---|---|
| 1 | `MediaImage` 增加 fade-in 过渡 | `MediaImage.tsx` | 新增 `fadeOnLoad` prop + `onLoad` 状态管理 |
| 2 | CSS 过渡动画 | `globals.css` | `rb-img-fadein` 关键帧 + `rb-img-shimmer` 骨架 |
| 3 | 列表卡片背景色 + shimmer | `cases/page.tsx`、`news/page.tsx`、`blog/page.tsx` | `bg-neutral-900` → `bg-neutral-200` + `rb-img-shimmer` |

### P1 — 全面覆盖（半天）

| # | 改造项 | 文件 | 说明 |
|---|---|---|---|
| 4 | 详情页 Hero shimmer | `cases/[slug]/page.tsx`、`news/[slug]/page.tsx`、`blog/[slug]/page.tsx` | 容器加 `rb-img-shimmer` |
| 5 | Markdown 正文图 shimmer | `markdown-components.tsx` | 容器加 `rb-img-shimmer` |
| 6 | 产品页图片 | `product-catalog.ts` 相关页面 | 同列表卡片处理 |
| 7 | 首页 Hero poster | `HeroSection.tsx` | 容器加 `rb-img-shimmer` |

### P2 — 高级优化（后续迭代）

| # | 改造项 | 文件 | 说明 |
|---|---|---|---|
| 8 | 评估移除 `unoptimized` | `MediaImage.tsx` | 验证 Next.js allImgs bug 是否修复 |
| 9 | `content-visibility: auto` | 列表页 CSS | 视口外卡片渲染跳过 |
| 10 | DNS 预解析确认 | `layout.tsx` | `<link rel="preconnect">` 存储域名 |
| 11 | 构建期 blurDataURL 生成 | 新增脚本 + `MediaImage` | 引入 sharp，实现完整 blur-up |

---

## 五、技术细节

### 5.1 fade-in 过渡机制详解

```
时间线：
────────────────────────────────────────────────────────→

t=0        组件挂载，图片开始加载
│          ├─ <img> opacity: 0（不可见）
│          ├─ 容器背景 bg-neutral-200 可见
│          └─ shimmer 动画开始扫过
│
t=0.5~3s   图片下载完成，onLoad 触发
│          ├─ setLoaded(true)
│          ├─ 移除 opacity-0
│          ├─ 添加 rb-img-fadein 类
│          └─ 400ms 动画：opacity 0→1 + blur(8px)→blur(0)
│
t=0.9~3.4s 动画结束，图片完全可见
│          └─ shimmer 自然被图片覆盖（z-index 关系）
```

### 5.2 shimmer 与图片的层级关系

```css
/* shimmer 的 ::after 伪元素 */
.rb-img-shimmer::after {
  z-index: 1;          /* 在图片之上 */
  pointer-events: none; /* 不阻挡交互 */
}

/* Next.js <Image> 的 <img> 渲染在容器内 */
/* 图片加载完成后自然覆盖 shimmer 视觉效果 */
/* 无需手动隐藏 shimmer —— 图片 opaque 后自然遮挡 */
```

### 5.3 性能影响评估

| 指标 | 改造前 | 改造后（预期） |
|---|---|---|
| 列表页 CLS | 0.01~0.05（图片区黑块闪烁） | ≈ 0（shimmer 占位 + aspect-ratio） |
| LCP（详情页 Hero） | 1.5~3s（大图直接加载） | 感知 0.5s（shimmer 立即出现 → 图加载完 fade-in） |
| 首屏带宽 | 无变化 | 无变化（不增加额外请求） |
| 感知加载速度 | 黑块 → 突然跳出 | shimmer 骨架 → 400ms 平滑渐入 |
| 额外请求 | 0 | 0（纯 CSS 方案） |
| JS 开销 | — | ~200B（useState + onLoad 回调） |
| CSS 开销 | — | ~500B（关键帧 + shimmer 样式） |

### 5.4 与图片迁移方案的协同

本方案与 `docs/web-legacy-images-migration-plan.md` 互补：

- 迁移方案解决"有没有图"（封面映射、资产补入）
- 本方案解决"图的加载体验"（占位、过渡、预加载）

建议实施顺序：先完成迁移（P0~P2），再落地本方案（P0→P1→P2）。迁移确保所有页面有真实图片后，shimmer 过渡才能发挥最佳效果。

---

## 六、验收标准

### 功能验收

- [ ] 所有 `MediaImage` 渲染的图片在加载期间容器显示 shimmer 骨架动画（非黑块/空白）
- [ ] 图片就绪后 shimmer → 清晰图过渡平滑（400ms fade-in + blur 消除），无视觉跳变
- [ ] 列表卡片（案例/新闻/博客）加载期间背景为浅灰色 + shimmer 扫光
- [ ] 详情页 Hero 图加载期间有 shimmer 占位，加载完成后有 fade-in 效果
- [ ] Markdown 正文图加载期间显示 shimmer 骨架动画
- [ ] 本地开发环境与生产环境体验完全一致（无环境差异）
- [ ] `prefers-reduced-motion: reduce` 下动画被禁用，图片直接显示

### 性能验收

- [ ] Lighthouse Performance 分数不降（≥ 当前值）
- [ ] CLS ≤ 0.01（图片区域无布局偏移）
- [ ] 列表页首屏 LCP 不恶化
- [ ] 无额外网络请求（对比改造前）
- [ ] CSS 增量 ≤ 1KB（gzip 后）

### 兼容性验收

- [ ] Chrome 120+：完整 shimmer + fade-in 体验
- [ ] Safari 17+：完整体验
- [ ] Firefox 120+：完整体验
- [ ] 移动端（iOS Safari / Android Chrome）：shimmer + fade-in 正常显示

---

## 七、风险与回滚

| 风险 | 缓解 |
|---|---|
| `opacity-0` 在 JS 禁用时无图可见 | Next.js 默认 CSR，SSR 输出的 HTML 不含 `opacity-0`（由 `useState(false)` 初始状态控制）；可追加 `<noscript>` 兜底 |
| shimmer `::after` 阻挡图片点击 | 已设 `pointer-events: none`，不影响交互 |
| `onLoad` 在某些 CDN 缓存场景不触发 | Next.js `<Image>` 的 `onLoad` 在 `<img>` 原生 load 事件触发，与 CDN 无关 |
| CSS 动画影响无障碍用户 | 已加 `@media (prefers-reduced-motion: reduce)` 禁用动画 |
| `bg-neutral-200` 与深色主题不协调 | 当前 C 端为浅色主题（Rosenbauer 工业风），不涉及暗色模式 |

---

## 八、未来升级路径：OSS 启用后的 blur-up 升级

当后续启用阿里云 OSS 图片处理（或引入 sharp devDependency）后，可平滑升级到完整的 **blur-up（LQIP）** 效果：

### 升级步骤

1. **新增 `ossBlurLoader`**：利用 OSS `x-oss-process=image/resize,w_20/quality,q_10/format,webp` 生成 ~200B 模糊缩略图 URL
2. **`MediaImage` 增加 `placeholder="blur"`**：将 `ossBlurLoader` 返回值作为 `blurDataURL`
3. **移除 shimmer 骨架**（可选）：blur-up 效果已足够，shimmer 可保留作为 fallback
4. **本地开发降级**：MinIO 不支持 `x-oss-process`，本地 `placeholder` 自动降级为 `"empty"`

### 升级前后对比

| 维度 | 当前方案（shimmer + fade-in） | 升级后（blur-up） |
|---|---|---|
| 占位视觉 | 骨架扫光动画 | 模糊版原图 |
| 额外请求 | 0 | 每图 +1 次 ~200B 缩略图请求 |
| 依赖 | 无 | OSS 图片处理 或 sharp |
| 本地/生产一致性 | ✅ 完全一致 | ⚠️ 本地降级 |
| 效果 | 好 | 更好（行业标杆） |

> 升级是增量改动，不影响当前方案已实现的 shimmer / fade-in 基础能力。

---

## 九、附录

### A. Next.js `placeholder` prop 行为参考

| placeholder 值 | 加载期间显示 | 需要 blurDataURL | 适用场景 |
|---|---|---|---|
| `"blur"` | 模糊版图片（`filter: blur(20px)`） | ✅ 是 | Hero、卡片封面（需 blurDataURL 来源） |
| `"empty"` | 空白（透明/背景色） | ❌ 否 | 正文配图、非关键图 |

> 当前方案使用 `"empty"`（默认值）+ CSS shimmer 容器，效果等价于 `"blur"` 但无需 blurDataURL。

### B. `prefers-reduced-motion` 无障碍适配

```css
@media (prefers-reduced-motion: reduce) {
  .rb-img-fadein {
    animation: none;
    opacity: 1;
    filter: none;
  }
  .rb-img-shimmer::after {
    animation: none;
    display: none;
  }
}
```

### C. 相关文件索引

| 文件 | 职责 |
|---|---|
| `apps/web/src/components/MediaImage.tsx` | 统一图片组件，本次改造核心 |
| `apps/web/src/lib/oss-image-loader.ts` | 图片处理 loader |
| `apps/web/src/lib/media-url.ts` | 媒体 URL 解析 |
| `apps/web/src/app/globals.css` | 全局样式，需新增过渡动画 |
| `apps/web/next.config.ts` | Next.js 图片配置 |
| `apps/web/src/components/content/markdown-components.tsx` | Markdown 正文图 |
| `apps/web/src/app/[locale]/cases/page.tsx` | 案例列表 |
| `apps/web/src/app/[locale]/cases/[slug]/page.tsx` | 案例详情 |
| `apps/web/src/components/sections/HeroSection.tsx` | 首页 Hero |
| `apps/web/src/components/ui/index.tsx` | PageHero 等共享 UI 组件 |
