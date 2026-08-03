# C 端网站图片加载体验优化方案

> 日期：2026-08-03
> 状态：方案评审通过（12 轮），待实施
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
| 案例列表卡片 | `fill` + `aspect-[4/3]` + `object-cover` | ❌ 加载时黑块/空白，无视觉过渡（新闻列表为纯文本，无卡片图） |
| 详情页 Hero | `loading="eager"` + `preload`（多数页面无 `fetchPriority`） | ❌ 大图加载无占位，直接跳出；可顺带补充 `fetchPriority="high"`（见 §3.5） |
| Markdown 正文图 | `fill` + `aspect-[16/9]` 容器 | ❌ 同上 |
| `generate-placeholders.mjs` | 为缺失源图生成纯色 1600×900 PNG 兜底 | ⚠️ 仅解决"源文件不存在"的破图问题，不是加载体验占位 |

### 1.2 用户体验痛点

1. **黑块/空白闪烁**：列表页 9 张卡片同时 lazy 加载，网络慢时整屏灰色/黑色方块
2. **无过渡动画**：图片解码完成后瞬间"跳出"，与周围已有文字的页面产生视觉断裂
3. **CLS 隐患**：虽有 `aspect-[4/3]` 容器，但 `bg-neutral-900` 背景与最终图片色差大，感知上仍有"闪"
4. **Hero 大图无模糊预热**：详情页首屏 Hero 图（1920×500+）加载期间整块黑色，LCP 体感差
5. **lazy 图片 `unoptimized` 副作用**：当前 lazy 图跳过 Next.js 优化管线，意味着浏览器拿到的是原图尺寸，无 `srcSet` 多尺寸适配

### 1.3 技术债根因

- `MediaImage` 的 `...props` 虽然会透传 `placeholder` / `blurDataURL`，但当前没有生成 `blurDataURL` 的通道，无法启用 `placeholder="blur"`
- 没有“模糊缩略图”的独立生成通道
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
┌────────────────────────────────────────────────────────────────────┐
│                    图片加载体验分层                                │
├──────────────┬─────────────────────────────────────────────────────┤
│ LCP 图       │ eager + fetchPriority=high + preload                │
│              │ + 立即显示（无 fade-in，避免人为延迟 LCP）          │
├──────────────┼─────────────────────────────────────────────────────┤
│ 列表卡片图    │ lazy + shimmer 骨架背景                            │
│              │ + onLoad 后 opacity fade-in 过渡                    │
├──────────────┼─────────────────────────────────────────────────────┤
│ 正文配图      │ lazy + shimmer 骨架                                │
│              │ + content-visibility: auto（P2 可选）               │
├──────────────┼─────────────────────────────────────────────────────┤
│ 格式优先级    │ AVIF > WebP > JPEG/PNG                             │
│              │ 响应式 srcSet（next/image 自动生成）                │
└──────────────┴─────────────────────────────────────────────────────┘
```

### 2.3 占位方案对比（不依赖 OSS 图片处理）

| 方案 | 优点 | 缺点 | 推荐度 |
|---|---|---|---|
| **A. CSS shimmer 骨架 + onLoad fade-in** | 零依赖、零额外请求、全环境一致、实现简单 | 无"模糊→清晰"的 LQIP 效果 | ⭐⭐⭐⭐⭐ |
| **B. 构建期 sharp 生成 blurDataURL** | 有完整 blur-up 效果 | 需引入 sharp（~60MB native devDep）、构建期需访问图片源 | ⭐⭐⭐⭐ |
| C. 前端 Canvas 降采样 | 无服务端依赖 | 需先加载原图再降采样，违背初衷 | ⭐⭐ |
| D. 纯色背景占位 | 最简单 | 无过渡感，与现状差异不大 | ⭐⭐ |

**结论：采用方案 A — CSS shimmer 骨架 + onLoad fade-in 过渡**。零新依赖、零额外网络请求、本地/生产体验完全一致。后续若启用 OSS 图片处理或引入 sharp，可平滑升级到 `placeholder="blur"` 方案（见 §八）。

---

## 三、优化方案

### 3.1 总体目标

1. **消除“黑块闪烁”**：所有 **lazy** 图片加载期间展示 shimmer 骨架占位
2. **平滑过渡**：**lazy** 图片就绪后 shimmer → 清晰图的 opacity fade-in 动画
3. **CLS 归零**：所有图片容器保持 `aspect-ratio`，占位背景与最终图同尺寸
4. **LCP 提升**：Hero 图通过 preload + 背景色调浅减少加载期间黑块感
5. **零新依赖**：不引入 sharp / plaiceholder 等包，纯 CSS + React 状态

### 3.2 核心机制

#### 3.2.1 加载状态模型

```
┌──────────┐   图片开始加载     ┌──────────┐   onLoad 触发   ┌──────────┐
│ shimmer  │ ──────────────→ │ fade-in  │ ──────────────→ │ 清晰图   │
│ 骨架动画 │                 │ 过渡动画 │                 │ 正常显示 │
└──────────┘                 └──────────┘                 └──────────┘
     ↑                            ↑
  opacity: 0                 opacity: 0 → 1
  filter: blur(0)            filter: blur(8px) → blur(0)
                             animation: 400ms ease-out forwards
```

#### 3.2.2 MediaImage 组件增强

新增 `onLoad` 回调驱动的 fade-in 过渡，**eager/preload 图自动禁用**（避免 LCP 元素人为延迟）：

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
  /** 是否启用加载过渡动画。默认仅对 lazy 图开启；eager/preload 图自动关闭。 */
  fadeOnLoad?: boolean;
};

export function MediaImage({
  preload,
  loading,
  unoptimized,
  fadeOnLoad,
  className,
  onLoad,
  ...props
}: MediaImageProps) {
  const [loaded, setLoaded] = useState(false);
  const rawSrc = typeof props.src === 'string' ? props.src : '';
  const src = rawSrc ? resolveMediaUrl(rawSrc) : rawSrc;
  const resolvedLoading = loading ?? (preload ? 'eager' : 'lazy');
  // preload 会强制 eager 加载（Next.js 内部优先），矛盾组合时以 preload 为准
  const isLazy = resolvedLoading === 'lazy' && !preload;

  // eager/preload 图是 LCP 候选，不应人为 opacity-0 延迟显示；
  // 仅 lazy 图默认开启 fade-in，调用方也可显式覆盖。
  const shouldFade = fadeOnLoad ?? isLazy;

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    onLoad?.(e); // 转发给调用方，不吞掉原始回调
  };

  // 图片加载失败时也需移除 opacity-0，否则 shimmer 永不停止、图片永远不可见
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    props.onError?.(e);
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
        shouldFade && !loaded && 'opacity-0',
        shouldFade && loaded && 'rb-img-fadein',
      )}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
```

> **设计要点**：
> - **lazy 图**默认 `fadeOnLoad=true`：加载期间 `opacity-0`，就绪后 fade-in
> - **eager/preload 图**默认 `fadeOnLoad=false`：LCP 元素立即显示，不做人为延迟
> - 调用方可通过 `fadeOnLoad={true/false}` 显式覆盖默认行为
> - `onLoad` / `onError` 正确转发给调用方，不吞掉 Next.js 内部事件
> - **加载失败时** `onError` 也会移除 `opacity-0`，避免 shimmer 永不停止
> - 不依赖 `placeholder="blur"` 和 `blurDataURL`，零额外请求

### 3.3 CSS 过渡动画

```css
/* apps/web/src/app/globals.css 新增 */

/* ── 图片加载淡入动画（lazy 图 onLoad 后触发） ── */
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
    filter: none; /* 动画结束移除 filter，避免合成层常驻 */
  }
}

/* ── 骨架闪烁（用于图片容器 background） ──
 * 使用 background-image 而非 ::after 伪元素，
 * 好处：不透明的 <img> 加载完成后自然遮盖背景，无需 JS 手动隐藏 shimmer。
 * 说明：background 限制在容器 padding box 内不会溢出；
 *       overflow-hidden 的真实用途是配合图片 hover 放大（scale-105）裁切。
 */

/* 浅色 shimmer —— 用于无遮罩的纯图片容器（配 bg-neutral-200）
 * 层级说明：Tailwind 工具类在 @layer utilities 中，本类（非 layer）优先级更高，
 * 其 background 简写（background-color: transparent）会覆盖 bg-neutral-200；
 * 但渐变 200% 宽 + repeat 满铺容器，视觉完全由渐变决定，背景色仅作兜底。 */
.rb-img-shimmer {
  background: linear-gradient(
    90deg,
    #e5e5e5 0%,
    #f0f0f0 40%,
    #f5f5f5 50%,
    #f0f0f0 60%,
    #e5e5e5 100%
  );
  background-size: 200% 100%;
  animation: rb-shimmer 1.8s ease-in-out infinite;
}

/* 深色 shimmer —— 用于带 rb-media-shade 叠加的容器（配 bg-neutral-900）
 * 这些容器上方有白色文字，加载期间需保持深色背景以维持文字可读性。
 * rb-media-shade 渐变（rgba(10,10,10,0.88) → transparent）会叠在此背景上。
 */
.rb-img-shimmer-dark {
  background: linear-gradient(
    90deg,
    #262626 0%,
    #303030 40%,
    #383838 50%,
    #303030 60%,
    #262626 100%
  );
  background-size: 200% 100%;
  animation: rb-shimmer 1.8s ease-in-out infinite;
}

@keyframes rb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 减弱动画模式（无障碍） */
@media (prefers-reduced-motion: reduce) {
  .rb-img-fadein {
    animation: none;
    opacity: 1;
    filter: none;
  }
  .rb-img-shimmer {
    animation: none;
    background: #e5e5e5; /* 静态浅灰占位，不闪烁 */
  }
  .rb-img-shimmer-dark {
    animation: none;
    background: #262626; /* 静态深灰占位，不闪烁 */
  }
}
```

> **为什么用 `background-image` 而非 `::after` 伪元素？**
>
> `::after` 方案会在图片上方创建一个 `z-index: 1` 的覆盖层，图片加载后 shimmer 永远不会消失（需要 JS 设 `data-loaded` 属性，但 `MediaImage` 内部的 `loaded` 状态无法传递给父容器）。
>
> `background-image` 方案中，shimmer 是容器自身的背景。`<img>` 渲染在背景之上，一旦图片不透明（`opacity: 1`），自然完全遮盖背景——**零 JS 依赖，纯 CSS 自动完成**。

### 3.4 列表卡片 — 应用 shimmer 占位

图片容器分四类，必须选择正确的 shimmer 变体（实施时以「完整文件清单」标注的类型为准）：

| 类型 | 特征 | shimmer 类 | 背景色 | 示例文件 |
|---|---|---|---|---|
| **A 型：纯图片容器** | 无 `rb-media-shade`、无白色文字 | `rb-img-shimmer` | `bg-neutral-200` | `cases/page.tsx`、`burn-rooms/liner` |
| **B 型：遮罩+白字容器** | 有 `rb-media-shade` / `rb-on-media` + 白色文字 | `rb-img-shimmer-dark` | **保持 `bg-neutral-900`** | `ProductLineCard`、`solutions/page.tsx` |
| **白色背景型：产品图** | `object-contain p-4` 浅底产品图（白/灰底） | **不加 shimmer**（图片不铺满容器，动画会永久循环） | 保持 `bg-white` / `bg-neutral-100` | `fixed-tower/series`、`modular-tower/series` |
| **视频 poster 型** | 视频背景区（`MediaImage` 或 video poster） | **不加 shimmer** | 保持 `bg-neutral-900` | `HeroSection`、`MissionSection` |

> **为什么 B 型不能改 `bg-neutral-200`？**
> `rb-media-shade` 是 `rgba(10,10,10,0.88) → transparent` 的底部渐变。
> 若背景改为浅灰，加载期间白色文字会叠在浅色背景上（遮罩顶部透明区域），可读性崩溃。

**A 型示例 — 案例列表（纯图片容器，无遮罩）：**

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
    /* lazy 图 fadeOnLoad 默认 true，自动渐入 */
  />
</div>
```

> **改动要点**：
> - 容器加 `rb-img-shimmer`：加载期间有光泽扫过动画
> - 背景色从 `bg-neutral-900`（深色）改为 `bg-neutral-200`（浅灰），与 shimmer 光线协调
> - `MediaImage` 默认 `fadeOnLoad={true}`，图片就绪后自动 fade-in

**B 型示例 — ProductLineCard / QuickLinksSection（遮罩+白字容器）：**

```tsx
// 改动前（ProductLineCard.tsx）
<div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
  <Image src={line.image} alt={line.title} fill sizes="(max-width: 768px) 100vw, 33vw" quality={70} />
  <div className="absolute inset-0 rb-media-shade opacity-80" />
  <h3 className="absolute bottom-5 left-5 right-5 font-display text-xl font-bold text-white">{line.title}</h3>
</div>

// 改动后（保持深色背景，用深色 shimmer；lazy 图 fadeOnLoad 默认 true，自动渐入）
<div className="rb-img-shimmer-dark relative aspect-[16/10] overflow-hidden bg-neutral-900">
  <Image src={line.image} alt={line.title} fill sizes="(max-width: 768px) 100vw, 33vw" quality={70} />
  <div className="absolute inset-0 rb-media-shade opacity-80" />
  <h3 className="absolute bottom-5 left-5 right-5 font-display text-xl font-bold text-white">{line.title}</h3>
</div>
```

> **B 型改动要点**：
> - 背景色**保持 `bg-neutral-900`**，不改色
> - 加 `rb-img-shimmer-dark`（深灰扫光），加载期间白色文字仍可读
> - 适用于 `ProductLineCard`、`QuickLinksSection`、`Footer` 等带遮罩+白字的容器

### 3.5 详情页 Hero — preload + 无 fade-in

Hero 图是 LCP 元素，`MediaImage` 已自动对 `loading="eager"` / `preload` 图禁用 fade-in，
因此**无需额外改动**——只需将容器背景色调浅，减少加载期间的深色黑块感：

```tsx
// 改动前
<section className="relative h-[420px] overflow-hidden bg-neutral-900 lg:h-[520px]">
  <Image src={coverImage} alt={title} fill preload loading="eager" sizes="100vw" className="object-cover" />
</section>

// 改动后（仅调背景色 + 补充 LCP 属性，不加 shimmer）
<section className="relative h-[420px] overflow-hidden bg-neutral-800 lg:h-[520px]">
  <Image src={coverImage} alt={title} fill preload loading="eager" fetchPriority="high"
    sizes="100vw" quality={90} /* LCP 图强制高质量，避免 Next.js 自动选择过低质量 */
    className="object-cover" />
  {/* fadeOnLoad 自动为 false，图片立即显示 */}
</section>
```

> **注意**：现状大部分详情页 Hero 仅有 `preload` + `loading="eager"`，**尚未设置 `fetchPriority="high"` 和 `quality={90}`**（仅首页 HeroSection 已设置）。本次改动顺带补充这两个 LCP 属性。

> **为什么不加 shimmer？**
> 1. Hero 图是 LCP 元素，`fadeOnLoad` 已自动禁用，图片几乎立即显示，shimmer 没有展示窗口
> 2. Hero 已有 `rb-media-shade-strong` 遮罩层 + 文字内容，加载期间视觉反馈已足够；若强行加 shimmer，遮罩底部不透明区域与上部透明区域会形成“下半深色 + 上半扫光”的割裂效果（遮罩是独立 absolute 层，无 z-index，靠 DOM 顺序叠在图片上方）
> 3. 仅将容器背景调浅（`bg-neutral-900` → `bg-neutral-800`），减少加载期间深色黑块感

### 3.6 Markdown 正文图 — shimmer 骨架

正文配图数量多、非 LCP，使用 shimmer 骨架 + fade-in：

```tsx
// apps/web/src/components/content/markdown-components.tsx
// 改动前：bg-neutral-100（当前实际值）
// 改动后：bg-neutral-200 + rb-img-shimmer
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

1. **首选**：项目当前为 Next.js 16.2.9，`allImgs` 追踪大概率已修复；直接实验移除 `unoptimized` 逻辑（见 P2 项 8），用 Lighthouse 对比 LCP 确认无回归后落地
2. **临时 workaround**（有风险）：给 lazy 图 `src` 加 `?lazy=1` 后缀避免 key 冲突，但会导致 OSS loader 生成额外缓存键、CDN 视为不同资源，不推荐长期使用
3. **短期折中**：保留 `unoptimized`，但通过 loader 的格式参数手动实现格式优化（当前已在做）

> 当前 Next.js 16.2.9 大概率已修复 `allImgs` 追踪，P2 阶段直接实验验证后移除 `unoptimized` 逻辑。
>
> **注意**：`unoptimized={true}` 期间，`sizes` 属性虽然仍输出到 HTML，但因无 `srcSet` 生成而**无实际效果**。移除 `unoptimized` 后 `sizes` 才真正生效。

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
| 展会详情 | `coverImage` | ✅ 已设置 |
| 解决方案详情 | `coverImage` | ✅ 已设置 |
| 教育中心 | `IMAGE` 常量 | ✅ 已设置 |
| 燃烧室模拟 | `IMAGE` 常量 | ✅ 已设置 |
| 燃烧室 CFBT | `IMAGE` 常量 | ✅ 已设置 |
| 健身器材配件 | `IMAGE` 常量 | ✅ 已设置 |
| 竞技配件 | `IMAGE` 常量 | ✅ 已设置 |
| 产品目录页（fixed-tower / modular-tower / burn-rooms / why-us / why-us/story / how-to-buy / fixed-tower/series） | VideoHero poster | ✅ 已设置（`MediaImage` eager + `fetchPriority` + `quality=90`） |
| 专业培训子页（rope-rescue / psychological） | 手写 Hero `MediaImage` | ✅ 已设置（preload + eager + `quality=90`，无 `fetchPriority`） |
| 为什么选我们/全球 | 手写 Hero `MediaImage` | ✅ 已设置（preload + eager，无 `quality`/`fetchPriority`） |
| 配件页 | 手写 Hero `MediaImage` | ✅ 已设置 |
| 爬塔（climbing-tower） | 手写 Hero `MediaImage` | ✅ 已设置 |
| 营销弹窗封面 | `popupImage` | ⚠️ 已设置，但弹窗经 `next/dynamic` 懒加载，preload 意义不大，可考虑移除 |

#### 3.8.2 关键资源 DNS 预解析

✅ **已实现**，无需额外改动。`[locale]/layout.tsx` 已通过 `getMediaOrigin()` 动态注入：

```tsx
// apps/web/src/app/[locale]/layout.tsx（已存在）
<link rel="preconnect" href={mediaOrigin} crossOrigin="anonymous" />
<link rel="dns-prefetch" href={mediaOrigin} />
```

`next.config.ts` 同时设置了 `X-DNS-Prefetch-Control: on` 响应头。

---

### 3.9 高级优化（可选，后续迭代）

#### 3.9.1 `content-visibility: auto`

对列表页视口外的卡片启用渲染跳过：

```css
/* 列表卡片：视口外不渲染内部细节，滚动到附近时才渲染。
 * 纯 CSS 方案，浏览器自动处理视口检测，无需 JS。
 * 注意：contain-intrinsic-size 需提供合理预估值，避免滚动条跳动。 */
.content-card-offscreen {
  content-visibility: auto;
  contain-intrinsic-size: auto 320px; /* 预估卡片高度 */
}
```

**应用位置**：在列表页的每个卡片 `<Link>` 元素上添加此 CSS 类。例如：
- `cases/page.tsx` — 每个案例卡片 `<Link>`
- `resources/blog/page.tsx` — 常规文章卡片（非 featured）
- `solutions/page.tsx` — 解决方案卡片

> 注意：避免影响 SEO 爬虫渲染——搜索引擎爬虫通常不执行 CSS，`content-visibility` 不会阻止爬虫读取内容。

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
| 1 | `MediaImage` 增加 fade-in 过渡 | `MediaImage.tsx` | 新增 `fadeOnLoad` prop，lazy 图自动 fade-in，eager 图禁用 |
| 2 | CSS 过渡动画 | `globals.css` | `rb-img-fadein` 关键帧 + `rb-img-shimmer` / `rb-img-shimmer-dark` 背景骨架 |
| 3 | 列表卡片 shimmer + 背景色 | 见下方完整清单 | A 型容器：`bg-neutral-900` → `bg-neutral-200` + `rb-img-shimmer`（`DeliveriesSection` 无背景色，为新增 `bg-neutral-200`）；B 型容器：保持 `bg-neutral-900` + `rb-img-shimmer-dark`；白色背景型：保持浅底，**不加 shimmer**（视频 poster 型无需改动） |

### P1 — 全面覆盖（半天）

| # | 改造项 | 文件 | 说明 |
|---|---|---|---|
| 4 | 详情页 Hero 背景色调整 | `cases/[slug]`、`news/[slug]`、`blog/[slug]`、`trade-shows/[slug]`、`solutions/[slug]`、`why-us/global`、`accessories`、`specialized-training/*`、`fixed-tower/climbing-tower`、`education-center`、`burn-rooms/fire-simulation`、`burn-rooms/cfbt`、`accessories/fitness-equipment`、`accessories/competition` | `bg-neutral-900` → `bg-neutral-800`，**不加 shimmer**（eager 图立即显示），顺带补 `fetchPriority="high"` + `quality={90}` |
| 5 | Markdown 正文图 shimmer | `markdown-components.tsx` | 容器加 `rb-img-shimmer` + `bg-neutral-100` → `bg-neutral-200` |
| 6 | 首页 Hero poster | `HeroSection.tsx` | 视频 poster 型：保持 `bg-neutral-900` + 遮罩 + 白字，**无需改动**（现状已达标，见 §5.5） |
| 7 | PageHero 组件 | `ui/index.tsx` | **已核实无需改动**：PageHero 为纯文字页头（`bg-neutral-100`），无图片容器 |

### P2 — 高级优化（后续迭代）

| # | 改造项 | 文件 | 说明 |
|---|---|---|---|
| 8 | 评估移除 `unoptimized` | `MediaImage.tsx` | 当前 Next.js 16.2.9，`allImgs` 追踪大概率已修复；实验移除后对比 Lighthouse LCP 确认无回归 |
| 9 | `content-visibility: auto` | 列表页 CSS | 视口外卡片渲染跳过（应用位置见 §3.9.1） |
| 10 | 构建期 blurDataURL 生成 | 新增脚本 + `MediaImage` | 引入 sharp，实现完整 blur-up |

> DNS 预解析（`preconnect` / `dns-prefetch`）已在 `[locale]/layout.tsx` 实现（见 §3.8.2），无需列入改造。

### 完整文件清单（P0 项 3 + P1 涉及的所有图片容器）

> 容器数 = 需改造的代码位置数（JSX 模板），运行时每页可能渲染多个实例（如列表卡片）。

**A 型：纯图片容器（加 `rb-img-shimmer` + 改 `bg-neutral-200`）：**

| 文件 | 容器数 | 当前背景 | 备注 |
|---|---|---|---|
| `cases/page.tsx` | 1 | `bg-neutral-900` | hover 遮罩（`opacity-0`，加载期间不可见） |
| `components/sections/DeliveriesSection.tsx` | 1（渲染 6 个卡片） | **无背景色（透明）** | 首页“全球交付”区块，A 型；hover 遮罩（`opacity-0`）；需**新增** `bg-neutral-200` + `rb-img-shimmer` |
| `resources/blog/page.tsx` | 1 | `bg-neutral-900` | 仅 featured 区域；常规列表卡片无图片 |
| `specialized-training/page.tsx` | 1 | `bg-neutral-900` | hover 遮罩（`opacity-0`，加载期间不可见） |
| `components/content/markdown-components.tsx` | 1 | `bg-neutral-100` | 正文图，改为 `bg-neutral-200` |

**B 型：遮罩+白字容器（加 `rb-img-shimmer-dark` + 保持 `bg-neutral-900`）：**

| 文件 | 容器数 | 当前背景 | 遮罩 |
|---|---|---|---|
| `components/products/ProductLineCard.tsx` | 2 | `bg-neutral-900` | `rb-media-shade` + 白字标题 |
| `components/sections/QuickLinksSection.tsx` | 1 | `bg-neutral-900` | `rb-media-shade` + `rb-on-media` 白字 |
| `components/layout/Footer.tsx` | 1 | `bg-neutral-900` | `rb-media-shade-strong` + 白字 CTA |
| `solutions/page.tsx` | 1 | `bg-neutral-900` | `rb-media-shade`（永久可见）+ 白字标题 |

**详情页 Hero（仅改背景色，不加 shimmer）：**

| 文件 | 当前背景 |
|---|---|
| `cases/[slug]/page.tsx` | `bg-neutral-900` |
| `news/[slug]/page.tsx` | `bg-neutral-900` |
| `blog/[slug]/page.tsx` | `bg-neutral-900` |
| `trade-shows/[slug]/page.tsx` | `bg-neutral-900` |
| `solutions/[slug]/page.tsx` | `bg-neutral-900` |
| `why-us/global/page.tsx` | `bg-neutral-900` |
| `accessories/page.tsx` | `bg-neutral-900` |
| `specialized-training/rope-rescue/page.tsx` | `bg-neutral-900` |
| `specialized-training/psychological/page.tsx` | `bg-neutral-900` |
| `fixed-tower/climbing-tower/page.tsx` | `bg-neutral-900` |
| `education-center/page.tsx` | `bg-neutral-900` |
| `burn-rooms/fire-simulation/page.tsx` | `bg-neutral-900` |
| `burn-rooms/cfbt/page.tsx` | `bg-neutral-900` |
| `accessories/fitness-equipment/page.tsx` | `bg-neutral-900` |
| `accessories/competition/page.tsx` | `bg-neutral-900` |

> `components/ui/index.tsx`（PageHero）已核实为纯文字页头（`bg-neutral-100`，无图片），不在此表。
> `components/sections/HeroSection.tsx`（首页 Hero）为视频 poster 型，已移入视频 poster 型清单：视频型保持深底，无需改动。

**画廊/产品页（加 shimmer + 改背景色）：**

| 文件 | 容器数 | 当前背景 | 类型 |
|---|---|---|---|
| `burn-rooms/liner/page.tsx` | 2 | `bg-neutral-900` | A 型 |
| `accessories/maritime/page.tsx` | 1 | `bg-neutral-900` | A 型 |
| `accessories/tactical/page.tsx` | 1 | `bg-neutral-900` | A 型 |
| `accessories/hazmat/page.tsx` | 1 | `bg-neutral-900` | A 型 |
| `modular-tower/custom/page.tsx` | 1 | `bg-neutral-900` | A 型 |
| `fixed-tower/series/page.tsx` | 1（产品图） | `bg-white`（`object-contain p-4` 产品图） | 白色背景型：**不加 shimmer**（`object-contain` 图不铺满容器，加动画会在图片四周永久循环），保持静态浅底即可（该页另有 VideoHero 首屏，见视频 poster 型表） |
| `modular-tower/series/page.tsx` | 1 | `bg-neutral-100`（`object-contain p-4` 产品图） | 白色背景型：**不加 shimmer**（同上），保持静态浅底即可 |

**视频 poster 型（保持 `bg-neutral-900`，不加 shimmer）：**

| 文件 | 容器数 | 当前背景 | 说明 |
|---|---|---|---|
| `components/sections/HeroSection.tsx` | 1 | `bg-neutral-900` | 首页 Hero：`MediaImage` poster（eager + preload + fetchPriority + quality=90）+ `MediaVideo` + `rb-media-shade-strong` + 白字；已达标，无需改动 |
| `components/sections/MissionSection.tsx` | 1 | `bg-neutral-900` | 首页 Mission 区：`LazyMediaVideo` poster（非 `MediaImage`），视频进入视口才加载；深底 + `rb-media-shade-strong` + 白字加载期间可读性已足够，poster 由 video 管理，shimmer 无法联动 fade-in |
| `components/marketing/MarketingPopupDialog.tsx` | 1 | 无背景类（透明） | 弹窗封面 `CoverBanner`：`MediaImage` + `preload`，无 shimmer 窗口（弹窗动态加载后即显示）；现状可接受，可选加 `bg-neutral-100` + shimmer |
| `components/ui/index.tsx`（VideoHero） | 1 | `bg-neutral-900` | **已达标，无需改动**：`MediaImage` poster（eager + preload + fetchPriority + quality=90）+ `MediaVideo` + `rb-media-shade-strong` + 白字；视频 poster 型处理（保持深底，不加 shimmer） |
| `fixed-tower/page.tsx` | 1 | `bg-neutral-900` | VideoHero 使用页，同上，无需改动 |
| `modular-tower/page.tsx` | 1 | `bg-neutral-900` | VideoHero 使用页，同上，无需改动 |
| `burn-rooms/page.tsx` | 1 | `bg-neutral-900` | VideoHero 使用页，同上，无需改动 |
| `why-us/page.tsx` | 1 | `bg-neutral-900` | VideoHero 使用页，同上，无需改动 |
| `why-us/story/page.tsx` | 1 | `bg-neutral-900` | VideoHero 使用页，同上，无需改动 |
| `resources/how-to-buy/page.tsx` | 1 | `bg-neutral-900` | VideoHero 使用页，同上，无需改动 |
| `fixed-tower/series/page.tsx`（VideoHero） | 1 | `bg-neutral-900` | VideoHero 使用页，同上，无需改动（该页另有白色背景型产品图，见上表） |

> **注意**：`resources/news/page.tsx` 新闻列表页为纯文本布局，无图片容器，无需改造。
> `resources/blog/page.tsx` 常规列表卡片同样无图片，仅 featured 区域有图片容器。

### 豁免清单（无需改造，已确认）

以下组件虽含图片，但均为固定尺寸、非 LCP、无 CLS 风险，且代码中已有明确豁免注释，**不适用 shimmer/fade-in**：

| 文件 | 图片类型 | 豁免原因 |
|---|---|---|
| `components/contact/SocialQrCards.tsx` | 二维码（next/image，72~112px） | 静态小图，非 LCP，无 CLS |
| `components/contact/SocialQrImage.tsx` | 二维码（原生 img） | 多候选 URL 失败回退依赖原生 onError 链；固定尺寸无 CLS |
| `components/contact/SocialChannelBar.tsx` | 平台图标 + 弹层二维码（原生 img） | 按需展示，非 LCP；固定容器尺寸无 CLS |
| `components/layout/TopBar.tsx` | 弹层二维码（原生 img） | 同上 |
| `components/i18n/LanguageSelectorDrawer.tsx` | flagcdn 语言图标（原生 img） | 三方小图标已带 srcSet/尺寸/lazy，不值得过代理优化 |
| `components/chat/MessageList.tsx` | 聊天附件图（原生 img + `ImagePreview`） | 运行时动态 URL，固定缩略图尺寸无 CLS |

---

## 五、技术细节

### 5.1 fade-in 过渡机制详解

```
时间线（lazy 图）：
────────────────────────────────────────────────────────→

t=0        组件挂载，图片开始加载
│          ├─ <img> opacity: 0（不可见）
│          ├─ 容器背景 rb-img-shimmer 可见（灰色渐变扫光）
│          └─ fadeOnLoad = true（因为 isLazy = true）
│
t=0.5~3s   图片下载完成，onLoad 触发
│          ├─ setLoaded(true)
│          ├─ 移除 opacity-0，添加 rb-img-fadein 类
│          └─ 400ms 动画：opacity 0→1 + blur(8px)→blur(0)
│
t=0.9~3.4s 动画结束，图片完全不透明
│          └─ 图片自然遮盖容器背景 shimmer，无需手动隐藏

t=0（eager/preload 图）：
│          ├─ fadeOnLoad = false（因为 isLazy = false）
│          ├─ <img> 无 opacity-0，立即可见
│          └─ 容器背景色被图片即刻覆盖（Hero 不加 shimmer）
```

### 5.2 shimmer 与图片的层级关系

```
容器 DOM 结构：
<div class="rb-img-shimmer relative aspect-[4/3] overflow-hidden bg-neutral-200">
  <!-- shimmer 是容器的 background-image，在 z 轴最底层 -->
  <img ... />  <!-- Next.js <Image> 渲染在背景之上 -->
</div>

加载过程：
1. 初始状态：容器背景 shimmer 可见，<img> opacity: 0
2. 图片加载完成：<img> opacity 渐变为 1
3. 最终状态：<img> 完全不透明，自然遮盖容器背景 shimmer

关键：shimmer 是 background-image，不是 ::after 伪元素，
      因此不存在 z-index 冲突，也不需要 JS 手动隐藏。
```

### 5.3 性能影响评估

| 指标 | 改造前 | 改造后（预期） |
|---|---|---|
| 列表页 CLS | 0.01~0.05（图片区黑块闪烁） | ≈ 0（shimmer 占位 + aspect-ratio） |
| LCP（详情页 Hero） | 1.5~3s（大图直接加载，黑底闪烁） | 无变化（eager 图立即显示，仅背景色调浅减少黑块感） |
| 首屏带宽 | 无变化 | 无变化（不增加额外请求） |
| 感知加载速度 | 黑块 → 突然跳出 | shimmer 骨架 → 400ms 平滑渐入 |
| 额外请求 | 0 | 0（纯 CSS 方案） |
| JS 开销 | — | ~250B（useState + onLoad/onError 回调） |
| CSS 开销 | — | ~600B（关键帧 + 双 shimmer 变体样式） |
| shimmer 动画性能 | 无 | `background-position` 动画非 GPU 合成，每帧 CPU 重绘；卡片面积小影响极小，可忽略 |

### 5.4 与图片迁移方案的协同

本方案与 `docs/web-legacy-images-migration-plan.md` 互补：

- 迁移方案解决“有没有图”（封面映射、资产补入）
- 本方案解决“图的加载体验”（占位、过渡、预加载）

建议实施顺序：先完成迁移（P0~P2），再落地本方案（P0→P1→P2）。迁移确保所有页面有真实图片后，shimmer 过渡才能发挥最佳效果。

### 5.5 视频 poster 策略（Hero / Mission / PageHero）

视频背景区的 poster 分两种来源，策略不同：

| 场景 | poster 载体 | 策略 |
|---|---|---|
| 首页 Hero | `MediaImage`（eager + preload + fetchPriority） | 视频型深底设计：保持 `bg-neutral-900` + 遮罩 + 白字，不加 shimmer（poster eager 立即显示，加载窗口极短，无需调浅） |
| VideoHero（产品目录 / why-us / burn-rooms / how-to-buy 等 7 页） | `MediaImage` poster（eager + preload + fetchPriority + quality=90） | 已符合“视频 poster 型”标准：eager 自动禁用 fade-in；容器保持 `bg-neutral-900` + 遮罩 + 白字，不加 shimmer，**无需改动** |
| Mission 区 | `LazyMediaVideo` 的 `poster` 属性 | 视频懒加载，poster 由 video 管理；容器保持 `bg-neutral-900` + 遮罩 + 白字，不加 shimmer（无法联动 fade-in） |
| 手写 Hero 子页（培训 / 全球 / 配件 / 爬塔 / 教育中心 / 燃烧室等） | `MediaImage`（preload + eager） | 同首页 Hero 策略（§3.5）：eager 自动禁用 fade-in，仅背景调浅 |

> 注意：视频 poster 图（video 元素自身加载）不受 `MediaImage` 的 `fadeOnLoad` / `onError` 逻辑保护，属浏览器原生行为；此类容器统一走“视频 poster 型”处理（保持深底，不加 shimmer）。

---

## 六、验收标准

### 功能验收

- [ ] 所有 **lazy** `MediaImage` 渲染的图片在加载期间容器显示 shimmer 骨架动画（非黑块/空白）
- [ ] lazy 图片就绪后 shimmer → 清晰图过渡平滑（400ms fade-in + blur 消除），无视觉跳变
- [ ] **A 型容器**（无遮罩）加载期间背景为浅灰 + shimmer 扫光
- [ ] **B 型容器**（遮罩+白字）加载期间背景保持深色 + 深色 shimmer 扫光，白色文字可读
- [ ] **白色背景型容器**（产品图）加载期间背景保持浅色静态（不加 shimmer），产品图加载完成后直接显示，无黑块
- [ ] 详情页 Hero 图（eager）立即显示，无 opacity-0 延迟，背景色调浅无黑块
- [ ] Markdown 正文图加载期间显示 shimmer 骨架动画
- [ ] 本地开发环境与生产环境体验完全一致（无环境差异）
- [ ] `prefers-reduced-motion: reduce` 下动画被禁用，图片直接显示
- [ ] 图片加载失败（404 / 断网）时 `onError` 触发，图片不再永久隐藏（显示 broken image 图标），shimmer 停止

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
| `opacity-0` 在 JS 禁用时无图可见 | `useState(false)` 在 SSR 时 `loaded=false`，`opacity-0` **会**出现在 SSR HTML 中。但 Next.js App Router 强依赖 JS 运行，禁用 JS 时整个应用不可用；如需极致兼容可追加 `<noscript><style>.rb-img-fadein{opacity:1!important}</style></noscript>` 兜底 |
| shimmer `background` 不影响交互 | shimmer 是容器 `background-image`，不是伪元素覆盖层，`<img>` 渲染在其上方，交互完全不受影响 |
| `onLoad` 在某些 CDN 缓存场景不触发 | Next.js `<Image>` 的 `onLoad` 在 `<img>` 原生 load 事件触发，与 CDN 无关 |
| CSS 动画影响无障碍用户 | 已加 `@media (prefers-reduced-motion: reduce)` 禁用动画 |
| `bg-neutral-200` 与深色主题不协调 | 当前 C 端为浅色主题（Rosenbauer 工业风），不涉及暗色模式 |
| Hero 容器加 shimmer 与 `rb-media-shade-strong` 遮罩冲突 | Hero 图是 eager/LCP，`fadeOnLoad` 自动禁用，图片立即显示；Hero 区域**不加 shimmer**，仅调整背景色 |
| B 型容器（遮罩+白字）误用浅色 shimmer | 已明确分类：A 型用 `rb-img-shimmer` + `bg-neutral-200`，B 型用 `rb-img-shimmer-dark` + 保持 `bg-neutral-900`，白色背景型不加 shimmer（保持静态浅底），视频 poster 型不加 shimmer。改造时按文件清单标注的类型执行 |
| 白色背景型误加 shimmer 导致永久扫光 | `object-contain p-4` 产品图不铺满容器，容器背景永远可见；若加 `rb-img-shimmer`（无限动画）会在图片四周永久循环。因此白色背景型不加 shimmer，保持静态浅色背景 |
| A 型 hover 放大露边 | 卡片图片 `group-hover:scale-105` 放大 5% 时边缘露出 `bg-neutral-200` + shimmer 背景；影响短暂且仅在 hover 时，可接受；如需消除可将背景改为更接近图片的色值 |
| 图片加载失败时 shimmer 永不停止、图片永远不可见 | 已加 `onError` 处理器，失败时也调用 `setLoaded(true)` 移除 `opacity-0`，浏览器显示 broken image 图标 |
| 部分页面直接使用 `next/image` 而非 `MediaImage` | `education-center/page.tsx`、`burn-rooms/fire-simulation/page.tsx`、`contact/SocialQrCards.tsx` 等直接 import `next/image`，`MediaImage` 的 `fadeOnLoad`/`onError` 改动对它们不生效。内容照片页（education-center 等）需迁移为 `MediaImage`；二维码等固定尺寸静态图已豁免（见豁免清单） |

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
  .rb-img-shimmer {
    animation: none;
    background: #e5e5e5; /* 静态浅灰占位，不闪烁 */
  }
  .rb-img-shimmer-dark {
    animation: none;
    background: #262626; /* 静态深灰占位，不闪烁 */
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
| `apps/web/src/components/products/ProductLineCard.tsx` | 产品线卡片（B 型，2 处） |
| `apps/web/src/components/sections/QuickLinksSection.tsx` | 快捷入口卡片（B 型） |
| `apps/web/src/components/sections/HeroSection.tsx` | 首页 Hero |
| `apps/web/src/components/ui/index.tsx` | PageHero（纯文字无图）、VideoHero（视频背景页头）等共享 UI 组件 |
| `apps/web/src/components/layout/Footer.tsx` | 页脚背景图（B 型） |
| `apps/web/src/components/sections/DeliveriesSection.tsx` | 首页“全球交付”区块（A 型，6 卡片） |
| `apps/web/src/components/sections/MissionSection.tsx` | 首页 Mission 区（视频 poster 型） |
| `apps/web/src/components/marketing/MarketingPopupDialog.tsx` | 营销弹窗封面（透明容器，可选优化） |
| `apps/web/src/components/LazyMediaVideo.tsx` | 懒加载视频组件（MissionSection poster 来源） |
| `apps/web/src/app/[locale]/cases/page.tsx` | 案例列表（A 型） |
| `apps/web/src/app/[locale]/cases/[slug]/page.tsx` | 案例详情 Hero |
| `apps/web/src/app/[locale]/resources/blog/page.tsx` | 博客列表（featured 区域，A 型） |
| `apps/web/src/app/[locale]/resources/blog/[slug]/page.tsx` | 博客详情 Hero |
| `apps/web/src/app/[locale]/resources/news/[slug]/page.tsx` | 新闻详情 Hero |
| `apps/web/src/app/[locale]/resources/trade-shows/[slug]/page.tsx` | 展会详情 Hero |
| `apps/web/src/app/[locale]/solutions/page.tsx` | 解决方案列表（B 型） |
| `apps/web/src/app/[locale]/solutions/[slug]/page.tsx` | 解决方案详情 Hero |
| `apps/web/src/app/[locale]/specialized-training/page.tsx` | 专业培训列表（A 型） |
| `apps/web/src/app/[locale]/specialized-training/rope-rescue/page.tsx` | 专业培训 Hero |
| `apps/web/src/app/[locale]/specialized-training/psychological/page.tsx` | 专业培训 Hero |
| `apps/web/src/app/[locale]/why-us/global/page.tsx` | 全球 Hero |
| `apps/web/src/app/[locale]/accessories/page.tsx` | 配件 Hero |
| `apps/web/src/app/[locale]/accessories/maritime/page.tsx` | 海事配件画廊（A 型） |
| `apps/web/src/app/[locale]/burn-rooms/liner/page.tsx` | 衬里画廊（A 型，2 处） |
| `apps/web/src/app/[locale]/burn-rooms/fire-simulation/page.tsx` | 燃烧室模拟 Hero |
| `apps/web/src/app/[locale]/burn-rooms/cfbt/page.tsx` | 燃烧室 CFBT Hero |
| `apps/web/src/app/[locale]/modular-tower/custom/page.tsx` | 定制塔画廊（A 型） |
| `apps/web/src/app/[locale]/modular-tower/series/page.tsx` | 系列产品图（白色背景型） |
| `apps/web/src/app/[locale]/fixed-tower/climbing-tower/page.tsx` | 爬塔 Hero |
| `apps/web/src/app/[locale]/fixed-tower/series/page.tsx` | 系列产品图（白色背景型） |
| `apps/web/src/app/[locale]/education-center/page.tsx` | 教育中心 Hero |
| `apps/web/src/app/[locale]/accessories/tactical/page.tsx` | 战术配件画廊（A 型） |
| `apps/web/src/app/[locale]/accessories/hazmat/page.tsx` | 危化品配件图（A 型） |
| `apps/web/src/app/[locale]/accessories/fitness-equipment/page.tsx` | 健身器材配件 Hero |
| `apps/web/src/app/[locale]/accessories/competition/page.tsx` | 竞技配件 Hero |
