# 百度广告投放迁移指南（老站 → 新站）

> 编写日期：2026-07-30
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
   - **③ 转化追踪重建**（工程 + 投放）——新站目前**没有**百度统计、**没有**采集 `bd_vid`、**没有** OCPC 回传，这三项不补上，投放就回到"只看消费不看效果"的盲投状态。
3. 一个新站特有的坑：**落地页 URL 必须写带语言前缀的完整地址**（如 `https://www.tzjii.com/zh-CN/modular-tower`）。不带前缀的 URL（如 `/modular-tower`）会被 next-intl 做一次 **307 跳转**，百度落地页审核对跳转敏感，且白白损失打开速度和质量度。

---

## 二、新老站点差异对照

| 维度 | 老站 | 新站 |
|------|------|------|
| 域名 | www.tzjii.com | www.tzjii.com（不变） |
| URL 形态 | `proshow-{栏目}-{ID}.html` 等静态路径 | `/zh-CN/{栏目}/{子页}` 语义化路径 |
| 语言 | 单语言 | zh-CN / zh-TW / en 三语言，URL 强制带前缀 |
| 统计 | 老站自带（具体不详） | 自建埋点（PV/UTM/gclid/访客归并），**无百度统计** |
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

> 落地方式：在 `infra/docker/nginx/templates/tzj.conf.template` 加一组
> `location ~ ^/(proshow|prolist|caseshow|caselist|newsshow|newslist|page)-.*\.html$`
> 的 301 规则（先按"模式 → 栏目页"粗映射即可，不必逐条精确映射 240+ 个老 URL；
> 若某几条老 URL 历史上是广告主力落地页，可单独精确映射）。
> **在广告切换前先上线这一步**，保证任何时刻点进来都不 404。

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

### 3.3 账户设置检查

- 推广 URL / 显示 URL 里若有老路径（`.html`），全部更新；
- 移动端落地页与 PC 用同一 URL（新站是响应式，无需 m. 站点）；
- 若之前用了"基木鱼"托管落地页，可继续保留作为 A/B 对照，但自有站转化追踪打通后建议逐步切回自有落地页（数据资产在自己手里）；
- 分批切换：先切 1~2 个消费占比小的计划观察 3~5 天（跳出率、平均停留、询盘量），无异常再全量。

---

## 四、工程侧：转化追踪改造清单（TODO）

这是目前最大的缺口。新站 [analytics.ts](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/lib/analytics.ts) 只采集了 UTM + `gclid`（Google 点击 ID），百度体系完全没接。按优先级：

### P0-1 采集 `bd_vid`（百度 OCPC 点击 ID）

- 在 `analytics.ts` 的 `parseAttributionFromUrl()` 中比照 `gclid` 增加 `bd_vid` 字段，
  随会话归因持久化并随 PV/identify 上报；
- API 侧（`apps/api` analytics 模块）与库表同步加字段。
- 这是后续 OCPC 转化回传的前提（回传必须带 `bd_vid`）。

### P0-2 接入百度统计（hm.js）

- 在 `apps/web` 的根 layout 以延迟方式注入百度统计代码
  （站点 ID 走环境变量，如 `NEXT_PUBLIC_BAIDU_HM_ID`，未配置则不注入——遵守"禁止硬编码"约束）；
- App Router 是 SPA 式导航，需在路由变化时手动调用
  `_hmt.push(['_trackPageview', path])`，可挂在现有 `trackPageView` 的调用点上；
- 用途：百度推广后台与百度统计打通后，才能看到关键词级的到访/转化报表，也是落地页体验评分的数据来源。

### P1-1 OCPC 转化回传（API 回传方式，推荐）

- 转化事件：**询盘表单提交成功**（ContactSection 提交成功回调处）为主转化；
  在线聊天发起、电话点击可作为辅助转化；
- 由 `apps/api` 侧在询盘落库后，携带该访客会话的 `bd_vid` 调用百度 OCPC
  转化回传 API（服务端回传，避免前端丢数）；
- 回传 token、账户参数全部走环境变量。
- 做完这一步才能开 OCPC 智能出价，这是百度投放降本的关键。

### P1-2 旧 URL 301（见第二节）

- nginx 模板加规则，随下一次部署上线；
- 同时把这批老 URL 的 301 提交到百度站长平台的"改版工具"，加速权重迁移（对自然流量也有收益）。

### P2 落地页合规自查

- **备案号**：`site-defaults.ts` 里兜底值仍是占位符 `豫ICP备XXXXXXXX号`，
  需确认 admin 后台站点设置里已配置真实备案号（百度落地页审核会核对备案与推广主体一致性）；
- 落地页底部保留公司全称、联系方式；宣传语避免"最/第一/国家级"等广告法禁用词；
- 三语言站点投国内广告一律落 `zh-CN` 页面，勿把英文页当落地页。

---

## 五、切换执行顺序（一页纸版）

| 步骤 | 负责 | 内容 | 依赖 |
|------|------|------|------|
| 1 | 工程 | nginx 旧 URL 301 上线 + 百度站长平台提交改版规则 | 无 |
| 2 | 工程 | 接入百度统计 hm.js（环境变量注入） | 投放同事提供统计站点 ID |
| 3 | 投放 | 按 3.1/3.2 批量替换落地页 URL（先小计划灰度 3~5 天） | 步骤 1、2 |
| 4 | 工程 | `bd_vid` 采集 + 询盘 OCPC 服务端回传 | 投放同事提供回传 token |
| 5 | 投放 | 全量切换 → 观察 1~2 周 → 开启 OCPC 出价 | 步骤 4 |
| 6 | 双方 | 每周对照：百度后台消费 vs admin 后台 `utm_source=baidu` 的询盘数 | 持续 |

---

## 六、常见问题

**Q：域名没变，为什么广告还要动？**
A：百度审核和质量度绑定的是"最终访问 URL"。老创意里的 `xxx.html` 现在全是 404/301，不改会导致审核拒登、质量度下滑、点击浪费。

**Q：能不能直接投 `https://www.tzjii.com/`？**
A：不建议。根路径目前是 307 临时跳转到 `/zh-CN`（详见 `docs/web-seo-assessment-and-plan.md` P0-2），审核可能判"跳转页"，速度也多一跳。永远投带 `/zh-CN` 前缀的最终 URL。

**Q：老站那 240 多个页面要逐个 301 吗？**
A：不用。按 URL 模式粗映射到对应栏目页即可；只有历史上做过广告主力落地页的个别 URL 值得精确映射（可从老百度账户的"访问 URL 报告"里导出消费 Top 的落地页清单来决定）。
