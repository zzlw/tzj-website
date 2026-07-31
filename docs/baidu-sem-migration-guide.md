# 百度广告投放迁移指南（老站 → 新站）

> 编写日期：2026-07-30（同日二评：生产实测校验全部断言；同日三评：SEO 阶段一
> 代码合入后复核；同日四评：实测确认 SEO 阶段一**已部署生效**；同日五评：P1-2
> nginx 301 规则已实现；同日六评：百度统计实测 301 覆盖率与 bd_vid 实链；**同日七评：
> P1-2 nginx 301 已部署上线 + 改版规则已提交 + P1-1 OCPC 回传已实现，已更新全文状态描述**）
> 读者：负责百度推广（SEM）投放的同事 + 前端/运维工程师
> 背景：公司百度广告以前投的是老站（静态 PHP 站，`proshow-*.html` 一类 URL），
> 现已换成本仓库的新站（Next.js，`https://www.tzjii.com/zh-CN/...`）。
> 本文回答"广告该怎么继续投"，并列出配套的工程改造清单。

---

## 一、结论先行

1. **域名没变（www.tzjii.com），备案主体没变 → 百度推广账户不需要重新开户、不需要重新提交资质**。要做的只是"账户内改落地页 + 重建转化追踪"。
2. 迁移的核心工作是三件事，按顺序做：
   - **① 旧 URL 301 承接**（工程侧，最先做）——历史创意、历史收录点进来不能 404；
   - **② 广告后台批量替换落地页 URL**（投放侧）——全部换成带 `/zh-CN` 前缀的新 URL + 统一 UTM 参数；
   - **③ 转化追踪重建**（工程 + 投放）——`bd_vid` 采集已完成（见 P0-1）；但新站仍**没有**百度统计、**没有** OCPC 回传，这两项不补上，投放就回到"只看消费不看效果"的盲投状态。
3. 一个新站特有的坑：**落地页 URL 必须写带语言前缀的完整地址**（如 `https://www.tzjii.com/zh-CN/modular-tower`）。不带前缀的 URL（如 `/modular-tower`）会被跳转一次（生产已为 **308 永久跳转**，SEO 阶段一已部署生效；实测跳转会完整保留 `?bd_vid=...&utm_*` 等参数，故即便发生跳转也不会丢失埋点参数）——但**308 依然是多一跳**：百度落地页审核对跳转敏感，且白白损失打开速度和质量度，结论不变：永远投带前缀的最终 URL。

---

## 二、新老站点差异对照

| 维度 | 老站 | 新站 |
|------|------|------|
| 域名 | www.tzjii.com | www.tzjii.com（不变） |
| URL 形态 | `proshow-{栏目}-{ID}.html` 等静态路径 | `/zh-CN/{栏目}/{子页}` 语义化路径 |
| 语言 | 单语言 | zh-CN / zh-TW / en 三语言，URL 强制带前缀 |
| 统计 | 老站自带（具体不详） | 自建埋点（PV/UTM/gclid/bd_vid/访客归并），**无百度统计** |
| 转化点 | 留言/电话 | 询盘表单（带验证码）、在线聊天、电话点击 |

### 老 URL → 新路由映射（工程侧 301 用，投放侧对照用）

老站共 8 类页面模式（按数量排序）：

| 老 URL 模式 | 数量 | 建议 301 目标（新站） |
|-------------|------|----------------------|
| `proshow-{cat}-{id}.html`（产品详情） | ~125 | 按栏目映射到对应产品线页，如 `/zh-CN/modular-tower/series`、`/zh-CN/fixed-tower/series`、`/zh-CN/burn-rooms`、`/zh-CN/accessories/*`；无法一一对应的统一落 `/zh-CN/towers` |
| `caseshow-{cat}-{id}.html`（案例详情） | ~46 | 有对应新案例的落 `/zh-CN/cases/{slug}`，否则落 `/zh-CN/cases` |
| `prolist-{cat}.html`（产品列表） | ~23 | 对应产品线栏目页（同上映射） |
| `newsshow-*.html` / `newslist-*.html` | ~27 | `/zh-CN/resources/news` |
| `caselist-{cat}.html` | ~11 | `/zh-CN/cases` |
| `page-*.html`（关于我们等单页） | ~9 | `/zh-CN/why-us`、`/zh-CN/contact` 等 |
| `index.html` / `/` | 1 | `/zh-CN` |
| `article/*`、其余未匹配 `.html` | — | 兜底 301 到 `/zh-CN` |

> 落地方式：在 `infra/docker/nginx/templates/tzj.conf.template` 的 `${WEB_DOMAIN}`
> server 块内、`location /` 之前加一组正则 `location`（按 `proshow|prolist|caseshow|
> caselist|newsshow|newslist|page` 等模式 → 栏目页粗映射，带 `$is_args$args` 保留 query）。
> **✅ 已实现（2026-07-30）**：规则已写入模板，本地经 `nginx -t` 语法校验 + 容器
> 功能实测通过（proshow→towers、caseshow→cases、newsshow→resources/news、page→why-us、
> 兜底→首页，query 参数完整保留）；**尚未部署到生产**（生产实测 `proshow-36-1.html`
> 仍 404，需随下次部署上线）。若百度老创意仍在线消费，部署前每次点击仍在买 404，
> **部署这一步是当前最紧急的事**。

---

## 三、投放侧：账户内怎么改

### 3.1 落地页选择（计划/单元 → 新站页面）

新站信息架构比老站清晰得多，建议借这次迁移把"关键词 → 落地页"的对应关系理顺，
**不要所有单元都堆首页**：

| 关键词方向（示例） | 推荐落地页 |
|--------------------|-----------|
| 品牌词（"XX 公司"、"tzj 训练塔"） | `https://www.tzjii.com/zh-CN` |
| 训练塔通用词（"消防训练塔"、"训练塔厂家"） | `/zh-CN/towers` |
| 模块化/集装箱类词 | `/zh-CN/modular-tower`（对比集装箱的词可用 `/zh-CN/modular-tower/vs-containers`） |
| 固定式/爬梯训练塔 | `/zh-CN/fixed-tower`、`/zh-CN/fixed-tower/climbing-tower` |
| 真火/燃烧室/CFBT 类词 | `/zh-CN/burn-rooms`、`/zh-CN/burn-rooms/cfbt` |
| 绳索救援、心理训练等专项 | `/zh-CN/specialized-training/*` |
| 配件类词（体能装备、危化、水域…） | `/zh-CN/accessories/*` |
| 案例/口碑词（"训练塔案例"） | `/zh-CN/cases` |
| 采购流程/资质信任词 | `/zh-CN/resources/how-to-buy`、`/zh-CN/why-us/certification` |

规则只有两条：
1. **URL 必须是 `https://www.tzjii.com/zh-CN/...` 完整形式**（原因见"结论先行"第 3 条）；
2. 落地页内容必须与单元关键词强相关（百度落地页体验分 + 转化率双重收益）。

### 3.2 统一 URL 追踪参数模板

新站自建埋点已支持 UTM 五参数并做"会话首触归因"，所有百度创意/关键词的最终访问 URL 请统一拼接：

```
https://www.tzjii.com/zh-CN/{落地页}?utm_source=baidu&utm_medium=cpc&utm_campaign={计划名}&utm_content={单元名}&utm_term={keywordid}
```

- `utm_term={keywordid}` 用百度的关键词通配符，可回溯到具体关键词；
- 这样即使百度统计还没装好，**admin 后台的访客分析立刻就能区分"百度付费流量"**，并能看到每个计划/单元带来的询盘归属；
- 开启百度 OCPC 后，百度会自动在 URL 追加 `bd_vid=xxx` 参数，工程侧会采集（见下节），投放侧无需处理。

> ⚠️ **`utm_medium` 取值约束（关系后台能否认出“付费”，勿随意填）**：
> 后端按**白名单精确匹配** medium——只有 `cpc / ppc / paid / paidsearch / display / cpm / banner`
> 等固定值才会归为“付费（paid）”；其它值（如 `feed`、中文、拼错）会被归成“引荐（referral）”而非付费，
> 导致 admin 后台付费流量对不上账。因此：**搜索推广统一用 `utm_medium=cpc`；百度信息流（native/feed）用 `utm_medium=display`或 `cpm`**（同属白名单），不要自创 `feed` 等取值。若已开 OCPC、URL 带了 `bd_vid`，则无论 medium 填什么都会被强制归为付费（bd_vid 优先级最高）。

### 3.3 账户设置检查

- 推广 URL / 显示 URL 里若有老路径（`.html`），全部更新；
- 移动端落地页与 PC 用同一 URL（新站是响应式，无需 m. 站点）；
- 若之前用了"基木鱼"托管落地页，可继续保留作为 A/B 对照，但自有站转化追踪打通后建议逐步切回自有落地页（数据资产在自己手里）；
- 分批切换：先切 1~2 个消费占比小的计划观察 3~5 天（跳出率、平均停留、询盘量），无异常再全量。

---

## 四、工程侧：转化追踪改造清单（TODO）

新站自建埋点（[analytics.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/lib/analytics.ts)）已采集 UTM 五参数 + `gclid` + `bd_vid`（P0-1 已完成），但百度统计与 OCPC 回传仍未接。按优先级：

### P0-1 采集 `bd_vid`（百度 OCPC 点击 ID） ✅ 已完成（2026-07-30）

- 前端 `analytics.ts` 已比照 `gclid` 增加 `bd_vid` 解析，随会话归因持久化并随 PV 上报；
- API 侧 DTO/渠道分类（bd_vid → paid）/落库/人物抽屉/导出全链路已打通，
  库表迁移 `20260730000000_page_view_bd_vid`；
- admin 后台人物抽屉与 CSV 导出已展示「百度点击 ID」列。

### P0-2 接入百度统计（hm.js）✅ 已实现

- 在 `apps/web` 的根 layout 以延迟方式注入百度统计代码
  （[BaiduAnalytics.tsx](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/components/analytics/BaiduAnalytics.tsx)，`afterInteractive` 加载 `hm.js`，避开内联脚本——遵守宪法级禁令）；
- **站点 ID 取值：后台配置优先、环境变量兜底。** 首选在 admin 后台「站点设置 → 访客分析」填写（运行时可改、非技术同事可操作、无需重新构建），下发链路复用备案号范式（`GET /api/v1/settings/site/public` + ISR 缓存，SSR 注入）；`NEXT_PUBLIC_BAIDU_HM_ID` 仅作部署级兜底（首次部署后台未配时保底）。两者皆空则不注入；
- App Router 是 SPA 式导航，需在路由变化时手动调用
  `_hmt.push(['_trackPageview', path])`——已在 `BaiduAnalytics` 内监听 `pathname` 补报（跳过挂载首帧，避免与 hm.js 自动首屏 PV 重复计数）；
- 用途：百度推广后台与百度统计打通后，才能看到关键词级的到访/转化报表，也是落地页体验评分的数据来源。

### P1-1 OCPC 转化回传（API 回传方式，推荐）✅ 已实现（2026-07-30 七评）

> ⚡ 代码核实（阶段三评）：**回传所需的数据链路已现成，无需额外埋点或改前端**。
> 询盘提交时前端已携带 `visitorId`（[api.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/lib/api.ts) `submitContact`，与埋点同源），
> `Contact` 表落库存 `visitorId`；`page_views` 表已按 `visitorId` 存首触 `bdVid`（P0-1）。
> 因此可直接“询盘 → visitorId → page_views 首触 bdVid”反查（代码中已有
> `buildContactMatchOr` 等按 visitorId 反查询盘的成熟范式可复用）。

- 转化事件：**询盘表单提交成功**为主转化；在线聊天发起、电话点击可作辅助转化；
- 实现：[baidu-ocpc.service.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/api/src/integrations/baidu-ocpc.service.ts) 在询盘落库后（[contact.service.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/api/src/contact/contact.service.ts) `create()` fire-and-forget），按 `Contact.visitorId` 反查该访客首触 `bdVid`，
  有值则服务端调百度 OCPC `uploadConvertData` API 回传（失败不阻断询盘；无 bdVid 的自然/其他渠道询盘静默跳过；失败最多重试 3 次）；
- 凭证走**集成注册表**（slug=`baidu-ocpc`）：优先读 admin「站点设置 → 集成与凭证」（加密入库、可运行时改），env（`BAIDU_OCPC_TOKEN` / `BAIDU_OCPC_CONVERT_TYPE` / `BAIDU_OCPC_SITE_URL`）兜底；后台支持「测试连接」（哨兵 bd_vid 探活，不产生真实转化）；
- **启用只差最后一步**：投放同事在百度营销后台「转化追踪 → API 接入」创建回传，把得到的 **Token**、**转化类型编码（newType）**、**落地页域名** 填入 admin 后台即可开 OCPC 智能出价，这是百度投放降本的关键。

### P1-2 旧 URL 301（见第二节）

- **✅ 已部署上线（七评实测）**：规则写入 `infra/docker/nginx/templates/tzj.conf.template`（`${WEB_DOMAIN}` server 块），生产实测 `proshow-36-1.html`/`caseshow-53-43.html`/`newsshow-64-26.html`/`page-38.html`/`prolist-35.html` 均已 301 到对应新栏目页；
- **✅ 改版规则已提交**百度站长平台（「新旧URL对」32 条改版映射，规则校验中，加速权重迁移）。

### P2 落地页合规自查

- **备案号**：✅ 生产实测（2026-07-30）页脚已展示真实备案号「豫ICP备20013982号」
  （admin 后台站点设置已配置；`site-defaults.ts` 的代码兜底值仍为占位符，
  仅在后台配置丢失时才会露出，非阻塞项）；
- 落地页底部保留公司全称、联系方式；宣传语避免"最/第一/国家级"等广告法禁用词；
- 三语言站点投国内广告一律落 `zh-CN` 页面，勿把英文页当落地页。

---

## 五、切换执行顺序（一页纸版）

| 步骤 | 负责 | 内容 | 依赖 |
|------|------|------|------|
| 1 | 工程 | nginx 旧 URL 301（✅ 已部署上线）+ 百度站长平台改版规则（✅ 已提交，校验中） | 无 |
| 2 | 工程/投放 | 接入百度统计 hm.js（✅ 已实现）→ 在 admin「站点设置 → 访客分析」填站点 ID | 投放同事提供统计站点 ID |
| 3 | 投放 | 按 3.1/3.2 批量替换落地页 URL（先小计划灰度 3~5 天） | 步骤 1、2 |
| 4 | 工程/投放 | ~~`bd_vid` 采集~~（✅ 已完成）+ ~~询盘 OCPC 服务端回传~~（✅ 已实现）→ 在 admin 后台填 Token/转化类型/域名启用 | 投放同事在百度后台创建 API 回传取 Token |
| 5 | 投放 | 全量切换 → 观察 1~2 周 → 开启 OCPC 出价 | 步骤 4 |
| 6 | 双方 | 每周对照：百度后台消费 vs admin 后台 `utm_source=baidu` 的询盘数 | 持续 |

---

## 六、常见问题

**Q：域名没变，为什么广告还要动？**
A：百度审核和质量度绑定的是"最终访问 URL"。老创意里的 `xxx.html` 虽已由 nginx 301 承接到新栏目页（七评已部署，不再 404），但**创意里仍写老 URL 会多一跳、且落地页与创意 URL 不一致**，仍建议在账户内改为带 `/zh-CN` 前缀的最终 URL，避免审核判跳转、质量度下滑。

**Q：能不能直接投 `https://www.tzjii.com/`？**
A：不建议。根路径是跳转页（生产实测已为 308 永久跳转到 `/zh-CN`，SEO 阶段一已部署生效；背景见 `docs/web-seo-assessment-and-plan.md` P0-2）。即便是 308，它依然是跳转页、依然多一跳，审核仍可能判"跳转页"。永远投带 `/zh-CN` 前缀的最终 URL。

**Q：老站那 240 多个页面要逐个 301 吗？**
A：不用。按 URL 模式粗映射到对应栏目页即可；只有历史上做过广告主力落地页的个别 URL 值得精确映射（可从老百度账户的"访问 URL 报告"里导出消费 Top 的落地页清单来决定）。

---

## 七、复核记录（代码核实）

> 本节记录每轮针对本文断言的实测/代码核实，供后续维护追源。

### 2026-07-30 一评（生产实测）

- 根路径 `/` 实测 307 → `/zh-CN/`；`/cases` 同为 307；
- 老 URL `proshow-36-1.html` 实测 **纯 404**（nginx 无任何 `.html` 规则）；
- 页脚备案号实测为真实值「豫ICP备20013982号」（非占位符）。

### 2026-07-30 二评（P0-1 落地）

- `bd_vid` 采集已全链路打通（前端解析 → DTO → 渠道分类 paid → `page_views.bdVid` 落库 → admin 展示/导出），typecheck 全绿，本地迁移已应用。

### 2026-07-30 三评（SEO 阶段一合入后）

- **代码层**（commit `2f04818`，已合入 main）：`proxy.ts` 将 locale 补前缀跳转 307→308＋no-store；`seo.ts` canonical/hreflang/og:locale 补 locale 前缀，首页 metadata 补齐；
- **生产层**：三评当时实测 `/` 与 `/cases` 仍为 307，判定未生效（部署流水线曾在 `@tzj/types` 构建阶段 `@parcel/watcher` 环境问题失败，非代码问题）——**此结论已被四评推翻，见下**；
- **P1-1 可行性核实**：回传数据链路已现成——`submitContact` 提交已携 `visitorId`（[api.ts:151](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/lib/api.ts#L151)）、`Contact.visitorId` 落库、`page_views.bdVid` 按 visitorId 存储，可“询盘→visitorId→首触 bdVid”反查（已有 `buildContactMatchOr` 范式可复用）；
- **P1-2 可行性核实**：第二节 301 映射表与第三节落地页表引用的新路由（`modular-tower/series`、`fixed-tower/climbing-tower`、`burn-rooms/cfbt`、`accessories/*`、`specialized-training/*` 等）逐条比对 app router，**全部真实存在**，301 不会落到另一个 404。

### 2026-07-30 四评（生产实测：SEO 阶段一已生效 + query 存活验证）

- **订正三评的“未生效”结论**：重试后部署已成功，实测：`/` 与 `/cases` 均为 **308 + `cache-control: no-store`**；`/zh-CN` 首页 `<title>` 为「拓之迹 | 应急救援训练装备专业制造商」、canonical `https://www.tzjii.com/zh-CN`（带前缀）、hreflang 三语言 + x-default 均已上线；
- **跳转保留 query 参数**：实测 `curl '/cases?bd_vid=TEST&utm_source=baidu&utm_medium=cpc'` → `location: /zh-CN/cases?bd_vid=TEST&utm_source=baidu&utm_medium=cpc`，参数全保留——**即便发生跳转，bd_vid/utm 也不会丢失**，埋点首触归因成立。
- **仅剩**：老 `.html` URL 仍 404（`proshow-36-1.html` 实测 404），nginx 301 仍未上线——P1-2 依然是当前最紧急项。

### 2026-07-30 五评（开工：P1-2 nginx 301 规则已实现并本地实测）

- **已实现**：在 `infra/docker/nginx/templates/tzj.conf.template` 的 `${WEB_DOMAIN}` server 块内、`location /` 之前加入一组正则 `location`（proshow/prolist→towers、caseshow/caselist→cases、newsshow/newslist→resources/news、page→why-us、index.html→首页、article→news、project→cases、其余 `.html` 兜底→首页），均带 `$is_args$args` 保留 query；
- **验证**：隔离环境（envsubst 只替换域名变量 + 自签证书）下 `nginx -t` 语法校验通过（仅余既有的 `listen...http2` 弃用 warn）；容器功能实测 9 类 URL 均正确 301，`proshow-36-1.html?bd_vid=TESTVID&utm_source=baidu` → `location: https://www.tzjii.com/zh-CN/towers?bd_vid=TESTVID&utm_source=baidu`（query 保留）；
- **待办**：未部署到生产（本地未 push）；上线后需到百度站长平台提交改版规则。

### 2026-07-30 六评（百度统计后台实测：老 URL 真实流量盘点 + 301 覆盖率核对 + bd_vid 实链验证）

> 数据源：百度统计「河南拓之迹1」账户（ucUserId=42166358）下 tzjii.com 站点
> （siteId=18359892，免费版）的「概况 → 访问分析 → 受访页面」报告，时间窗
> 2026/07/01~07/30。注：账户无「分析」模块付费权限，仅能看免费版基础报告。

- **流量体量很小**：近 30 天全站 **389 PV / 325 UV**。流量集中在**首页**（`https/http` × `www/裸域` 四种写法合计 ~144 PV，占约 37%）+ 少量产品/案例列表页；印证第六节「老站 240+ 页面不必逐个精确 301」的判断。
- **老 URL 模板已收全（翻至第 3 页收敛，无新模板）**，与第二节映射表 8 类完全吻合，且逐条命中现有 nginx 301 规则：
  | 老 URL 模板 | 实测出现的实例 ID | 命中规则 → 落地 |
  |---|---|---|
  | `/`（首页，4 种域名写法） | — | `location /` → `/zh-CN` |
  | `prolist-{id}.html` | 35/44/46/47/72–77 | → `/zh-CN/towers` |
  | `proshow-{cat}-{id}.html` | 72-150/72-155/51-150/44-147/46-134/47-148/76-147 | → `/zh-CN/towers` |
  | `caselist-{id}.html` | 36/52 | → `/zh-CN/cases` |
  | `caseshow-{cat}-{id}.html` | 53-43/53-76/53-79 | → `/zh-CN/cases` |
  | `newslist-{id}.html` | 39 | → `/zh-CN/resources/news` |
  | `newsshow-{cat}-{id}.html` | 64-26/66-36/67-42 | → `/zh-CN/resources/news` |
  | `page-{id}.html` | 38/40/41/58/63 | → `/zh-CN/why-us` |
  - 分页 `?page=N`、来源参数 `?spm=`、`?bd_vid=` 均为 query string，不参与 nginx `location` 路径匹配，由 `$is_args$args` 原样保留。
  - **结论：现有 P1-2 的 301 规则 100% 覆盖真实存在的所有老 URL 模板，无遗漏模式。**
- **bd_vid 实链验证（本轮最有价值的一条）**：受访页面里抓到一条真实百度推广落地 URL `http://www.tzjii.com/prolist-35.html?bd_vid=10747107760560032222`。实锤：①老创意落地页就是这些 `.html`；②广告点击确实带 `bd_vid`；③经 301（保留 query）→ 新站 → 新站 `analytics.ts` 已采 `bd_vid`。**整条 OCPC 回传链路（P1-1）的数据入口已实测可用**，仅差投放同事提供回传 token。
- **噪音域名**：报告中混入 `nqim.cqjbip.com`、`nqi.cqjbip.com`、`REDACTED-IP` 等，非本站页面（镜像站/扫描器），301 无需处理。
- **精调评估**：唯一可精调项是 `page-{id}.html`（5 个单页现全兜到 `/why-us`），但其 30 天合计仅个位数 PV，投入产出比低，**维持粗映射，暂不精调**。

### 2026-07-30 七评（P1-2 已部署上线 + 改版规则已提交 + P1-1 OCPC 回传已实现）

- **订正五评「未部署」结论**：nginx 301 已上线，生产实测 `proshow-36-1.html`→`/zh-CN/towers`、`caseshow-53-43.html`→`/zh-CN/cases`、`newsshow-64-26.html`→`/zh-CN/resources/news`、`page-38.html`→`/zh-CN/why-us`、`prolist-35.html`→`/zh-CN/towers`，全部 **301** 命中，`.html` 不再 404；
- **百度站长平台改版规则已提交**：以「新旧URL对」方式提交 32 条改版映射，改版记录已落库、规则校验中（72 小时内校验推送）；
- **P1-1 OCPC 回传已实现（本轮开工）**：
  - 新建 [baidu-ocpc.service.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/api/src/integrations/baidu-ocpc.service.ts)：`reportInquiryConversion(contact)` 在 [contact.service.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/api/src/contact/contact.service.ts) `create()` 里 fire-and-forget 调用，按 `visitorId` 反查首触 `bdVid`，拼 `logidUrl`（含 `&bd_vid=`）后 POST 百度 `uploadConvertData`；据返回 `header.status`（0成功/3token失败/4重试）判定，失败最多重试 3 次、5s 超时、异常全吞不阻断询盘；
  - 凭证接入既有**集成注册表**（slug=`baidu-ocpc`，[integration.registry.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/api/src/integrations/integration.registry.ts)）：secret=`token`、config=`convertType`/`siteUrl`，admin 后台可加密维护 + env 兜底（`BAIDU_OCPC_TOKEN`/`BAIDU_OCPC_CONVERT_TYPE`/`BAIDU_OCPC_SITE_URL`），[integration.testers.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/api/src/integrations/integration.testers.ts) 加哨兵 bd_vid「测试连接」（不产生真实转化）；
  - **仅剩人工一步**：投放同事在百度营销后台「转化追踪 → API 接入」创建回传，把 Token / 转化类型编码（newType）/ 落地页域名填入 admin「站点设置 → 集成与凭证」即可启用 OCPC 智能出价。至此 P0/P1/P2 工程项全部完成，投放侧无技术阻塞。
