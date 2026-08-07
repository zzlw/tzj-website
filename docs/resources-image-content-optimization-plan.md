# 「资源与服务」图文优化技术方案

> 日期：2026-08-07
> 状态：已落地（2026-08-07：6 服务页图文/信任/转化全部接入；内容中心交叉项待各自方案推进）
> 范围：`apps/web` 资源与服务全部页面（`/resources` hub、how-to-buy、design-center、inspections、faqs、
> warranty，以及 blog / news / trade-shows 列表与详情）、静态媒体、i18n 文案、SEO/OG 与转化
> 关联：`docs/product-center-image-content-optimization-plan.md`（同构方案）、
> `docs/blog-center-content-ai-enrichment-plan.md`、`docs/news-center-content-ai-enrichment-plan.md`、
> `docs/trade-shows-center-content-ai-enrichment-plan.md`（内容中心已单独成案）、
> `docs/case-center-content-ai-enrichment-plan.md`、`AGENTS.md`

## 结论先行

「资源与服务」实际包含两类页面：

1. **服务/工具页（静态代码维护）**：`/resources` hub、how-to-buy、design-center、inspections、faqs、warranty；
2. **内容中心页（后台/API 维护）**：blog、news、trade-shows——这三个已有独立内容优化方案，
   本方案只处理它们与「资源与服务」的交叉问题（OG、信任条、导航一致性），不重复内容生产。

本地盘点结论：

| 维度 | 现状 |
|---|---|
| 页面规模 | 6 个服务/工具页 + 3 个内容中心（含列表/详情） |
| 图片 | 服务页基本无主图：how-to-buy 用 `louisville-case.mp4` + 通用塔体 poster；其余 5 页为纯文字/图标 |
| 视频 | `louisville-case.mp4` 需确认 MinIO 源与压缩 |
| 内容中心 | blog/news/trade-shows 已按各自方案补齐封面/双封面/图集，此处不再展开 |
| SEO/OG | 服务页 `createPageMetadata` 均未传 image，OG 全部回退默认图 |
| 转化 | how-to-buy / design-center / inspections / warranty / faqs 有 CTA 或 BookConsultButton；无电话/询盘入口、无资质信任条 |
| 静态边界 | 服务页无后台维护；内容页走现有内容中心链路 |

本方案给出：

1. **服务页补视觉与证据**：每个服务页配 hero/OG/配图，补资质信任条、公司实力数字、电话/询盘 CTA。
2. **hub 升级**：`/resources` 从纯图标卡片升级为「图标 + 缩略图/场景图」卡片，并配专属 OG。
3. **内容中心只补交叉项**：blog/news/trade-shows 沿用既有方案，仅统一 OG、信任条与导航入口。
4. **本期不做埋点**：效果以业务记录与人工抽检为准。

---

## 目录

- 一、现状盘点（页面矩阵 / 图片 / 文案 / SEO / 转化）
- 二、目标与原则
- 三、图文与转化规范
- 四、技术落地
- 五、验收标准
- 六、工作量与排期估算
- 七、风险与依赖
- 附：页面清单与单页验收模板

---

## 一、现状盘点

### 1.1 页面矩阵

#### A. 服务/工具页（6 个路由）

| 路由 | 页面定位 | 主要图片现状 |
|---|---|---|
| `/resources` | 资源与服务 hub | 纯图标卡片，无图 |
| `/resources/how-to-buy` | 如何采购 | hero 视频 + 通用塔体 poster；采购步骤纯文字 |
| `/resources/design-center` | 塔型设计中心 | 无 hero 图；目录/资料/下载纯文字 |
| `/resources/inspections` | 年检服务 | 无 hero 图；周期/项目/为什么纯文字 |
| `/resources/faqs` | 常见问题 | 无 hero 图；手风琴问答 |
| `/resources/warranty` | 质保服务 | 无 hero 图；责任/质保表/支持纯文字 |

#### B. 内容中心页（已有独立方案）

| 路由 | 现状 | 本方案处理 |
|---|---|---|
| `/resources/blog` + 详情 | 列表/详情封面已补齐（blog 方案） | OG、信任条、入口一致性 |
| `/resources/news` + 详情 | 双封面/图集已补齐（news 方案） | 同上 |
| `/resources/trade-shows` + 详情 | 列表/详情封面已补齐（trade-shows 方案） | 同上 |

### 1.2 静态数据源

| 数据源 | 内容 | 变更方式 |
|---|---|---|
| `apps/web/src/app/[locale]/resources/*/page.tsx` | 页面结构与图片常量 | 代码 PR |
| `apps/web/src/messages/{locale}/pages/resources*.json` | 服务页三语文案 | 代码 PR |
| `apps/web/src/lib/static-media-paths.ts` | 静态媒体清单 | 新增资产必须登记 |
| blog/news/trade-shows | 后台/API/DB | 走各自内容中心方案 |

### 1.3 图片现状

- 服务页几乎无主图，只有 how-to-buy 有视频 + 通用塔体 poster；
- `/resources` hub 是图标卡片，缺少视觉识别；
- design-center 的目录/下载没有封面缩略图；inspections/warranty 没有服务场景图；
- 全部服务页 OG 回退默认图。

### 1.4 文案现状

- how-to-buy：采购流程完整，缺「给谁看 + 资质/案例证据」；
- design-center：资料清单完整，缺产品缩略图/封面；
- inspections：周期与项目清晰，缺「为什么可信」的服务证据；
- faqs：问答结构好，适合补「采购/报价/工期」高频问题；
- warranty：质保表清晰，缺服务网络/联系方式。

### 1.5 SEO / 转化现状

- 服务页均未传 OG 图；
- 转化只有 `CtaBand`/`BookConsultButton`，无电话/询盘入口；
- 无资质信任条；公司实力数字未在服务页出现；
- 内容中心列表页 OG 依赖各自方案，服务页与内容中心之间缺统一信任层。

---

## 二、目标与原则

### 2.1 目标

- 6 个服务页全部具备「服务场景图 + 证据化文案 + 资质信任 + 三级 CTA + 专属 OG」；
- `/resources` hub 从「目录页」升级为「能建立信任的资源入口」；
- 内容中心保持既有方案，不重复返工。

### 2.2 原则

| 原则 | 说明 |
|---|---|
| 服务页静态、内容页走后台 | 服务页只动代码；内容中心沿用现有链路 |
| 真实优先 | 服务场景图、数字、案例真实可核对 |
| AI 实拍级 | 缺实拍时用 AI 实拍级生图，无 AI 味，不冒充实拍 |
| 信任层 | 资质、案例、服务闭环、公司实力数字 |
| 本期不做埋点 | 不以行为指标验收，以业务记录与人工抽检为准 |

---

## 三、图文与转化规范

### 3.1 图片注册表

建立 `apps/web/src/lib/resources-images.ts`：

```ts
export const RESOURCES_IMAGES = {
  hub: { og: '/media/resources/hub-og.webp' },
  'how-to-buy': { hero: '/media/resources/how-to-buy-hero.webp', og: '/media/resources/how-to-buy-og.webp' },
  'design-center': { hero: '/media/resources/design-center-hero.webp', og: '/media/resources/design-center-og.webp' },
  inspections: { hero: '/media/resources/inspections-hero.webp', og: '/media/resources/inspections-og.webp' },
  faqs: { og: '/media/resources/faqs-og.webp' },
  warranty: { hero: '/media/resources/warranty-hero.webp', og: '/media/resources/warranty-og.webp' },
} as const;
```

OSS/MinIO key：`content/resources/{page}-*.webp`（`resolveMediaUrl` 自动映射）。

### 3.2 页面图片规范

| 页面 | 建议图片 | 要求 |
|---|---|---|
| `/resources` | hub 卡片缩略图 + OG | 8 个入口卡各配小图或场景图 |
| how-to-buy | 采购/交付场景 hero + 流程图配图 | 替换通用塔体 poster |
| design-center | 产品目录封面缩略图 + 下载封面 | 资料卡有视觉封面 |
| inspections | 检测/维保场景图 + 检查项示意 | 体现专业服务 |
| faqs | 轻量 OG 即可，可不加正文图 | 保持问答可读性 |
| warranty | 质保/服务网络场景图 | 与售后服务认证呼应 |

### 3.3 文案规范

- 服务页 Hero 回答三问：这是什么服务 / 对客户有什么用 / 为什么可信；
- 补「事实与数据清单」：检测周期、质保年限、服务网络、响应时效，数字需业务确认；
- FAQ 补高频决策问题：报价怎么算、工期多久、资质是否齐全、售后如何保障；
- design-center 的资料卡补「是什么 / 怎么用 / 适合谁」。

### 3.4 信任层与转化

- 服务页全部接入资质信任条（ISO 9001/14001/45001、五星售后）并链到资质页；
- 每页 ≥3 个转化触点：场景化聊天、`tel:` 电话、询盘表单（复用三级分流）；
- how-to-buy/warranty/inspections 挂 2~3 个相关案例。

### 3.5 SEO 意图映射

| 页面 | 主关键词 | 长尾示例 |
|---|---|---|
| `/resources/how-to-buy` | 训练塔采购流程 | 消防训练设施怎么买、训练塔招标采购 |
| `/resources/design-center` | 训练塔设计 | 训练塔选型、训练设施设计资料 |
| `/resources/inspections` | 训练塔年检 | 训练设施年度检测、训练塔维护检查 |
| `/resources/faqs` | 训练塔常见问题 | 训练塔价格、训练塔工期、训练塔售后 |
| `/resources/warranty` | 训练塔质保 | 训练设施质保政策、售后维保 |

---

## 四、技术落地

### 阶段 A：盘点与素材收集（0.5 天）

- 收集服务场景实拍（检测/交付/工厂/售后）与资料封面；
- 确认 `louisville-case.mp4` 的 MinIO 源与编码；
- 输出 6 页素材替换清单。

### 阶段 B：素材生产（1~2 天）

- 真实素材优先；缺图用 AI 实拍级生图；
- 压缩 WebP → 上传 MinIO → 登记 `static-media-paths.ts`。

### 阶段 C：代码接入（1~2 天）

1. 新建 `resources-images.ts`，替换页面散落常量；
2. 服务页 `createPageMetadata` 传 `ogImage`；
3. `/resources` hub 卡片补缩略图；design-center 资料卡补封面；
4. 服务页接入资质信任条 + 三级 CTA + 相关案例；
5. 三语文案按 3.3 重写；
6. 内容中心列表/详情保持既有方案，仅统一信任条与入口。

### 阶段 D：验证

- curl 全部 `/resources/*` 路由 200；
- OG 断言：服务页 openGraph.images 非默认图；
- 无原始 i18n key、无硬编码中文；
- typecheck + `pnpm run check`；
- 人工抽检：图片真实感、数字可核对、FAQ 覆盖采购决策。

---

## 五、验收标准

1. 6 个服务页均有专属 OG 图；
2. how-to-buy 不再使用通用塔体 poster；
3. `/resources` hub 卡片有缩略图/场景图；
4. design-center 资料卡有封面；inspections/warranty 有服务场景图；
5. 服务页全部有资质信任条 + ≥3 个转化触点；
6. FAQ 覆盖报价/工期/资质/售后；
7. 内容中心沿用既有方案，无重复返工；
8. 三语同步、无硬编码中文；
9. 无后台/DB/API 改动（服务页）；`pnpm run check` + typecheck 全绿。

---

## 六、工作量与排期估算

资产估算：6 服务页 ×（hero/OG/配图 2~3 张）+ hub 缩略图 ≈ **20~30 张**；
AI 候选 2~3 倍 ≈ **50~90 次生成**；WebP 后约 **15~30MB**。

| 阶段 | 内容 | 估算 |
|---|---|---|
| A | 盘点/素材收集/数字确认 | 0.5 人日 |
| B | 素材生产（实拍/AI + 压缩上传） | 1~2 人日 |
| C | 代码接入（注册表/页面/文案/信任层/CTA） | 1~2 人日 |
| D | 验证与回归 | 0.5 人日 |
| **合计** | | **约 3~5 人日** |

---

## 七、风险与依赖

| 风险/依赖 | 影响 | 对策 |
|---|---|---|
| 服务场景无实拍 | 只能 AI，真实感风险 | AI 实拍级标准 + 审核 |
| 数字未确认 | 夸大宣传风险 | 数字业务确认，不虚报 |
| 内容中心重复返工 | 浪费产能 | 只做交叉项（OG/信任条/入口） |
| 视频源缺失/超重 | hero 404/性能差 | 阶段 A 检查 MinIO 与编码 |

依赖：`resources-images.ts`、三语 `pages/resources*.json`、`static-media-paths.ts`、MinIO/OSS；
内容中心依赖各自既有方案。

---

## 附：页面清单与单页验收模板

### A. 当前清单

| 页面 | 当前图 | 建议动作 |
|---|---|---|
| `/resources` | 无图 | hub 卡片缩略图 + OG |
| `/resources/how-to-buy` | 视频 + 通用塔体 poster | 服务场景 hero + OG |
| `/resources/design-center` | 无图 | 资料封面 + OG |
| `/resources/inspections` | 无图 | 检测场景图 + OG |
| `/resources/faqs` | 无图 | OG（正文可不加图） |
| `/resources/warranty` | 无图 | 质保/服务网络图 + OG |

### B. 单页验收清单

```text
[ ] 路由：________
[ ] hero/OG 专属且与服务主题匹配
[ ] 无通用塔体/楼梯图作为主图
[ ] 服务场景图真实可核对；AI 图无 AI 味且不冒充实拍
[ ] 事实与数据清单有出处
[ ] 资质信任条 + ≥3 个转化触点
[ ] FAQ 覆盖报价/工期/资质/售后（如适用）
[ ] SEO 主词 + 长尾词映射完成
[ ] 三语无原始 key / 无硬编码中文
[ ] WebP < 500KB，MinIO 200
[ ] curl 200 + typecheck + pnpm run check
```

---

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-07 | 初稿：盘点 6 个服务/工具页 + 3 个内容中心；服务页对齐产品中心图文与转化规范，内容中心引用既有方案 |
| 2026-08-07 | 落地：AI 实拍级生图 12 张→21 个 WebP（均 <500KB）上传 MinIO `content/resources/` 并登记 static-media-paths；新建 `resources-images.ts` 注册表；6 服务页全部接入专属 OG、资质信任条、三级 CTA（聊天/主电话/询盘）；how-to-buy/inspections/warranty 内嵌真实案例卡；design-center 目录卡复用产品线实拍封面；hub 5 个服务入口卡配缩略图；三语补 FAQ（报价/资质/售后）与 SEO 标题；验证：18 路由 × 200、OG 全专属、21 资产 MinIO 200、typecheck 全绿、改动文件 0 error |
