# 媒体水印设计方案（统一文档：按次覆盖 + 逐张操作 + 批量补水印）

> **状态总览（2026-08-03）**
>
> | 部分 | 子方案 | 状态 |
> |------|--------|------|
> | 第一部分 | 按次覆盖（Opt-out / Force） | ✅ 已实施（设计定稿 v3；迁移 `20260730120000_media_asset_watermarked` 已产出） |
> | 第二部分 | 逐张水印操作（加水印 / 去水印） | ✅ 已实施 · 2026-08-03 终极评估通过（见第二部分 §10） |
> | 第三部分 | 批量补水印 | ⏸ 暂缓 · v2.1 待评审（见第三部分 §11 对账记录） |
>
> 关联模块：`apps/api/src/media/`、`apps/admin/src/components/media/`、`apps/admin/src/features/media.ts`、`packages/types`
>
> 来源说明：本文件于 2026-08-03 由三份独立文档合并而成（`watermark-opt-out-design.md` / `per-image-watermark-design.md` / `batch-watermark-design.md`，原文件已删除），统一为单一事实来源，杜绝跨文档不一致。三个部分内部章节号各自独立编号，正文中的「第 X 部分」即指本文件对应部分。

---

# 第一部分 · 媒体水印按次覆盖（Opt-out / Force）

> 状态：✅ **已实施**（设计定稿 v3，经三轮评审修订，已冻结；迁移 `20260730120000_media_asset_watermarked` 已产出，为第二、三部分的前置）
> 日期：2026-07-30
> 关联模块：`apps/api/src/media/`、`apps/admin`（媒体库 / MediaPicker）、`packages/types`

---

## 1. 背景与问题

当前媒体水印为 **上传时服务端烧录**（Burn-in）模式：

- 配置存于 `Setting` 表（key = `SITE_MEDIA_SETTING_KEY`），经 `PUT /settings/site/media` 全局开关；
- `POST /media/upload` → `MediaService.uploadAndRegister` → `WatermarkService.processUpload`，图片经 sharp 合成、视频经 ffmpeg 烧录后再写入 S3；
- 过滤维度只有**全局级**：`applyToFolders`（uploads/cms）、`applyToImages/applyToVideos`、`minWidth/minHeight`。

由此产生的核心痛点：

1. **一刀切**：全局水印开启后，所有走媒体库的上传全部被烧录，想上传一张"干净"的图（如给合作方的原图、后台内部用图、待做水印 Logo 的素材本身）没有任何入口，只能先去设置页关水印 → 上传 → 再开回来，繁琐且有并发窗口（关掉期间其他人上传的图也漏掉水印）。
2. **不可逆**：烧录是破坏性的，原图不落库，事后无法"去水印"。（⚠️ 2026-08-03 起缓解：上传自动烧录链路同步备份原图至 `_archive/watermark/{id}/`，与手动加水印共用恢复路径，见第二部分 §2.3 增补说明）
3. **不可见**：`MediaAsset` 无水印标记字段，媒体库里分不清哪张图带水印、哪张不带。
4. **链路不一致**（现状事实，非本方案引入）：`POST /storage/upload` 与「presign 直传 + register 登记」两条旁路本来就不经过水印。

---

## 2. 业内实践调研

| 实践 | 代表 | 核心思路 | 适配度 |
|------|------|---------|--------|
| **交付时叠加**（Delivery-time） | 阿里云 OSS `x-oss-process=image/watermark`、Cloudinary/imgix URL 变换 | 只存原图，访问 URL 上带处理参数实时生成水印图；水印是"交付策略"而非"文件属性"，随时可开关、可反悔 | 理论最佳，但本地 MinIO 无此能力，且 C 端图片 URL 直出数据库，需改造 URL 拼装 + CDN 缓存 + 防盗链（防止去参访问原图），复杂度高 |
| **双副本**（Original + Derivative） | Getty / Shutterstock、大型 DAM 系统 | 原图存私有区，公开区放带水印衍生图；DB 记录两个 key | 非破坏、可重打水印，但存储翻倍、增删改逻辑翻倍 |
| **上传时豁免**（Per-upload override） | WordPress 水印类插件（Image Watermark 等）、各类 CMS | 全局开关照旧，上传表单提供"本次不加水印"勾选，配合权限控制 | 改动最小，直接命中痛点 |
| **资产级标记** | 通用 DAM 惯例 | 资产记录"是否已加水印"，列表可视化、可筛选 | 低成本补齐可见性 |

**共识原则**：水印应尽量后置（越晚烧录越可逆）；无论哪种模式，都必须提供**单次上传粒度的覆盖入口**，且默认值跟随全局策略（安全默认）。

## 3. 方案选型

| 候选 | 描述 | 结论 |
|------|------|------|
| A. 上传时豁免 + 资产标记 | `/media/upload` 增加 `watermark` 覆盖参数；`MediaAsset` 增加 `watermarked` 字段 | ✅ **采纳**。12 处小改动（见第 5 节），直接解决痛点 1 与痛点 3 |
| B. 双副本 | 原图 + 水印衍生图各存一份 | ⏸ 暂缓。本项目为小而美官网后台（个位数运营人员），存储翻倍与逻辑复杂度不划算；列为演进方向 |
| C. 交付时叠加 | 生产走 OSS 图片处理参数，本地 MinIO 走代理 | ⏸ 暂缓。本地/生产行为不一致 + URL 改造面大；若未来防盗需求升级再评估 |

选型依据项目约束：小规模团队、避免过度设计（参见 `docs/design/README.md` 与项目设计哲学）。方案 A 保持"烧录"这一现有心智不变，只是把决定权从"全局唯一"下放到"单次上传可覆盖"。

---

## 4. 详细设计（方案 A）

### 4.1 API 契约

`POST /media/upload` 的 multipart 表单新增可选字段 `watermark`：

```
watermark: 'auto' | 'skip' | 'force'   // 默认 'auto'
```

| 取值 | 语义 |
|------|------|
| `auto` | 默认。完全遵循全局设置（现有行为，向后兼容） |
| `skip` | 本次上传强制不加水印（即使全局开启、目录/类型匹配） |
| `force` | 本次上传强制加水印（全局已开启但目录不在 `applyToFolders`、或类型开关关闭时也加；全局 `enabled=false` 时仍不加——没有已启用的水印样式来源；SVG/GIF、小于 min 尺寸的硬性跳过仍然生效） |

设计说明：

- 用三值枚举而非 `skipWatermark: boolean`，一次把"豁免"和"补打"两个方向都覆盖，避免后续再改契约；
- **权限**：不新增权限点。持有 `media.upload` 即可使用 `skip/force`。理由：本项目运营团队极小且互信，水印目的是 C 端防盗图而非内部管控，为一个勾选框引入新权限点属于过度设计。若未来需要收紧，在 controller 处加 `media.watermark.override` 权限即可（预留说明，不实施）；
- **审计**：media 模块当前没有操作审计埋点（已核实），本方案也不新增——`MediaAsset.watermarked + uploadedById` 两个字段即构成留痕（谁上传的、是否烧录了水印），足够本项目规模的追溯需求。

### 4.2 数据模型

`MediaAsset` 新增一列：

```prisma
model MediaAsset {
  // ...现有字段
  watermarked Boolean? // true=服务端已烧录；false=服务端确认未烧录；null=未知（历史数据/服务端未经手文件）
}
```

- 迁移：`prisma migrate dev --name media-asset-watermarked`（历史行保持 null，不回填、不猜测）。**必须产出迁移文件、禁止 `db push`**：生产库靠 `migrate deploy` 应用，本项目踩过"开发 db push 与生产 migrate deploy 漂移"的坑，新增列若不经迁移文件会在生产发布时丢失（已产出迁移 `20260730120000_media_asset_watermarked`，本方案实施完毕）；
- 赋值来源是**实际处理结果**而非请求参数：`WatermarkService` 返回"是否真的烧录了"（见 4.3），跳过（尺寸不足、SVG/GIF、ffmpeg 缺失、处理异常回退）一律记 `false`。这保证字段语义是"文件事实"而不是"用户意图"；
- **`false` 与 `null` 严格区分**：`false` 仅在服务端亲手处理过文件buffer 且未烧录时写入；服务端没经手文件内容的链路（presign 直传登记、历史数据）一律 `null`。这一区分是未来"批量补水印"工具（第三部分）按 `false` 筛选时不误伤的前提。

### 4.3 后端改动

#### `packages/types/src/dto/site-media.ts`

```ts
/** 单次上传的水印覆盖策略 */
export type WatermarkOverride = 'auto' | 'skip' | 'force';
```

#### `watermark.service.ts`

1. `ProcessedMedia` 增加 `watermarked: boolean` 字段；所有 return 路径显式赋值（成功烧录 `true`，其余 `false`）。
2. `processUpload` 签名追加参数：

```ts
async processUpload(
  buffer: Buffer, mimeType: string, folder: string,
  override: WatermarkOverride = 'auto',
): Promise<ProcessedMedia>
```

3. 判定逻辑（替代现有 `shouldProcess` 的调用处）：

```
override === 'skip'  → 直接返回原文件（watermarked: false）
override === 'force' → 仅要求 config.enabled，跳过 applyToFolders /
                       applyToImages / applyToVideos 检查；
                       SVG/GIF 与 min 尺寸检查仍生效
override === 'auto'  → 现有 shouldProcess 全量检查（行为不变）
```

> `force` 不额外校验水印内容：`buildStamp` 对空 text 本就回退 `'Watermark'` 占位，且 settings schema 的 `superRefine` 在 `enabled=true` 时已拦截空内容，"enabled 但内容未配置"到不了运行时，不要重复校验。

`checkFfmpeg` 失败、处理异常回退等现有兜底逻辑一律不变。

#### `media.service.ts` / `media.controller.ts`

- `uploadAndRegister(file, folder, userId, watermark)` 透传 override，并把 `processed.watermarked` 写入 `mediaAsset.create`；
- controller 的 `upload()` 新增 `@Body('watermark') watermark?: string`，归一化：非 `skip`/`force` 值一律按 `auto` 处理（宽容解析，不抛 400），Swagger `@ApiBody` 补充该字段；
- `replaceSiteAsset`（替换站点静态资源）：该链路直接 `s3.upload` 覆盖同 key、随后 `update` 同一条 `MediaAsset` 记录。替换不走水印烧录（上传自动烧录目录范围不含 `content/`；2026-08-03 起站点资源可经手动 `applyWatermark` 加水印，属另一条 force 链路），但**必须在 update 时把 `watermarked` 置回 `null`**——文件内容已换，旧标记即失效，不处理会留下过期数据。

#### 旁路链路（明确不改，写入文档留痕）

- `POST /storage/upload`：历史通用上传口，本来就无水印，不产生 `MediaAsset` 记录，保持现状；
- `presign + register` 直传链路：服务端拿不到文件内容，天然无法烧录。`register` 登记时 `watermarked` 记 **`null`（未知）而非 `false`**——上传者可能直传一张本身已带水印的图，服务端没经手就不能"确认无水印"（语义定义见 4.2）；
- 结论：**"要水印，走 `/media/upload`"** 是唯一约定，本方案不试图在旁路上补水印。

### 4.4 Admin 前端改动

#### `features/media.ts`

```ts
export async function uploadMedia(
  file: File, folder = 'uploads',
  watermark: WatermarkOverride = 'auto',
): Promise<MediaAsset>
// 仅在非默认值时追加字段，与 BFF "缺省不透传"保持一致：
// if (watermark !== 'auto') fd.append('watermark', watermark)
// useUploadMedia 的 mutationFn 参数定为对象形式 { file, watermark? }：
// 两个调用方（media/page.tsx 循环、MediaPicker）都需传 toggle 状态，对象形式改造点最少
```

#### BFF `app/api/media/upload/route.ts`

透传 `watermark` 表单字段（缺省不追加，保持请求最小）。

#### UI 交互

| 入口 | 改动 |
|------|------|
| 媒体库页 `media/page.tsx` 上传按钮 | 上传按钮旁增加一个 Switch/Checkbox「本次上传不加水印」，**恒显示、不做全局状态联动**；选中后本批次所有文件带 `watermark=skip`，上传完成后自动复位为不选中（防遗忘常开）。tooltip 注明「全局水印关闭时此选项无效果」 |
| `MediaPicker.tsx` 上传区 | 同上，复用同一个小组件（建议抽 `WatermarkOptOutToggle`），置于上传按钮附近 |
| `MarkdownEditor.tsx`（Vditor 拖拽上传） | **不加开关**，恒为 `auto`。编辑器内贴图是 CMS 正文配图，正是水印的目标场景；需要无水印图时先去媒体库上传再插入 |
| 媒体库列表/卡片 | `watermarked === true` 的资产显示一个小徽标（如 Stamp 图标 + tooltip「已烧录水印」）；`false` 不显示；`null`（历史数据）不显示。`MediaPicker` 网格同步显示同一徽标（选图时能直接看出"这张带水印"）。可选：列表筛选器增加"含水印/无水印"（低优先级，可后做） |

**明确不做"仅全局开启时显示"的联动**：读全局水印状态需 `GET /settings/site/media`（要求 `settings.view` 权限），若在上传入口拉取，无权限的上传者每次进页都会打一个 403（apiClient 的 403 特判只针对 2FA，其余走错误路径产生噪音），且会导致不同角色看到不同 UI。恒显示 + tooltip 是更简单一致的方案：勾了但全局关闭 → 本来就不加水印，无副作用；净省一个查询和整段条件逻辑。

### 4.5 安全与边界

1. `skip` 只作用于"本次上传的文件"，不触碰全局配置，**消除了"关全局→上传→开回来"期间其他人上传漏水印的并发窗口**——这是本方案相对现状最重要的安全改进；
2. `force` 不会绕过 `enabled=false`：全局关闭意味着"本站当前不使用水印"，单次上传不应能激活一个未配置/已停用的水印样式；
3. C 端（apps/web）零改动、零感知：交付的仍是 S3 上的最终文件；
4. `watermarked` 为可空布尔，历史数据不回填，任何展示逻辑必须容忍 `null`；
5. **发布兼容性：零风险、无部署顺序要求**——可空新列 + 纯可选参数，旧 admin 前端打新 API 不传字段走 `auto`，新前端打旧 API 多余的 multipart 字段被忽略；回滚时先退代码即可，残留列多余但无害，无不可逆操作。

---

## 5. 实施清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `packages/types/src/dto/site-media.ts` | 新增 `WatermarkOverride` 类型导出 |
| 2 | `apps/api/prisma/schema.prisma` | `MediaAsset.watermarked Boolean?` + 迁移 |
| 3 | `apps/api/src/media/watermark.service.ts` | `ProcessedMedia.watermarked`；`processUpload` 支持 override 三态 |
| 4 | `apps/api/src/media/media.service.ts` | `uploadAndRegister` 透传 override、落库 `watermarked`；`register` 记 `null`；`replaceSiteAsset` 更新时置 `null` |
| 5 | `apps/api/src/media/media.controller.ts` | `upload()` 接收并归一化 `watermark` 字段，Swagger 更新 |
| 6 | `apps/admin/src/features/media.ts` | `uploadMedia` / `useUploadMedia` 增加 watermark 参数 |
| 7 | `apps/admin/src/app/api/media/upload/route.ts` | BFF 透传 `watermark` |
| 8 | `apps/admin/src/components/crud/WatermarkOptOutToggle.tsx`（新增） | 「本次上传不加水印」开关小组件 |
| 9 | `apps/admin/src/app/(dashboard)/media/page.tsx` | 集成开关 + 列表水印徽标 |
| 10 | `apps/admin/src/components/crud/MediaPicker.tsx` | 集成开关 + 网格水印徽标 |
| 11 | `apps/admin/src/features/types.ts`（MediaAsset 前端类型） | 补 `watermarked?: boolean \| null` |
| 12 | `apps/api/src/media/watermark.service.spec.ts`（新增） | 第 6 节测试计划的单测与接口层用例（media 模块首个 spec） |

> 所有权注记（AGENTS.md）：#1 涉及 `packages/types` 新增类型，属"仅允许新增"范围；#2 涉及 `prisma/schema.prisma`，按所有权矩阵为"A2 提议, A1 审批"。两项均为 A1 审批项，本文档即提案；其余均为 A2 业务代码。

## 6. 测试计划

1. **单测（watermark.service）**——注意这是 media 模块的第一个 spec（现有测试集中在 access/auth/support/users），mock 策略：**sharp 真跑不 mock**（合成逻辑就是被测对象，用 sharp 现场生成纯色测试图作输入，断言输出 buffer 与输入不同/相同即可判定是否烧录）；`SettingsService.getSiteMediaSettings` 与 `S3Service` 用 stub 注入。用例：
   - `override=skip` + 全局开启 → 返回原 buffer，`watermarked=false`；
   - `override=force` + 目录不在 `applyToFolders` → 烧录，`watermarked=true`；
   - `override=force` + `enabled=false` → 不烧录；
   - `override=auto` → 与现有行为逐项一致（回归）；
   - 小图/SVG/GIF 在 `force` 下仍跳过（`watermarked=false`）；
   - 视频 + ffmpeg 不可用（stub `checkFfmpeg` 为 false）→ 回退原文件，`watermarked=false`。
2. **接口层单测**（并入 controller/service 层 spec，用 Nest Testing Module，与现有测试形态一致，**不新搭 supertest e2e 基建**）：`watermark` 传非法值（如 `"yes"`）按 `auto` 处理，不报 400（归一化逻辑抽纯函数即可直接测）；不传字段行为与改造前完全一致；`register` 登记后 `watermarked` 为 `null`。
3. **E2E 手工**：全局开启水印 → 媒体库勾选"不加水印"上传 → 下载校验无水印、列表无徽标；不勾选上传 → 有水印、有徽标；MarkdownEditor 贴图 → 有水印；替换站点资源 → 该记录 `watermarked` 变回 `null`。
4. **迁移验证**：迁移后历史 `MediaAsset` 行 `watermarked` 为 null，媒体库列表正常渲染。

## 7. 未来演进（不在本期范围）

1. **双副本模式**（方案 B）：若出现"给客户看带水印预览、成交后交付原图"类需求，再引入 `originalKey` 私有存储 + 衍生图公开的双副本结构，届时 `watermarked` 字段语义平滑升级为"公开副本是否带水印"；
2. **交付时叠加**（方案 C）：若 C 端防盗需求升级且已全面切 OSS + CDN，可评估 `x-oss-process` 样式分离 + 原图防直连；
3. **重打水印工具**：基于 `watermarked=false` 的筛选，提供"对选中资产批量补水印"的管理操作（即本文件第三部分；依赖双副本的原图留存才真正安全，烧录模式下补打即二次编码）。

---

# 第二部分 · 逐张水印操作（按资产单张 加水印 / 去水印）

> 状态：✅ **已实施 · 2026-08-03 终极评估通过（本部分 §10）**（v2 定稿；终审修正 list 上限死角 + 补齐 §7.1 单测）
> 日期：2026-08-03
> 关联模块：`apps/api/src/media/`、`apps/admin/src/components/media/`、`apps/admin/src/features/media.ts`
> 前置依赖：本文件第一部分（已完成实施，`MediaAsset.watermarked` 字段 + 三态覆盖已就绪）
> 替代方案：本文件第三部分（批量方案，因 BFF SSE 架构问题暂缓，本期以逐张方案替代）

---

## 1. 背景与动机

### 1.1 核心诉求

存量媒体资产中存在未烧录水印的图片，需要一种机制让运营人员对单张图片执行「加水印」或「去水印」操作。

### 1.2 为什么选择逐张而非批量

| 维度 | 逐张操作（本部分方案） | 批量操作（本文件第三部分） |
|------|-------------------|---------------------------------------|
| **架构复杂度** | 普通 JSON 请求/响应 | 需 SSE 流式进度推送 |
| **BFF 穿透** | 通用 BFF 代理直接支持 | 通用 BFF 的 `await apiRes.text()` 会缓冲整个 SSE 流，需专用流式 BFF |
| **nginx 配置** | 无额外要求 | API 域名需加 `proxy_read_timeout 300s` |
| **去水印能力** | ✅ 单张从备份恢复，用户可接受 | ❌ 批量恢复无实际意义 |
| **用户体验** | 悬停卡片 → 一键操作，直观 | 勾选 → 弹窗 → 等待，适合大量 |
| **实现量** | ~6 个文件 | ~8 个文件 + nginx 变更 |
| **适用场景** | 日常零散操作（<50 张/次） | 一次性全量处理（>100 张） |

**结论**：逐张方案覆盖 90% 的日常场景，架构简单，无 SSE/BFF 问题，且能提供「去水印」能力。批量方案留待后续量级增长时再做。

### 1.3 业内实践

- **WordPress 媒体库**：单张图片有「编辑」入口，可施加/移除水印（依赖原图保留）
- **Lightroom**：导出时决定是否加水印，原图始终保留
- **DAM 系统**（Bynder、Cloudinary）：单资产操作 + 批量操作并存

本项目为烧录模式（水印合成到像素），「去水印」依赖备份恢复。

---

## 2. 方案概览

### 2.1 用户流程

```
管理员在媒体库看到目标图片
→ 悬停卡片，右上角操作按钮区出现「水印」按钮
→ 点击：
   - 未加水印 → 一键加水印（自动备份原图到 _archive）
   - 已加水印 → 一键去水印（从 _archive 恢复最近备份）
→ 操作完成，卡片自动刷新（水印状态徽标更新）
```

### 2.2 加水印流程（单张）

```
1. 校验：deletedAt / asset.watermarked !== true（已加水印则拒绝；站点资源 2026-08-03 起同样支持）
2. 从 S3 下载原文件（getObjectBuffer）
3. 调用 WatermarkService.processUpload(buffer, mimeType, folder, 'force')
   —— 格式适用性由其内部 shouldProcess 判定：force 跳过目录/类型范围检查，
      但 SVG/GIF/最小尺寸/非 image-video 类型硬性拦截（返回 watermarked=false）
4. 若 processed.watermarked === false → 返回 422（尺寸不足/格式不支持）
5. 备份：s3.copy(asset.key, backupKey)
   - backupKey = `_archive/watermark/${asset.id}/${Date.now()}-${uuid8}-${basename}`
6. 覆盖写回：s3.upload(processed.buffer, asset.key, processed.mimeType)
7. 更新 DB：watermarked=true, mimeType, size
8. 返回更新后的 MediaAsset
```

### 2.3 去水印流程（单张）

```
1. 校验：asset.watermarked === true（未加水印则拒绝）
2. 查找最近备份：s3.list(`_archive/watermark/${asset.id}/`)
   - 无备份 → 返回 404（无法去水印，提示手动从 OSS 恢复）
   - 有备份 → 取最新一条（按时间戳排序）
3. 备份当前带水印文件（防误操作）：s3.copy(asset.key, `_archive/watermark-before-remove/${asset.id}/${Date.now()}-${uuid8}-${basename}`)
4. 恢复：s3.copy(backupKey, asset.key)
5. s3.head() 读取恢复后文件的元信息，更新 DB：watermarked=false, mimeType, size（水印处理可能改变过二者）
6. 返回更新后的 MediaAsset
```

### 2.4 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 备份路径 | `_archive/watermark/{assetId}/{timestamp}-{uuid8}-{basename}` | 按资产 ID 分目录，查找备份只需 list 固定前缀，无需全局扫描；追加随机后缀防并发碰撞 |
| 去水印策略 | 从备份恢复 | 烧录模式下原图已被覆盖，唯一恢复途径是备份 |
| 无备份时 | 返回 404 + 明确错误信息 | 不猜测、不静默失败；引导管理员手动从 OSS 控制台恢复 |
| 覆盖写回 vs 新 key | 覆盖写回（同 key） | URL 不变，所有 CMS 引用自动生效 |
| 权限 | `media.upload` | 与上传同源，不新增权限点 |
| 确认弹窗 | 加水印无需确认（可逆）；去水印需确认（备份可能不存在） | 加水印有备份兜底，操作轻量；去水印依赖备份存在性，需用户确认 |

---

## 3. API 契约

### 3.1 加水印

```
POST /api/media/:id/watermark
Authorization: Bearer <token>
```

**Response**（通过通用 BFF 代理，标准 JSON）：

```json
{
  "success": true,
  "data": {
    "id": "cuid1",
    "key": "cms/abc.jpg",
    "url": "https://...",
    "watermarked": true,
    "mimeType": "image/jpeg",
    "size": 123456,
    "backupKey": "_archive/watermark/cuid1/1722678000000-a1b2c3d4-abc.jpg"
  }
}
```

**错误码**：

| 状态 | code | 场景 |
|------|------|------|
| 400 | `WATERMARK_ALREADY_APPLIED` | `watermarked === true`，已有水印 |
| 422 | `WATERMARK_NOT_APPLICABLE` | SVG/GIF/尺寸不足/处理异常 |
| 404 | 标准 NotFoundException | 资产 ID 不存在 |
| 409 | `MEDIA_IN_TRASH` | 资产在回收站中 |

### 3.2 去水印

```
DELETE /api/media/:id/watermark
Authorization: Bearer <token>
```

**Response**：

```json
{
  "success": true,
  "data": {
    "id": "cuid1",
    "key": "cms/abc.jpg",
    "url": "https://...",
    "watermarked": false,
    "restoredFrom": "_archive/watermark/cuid1/1722678000000-a1b2c3d4-abc.jpg"
  }
}
```

**错误码**：

| 状态 | code | 场景 |
|------|------|------|
| 400 | `WATERMARK_NOT_APPLIED` | `watermarked !== true`，未加水印 |
| 404 | `WATERMARK_BACKUP_NOT_FOUND` | `_archive` 中无该资产的备份 |
| 409 | `MEDIA_IN_TRASH` | 资产在回收站中 |

---

## 4. 后端改动

### 4.1 `MediaService` — 新增两个方法

```ts
// apps/api/src/media/media.service.ts
// 需新增导入：UnprocessableEntityException（@nestjs/common）、randomUUID（node:crypto）
// 注：返回类型不显式标注（与现有 softRemove/restore/purge 一致，由 prisma.update 推断；
//     该文件未导入 MediaAsset 类型，显式标注会编译报错）

/** 对单张资产烧录水印。 */
async applyWatermark(id: string) {
  const asset = await this.getActiveOrThrow(id);
  if (asset.deletedAt) throw new ConflictException({ error: 'MEDIA_IN_TRASH', ... });
  if (asset.watermarked === true) {
    throw new BadRequestException({ error: 'WATERMARK_ALREADY_APPLIED', ... });
  }

  // 下载 → 处理
  const buffer = await this.s3.getObjectBuffer(asset.key);
  const processed = await this.watermark.processUpload(buffer, asset.mimeType, asset.folder, 'force');
  if (!processed.watermarked) {
    throw new UnprocessableEntityException({
      error: 'WATERMARK_NOT_APPLICABLE',
      message: '图片尺寸不足、格式不支持（SVG/GIF）或处理异常',
    });
  }

  // 备份 → 覆盖（追加随机后缀防并发碰撞）
  const basename = asset.key.split('/').pop() ?? asset.id;
  const backupKey = `_archive/watermark/${asset.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${basename}`;
  await this.s3.copy(asset.key, backupKey);
  await this.s3.upload(processed.buffer, asset.key, processed.mimeType);

  // 更新 DB
  const updated = await this.prisma.mediaAsset.update({
    where: { id },
    data: {
      watermarked: true,
      size: processed.buffer.length,
      mimeType: processed.mimeType,
    },
  });
  const enriched = await this.guard.enrichMany([updated]);
  return { ...(enriched[0] ?? updated), backupKey };
}

/** 从备份恢复单张资产的原图（去水印）。 */
async removeWatermark(id: string) {
  const asset = await this.getActiveOrThrow(id);
  if (asset.deletedAt) throw new ConflictException({ error: 'MEDIA_IN_TRASH', ... });
  if (asset.watermarked !== true) {
    throw new BadRequestException({ error: 'WATERMARK_NOT_APPLIED', ... });
  }

  // 查找最近备份（取 S3 MaxKeys 上限 1000，防备份超限时误选旧备份，见本部分 §10）
  const prefix = `_archive/watermark/${asset.id}/`;
  const backups = await this.s3.list(prefix, 1000);
  if (backups.length === 0) {
    throw new NotFoundException({
      error: 'WATERMARK_BACKUP_NOT_FOUND',
      message: '未找到该资产的备份文件，无法去水印。请从 OSS 控制台手动恢复原图。',
    });
  }
  // 按时间戳降序取最新
  const latest = backups.sort().at(-1)!;

  // 先备份当前带水印版本（防误操作）
  const basename = asset.key.split('/').pop() ?? asset.id;
  const safetyBackup = `_archive/watermark-before-remove/${asset.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${basename}`;
  await this.s3.copy(asset.key, safetyBackup);

  // 恢复
  await this.s3.copy(latest, asset.key);

  // 读取恢复后文件的元信息（水印处理可能改变 mimeType/size，恢复后须还原）
  const head = await this.s3.head(asset.key);

  // 更新 DB
  const updated = await this.prisma.mediaAsset.update({
    where: { id },
    data: {
      watermarked: false,
      mimeType: head.contentType,
      size: head.contentLength,
    },
  });
  const enriched = await this.guard.enrichMany([updated]);
  return { ...(enriched[0] ?? updated), restoredFrom: latest };
}
```

### 4.2 `MediaController` — 新增两个路由

```ts
// apps/api/src/media/media.controller.ts

@RequirePermissions('media.upload')
@Post(':id/watermark')
@ApiOperation({ summary: '对单张资产加水印' })
async applyWatermark(@Param('id') id: string) {
  return this.media.applyWatermark(id);
}

@RequirePermissions('media.upload')
@Delete(':id/watermark')
@ApiOperation({ summary: '对单张资产去水印（从备份恢复）' })
async removeWatermark(@Param('id') id: string) {
  return this.media.removeWatermark(id);
}
```

> 无需 DTO（无请求体），无需 `@Res()` 手写（标准 JSON 响应，走 TransformInterceptor）。

### 4.3 `S3Service` — 新增 `head` 方法

```ts
// apps/api/src/storage/s3.service.ts

/** 获取对象元信息（ContentLength + ContentType），不下载内容。 */
async head(key: string): Promise<{ contentLength: number; contentType: string }> {
  const result = await this.client.send(
    new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
  );
  return {
    contentLength: result.ContentLength ?? 0,
    contentType: result.ContentType ?? 'application/octet-stream',
  };
}
```

> `HeadObjectCommand` 已在 `s3.service.ts` 中导入（`exists` 方法使用），无需新增导入。

### 4.4 改动文件清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `apps/api/src/media/media.service.ts` | 新增 `applyWatermark` + `removeWatermark` 方法 + 导入 `UnprocessableEntityException`、`randomUUID` |
| 2 | `apps/api/src/media/media.controller.ts` | 新增 `POST :id/watermark` + `DELETE :id/watermark` 路由 |
| 3 | `apps/admin/src/features/media.ts` | 新增 `useApplyMediaWatermark` + `useRemoveMediaWatermark` hooks（mutationFn 直调 api，无需独立函数） |
| 4 | `apps/admin/src/components/media/MediaCard.tsx` | 悬停操作区新增水印按钮 + 新增 `onApplyWatermark`/`onRemoveWatermark` 回调 props |
| 5 | `apps/api/src/storage/s3.service.ts` | 新增 `head(key)` 方法（HEAD 请求取元信息，去水印恢复后还原 mimeType/size） |
| 6 | `apps/admin/src/app/(dashboard)/media/page.tsx` | 持有两个 mutation + ConfirmDialog + `notifySuccess`/`notifyError`，向下传回调 |

**不涉及**：`packages/types`、`prisma/schema.prisma`、nginx 配置、BFF 路由（通用 BFF 直接代理 JSON 请求）。

---

## 5. Admin 前端设计

### 5.1 MediaCard 水印按钮

在 [`MediaCard.tsx`](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/admin/src/components/media/MediaCard.tsx) 的悬停操作区（右上角 `group-hover:opacity-100` 区域），新增水印操作按钮：

**位置**：在「替换站点资源」按钮之后、「删除」按钮之前（即插在 `asset.isReplaceable` 块与 `<Can perm="media.delete">` 块之间）。

**接线约定（与现有模式一致）**：MediaCard 现有动作全部通过回调 props 上抛（`onDelete`/`onRestore`/`onPurge`/`onReplaceSite`，卡片内无 hook/mutation）。水印同样新增回调：`onApplyWatermark?: (asset: MediaAsset) => void`、`onRemoveWatermark?: (asset: MediaAsset) => void`；mutation、确认弹窗、`notifySuccess`/`notifyError` 均由 `media/page.tsx` 持有（与删除/恢复流程同构）。

**显示条件**：
- `mode === 'active'`（非回收站）
- `kind === 'image' || kind === 'video'`（复用 MediaCard 已有的 `getMediaKind(asset.mimeType, asset.filename)` 结果；`MediaAsset` 类型上**无** `kind` 字段，须用该工具函数判断）
- 权限：按钮包裹 `<Can perm="media.upload">`（项目约定，同上传按钮；MediaCard 内无权限 hook，统一用 `Can` 组件）

> 2026-08-03 起取消「非站点资源（`!asset.isSiteResource`）」限制：站点静态资源同样可一键加水印/去水印（覆盖后 C 端即展示水印图，原图备份在 `_archive/watermark/{id}/` 可随时去水印回退）。

**按钮状态**：

| 资产状态 | 图标 | Tooltip | 点击行为 |
|----------|------|---------|---------|
| `watermarked !== true` | `ShieldPlus` | 加水印 | 调用 `applyWatermark` |
| `watermarked === true` | `ShieldOff` | 去水印 | 弹出确认 → 调用 `removeWatermark` |

**视觉**：与现有操作按钮一致（`icon-xs` + `secondary` + `bg-background/80 backdrop-blur-sm`）。

### 5.2 交互流程

```
悬停卡片 → 看到水印按钮（ShieldPlus / ShieldOff）
→ 点击「加水印」：
   - 按钮变为 loading 状态（Loader2 spin，page 持有 mutation.isPending）
   - API 调用成功 → `invalidateQueries(['media'])` 卡片刷新，底部出现「水印」徽标
   - `notifySuccess('已添加水印')`
   - API 返回 422 → `notifyError(e, '加水印失败')`（ApiError 自带后端可读 message，如「尺寸不足/格式不支持」）
→ 点击「去水印」：
   - 弹出 ConfirmDialog（page 持有，同现有删除确认模式）：「确认去除水印？将从备份恢复原图。」
   - 确认 → loading → 成功 → 卡片刷新，「水印」徽标消失
   - `notifySuccess('已去除水印，原图已恢复')`
   - 返回 404 → `notifyError(e, '去水印失败')`（后端 message 提示「未找到备份文件」）
```

> 反馈一律走 [`lib/notify.ts`](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/admin/src/lib/notify.ts) 的 `notifySuccess`/`notifyError`（项目约定，同上传/恢复/替换流程），**不直接使用 toast**。

### 5.3 前端代码结构

```ts
// apps/admin/src/features/media.ts（新增）

export function useApplyMediaWatermark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<MediaAsset>(`media/${id}/watermark`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function useRemoveMediaWatermark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<MediaAsset>(`media/${id}/watermark`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });
}
```

> hooks 在 `media/page.tsx` 中调用（非 MediaCard 内部），与 `useDeleteMedia`/`useRestoreMedia` 的持有位置一致。
> 走 `api.post` / `api.del` → 通用 BFF `${BASE_PATH}/api/bff/media/:id/watermark` → NestJS API。
> 通用 BFF 的 `await apiRes.text()` 对 JSON 响应完全兼容，无 SSE 流式问题。

---

## 6. 安全与边界

### 6.1 数据安全

1. **备份机制**：加水印前自动备份原图到 `_archive/watermark/{assetId}/`，去水印时自动查找最近备份恢复。**上传自动烧录（auto/force 且实际烧录）同样同步备份原图**（2026-08-03 增补，`uploadAndRegister` 内实现，共用同一前缀），因此自动烧录素材也可一键去水印；备份失败仅告警不阻塞上传（降级为不可逆，需从存储控制台手动恢复）
2. **防误操作**：去水印前额外备份当前带水印版本到 `_archive/watermark-before-remove/`，确保操作可逆
3. **站点资源**：2026-08-03 起 `content/` 目录的站点静态资源同样支持一键加水印/去水印（移除后端 `isStaticSiteAsset` 检查与前端按钮隐藏）；备份/恢复机制与普通素材一致。删除仍受保护（`MEDIA_PROTECTED`）
4. **烧录不可逆说明**：加水印操作本身不可逆（像素已改变），但有备份兜底。去水印依赖备份存在性
5. **并发边界**：watermarked 检查非事务性，同一资产两个请求真正同时到达时可能产生冗余备份；但本方案为单人手工逐张操作场景，风险可忽略，且冗余备份不丢数据（去水印始终取最新备份），不额外加锁

### 6.2 权限

- 使用现有 `media.upload` 权限，不新增权限点
- 理由：与批量方案相同，补水印本质是"重新处理并上传"

### 6.3 视频水印耗时边界

视频水印走 ffmpeg，`execFileAsync` timeout 为 300s（[`watermark.service.ts`](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/api/src/media/watermark.service.ts) `processVideo`）。超时链路：前端 → Admin 域名 nginx（`proxy_read_timeout 300s`）→ BFF server-to-server 直连 NestJS API（无 nginx 层）。Admin 域名 300s 与 ffmpeg 300s 临界重合，极端长视频可能在临界处被 nginx 504；本期可接受（操作失败后重试即可，备份机制保证数据无损），后续若有大视频需求再调高 Admin 域名超时或引入异步任务。

> **2026-08-03 修复记录（视频加水印全部失败）**：`processVideo` 原先用 `sharp()` 探测视频宽高——sharp 是图像库，读取视频必然抛 `Input buffer contains unsupported image format`，异常被外层 catch 吞掉后返回 `watermarked: false`，导致**所有视频（mp4/mov 等）加水印均 422 失败**。已改为 ffprobe 探测（`probeVideoDimensions`，失败回退默认 1280x720，不阻塞烧录）；同时 `videoExtFromMime` 映射容器扩展名（`video/quicktime → mov`，原先拆出 `quicktime` 无法被 ffmpeg 识别为输出格式）。

### 6.4 兼容性

- **零破坏**：不影响现有上传链路、不影响 C 端
- **向后兼容**：新接口，旧前端不感知
- **通用 BFF 兼容**：JSON 请求/响应，通用 BFF 代理直接支持，无需专用 BFF 路由

---

## 7. 测试计划

### 7.1 单元测试

| 用例 | 输入 | 预期 |
|------|------|------|
| 加水印 + `watermarked=false` | 确认无水印图片 | 下载 → 烧录 → 备份 → 覆盖 → `success` |
| 加水印 + `watermarked=true` | 已有水印资产 | 返回 400 `WATERMARK_ALREADY_APPLIED` |
| 加水印 + `watermarked=null` | 历史未知资产 | 同 false，尝试处理 |
| 加水印 + SVG | `image/svg+xml` | 返回 422 `WATERMARK_NOT_APPLICABLE` |
| 加水印 + 小图 | 200x100 图片 | 返回 422，message 含「尺寸」 |
| 加水印 + 回收站资产 | `deletedAt` 非空 | 返回 409 `MEDIA_IN_TRASH` |
| 加水印 + 站点资源 | `content/hero.mp4` | 2026-08-03 起支持：正常烧录并备份，不再返回 409 |
| 去水印 + 有备份 | `watermarked=true` + `_archive` 存在 | 恢复 → `success` |
| 去水印 + 无备份 | `watermarked=true` + `_archive` 为空 | 返回 404 `WATERMARK_BACKUP_NOT_FOUND` |
| 去水印 + `watermarked=false` | 未加水印资产 | 返回 400 `WATERMARK_NOT_APPLIED` |
| 备份验证 | 正常加水印流程 | 验证 `_archive/watermark/{id}/` 下生成了备份 |
| 安全备份验证 | 正常去水印流程 | 验证 `_archive/watermark-before-remove/{id}/` 下生成了安全备份 |

### 7.2 E2E 手工

1. 上传一张图（skip 水印）→ 确认 `watermarked=false` → 悬停卡片 → 点击「加水印」→ 下载验证水印已烧录 → `watermarked=true`
2. 修改水印配置（换文字）→ 对已有水印资产点击「去水印」→ 确认弹窗 → 下载验证原图已恢复 → `watermarked=false`
3. 再次点击「加水印」→ 验证新水印样式已生效
4. 检查 `_archive/watermark/` 和 `_archive/watermark-before-remove/` 目录确认备份文件存在
5. 对 SVG 文件点击「加水印」→ 验证错误提示（`notifyError`）展示后端可读 message「格式不支持」

---

## 8. 与批量方案的关系

本方案为**第一阶段**，解决日常零散操作。若未来需要一次性处理数百张存量资产，可在本方案基础上平滑扩展：

1. **复用后端方法**：第三部分（批量方案）的 `reprocessAsset` 即为 `applyWatermark` 的单张逻辑，可直接在循环中调用
2. **BFF 流式路由**：届时新增专用流式 BFF + SSE 前端，与现有通用 BFF 并行
3. **批量按钮**：在媒体库工具栏增加「批量加水印」按钮，勾选多张后触发

本方案的备份路径约定（`_archive/watermark/{assetId}/`）与第三部分（批量方案）完全兼容。

---

## 9. 所有权注记（AGENTS.md）

| 改动 | 所有者 | 审批 |
|------|--------|------|
| `media.service.ts` 新增方法 | A2 | 否 |
| `media.controller.ts` 新增路由 | A2 | 否 |
| `s3.service.ts` 新增 `head` 方法 | A2 | 否 |
| Admin 前端 features + MediaCard | A2 | 否 |

本方案不涉及 `packages/types` 类型变更、不涉及 `prisma/schema.prisma` 修改、不涉及 nginx 配置变更、不涉及 BFF 路由新增。全部为 A2 业务代码范围。`s3.service.ts` 新增 `head` 方法为存储层基础设施扩展，属 A2 维护范围。

---

## 10. 终极评估结论（2026-08-03，代码级逐条取证 + 对抗性审查）

**结论：✅ 本部分方案已全量实施并通过终审。** 本次评估不只验证断言，还做了对抗性审查（前缀碰撞、中途失败态、路由碰撞、超时链路、双击竞态）；发现的 2 个真实问题已当场修复并回归验证。后续不应再推翻本方案。

### 10.1 实施状态取证（变更清单 6 项全部落地）

| # | 清单项 | 取证位置 | 判定 |
|---|--------|---------|------|
| 1 | `applyWatermark`/`removeWatermark` | `media.service.ts` L317-417 | ✅ |
| 2 | `POST/DELETE :id/watermark` 路由（media.upload） | `media.controller.ts` L138-150 | ✅ |
| 3 | `useApplyMediaWatermark`/`useRemoveMediaWatermark` | `features/media.ts` L117-133 | ✅ |
| 4 | MediaCard 水印按钮（ShieldPlus/ShieldOff + loading + 水印徽标） | `MediaCard.tsx` L55-65、L222-251 | ✅ |
| 5 | `s3.head()` | `s3.service.ts` L247-258 | ✅ |
| 6 | page 持有 mutation + ConfirmDialog + notify | `media/page.tsx` L209-227、L481-489 | ✅ |

### 10.2 对抗性审查结果

| 审查项 | 结论 |
|--------|------|
| **前缀碰撞**：`_archive/watermark/{id}/` 会否误匹配 `_archive/watermark-before-remove/…` | ✅ 安全：前缀含 `{id}/`，而 before-remove 在 `watermark` 后接 `-` 非 `/`，不可能误匹配 |
| **备份排序**：13 位毫秒时间戳前缀 | ✅ 当前世纪内字典序 = 时间序，`sort().at(-1)` 正确 |
| **CopyObject 元数据**：`s3.copy` 未设 MetadataDirective | ✅ 默认 `COPY` 保留源 ContentType，备份/恢复两侧均不丢类型；`head()` 回写正确 |
| **中途失败态**：备份先于覆盖（不丢数据）；remove 恢复失败可幂等重试 | ✅ 顺序安全；唯一窗口见 10.4 |
| **路由碰撞**：`DELETE :id/watermark` vs `DELETE :id` | ✅ 具体路径先声明且更具体，不冲突 |
| **双击/并发**：前端 pendingId 禁用按钮 + 后端状态检查 | ✅ 最坏仅冗余备份，不丢数据（§6.1） |
| **超时链路**：ffmpeg 300s ↔ nginx admin 域 300s；BFF retryFetch 无自身超时（已核实） | ⚠ 临界重合已在 §6.3 明示接受 |
| **BFF 兼容**：通用 BFF 支持 POST/DELETE，`await text()` 对 JSON 无问题（已核实 route.ts 导出全部方法） | ✅ |
| **Schema**：`MediaAsset.watermarked Boolean?` 已存在（第一部分方案落地） | ✅ |

### 10.3 终审发现并已当场修复

1. **`list(prefix, 100)` 上限死角（真实 bug）**：备份超 100 条时 S3 返回最旧 100 条，`sort().at(-1)` 会误选旧备份恢复。已改为 S3 MaxKeys 上限 1000（`media.service.ts`），手工场景不可达，仅作正确性兜底。
2. **§7.1 单测未落地**：12 个用例无任何 spec 覆盖。已新增 `media.service.watermark.spec.ts`（11 用例，含调用顺序/备份 key 格式/乱序取最新断言），全量 14 套件 137 测试通过，tsc + biome 干净。
3. **跨文档矛盾（水印方案族对账）**：批量方案 v2 草案的备份路径（平铺 `_archive/watermark-reprocess/`）与本方案已实施前缀不兼容，若批量照案实施将断裂去水印恢复链路。已在第三部分 v2.1 修正为同构 key（见第三部分 §11 对账记录），本部分 §8 的兼容性声明由此成立。

### 10.4 残余风险（评估为可接受）

| 风险 | 评估 |
|------|------|
| 加水印后 DB 更新失败（S3 已覆盖）→ 重试将二次烧录且备份变为带水印版 | 窗口极窄（DB 故障 + 人工重试叠加）；建议运维上对 DB 报错的资产先查 `_archive` 再重试 |
| purge 不清理 `_archive` 孤儿备份 | 存储卫生问题，无功能影响；归入后续清理脚本范围 |
| 视频水印 300s 临界 504 | §6.3 已明示：失败重试即可，备份机制保证数据无损 |
| 备份超 1000 条仍会误选 | 手工逐张场景不可达；若未来批量接入，需改分页倒序扫描 |

---

# 第三部分 · 存量媒体批量补水印（暂缓）

> 状态：设计草案（v2.1，首轮评审修订 + 2026-08-03 跨文档对账修正备份路径，见本部分 §11），待评审
> 日期：2026-08-03
> 关联模块：`apps/api/src/media/`、`apps/admin`（媒体库）、`packages/types`
> 前置依赖：本文件第一部分（已完成实施，`MediaAsset.watermarked` 字段 + 三态覆盖已就绪）

---

## 1. 背景与问题

第一部分（按次覆盖）方案上线后，**新上传**的媒体资产已具备完整的水印烧录与标记能力。但存量数据存在缺口：

1. **历史数据 `watermarked = null`**：方案上线前的所有媒体资产，服务端未经手文件内容，`watermarked` 为 `null`（未知）。其中部分图片实际上可能没有水印。
2. **`watermarked = false` 的资产**：上传时选择了 `skip`，或因尺寸不足 / SVG/GIF / 处理异常等原因未烧录水印。这些资产确认无水印，是最直接的补水印目标。
3. **水印样式变更**：管理员修改了水印配置（文字内容、布局、透明度等）后，已烧录的存量图片仍保留旧水印样式，无法自动更新。

**核心诉求**：提供一个管理操作，允许运营人员选中存量媒体资产，按当前水印配置批量补打 / 重打水印。

---

## 2. 业内实践调研

| 实践 | 代表 | 核心思路 | 适配度 |
|------|------|---------|--------|
| **服务端批量重处理** | WordPress 批量水印插件、DAM 系统 | 遍历目标资产 → 下载原图 → 叠加水印 → 覆盖写回 | ✅ 与现有架构完全兼容，改动最小 |
| **后台任务队列** | Bull / Agenda / BullMQ | 批量任务拆分为异步 job，后台 worker 消费，前端轮询进度 | 适合大规模（>1000 张），但本项目媒体量级小（预计 <500 张），引入队列属过度设计 |
| **CLI / 脚本工具** | Prisma seed 脚本、一次性迁移脚本 | 写一个 `ts-node` 脚本，手动执行 | 零 UI，适合开发者一次性操作；但运营人员无法自助使用 |
| **双副本重打** | Getty / Shutterstock | 始终保留原图，水印是衍生图，随时可重打 | 需要双副本架构（方案 B），本期不采纳 |

**选型结论**：采用 **服务端批量重处理 + 同步 API（带进度反馈）**。理由：
- 本项目媒体量级小（预估 <500 张），单张处理 <1s，全量处理 <10min，同步 API 可接受；
- 不引入新基础设施（消息队列 / worker），保持架构简洁；
- 通过 SSE（Server-Sent Events）或分步 polling 提供进度反馈，避免长请求超时；
- 若未来量级增长到需要异步化，可在同一接口上平滑演进为"提交任务 → 后台执行 → 前端轮询"。

---

## 3. 方案概览

### 3.1 用户流程

```
管理员进入媒体库 → 筛选/勾选目标资产 → 点击「批量加水印」
→ 二次确认弹窗（显示数量、警告「烧录不可逆」）
→ 确认 → 后端逐张处理 → 前端实时显示进度（已处理/总数/成功/失败）
→ 完成后自动刷新列表
```

### 3.2 处理流程（单张）

```
1. 从 DB 读取 MediaAsset 记录
2. 从 S3 下载原文件（getObjectBuffer）
3. 调用 WatermarkService.processUpload(buffer, mimeType, folder, 'force')
   - 使用当前全局水印配置
   - force 模式：跳过 applyToFolders/applyToImages 检查
   - SVG/GIF、minWidth/minHeight 硬性跳过仍生效
4. 若 processed.watermarked=true → 覆盖写回 S3（同 key）
5. 更新 DB：watermarked / mimeType / size（按实际处理结果同步）
6. 返回单张结果（success/skipped/failed + 原因）
```

> **已知限制**：「重打」模式对已有水印的资产会产生**双重水印叠加**效果（旧水印 + 新水印），因烧录模式不保留原图，无法做到"替换"。若需干净重打，须先从 `_archive/` 手动恢复原图再操作。前端确认弹窗须对此额外警告。

### 3.3 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 覆盖写回 vs 新 key | **覆盖写回（同 key）** | URL 不变，所有 CMS 引用自动生效；与现有 `replaceSiteAsset` 的覆盖策略一致 |
| 是否备份原文件 | **是，备份到 `_archive/watermark/{assetId}/`** | 烧录不可逆，备份提供回滚可能；**必须复用第二部分（逐张方案，已实施）的按资产分目录约定**：逐张去水印从该前缀取最新备份恢复，批量补打的备份写入同一前缀后，用户可直接用逐张「去水印」回退批量操作，两方案恢复链路互通（v2 草案原写的平铺 `watermark-reprocess/` 与之不兼容，已于 v2.1 修正） |
| 并发策略 | **串行处理** | 单张处理涉及 S3 下载 + sharp 编码 + S3 上传，内存占用大（每张 ~2-5MB buffer），串行避免 OOM；小量级下性能可接受 |
| 超时策略 | **单张 30s 超时，整体无硬上限** | 视频处理可能较慢；前端 SSE 心跳保活 |
| 失败处理 | **逐张 try-catch，失败不中断** | 某张处理失败不影响其余；最终报告包含失败明细 |
| 断连中止 | **检测 `res.closed`，断连即停** | 用户关闭页面后停止后续处理，避免空转浪费资源 |
| 权限 | **`media.upload`** | 补水印本质是"重新上传处理后的文件"，与上传权限同源；不新增权限点 |

---

## 4. API 契约

### 4.1 批量补水印接口

```
POST /api/media/batch-watermark
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "ids": ["cuid1", "cuid2", ...],   // 目标资产 ID 列表（必填，1-100）
  "mode": "补打" | "重打"            // 可选，默认 "补打"
}
```

**`mode` 语义**：

| 取值 | 行为 | 筛选逻辑 |
|------|------|---------|
| `补打`（默认） | 仅处理确认无水印的资产 | 自动过滤：`watermarked !== true`（即 `false` 或 `null`） |
| `重打` | 对所有选中资产重新烧录（含已有水印的） | 不过滤，全部处理；用于水印样式变更后统一更新；**⚠️ 已有水印资产将产生双重水印叠加** |

**Response**：

通过查询参数 `?stream=true` 区分响应模式（复用项目已有的 `@Res()` 手写 SSE 模式，见 `lingxi-agent.service.ts`）：

- `POST /api/media/batch-watermark?stream=true` → SSE 流式（默认，前端使用）
- `POST /api/media/batch-watermark` → 同步 JSON（等全部处理完再返回，降级/调试用）

**SSE 流式响应**：

```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
X-Accel-Buffering: no
Connection: keep-alive

event: start
data: {"total": 42, "mode": "补打", "actualCount": 38}

event: progress
data: {"index": 1, "total": 38, "id": "cuid1", "status": "success", "filename": "abc.jpg"}

event: progress
data: {"index": 2, "total": 38, "id": "cuid2", "status": "skipped", "reason": "SVG 格式不支持", "filename": "logo.svg"}

event: progress
data: {"index": 3, "total": 38, "id": "cuid3", "status": "failed", "reason": "S3 下载超时", "filename": "big.png"}

event: done
data: {"success": 35, "skipped": 2, "failed": 1, "duration": 28500}
```

> 实现要点（复用 lingxi 模块 SSE 模式）：
> - controller 注入 `@Res() res: Response`，手写 `text/event-stream` 响应头
> - 心跳间隔 15s（`: ping\n\n`），防止 nginx 反代 read timeout 断连
> - 监听 `res.on('close')` 检测客户端断连，断连后 `closed = true`，循环中检测并提前终止
> - 前端使用 `EventSource` 或 `fetch` + `ReadableStream` 消费；失败时降级为无 `?stream` 的同步 JSON 请求

### 4.2 预览/估算接口

**砍掉**。确认弹窗直接显示「已选 N 张，补打模式将处理 M 张（K 张已有水印已排除）」即可，无需额外接口。数量由前端根据选中资产的 `watermarked` 字段本地计算。

---

## 5. 后端改动

### 5.1 `WatermarkService` — 新增 `reprocessAsset` 方法

```ts
// apps/api/src/media/watermark.service.ts

export interface ReprocessResult {
  id: string;
  key: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  watermarked: boolean;
}

async reprocessAsset(
  asset: MediaAsset,
  mode: '补打' | '重打',
): Promise<ReprocessResult>
```

**内部逻辑**：

```
1. 模式过滤：
   - mode === '补打' && asset.watermarked === true → 直接返回 skipped（已有水印）
2. 下载：s3.getObjectBuffer(asset.key)
3. 处理：processUpload(buffer, asset.mimeType, asset.folder, 'force')
4. 判断：
   - processed.watermarked === false → 返回 skipped（尺寸不足/SVG/处理回退等）
   - processed.watermarked === true → 继续
5. 备份（仅当实际会覆盖时）：
   - backupKey = `_archive/watermark/${asset.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${asset.key.split('/').pop()}`
   - 与第二部分 applyWatermark 完全同构（按资产分目录 + 随机后缀防碰撞），逐张去水印可恢复批量产生的备份
   - s3.copy(asset.key, backupKey)
6. 覆盖写回：s3.upload(processed.buffer, asset.key, processed.mimeType)
7. 更新 DB：prisma.mediaAsset.update({
     where: { id: asset.id },
     data: {
       watermarked: true,
       size: processed.buffer.length,
       mimeType: processed.mimeType,  // processUpload 可能改变 MIME（如 BMP→JPEG）
     },
   })
8. 返回 success
```

**异常处理**：所有步骤包裹 try-catch，捕获后返回 `failed` + reason，不抛异常中断批量流程。

### 5.2 `MediaService` — 新增 `batchWatermark` 方法

```ts
// apps/api/src/media/media.service.ts

async batchWatermark(
  ids: string[],
  mode: '补打' | '重打',
  onProgress?: (result: ReprocessResult, index: number, total: number) => void,
): Promise<{ total: number; success: number; skipped: number; failed: number; duration: number }>
```

**内部逻辑**：

```
1. 批量查询：prisma.mediaAsset.findMany({ where: { id: { in: ids }, deletedAt: null } })
2. 模式过滤（补打模式）：
   - 过滤掉 watermarked === true 的资产
   - 记录 actualCount
3. 逐张串行处理（含断连检测）：
   - for (const asset of assets) {
       if (closed) break;  // 客户端已断连，提前终止
       const result = await watermark.reprocessAsset(asset, mode);
       onProgress?.(result, i, total);
     }
4. 汇总统计返回
```

### 5.3 `MediaController` — 新增路由

```ts
// apps/api/src/media/media.controller.ts

@RequirePermissions('media.upload')
@Post('batch-watermark')
@ApiOperation({ summary: '批量对存量资产补水印/重打水印' })
async batchWatermark(
  @Body() dto: BatchWatermarkDto,
  @Query('stream') stream?: string,
  @Res() res: Response,  // SSE 手写响应（复用 lingxi 模块模式）
): Promise<void>
```

> `stream=true` 时走 SSE 流式（`@Res()` 手写，绕过 TransformInterceptor）；否则走同步 JSON（NestJS 标准返回）。

**DTO**：

```ts
// apps/api/src/media/dto/media.dto.ts（新增）

export class BatchWatermarkDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  ids: string[];

  @IsOptional()
  @IsIn(['补打', '重打'])
  mode?: '补打' | '重打';
}
```

### 5.4 改动文件清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `apps/api/src/media/watermark.service.ts` | 新增 `ReprocessResult` 接口 + `reprocessAsset` 方法 |
| 2 | `apps/api/src/media/media.service.ts` | 新增 `batchWatermark` 方法 |
| 3 | `apps/api/src/media/media.controller.ts` | 新增 `POST batch-watermark` 路由 |
| 4 | `apps/api/src/media/dto/media.dto.ts` | 新增 `BatchWatermarkDto` |
| 5 | `apps/admin/src/features/media.ts` | 新增 `batchWatermark` API 调用函数 |
| 6 | `apps/admin/src/app/(dashboard)/media/page.tsx` | 新增「批量加水印」按钮 + 进度弹窗 |
| 7 | `apps/admin/src/components/media/BatchWatermarkDialog.tsx`（新增） | 二次确认 + 进度展示组件 |
| 8 | `infra/docker/nginx/templates/tzj.conf.template` | API server 块 `location /` 增加 `proxy_read_timeout 300s`（SSE 长连接，默认 60s 不够） |

---

## 6. Admin 前端设计

### 6.1 入口

在媒体库页面（`media/page.tsx`）的工具栏区域，增加「批量加水印」按钮：

- **显示条件**：恒显示（持有 `media.upload` 权限即可见）
- **位置**：与「上传」「批量删除」等操作按钮并列
- **禁用条件**：未选中任何资产时 disabled

### 6.2 交互流程

```
┌─────────────────────────────────────────────┐
│  批量加水印                                   │
│                                              │
│  已选择 12 张资产                             │
│  模式：[补打 ▼]  重打                         │
│                                              │
│  ⚠️  补打模式将跳过已有水印的资产              │
│  ⚠️  烧录为不可逆操作，原文件将备份至 _archive  │
│  ⚠️  重打模式：已有水印的图片将产生双重水印叠加  │
│                                              │
│  预计处理：10 张（2 张已有水印，已自动排除）     │
│                                              │
│            [取消]  [确认执行]                  │
└─────────────────────────────────────────────┘
          ↓ 确认后
┌─────────────────────────────────────────────┐
│  处理中... 3/10                              │
│  ████████████░░░░░░░░░░  30%                │
│                                              │
│  ✅ abc.jpg                                  │
│  ✅ def.png                                  │
│  ⏭️  logo.svg（SVG 格式不支持）               │
│  ❌ big.png（S3 下载超时）                     │
│  ✅ ghi.webp                                 │
│  ...                                         │
│                                              │
│              [关闭]                           │
─────────────────────────────────────────────┘
```

### 6.3 状态图标

| 状态 | 图标 | 颜色 |
|------|------|------|
| success | ✅ CheckCircle | green |
| skipped | ⏭️ Skip | yellow/amber |
| failed | ❌ XCircle | red |
| processing |  Loader2 (spin) | blue |

### 6.4 完成后

- 自动关闭弹窗（延迟 2s，让用户看清最终结果）
- 刷新媒体库列表（`queryClient.invalidateQueries({ queryKey: ['media', 'list'] })`）
- Toast 提示摘要：「批量水印完成：成功 8 张，跳过 1 张，失败 1 张」

---

## 7. 安全与边界

### 7.1 数据安全

1. **备份机制**：每次覆盖写回前，自动备份原文件到 `_archive/watermark/{assetId}/` 目录（与第二部分同前缀，见本部分 §3.3），保留回滚可能，且可经逐张「去水印」恢复；
2. **烧录不可逆警告**：二次确认弹窗明确告知用户操作不可逆（即使有备份，恢复也需手动操作）；
3. **双重水印警告**：「重打」模式对已有水印的资产会产生旧+新双层水印叠加效果，因不保留原图无法替换。确认弹窗须额外警示，前端对 `mode=重打` 且选中资产含 `watermarked=true` 时显示红色警告；
4. **站点资源**：2026-08-03 起 `content/` 目录的站点静态资源同样支持逐张加水印/去水印（见第二部分）；批量方案若后续实施，同样不再排除站点资源。上传/替换仍受 `assertUploadFolderAllowed` 拦截

### 7.2 性能边界

| 约束 | 值 | 理由 |
|------|-----|------|
| 单次最大处理数 | 100 张 | 防止误操作导致全量处理；更大量分批执行 |
| 单张超时 | 30s | 视频处理可能较慢，但不宜无限等待 |
| 并发 | 串行（1 张/次） | 避免内存峰值；sharp 编码本身是 CPU 密集 |
| 总耗时估算 | ~1s/张（图片），~5-30s/张（视频） | 100 张图片约 2min，可接受 |
| **nginx 超时** | **`proxy_read_timeout 300s`** | **API 域名默认 60s 不够 SSE 长连接，须显式放宽（见实施清单 #8）** |

### 7.3 权限

- 使用现有 `media.upload` 权限，不新增权限点；
- 理由：补水印本质是"重新处理并上传"，与上传操作同源；本项目运营团队极小且互信。

### 7.4 兼容性

- **零破坏**：不影响现有上传链路、不影响 C 端；
- **向后兼容**：新接口，旧前端不感知；
- **回滚安全**：备份文件保留在 `_archive/`，即使代码回滚，数据不丢失。

---

## 8. 测试计划

### 8.1 单元测试（`watermark.service.spec.ts` 扩展）

| 用例 | 输入 | 预期 |
|------|------|------|
| 补打模式 + `watermarked=true` | 已有水印资产 | 返回 `skipped`，不下载/不处理 |
| 补打模式 + `watermarked=false` | 确认无水印图片 | 下载 → 烧录 → 覆盖 → `success` |
| 补打模式 + `watermarked=null` | 历史未知资产 | 同 false，尝试处理 |
| 重打模式 + `watermarked=true` | 已有水印资产 | 下载 → 重新烧录（双重水印）→ 覆盖 → `success`；**验证叠加效果** |
| SVG 文件 | `image/svg+xml` | 返回 `skipped`，reason 含 "SVG" |
| 小图（低于 minWidth） | 200x100 图片 | 返回 `skipped`，reason 含 "尺寸" |
| S3 下载失败 | mock getObjectBuffer 抛异常 | 返回 `failed`，不中断批量 |
| 备份验证 | 正常流程 | 验证 `_archive/` 下生成了备份文件 |

### 8.2 集成测试

- 媒体库选中 3 张不同状态资产（true/false/null）→ 补打模式 → 验证只有 false/null 被处理；
- 重打模式 → 验证全部被重新处理；
- 批量上限校验：传 101 个 ID → 返回 400。

### 8.3 E2E 手工

1. 上传一张图（skip 水印）→ 确认 `watermarked=false` → 批量补水印 → 下载验证水印已烧录 → `watermarked=true`；
2. 修改水印配置（换文字/布局）→ 对已有水印资产执行「重打」→ 下载验证水印已更新（注意双重水印叠加）；
3. 检查 `_archive/` 目录确认备份文件存在。

---

## 9. 未来演进（不在本期范围）

1. **异步任务队列**：若媒体量级增长到千级以上，将同步 API 改为"提交任务 → BullMQ 后台执行 → SSE/WebSocket 推送进度"；
2. **定时自动补水印**：监听水印配置变更事件，自动标记所有 `watermarked=true` 的资产为"样式过期"，提供一键更新入口；
3. **双副本模式**（方案 B）：引入原图私有存储后，补水印变为"生成新衍生图"而非"覆盖原文件"，彻底解决不可逆问题。

---

## 10. 所有权注记（AGENTS.md）

| 改动 | 所有者 | 审批 |
|------|--------|------|
| `watermark.service.ts` 新增方法 | A2 | 否 |
| `media.service.ts` 新增方法 | A2 | 否 |
| `media.controller.ts` 新增路由 | A2 | 否 |
| `dto/media.dto.ts` 新增 DTO | A2 | 否 |
| Admin 前端组件与 API 调用 | A2 | 否 |

本方案不涉及 `packages/types` 类型变更、不涉及 `prisma/schema.prisma` 修改。涉及 nginx 配置变更（#8），需部署时同步生效。其余全部为 A2 业务代码范围。

---

## 11. 跨文档对账记录（2026-08-03，水印方案族终审）

对合并前的水印方案族三份文档（按次覆盖 → 本文件第一部分、逐张 → 本文件第二部分、批量 → 本部分）做一致性对账，发现并修正 1 处实质矛盾：

| 矛盾点 | v2 草案原文 | 问题 | v2.1 修正 |
|--------|-----------|------|----------|
| 备份路径 | 平铺 `_archive/watermark-reprocess/{ts}-{basename}` | 与第二部分已实施的 `_archive/watermark/{assetId}/` 前缀不兼容：批量产生的备份无法被逐张「去水印」的 `list(prefix)` 找到，恢复链路断裂；且平铺无资产分目录、无防碰撞后缀 | 改为与第二部分 `applyWatermark` 完全同构的 key（本部分 §3.3、§5.1、§7.1 已同步），两方案恢复链路互通 |

另核实无矛盾项：`watermarked` 三态语义（true/false/null）三个部分一致；`processUpload(buffer, mimeType, folder, 'force')` 调用签名与已实施代码一致；补打筛选 `watermarked !== true` 与第一部分「false 与 null 严格区分」的语义兼容（null 历史资产纳入补打为有意设计）。
