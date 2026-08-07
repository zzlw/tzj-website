# 「为什么选我们」图文优化技术方案

> 日期：2026-08-07
> 状态：已落地（2026-08-07：注册表/9张AI素材/OG/信任条/三语均已接入并验证；公司实力数字升级与真实团队照片待业务提供后补充）
> 范围：`apps/web` 「为什么选我们」全部页面（`/why-us` + story / team / certification / global，共 **5 个路由**）、
> 静态媒体资产、i18n 文案、SEO/OG 与转化
> 关联：`docs/product-center-image-content-optimization-plan.md`（同构方案）、
> `docs/solutions-image-content-optimization-plan.md`、
> `docs/case-center-content-ai-enrichment-plan.md`、`docs/web-seo-assessment-and-plan.md`、`AGENTS.md`

## 结论先行

「为什么选我们」与产品中心/解决方案一样是**纯静态代码维护**：没有后台、没有 API、没有数据库。
内容来自 `apps/web/src/app/[locale]/why-us/*/page.tsx` + 三语 `pages/why-us*.json` + 静态媒体。

本地盘点结论：

| 维度 | 现状 |
|---|---|
| 页面规模 | 5 个路由：`/why-us`、`/why-us/story`、`/why-us/team`、`/why-us/certification`、`/why-us/global` |
| 图片 | 通用素材偏多：`/why-us` hero 用 `galvanized-stair.webp`，`/why-us/global` hero 用 `tower-wylie.jpg`，均为全站通用图 |
| 视频 | `/why-us` 用 `why.mp4`、`/why-us/story` 用 `whp-hero.mp4`，需确认 MinIO 源与压缩 |
| 团队页 | 成员是纯文字卡片，**无头像/照片**，信任感弱 |
| 故事页 | 时间线纯文字，无里程碑配图/老照片 |
| 全球页 | 区域/行业是文字标签，无地图、无项目分布视觉 |
| 资质页 | 已完成证书墙 + 灯箱（ISO 9001/14001/45001、五星售后），是三语/图片最完整的一页 |
| SEO/OG | 5 页 `createPageMetadata` 均未传 image，OG 全部回退默认图 |
| 转化 | 有 `CtaBand`/`BookConsultButton`；无电话/询盘入口、部分页无资质信任条 |

本方案给出：

1. **先盘点后替换**：5 页逐一定义「公司可信度视觉身份」，替换通用塔体/楼梯图，补齐团队头像、故事配图、全球分布图。
2. **静态资产单一数据源**：建立 `why-us` 图片注册表，页面不再散落 `HERO_IMAGE` 常量。
3. **信任与转化**：复用产品中心 3.7——资质信任条、真实案例、公司实力数字、三级 CTA；本期不做埋点。
4. **SEO/OG**：每页专属 OG 图，不再回退默认图。

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

### 1.1 页面矩阵（5 个路由）

| 路由 | 页面定位 | 主要图片现状 |
|---|---|---|
| `/why-us` | 为什么选我们（总览） | hero 视频 + `galvanized-stair.webp` 通用图；三大支柱为图标卡片 |
| `/why-us/story` | 发展历程 | hero 视频 + `about-cn.webp`；价值观/时间线纯文字 |
| `/why-us/team` | 团队 | `PageHero` 无图；成员为文字卡，无头像 |
| `/why-us/certification` | 资质认证 | 已完成 4 张证书墙 + 灯箱（本轮已落地） |
| `/why-us/global` | 全球/服务网络 | hero `tower-wylie.jpg` 通用塔体；区域/行业文字标签 |

### 1.2 静态数据源

| 数据源 | 内容 | 变更方式 |
|---|---|---|
| `apps/web/src/app/[locale]/why-us/*/page.tsx` | 页面结构与图片常量 | 代码 PR |
| `apps/web/src/messages/{locale}/pages/why-us*.json` | 三语文案 | 代码 PR |
| `apps/web/src/lib/static-media-paths.ts` | 静态媒体清单 | 新增资产必须登记 |
| `apps/web/public/media` + OSS/MinIO | 图片/视频 | 压缩后入库 |

### 1.3 图片现状

- `/why-us`、`/why-us/global` 使用全站通用素材（`galvanized-stair.webp`、`tower-wylie.jpg`），
  无法体现「公司实力/全球服务」；
- 团队页无成员照片；故事页时间线无配图；全球页无地图/分布图；
- 2 个 hero 视频（`why.mp4`、`whp-hero.mp4`）需确认 MinIO 源与编码；
- 资质页已达标，可作为其它页面的图片规范样板。

### 1.4 文案现状

- 文案结构完整（使命/愿景/价值观/里程碑/团队/区域），但**证据化不足**：
  缺真实项目数、服务网络、认证、客户行业的具体呈现；
- 团队描述偏职能介绍，缺「为什么值得信任」；
- 全球页用文字标签代替分布，视觉说服力弱。

### 1.5 SEO / 转化现状

- 5 页均未传 OG 图，分享全部回退默认图；
- 转化只有 `BookConsultButton`/`CtaBand`，无电话/询盘入口；
- `/why-us/story`、`/why-us/team`、`/why-us/global` 没有资质信任条；
- StatBand 只有 2018 / 13 / 6 / 4，缺少项目数/服务网络等更有说服力的数字。

---

## 二、目标与原则

### 2.1 目标

- 5 页全部具备「公司可信度视觉 + 证据化文案 + 资质信任 + 三级 CTA + 专属 OG」；
- 客户看完能回答「为什么选拓之迹」，并产生咨询动作。

### 2.2 原则

| 原则 | 说明 |
|---|---|
| 无后台、无 DB | 只动 `apps/web` 代码与静态资产 |
| 真实优先 | 团队照片、案例、数字必须真实可核对，不虚构 |
| AI 实拍级 | 缺实拍素材时用 AI 实拍级生图，无 AI 味，不冒充实拍 |
| 证据化文案 | 用项目数、服务网络、认证、案例替代空泛承诺 |
| 信任层 | 资质、案例、服务闭环、公司实力数字 |
| 本期不做埋点 | 不以行为指标验收，以业务记录与人工抽检为准 |

---

## 三、图文与转化规范

### 3.1 图片注册表

建立 `apps/web/src/lib/why-us-images.ts`：

```ts
export const WHY_US_IMAGES = {
  overview: {
    hero: '/media/why-us/overview-hero.webp',
    og: '/media/why-us/overview-og.webp',
  },
  story: {
    hero: '/media/why-us/story-hero.webp',
    og: '/media/why-us/story-og.webp',
  },
  team: {
    hero: '/media/why-us/team-hero.webp',
    og: '/media/why-us/team-og.webp',
  },
  certification: {
    hero: '/media/why-us/certification-hero.webp',
    og: '/media/why-us/certification-og.webp',
  },
  global: {
    hero: '/media/why-us/global-hero.webp',
    og: '/media/why-us/global-og.webp',
  },
} as const;
```

OSS/MinIO key：`content/why-us/{name}-*.webp`（`resolveMediaUrl` 自动映射）。

### 3.2 页面图片规范

| 页面 | 建议图片 | 要求 |
|---|---|---|
| `/why-us` | 工厂/交付/团队实拍 hero + 三大支柱配图 | 体现制造实力与交付现场 |
| `/why-us/story` | 里程碑配图（成立/基地/大项目/认证） | 真实时间线素材优先，无则 AI 实拍级示意 |
| `/why-us/team` | 成员头像 + 团队工作照 | 有真实照片优先；无真实照片不放 AI 人像 |
| `/why-us/certification` | 证书墙（已落地） + 页头 OG | 保持现状，补 OG |
| `/why-us/global` | 服务网络地图/项目分布 + 行业场景 | 地图用真实省份/城市标注，不虚构海外 |

### 3.3 文案规范

- 每页 Hero 回答三问：为什么可信 / 有什么证据 / 下一步；
- 公司实力数字（成立年份、交付项目数、服务网络、覆盖行业）集中展示，数字需业务确认；
- 团队页补「专业背景/从业年限/主导项目」；
- 全球页把文字标签升级为「区域 + 项目数/服务内容」组合；
- 故事页时间线配图与描述一一对应。

### 3.4 信任层与转化

- 所有页面复用资质信任条（ISO 9001/14001/45001、五星售后）并链接资质页；
- 每页 ≥3 个转化触点：场景化聊天、`tel:` 电话、询盘表单（复用三级分流）；
- 相关页面挂 2~3 个真实案例（如 `/why-us/global` 挂服务网络案例）。

### 3.5 SEO 意图映射

| 页面 | 主关键词 | 长尾示例 |
|---|---|---|
| `/why-us` | 消防训练设施厂家 | 训练塔厂家实力、拓之迹公司 |
| `/why-us/story` | 拓之迹发展历程 | 拓之迹成立、训练设施厂家介绍 |
| `/why-us/team` | 训练设施厂家团队 | 消防训练专家团队、工程团队 |
| `/why-us/certification` | 训练塔资质认证 | 消防设备认证、ISO 认证厂家 |
| `/why-us/global` | 训练设施服务网络 | 全国训练基地案例、消防训练设施服务 |

---

## 四、技术落地

### 阶段 A：盘点与素材收集（0.5 天）

- 收集真实公司/工厂/交付/团队照片；确认可公开使用的数字；
- 检查 `why.mp4`、`whp-hero.mp4` 的 MinIO 源与编码；
- 输出 5 页素材替换清单。

### 阶段 B：素材生产（1~2 天）

- 真实素材优先；缺图用 AI 实拍级生图（无 AI 味、不冒充实拍）；
- 压缩 WebP → 上传 MinIO → 登记 `static-media-paths.ts`。

### 阶段 C：代码接入（1 天）

1. 新建 `why-us-images.ts`，替换页面散落常量；
2. 5 页 `createPageMetadata` 传 `ogImage`；
3. 补团队头像/故事配图/全球分布；
4. 全部页面接入资质信任条 + 三级 CTA；
5. 三语文案按 3.3 重写。

### 阶段 D：验证

- curl 5 个路由 200；
- OG 断言：5 页 openGraph.images 非默认图；
- 无原始 i18n key、无硬编码中文；
- typecheck + `pnpm run check`；
- 人工抽检：图片真实感、数字可核对。

---

## 五、验收标准

1. 5 页 hero/OG 均为专属图，不再使用通用塔体/楼梯图；
2. 团队页有真实头像/工作照（或明确不展示，不用 AI 人像冒充）；
3. 故事页时间线有配图；全球页有服务网络/分布视觉；
4. 公司实力数字经业务确认且可核对；
5. 全部页面有资质信任条 + ≥3 个转化触点；
6. OG 图 5 页全配；
7. 三语同步、无硬编码中文；
8. 无后台/DB/API 改动；`pnpm run check` + typecheck 全绿。

---

## 六、工作量与排期估算

资产估算：5 页 ×（hero + OG + 配图 2~4 张）≈ **20~30 张**；
AI 候选 2~3 倍 ≈ **50~90 次生成**；WebP 后约 **15~30MB**。

| 阶段 | 内容 | 估算 |
|---|---|---|
| A | 盘点/素材收集/数字确认 | 0.5 人日 |
| B | 素材生产（实拍/AI + 压缩上传） | 1~2 人日 |
| C | 代码接入（注册表/页面/文案/信任层/CTA） | 1 人日 |
| D | 验证与回归 | 0.5 人日 |
| **合计** | | **约 3~4 人日** |

---

## 七、风险与依赖

| 风险/依赖 | 影响 | 对策 |
|---|---|---|
| 无真实团队/工厂照片 | 只能 AI，人像信任风险 | 不用 AI 人像冒充；可用工厂/交付场景图替代 |
| 公司数字未确认 | 夸大宣传风险 | 数字必须业务确认，不虚报 |
| 全球地图虚构 | 品牌信任受损 | 只标真实服务区域/项目，不画海外假分布 |
| 视频源缺失/超重 | hero 404/性能差 | 阶段 A 检查 MinIO 与编码，不达标退化静态 hero |

依赖：`why-us-images.ts`、三语 `pages/why-us*.json`、`static-media-paths.ts`、MinIO/OSS；
无 API/DB/Admin。

---

## 附：页面清单与单页验收模板

### A. 当前清单

| 页面 | 当前图 | 建议动作 |
|---|---|---|
| `/why-us` | `galvanized-stair.webp` + `why.mp4` | 替换为工厂/交付实拍 hero + 三大支柱配图 |
| `/why-us/story` | `whp-hero.mp4` + `about-cn.webp` | 时间线配图 + 专属 OG |
| `/why-us/team` | 无头像 | 真实团队照片/工作照 |
| `/why-us/certification` | 证书墙已达标 | 补页头/OG 图 |
| `/why-us/global` | `tower-wylie.jpg` | 服务网络/分布图 + 专属 OG |

### B. 单页验收清单

```text
[ ] 路由：________
[ ] hero/OG 专属且与页面主题匹配
[ ] 无通用塔体/楼梯图作为主图
[ ] 图片真实可核对；AI 图无 AI 味且不冒充实拍
[ ] 公司实力数字经业务确认
[ ] 资质信任条 + ≥3 个转化触点
[ ] SEO 主词 + 长尾词映射完成
[ ] 三语无原始 key / 无硬编码中文
[ ] WebP < 500KB，MinIO 200
[ ] curl 200 + typecheck + pnpm run check
```

---

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-07 | 初稿：盘点 5 个「为什么选我们」路由；对齐产品中心图文与转化规范，明确静态无后台边界 |
| 2026-08-07 | 落地：新增 `lib/why-us-images.ts` 注册表；AI 实拍级生图 9 张（5 hero + 4 配图）压缩 WebP 上传 MinIO（`content/why-us/`）并登记 `static-media-paths.ts`；5 页接入专属 hero/OG（不再回退默认图）；overview/story/team/global 接入资质信任条；story 时间线 2 处里程碑配图；team 页补头图与协作配图（无 AI 人像）；global 区域升级为境内/海外分组卡片（不虚构海外分布）；相关卡补封面图；三语 i18n 同步；上传脚本 `apps/api/scripts/upload-why-us-assets.mjs`；验证：5 路由三语 200、OG 专属、typecheck/biome 通过 |
