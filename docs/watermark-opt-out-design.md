# 媒体水印按次豁免（Opt-out）设计方案

> 状态：设计定稿，待实施
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
2. **不可逆**：烧录是破坏性的，原图不落库，事后无法"去水印"。
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
| A. 上传时豁免 + 资产标记 | `/media/upload` 增加 `watermark` 覆盖参数；`MediaAsset` 增加 `watermarked` 字段 | ✅ **采纳**。~6 个文件的小改动，直接解决痛点 1/3 |
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
| `force` | 本次上传强制加水印（全局已开启但目录不在 `applyToFolders`、或类型开关关闭时也加；全局 `enabled=false` 或水印内容未配置时仍不加，因为没有可用的水印样式来源；SVG/GIF、小于 min 尺寸的硬性跳过仍然生效） |

设计说明：

- 用三值枚举而非 `skipWatermark: boolean`，一次把"豁免"和"补打"两个方向都覆盖，避免后续再改契约；
- **权限**：不新增权限点。持有 `media.upload` 即可使用 `skip/force`。理由：本项目运营团队极小且互信，水印目的是 C 端防盗图而非内部管控，为一个勾选框引入新权限点属于过度设计。若未来需要收紧，在 controller 处加 `media.watermark.override` 权限即可（预留说明，不实施）；
- **审计**：`uploadAndRegister` 的现有操作审计（若有记录上传行为）无需额外埋点——`MediaAsset.watermarked` 字段本身即留痕。

### 4.2 数据模型

`MediaAsset` 新增一列：

```prisma
model MediaAsset {
  // ...现有字段
  watermarked Boolean? // null=历史数据（未知）；true=已烧录；false=确认无水印
}
```

- 迁移：`prisma migrate dev --name media-asset-watermarked`（历史行保持 null，不回填、不猜测）；
- 赋值来源是**实际处理结果**而非请求参数：`WatermarkService` 返回"是否真的烧录了"（见 4.3），跳过（尺寸不足、SVG/GIF、ffmpeg 缺失、处理异常回退）一律记 `false`。这保证字段语义是"文件事实"而不是"用户意图"。

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
override === 'force' → 仅要求 config.enabled 且水印内容有效（text 非空或 imageKey 存在），
                       跳过 applyToFolders / applyToImages / applyToVideos 检查；
                       SVG/GIF 与 min 尺寸检查仍生效
override === 'auto'  → 现有 shouldProcess 全量检查（行为不变）
```

`checkFfmpeg` 失败、处理异常回退等现有兜底逻辑一律不变。

#### `media.service.ts` / `media.controller.ts`

- `uploadAndRegister(file, folder, userId, watermark)` 透传 override，并把 `processed.watermarked` 写入 `mediaAsset.create`；
- controller 的 `upload()` 新增 `@Body('watermark') watermark?: string`，归一化：非 `skip`/`force` 值一律按 `auto` 处理（宽容解析，不抛 400），Swagger `@ApiBody` 补充该字段。

#### 旁路链路（明确不改，写入文档留痕）

- `POST /storage/upload`：历史通用上传口，本来就无水印，保持现状；
- `presign + register` 直传链路：服务端拿不到文件内容，天然无法烧录。`register` 登记时 `watermarked` 记 `false`；
- 结论：**"要水印，走 `/media/upload`"** 是唯一约定，本方案不试图在旁路上补水印。

### 4.4 Admin 前端改动

#### `features/media.ts`

```ts
export async function uploadMedia(
  file: File, folder = 'uploads',
  watermark: WatermarkOverride = 'auto',
): Promise<MediaAsset>
// FormData 追加 fd.append('watermark', watermark)
// useUploadMedia 的 mutationFn 参数改为 { file, watermark? } 或追加可选参数
```

#### BFF `app/api/media/upload/route.ts`

透传 `watermark` 表单字段（缺省不追加，保持请求最小）。

#### UI 交互

| 入口 | 改动 |
|------|------|
| 媒体库页 `media/page.tsx` 上传按钮 | 上传按钮旁增加一个 Switch/Checkbox「本次上传不加水印」，仅当**全局水印开启**时显示（避免关着水印还展示无意义选项）；选中后本批次所有文件带 `watermark=skip`，上传完成后自动复位为不选中（防遗忘常开） |
| `MediaPicker.tsx` 上传区 | 同上，复用同一个小组件（建议抽 `WatermarkOptOutToggle`），置于上传按钮附近 |
| `MarkdownEditor.tsx`（Vditor 拖拽上传） | **不加开关**，恒为 `auto`。编辑器内贴图是 CMS 正文配图，正是水印的目标场景；需要无水印图时先去媒体库上传再插入 |
| 媒体库列表/卡片 | `watermarked === true` 的资产显示一个小徽标（如 Stamp 图标 + tooltip「已烧录水印」）；`false` 不显示；`null`（历史数据）不显示。可选：列表筛选器增加"含水印/无水印"（低优先级，可后做） |

"全局水印是否开启"的判断：媒体库页与 MediaPicker 通过现有 `useSiteMediaSettings()`（`GET /settings/site/media`）获取。注意该接口需要 `settings.view` 权限——对无此权限的上传者，开关**照常显示但不做全局状态联动**（fallback：始终显示）；实现时以 `useSiteMediaSettings` 查询失败/无权限 → 显示开关为兜底，避免权限差异导致功能不可达。

### 4.5 安全与边界

1. `skip` 只作用于"本次上传的文件"，不触碰全局配置，**消除了"关全局→上传→开回来"期间其他人上传漏水印的并发窗口**——这是本方案相对现状最重要的安全改进；
2. `force` 不会绕过 `enabled=false`：全局关闭意味着"本站当前不使用水印"，单次上传不应能激活一个未配置/已停用的水印样式；
3. C 端（apps/web）零改动、零感知：交付的仍是 S3 上的最终文件；
4. `watermarked` 为可空布尔，历史数据不回填，任何展示逻辑必须容忍 `null`。

---

## 5. 实施清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `packages/types/src/dto/site-media.ts` | 新增 `WatermarkOverride` 类型导出 |
| 2 | `apps/api/prisma/schema.prisma` | `MediaAsset.watermarked Boolean?` + 迁移 |
| 3 | `apps/api/src/media/watermark.service.ts` | `ProcessedMedia.watermarked`；`processUpload` 支持 override 三态 |
| 4 | `apps/api/src/media/media.service.ts` | `uploadAndRegister` 透传 override、落库 `watermarked`；`register` 记 `false` |
| 5 | `apps/api/src/media/media.controller.ts` | `upload()` 接收并归一化 `watermark` 字段，Swagger 更新 |
| 6 | `apps/admin/src/features/media.ts` | `uploadMedia` / `useUploadMedia` 增加 watermark 参数 |
| 7 | `apps/admin/src/app/api/media/upload/route.ts` | BFF 透传 `watermark` |
| 8 | `apps/admin/src/components/crud/WatermarkOptOutToggle.tsx`（新增） | 「本次上传不加水印」开关小组件 |
| 9 | `apps/admin/src/app/(dashboard)/media/page.tsx` | 集成开关 + 列表水印徽标 |
| 10 | `apps/admin/src/components/crud/MediaPicker.tsx` | 集成开关 |
| 11 | `apps/admin/src/features/types.ts`（MediaAsset 前端类型） | 补 `watermarked?: boolean \| null` |

> 所有权注记（AGENTS.md）：#1 涉及 `packages/types` 新增类型，属"仅允许新增"范围（A1 审批项，本文档即提案）；其余均为 A2 业务代码。

## 6. 测试计划

1. **单测（watermark.service）**：
   - `override=skip` + 全局开启 → 返回原 buffer，`watermarked=false`；
   - `override=force` + 目录不在 `applyToFolders` → 烧录，`watermarked=true`；
   - `override=force` + `enabled=false` → 不烧录；
   - `override=auto` → 与现有行为逐项一致（回归）；
   - 小图/SVG/GIF 在 `force` 下仍跳过。
2. **接口测试**：`watermark` 传非法值（如 `"yes"`）按 `auto` 处理，不报 400；不传字段行为与改造前完全一致。
3. **E2E 手工**：全局开启水印 → 媒体库勾选"不加水印"上传 → 下载校验无水印、列表无徽标；不勾选上传 → 有水印、有徽标；MarkdownEditor 贴图 → 有水印。
4. **迁移验证**：迁移后历史 `MediaAsset` 行 `watermarked` 为 null，媒体库列表正常渲染。

## 7. 未来演进（不在本期范围）

1. **双副本模式**（方案 B）：若出现"给客户看带水印预览、成交后交付原图"类需求，再引入 `originalKey` 私有存储 + 衍生图公开的双副本结构，届时 `watermarked` 字段语义平滑升级为"公开副本是否带水印"；
2. **交付时叠加**（方案 C）：若 C 端防盗需求升级且已全面切 OSS + CDN，可评估 `x-oss-process` 样式分离 + 原图防直连；
3. **重打水印工具**：基于 `watermarked=false` 的筛选，提供"对选中资产批量补水印"的管理操作（依赖方案 B 的原图留存才真正安全，烧录模式下补打即二次编码）。
