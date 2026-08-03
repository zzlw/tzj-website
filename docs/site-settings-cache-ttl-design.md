# 官网站点设置缓存 TTL 设计（v3：后台可配）

> 状态：**终版（v3）· 2026-08-03 用户决策改为后台可配 TTL，v2 已实施后整体回退重做**
> 日期：2026-08-03
> 关联模块：`apps/api/src/settings/`、`apps/web/src/lib/site-settings.ts`、`apps/admin`（站点设置页 / Favicon 卡片 / 聊天设置页）

---

## 0. 修订沿革（v1 → v2 → v3）

| 版本 | 方案 | 结论 |
|------|------|------|
| v1 | Cache-Control 头驱动 + 后台可配 TTL | ❌ 推翻：Next 15+ 服务端 fetch 默认不缓存，无 `next.revalidate` 的 fetch 每次渲染直连 API，响应头被忽略，TTL 旋钮失效且徒增 API 负载 |
| v2 | push invalidation：API 保存后回调 web 端 revalidate 路由，秒级生效，TTL 写死 300s 仅作兜底 | ✅ 技术可行、已完整实施并通过验证；❌ 被用户否决：需要服务器 `.env.prod` 手动注入 `REVALIDATION_TOKEN` / `WEB_INTERNAL_URL`（SSH 运维操作），用户要求**纯后台可视化配置、零运维** |
| **v3（本版）** | **后台可配 TTL（两级缓存）**：admin 配置缓存秒数，web 端按配置值缓存站点设置；用户明确接受「可调等待」 | ✅ **采纳并已实施**。无新增环境变量、无新路由、无 nginx 改动、无回调——部署零负担，全部配置在后台完成 |

**v3 相比 v2 的变化**：撤销 v2 全部 10 项变更（revalidate 路由、WebRevalidationService、两处回调、env 变量、compose 注入、nginx 封禁、文案），改为「后台配置 TTL + web 端动态读取」。需求定性从「改完立即生效」修正为**「生效等待时长后台可配」**（用户 2026-08-03 明确决策）。

---

## 1. 背景与现状

后台保存站点设置（联系方式、社交媒体、备案、聊天配置、Favicon 等）后，官网（C 端）最长需等 5 分钟才可见：

- 唯一卡点（服务端路径）：`apps/web/src/lib/site-settings.ts` 的 `getSitePublicSettings()` / `getFaviconUrl()` 使用 Data Cache（`next.revalidate`）；五个消费方（layout / contact / ContactSectionLazy / Footer / HeaderShell）共享同一 Data Cache 条目，聊天配置/客服资料经同路径下发。全站按请求 SSR（`i18n/request.ts` 中 `await headers()`），无 Full Route Cache 旁路，设置生效唯一卡点即 fetch Data Cache。
- `tags: ['site-settings']` 已预埋（v2 使用，v3 保留但无消费方，作未来扩展锚点）。
- admin 三处文案（站点设置页、FaviconSettingsCard、聊天设置页）需随 TTL 配置动态化。
- API 侧 `site.public` / favicon 读路径无缓存（每次直读 `Setting` 表 / 直查 S3），无需失效；`security.auth` 的 30s 内存缓存仅守卫路径使用，与本方案无关。

---

## 2. 方案选型（v3）

### 2.1 核心矛盾：动态 TTL 无法直接传给 fetch

`next.revalidate` 必须在 fetch 调用时点**静态指定**，而 TTL 值来自后台配置——「为了拿到 TTL 需要 fetch 配置，而这个 fetch 本身需要 TTL 决定缓存策略」（先有鸡还是先有蛋）。v1 试图用响应头绕过此问题，已被推翻（§0）。

### 2.2 解法：两级缓存

| 层级 | 数据 | 缓存策略 | 生效语义 |
|------|------|---------|---------|
| TTL 元数据 | `GET /settings/cache-ttl` 返回的秒数 | 固定 `revalidate: 60` | 后台改 TTL 后最长 **60s** 内新值生效 |
| 站点设置内容 | `site.public` / favicon | `revalidate: <TTL 配置值>` | 后台改内容后最长 **TTL 秒** 生效 |

- TTL 元数据请求极小（一个数字），60s 缓存下每实例每 60s 仅 1 次 API 调用，负载可忽略；
- 两级均依赖 Next Data Cache，dev 下 Next 整体禁用 Data Cache（`revalidate` 与 0 等价），本地即时生效天然成立，无需分支；
- TTL = 0 时内容 fetch 为 `revalidate: 0`（等效 no-store，每次渲染实时读取）。

### 2.3 与业界的对照

| 实践 | 代表 | 适配度 |
|------|------|--------|
| 远程配置 TTL 旋钮（Remote Config） | LaunchDarkly / Firebase Remote Config | ✅ **采纳**（两级缓存解决动态取值问题）。v1 否决它的核心理由（`next.revalidate` 在 fetch 调用时点指定，动态取值需 bootstrap 二次拉取）被两级缓存正面解决：bootstrap 请求即 TTL 元数据请求，60s 固定缓存 |
| 按需失效 webhook（On-demand Revalidation） | Sanity / Strapi + `revalidateTag` | ⏸ v2 已验证可行（Next 16 需 `{ expire: 0 }` profile），但需运维注入密钥，用户否决；保留为未来「秒级生效」需求时的备选，token 注入路径已在 v2 实施中跑通 |

**共识原则**：内容变更的生效时效应由写方主动通知读方失效（push invalidation）优于读方轮询；但当 push 引入运维负担而用户接受等待时，**可配 TTL 是更优的工程权衡**——复杂度与运维成本最低，行为可预期。

---

## 3. 详细设计

### 3.1 配置存储（api）

`Setting` 表新增独立 key：`site.cacheTtl`（`group: 'site'`，`label: '官网缓存生效时长（秒）'`，`sortOrder: 3`），value 为 `{ ttl: number }`（秒，0-86400）。

- 常量：`CACHE_TTL_SETTING_KEY = 'site.cacheTtl'`、`DEFAULT_CACHE_TTL_SECONDS = 300`（`settings.defaults.ts`）——默认值与 v2 前写死值一致，**无配置时行为与现状完全不变**；
- 校验：`cacheTtlSchema = z.object({ ttl: z.number().int().min(0).max(86_400) })`；
- 读取容错：`getCacheTtl()` 对缺失/非数字/负数回退 300，超上限截断到 86400（`settings.service.ts`）。

### 3.2 API 端点（settings.controller.ts）

| 端点 | 权限 | 用途 |
|------|------|------|
| `GET /settings/cache-ttl` | `@Public()` | C 端 web 服务端读取 TTL 元数据（仅返回数字，无敏感信息） |
| `GET /settings/cache-ttl/admin` | `settings.view` / `settings.manage` | admin 展示当前值 |
| `PUT /settings/cache-ttl` | `settings.manage` | admin 保存，body `{ ttl: number }` |

返回统一经 TransformInterceptor 包装为 `{ data: { ttl } }`（与现有端点一致）。

### 3.3 web 端两级缓存（apps/web/src/lib/site-settings.ts）

```typescript
const CACHE_TTL_META_REVALIDATE = 60; // TTL 元数据固定缓存：后台改 TTL 最长 1 分钟生效
const DEFAULT_CACHE_TTL_SECONDS = 300;

async function getCacheTtl(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/settings/cache-ttl`, {
      next: { revalidate: CACHE_TTL_META_REVALIDATE },
    });
    if (!res.ok) throw new Error(`cache-ttl ${res.status}`);
    const json = (await res.json()) as { data?: { ttl?: number } };
    const ttl = json.data?.ttl;
    return typeof ttl === 'number' && ttl >= 0 ? Math.floor(ttl) : DEFAULT_CACHE_TTL_SECONDS;
  } catch {
    return DEFAULT_CACHE_TTL_SECONDS;
  }
}

// 内容 fetch：getSitePublicSettings / getFaviconUrl 各取一次
const ttl = await getCacheTtl();
fetch(url, { next: { revalidate: ttl, tags: ['site-settings'] } });
```

- 两个内容 fetch 各自调用一次 `getCacheTtl()`：同一渲染内 Next 对同 URL fetch 有 request dedupe，元数据请求不会翻倍；
- `tags: ['site-settings']` 保留（v3 无 revalidateTag 消费方，纯预留锚点，无副作用）；
- 注释语义：「TTL 由后台『官网生效速度』配置；默认 300s；0 = 不缓存」。

### 3.4 Admin 配置卡片（站点设置页）

`settings/site/page.tsx` 在 FaviconSettingsCard 之后新增卡片 **「官网生效速度」**：

- 数字输入（秒，`min=0 max=86400 step=30`），默认回填当前配置值；
- 说明文案：「官网（C 端）读取站点设置时的缓存时长。保存联系方式、客服资料、Favicon 等内容后，官网最长在此时长后生效；设为 0 则每次访问实时读取（不缓存）」；
- 保存按钮（复用 ModuleSaveButton），校验 0-86400 整数，成功后 toast「缓存时长已保存，官网最长 X 生效」；
- hooks：`useCacheTtl()` / `useUpdateCacheTtl()`（`features/site-settings.ts`），queryKey `['settings', 'cache-ttl']`。

### 3.5 Admin 文案（动态化）

三处 toast + 两处 PageHeader description 不再写死「即时生效」，统一按当前 TTL 动态生成（`lib/cache-ttl.ts` 的 `formatCacheTtl()`：0 →「实时生效」，非 0 →「最长 X 分钟/秒生效」，非 60 整数倍的秒数显示为秒）：

| 位置 | 文案 |
|------|------|
| 站点设置页 toast（保存 site.public） | `官网最长 5 分钟生效`（按配置） |
| 聊天设置页 toast（保存 site.public） | 同上 |
| FaviconSettingsCard toast | `已保存，官网最长 X 生效；已打开过的浏览器受本地缓存影响最长 30 天` |
| 站点设置页 description | `管理官网联系方式、ICP 备案与社交媒体。修改后官网最长 X 生效。` |
| 聊天设置页 description | `集中管理在线客服的资料与在线时间。修改后官网最长 X 生效。` |

### 3.6 favicon 的已知约束（明示，不在本次范围）

nginx 静态域对 MinIO 公开资源下发 `Cache-Control: public, max-age=2592000`（30 天）。设置层缓存失效（TTL 到期）后，**favicon 文件本身**在老访客浏览器最长 30 天才刷新（配套预览图 `statics/favicon-preview.png` 同 key 同约束，仅供 admin 后台展示）。因此 FaviconSettingsCard 的 toast 保留 30 天约束说明。根治手段为 URL 版本化（favicon key 带 hash/时间戳 + layout 中引用动态 URL），列为后续迭代。

注：`apps/web/src/app/manifest.ts` 硬编码 `statics/favicon.ico`，与 favicon 同 key、同受上述浏览器缓存约束，无需单独处理。

---

## 4. 变更清单（v3 实际落地）

| # | 位置 | 变更 |
|---|------|------|
| 1 | `apps/api/src/settings/settings.defaults.ts` | 新增 `CACHE_TTL_SETTING_KEY`、`DEFAULT_CACHE_TTL_SECONDS` |
| 2 | `apps/api/src/settings/settings.schema.ts` | 新增 `cacheTtlSchema`（0-86400 整数） |
| 3 | `apps/api/src/settings/settings.service.ts` | 新增 `getCacheTtl()` / `updateCacheTtl()`（含缺失回退与超限截断）；移除 v2 的 WebRevalidationService 注入与回调 |
| 4 | `apps/api/src/settings/settings.controller.ts` | 新增 `GET cache-ttl`（公开）、`GET cache-ttl/admin`、`PUT cache-ttl` |
| 5 | `apps/api/src/site-settings/favicon.service.ts` | 移除 v2 注入与回调（回退） |
| 6 | `apps/api/src/settings/settings.module.ts` | providers 移除 WebRevalidationService（回退） |
| 7 | `apps/api/src/config/env.validation.ts` | 移除 `WEB_INTERNAL_URL`、`REVALIDATION_TOKEN`（回退） |
| 8 | `apps/web/src/lib/site-settings.ts` | 新增 `getCacheTtl()`（60s 元数据缓存）；两处内容 fetch 改动态 TTL；注释更新 |
| 9 | `apps/web/src/app/api/revalidate/route.ts` | **删除**（回退） |
| 10 | `apps/api/src/settings/web-revalidation.service.ts` | **删除**（回退） |
| 11 | `infra/docker/docker-compose.prod.yml` | web 段移除 `REVALIDATION_TOKEN`（回退） |
| 12 | `infra/docker/nginx/templates/tzj.conf.template` | 移除 `/api/revalidate` 封禁（回退） |
| 13 | `apps/admin/src/features/site-settings.ts` | 新增 `useCacheTtl()` / `useUpdateCacheTtl()` |
| 14 | `apps/admin/src/lib/cache-ttl.ts` | **新增** `formatCacheTtl()` 文案工具 |
| 15 | `apps/admin/src/app/(dashboard)/settings/site/page.tsx` | 新增「官网生效速度」卡片；toast / description 动态化 |
| 16 | `apps/admin/src/app/(dashboard)/settings/chat/page.tsx` | toast / description 动态化 |
| 17 | `apps/admin/src/components/settings/FaviconSettingsCard.tsx` | toast 动态化（保留 30 天浏览器约束说明） |

**无数据库迁移**（`Setting` 表 key-value 结构，新 key 首次写入即创建）、**无环境变量、无新路由、无 nginx 改动**——部署零操作，v2 的部署检查表（服务器 `.env.prod` 手动加变量）全部取消。

---

## 5. 失败模式分析

| 故障 | 行为 | 用户影响 |
|------|------|---------|
| TTL 元数据请求失败（API 宕机/网络） | `getCacheTtl()` 回退 300 | 内容按默认 5 分钟缓存，与现状持平 |
| TTL 配置缺失/非法（DB 手改坏） | 服务端回退 300 | 同上 |
| TTL 配置为 0 | 内容 fetch 不缓存，每次渲染直连 API | 官网实时生效；API 负载上升（`site.public` 读取极轻，可接受） |
| 后台改 TTL 后 | 元数据缓存最长 60s 内更新 | 新时长最长 1 分钟内生效，可预期 |
| 后台改内容后 | 内容缓存最长 TTL 秒后过期 | 等待时长即配置值（用户已接受「可调等待」） |
| TTL 设得很大（如 86400） | 内容缓存 24h | 用户自身决策；改回小值最长 1 分钟生效 |
| 浏览器 30 天 favicon 缓存 | 不受本方案控制 | 3.6 明示 + 后续 URL 版本化根治 |

---

## 6. 发布与回滚

1. **发布**：api + web + admin 同批次部署即可。无部署顺序依赖：旧 web 读不到 `cache-ttl` 端点时（404）`getCacheTtl()` 走 catch 回退 300，行为与现状一致；新 web + 旧 api 同理（`cache-ttl` 404 → 300）。**无需任何服务器手动配置**（v2 的 token 注入要求已取消）。
2. **回滚**：前端回滚后内容 fetch 回到写死 300，与现状一致；api 回滚后 `cache-ttl` 端点消失，web 走 300 兜底。零残留风险。
3. 若未来需要秒级生效：v2 的 push 实现（含 Next 16 `revalidateTag(tag, { expire: 0 })` 签名结论）在 git 历史中完整保留，可随时恢复并叠加 TTL 旋钮作失败兜底。

---

## 7. 验收清单

- [ ] admin 站点设置页显示「官网生效速度」卡片，默认值 300，说明文案正确
- [ ] 改为 30 保存 → toast「缓存时长已保存，官网最长 30 秒生效」→ 官网改联系方式并保存 → 最长 30s 生效（改小 TTL 后元数据 60s 内生效）
- [ ] 改为 0 保存 → 官网刷新即时显示新内容（每次实时读取）
- [ ] 改回 300 → 行为与 v2 前完全一致（5 分钟）
- [ ] 改为 86400 上限 / 输入负数或小数 → 校验拦截（toast 报错，不落库）
- [ ] favicon 上传 → toast 含「官网最长 X 生效；…30 天」；无痕窗口按 TTL 生效
- [ ] 聊天设置页 toast / description 动态显示当前 TTL
- [ ] 本地 `pnpm dev` 全链路即时生效（dev 禁用 Data Cache）
- [ ] 输入 `abc` / 空值保存 TTL → 校验拦截
- [ ] 公网 `GET /settings/cache-ttl` 无需鉴权返回 `{ data: { ttl } }`；`PUT` 无 token 401

---

## 8. 终审结论（2026-08-03）

**结论：✅ 批准实施（v3）。** 本版为 v2 实施后按用户决策的整体改版：撤销全部 push 链路，落地后台可配 TTL。关键设计点均已代码级验证：

### 8.1 关键断言取证

| # | 断言 | 取证位置 | 判定 |
|---|------|---------|------|
| 1 | Next ^16.2.9；fetch 默认不缓存，显式 `next.revalidate` 才入 Data Cache | `pnpm-workspace.yaml`；v1 验证结论 | ✅ |
| 2 | TTL 元数据与内容两级缓存可共存于同一 Data Cache 体系 | `apps/web/src/lib/site-settings.ts` §3.3 实现 | ✅ |
| 3 | `Setting` 表为 key-value 结构，新 key 免迁移 | `settings.service.ts` upsert 先例（site.public / notifications / media） | ✅ |
| 4 | 默认值 300 与 v2 前写死值一致，无配置时行为不变 | `settings.defaults.ts` `DEFAULT_CACHE_TTL_SECONDS` | ✅ |
| 5 | admin 保存 TTL 后无需任何服务器操作 | 变更清单 #1-17 无 env/nginx/compose 新增 | ✅ |
| 6 | 元数据 60s 缓存下 API 负载可忽略 | 每实例每 60s 1 次极轻量请求 | ✅ |
| 7 | 全站按请求 SSR，无 Full Route Cache 旁路 | `i18n/request.ts` `await headers()` | ✅ |
| 8 | API 读路径无缓存，无需失效 | `settings.service.ts` / `favicon.service.ts`；全仓无 CacheModule | ✅ |
| 9 | 返回结构经 TransformInterceptor 包装 `{ data }` | `app.module.ts` APP_INTERCEPTOR；web 读取 `json.data` | ✅ |

### 8.2 v3 设计决策记录

1. **两级缓存是唯一干净的纯 TTL 实现**：`next.revalidate` 调用时点静态指定 vs TTL 动态配置的矛盾，靠「元数据固定 60s 缓存 + 内容按配置缓存」正面解决；bootstrap 请求即元数据请求，无额外往返。
2. **默认值保留 300**：无配置/失败时行为与 v2 前完全一致，规避回归；后台配置是显式优化项而非必需项。
3. **TTL=0 语义 = 不缓存**：`revalidate: 0` 等效 no-store（admin 端 favicon fetch 已有先例），满足「实时生效」诉求；代价是 API 负载上升，但 `site.public` 读取为单行查询，可接受。
4. **取消 v2 push 链路的依据**：用户明确接受「可调等待」并否决 SSH 运维操作；TTL 方案的失败模式全部可预期（§5），无不可控风险。
5. **保留 `tags: ['site-settings']`**：无消费方，纯预留；未来叠加 push 时无需改 web fetch 代码。

### 8.3 残余风险（评估为可接受）

| 风险 | 评估 |
|------|------|
| 内容生效存在等待（TTL 配置值） | 用户明确接受；后台可视化可调，改小值最长 1 分钟生效 |
| 改 TTL 本身最长 60s 生效 | 元数据缓存所致，用户可见说明文案已注明（§3.4） |
| TTL=0 时 API 负载上升 | 单行查询极轻；且为用户主动选择 |
| favicon 老访客浏览器缓存 ≤30 天 | 明示 + 后续 URL 版本化根治（§3.6） |
| geoMode 变更对已打开会话最长 5 分钟生效（客户端 sessionStorage 缓存，`analytics.ts`） | 与 TTL 无关的既有约束，新会话即时 |
