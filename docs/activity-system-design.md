# TZJ 营销活动弹窗系统技术方案 v3.5（十五轮评审修订版）

## 文档信息

| 属性 | 值 |
|------|-----|
| 版本 | v3.5 |
| 修订日期 | 2026-07-31 |
| 状态 | 待 A1 审批 schema 变更后进入开发 |
| 前版 | v3.4（十四轮修订完整性审计修订版；本轮十五轮发现见 §0） |
| 适用场景 | 小而美团队、后台用户 ≤ 100 人、日活 ≤ 10 万 |

---

## 0. 修订说明

v2.1 评审结论：**方向正确（TradeShow 扩展 + 零新增基础设施），但文档不可执行**。本版修订要点：

| # | v2.1 问题 | v2.2 处理 |
|---|-----------|-----------|
| 1 | Prisma 模型中 `scheduleStart/scheduleEnd` 重复定义两次，非法 | **砍掉这两个字段**，复用现有 `startDate/endDate` 作为展示窗口（促销活动的"活动时间"即"展示时间"，语义天然一致，admin 表单零改动） |
| 2 | `orderBy: { priority: 'desc' }` 引用不存在字段 | 改用现有 `sortOrder` |
| 3 | 新公开路由与现有 `@Get(':slug')` 冲突未处理 | 新路由 `marketing/active` **必须声明在 `:slug` 之前**（§4.1 显式标注） |
| 4 | 漏掉 fail-closed RolesGuard / check-permissions.mjs 约定；误称需新建 `@Public()` | 两个新端点标注现成的 `@Public()`（`auth/decorators/public.decorator.ts`） |
| 5 | Buffer 批量写与示例代码矛盾，"crash 自动补齐"是虚假承诺 | **砍掉 buffer**。实测量级（点击事件 QPS 个位数）直写 `increment` 足够 |
| 6 | `take: 1` 还随机打乱，自相矛盾 | 砍掉随机打乱；单活动展示按 `sortOrder desc, publishedAt desc` |
| 7 | 前端组件逻辑坏死（state 未赋值、频次控制不写回、曝光不上报） | §6 重写为可工作的实现草图 |
| 8 | `@Headers()` 用错（那是读请求头）、TS 枚举分号语法错误 | 改 `@Header()`；砍掉共享枚举，沿用现有 string + DTO 校验风格（`eventType` 同款） |
| 9 | 集成位置写错（web 是 i18n 结构） | 挂载点改为 `apps/web/src/app/[locale]/layout.tsx` |
| 10 | `rate-limiter-flexible`、`isomorphic-dompurify` 两个冗余新依赖 | 全部砍掉：限流用现有 `@Throttle`（contact/analytics 同款先例）；消毒用现有 `sanitizeMarkdown`（写入侧）+ `MarkdownBody`（渲染侧 rehypeSanitize）。**零新增依赖** |
| 11 | "CSRF Token 验证已内置"失实 | 删除该表述；防滥用 = `@Throttle` + 服务端校验目标活动状态 |
| 12 | admin 声称的 `section-header`/`tags-input`/条件渲染均不存在 | 明确为 `ResourceForm` 通用改造：`FieldDef` 新增 `visibleWhen`（§5.1），工时如实计入 |
| 13 | "8 个新字段"实际 12 个 | 如实为 **10 个**（§3.1） |
| 14 | 性能口径三处打架（10ms/45ms/100ms） | 统一：50 QPS 下 P99 < 100ms（30s 缓存内近似内存返回，轻松达标） |
| 15 | `displayType`（banner/landing）无实现计划 | 砍掉，v1 只做弹窗；banner/landing 进 Backlog |
| 16 | i18n 未考虑 | §6.3 明确单语限制与路径匹配的 locale 处理；per-locale 文案进 Backlog |
| 17 | schema 决策自封"已确认" | 按 AGENTS.md：schema 变更 A2 提议、**A1 审批** |

**二轮自审补充**（v2.2 初稿对照代码库逐条核实后新增）：

| # | 二轮发现 | 处理 |
|---|-----------|-----------|
| 18 | API 有全局 `TransformInterceptor`，所有响应包装为 `{ success, data, ... }`，初稿组件直接 `res.json() as MarketingActivity[]` 解析必然失败 | §6.2 组件改为解析 `json.data` |
| 19 | **内容面外溢未决策**：`promotion` 类型会出现在 C 端展会列表页、详情页"相关推荐"、站内搜索（sitemap 不枚举 trade-shows，无影响）；且 `tradeShowTypeLabel` 对未知类型回退显示裸值 `promotion` | §6.4 新增决策：接受展示 + 补齐类型标签与 i18n（admin `constants.ts`、web `content-labels.ts`、三语 messages），工时 +1h |
| 20 | "提交时剔除隐藏字段值"属过度设计：营销字段服务端一律以 `isMarketing` 总开关为准，隐藏字段随表单提交默认值无害 | `visibleWhen` 简化为**纯显示过滤**，砍掉提交剔除逻辑与对应验收项 |

**三轮核查补充**（v2.3：将 v2.2 的 20 项关键事实声明逐条对码验证——19 项属实、1 项笔误；另深挖 admin 表单链路 `normalizeValues` / `toForm` / zod resolver 后新增 8 项）：

| # | 三轮发现 | 处理 |
|---|-----------|-----------|
| 21 | **隐藏字段仍被 zod 校验**：number 字段以 `valueAsNumber` 注册，清空 `delaySeconds` 后切走触发方式 → 字段隐藏但值为 `NaN` → 校验失败且错误提示不可见，表单卡死 | §5.1 补铁律：营销字段 zod 端一律宽松（coerce/optional/default），严格校验只放 DTO |
| 22 | **`excludePages` 的 tags 字段口径错位**：表单层值是逗号/换行分隔**字符串**（`normalizeValues` 提交时才 split 成数组），按数组写 zod/defaults 必错；且漏了 `toForm` 增量 | §5.2 修正：zod `z.string()`、defaults `''`、`toForm` 补 `join(', ')` |
| 23 | `excludePages` 无路径格式校验，运营填 `products`（缺 `/`）静默失效 | DTO 加 `@Matches(/^\//, { each: true })`（§4.3） |
| 24 | `ctaUrl` 无协议校验，`javascript:` URL 经 `window.open` 会执行 | DTO 加 `@Matches(/^(https?:\/\/|\/)/)`（§4.3） |
| 25 | `excludePages` 仅在首次加载评估：落地在排除页则本会话不再弹 | 接受为 MVP 语义，§6.3 与后台 help 明示 |
| 26 | popup-event 不校验时间窗口，过期活动可被刷计数 | `updateMany` where 补时间窗口条件（§4.2，成本为零） |
| 27 | 定时发布走 PublishingService cron 直写 DB，不触发 marketingCache 失效 | 靠 30s TTL 最终生效，可接受；§4.1 修正"0s 延迟"表述 |
| 28 | admin 常量文件实为 `constants.tsx`（.tsx），文档两处写错；组件草图未清理 scroll/timeout | 修正路径；§6.2 补清理函数 |

**四轮收尾核查**（v2.4：验证前三轮未覆盖的边角依赖——UI 导出、类型定义、CORS、DTO 现状，均为 P3 级）：

| # | 四轮发现 | 处理 |
|---|-----------|-----------|
| 29 | admin `features/types.ts` 的 `TradeShowItem` 接口未列入改动清单——`toForm` 回填与列表列都依赖新字段 | §5.2 补：接口加 10 个营销字段 |
| 30 | `@tzj/ui` 确已导出 Dialog primitives，但 **web 现从未用过 Dialog**（仅 Popover/ScrollArea 等），首次引入需按 C 端工业风核对视觉 | §6.2 注记：圆角/描边由 web 覆盖令牌决定，验收时目视核对 |
| 31 | 现有 `eventType` DTO 实际**无 `@IsIn` 约束**（#8 "eventType 同款"表述失准，营销字段比它更严格，无害）；`CreateTradeShowDto.eventType` 的 description 也需补 promotion；新装饰器需补 `IsIn/Max/Matches` 导入 | §6.4 清单补齐；导入属实现细节不另计工时 |
| 32 | CORS 确认零变更：API 为 `CORS_ORIGINS` 白名单，web 域名已在列（analytics 客户端直连先例） | §8 补一行正面确认 |
| 33 | 草图引用的 `pruneEntries` 未给实现说明 | §6.2 补注释：遍历 `tzj_popup_*` 按 `lastShownAt` 删最旧 |

**五轮行为语义审查**（v2.5：不再核对事实声明，转向运营链路与公开面行为）：

| # | 五轮发现 | 处理 |
|---|-----------|-----------|
| 34 | **P2 公开面外泄营销字段**：公开 `findAll` 仅剥离审计字段（INTERNAL_KEYS），`findOne` 公开访问返回**全量字段**——10 个新字段（含曝光/点击计数）将随公开列表/详情外泄，竞品可见；MARKETING_SELECT 白名单只管新端点 | `INTERNAL_KEYS` 追加营销字段 + `findOne` 补 strip（§4.3），工时 +0.5h |
| 35 | 弹窗发布前无预览：previewToken 机制仅覆盖详情页 | MVP 接受（即时生效 + 秒级回滚兜底），预览进 Backlog（§5.3） |
| 36 | 迁移 SQL 数组默认值 `'{}'` 与仓库既有风格不一致（0_init 全部用 `ARRAY[]::TEXT[]`），未来 migrate diff 可能报漂移噪音 | §3.2 改为 `ARRAY[]::TEXT[]` |
| 37 | 正面确认：C 端详情页对 location/boothNumber 已条件渲染，promotion 详情页不会出现空展位号 | 无需处理 |
| 38 | 正面确认：admin 列表走 includeUnpublished 全量返回，计数列表列数据可直接取 | 无需处理 |

**六轮定点核查**（v2.6：验证五轮修复的可实现性 + 部署/性能两个收尾视角）：

| # | 六轮发现 | 处理 |
|---|-----------|-----------|
| 39 | 正面确认：#34 的 findOne 剥离可实现——controller 已用 `!!user \|\| previewToken.verify()` 算出 `includeUnpublished` 传入 service，只需在返回处按该标志 strip，controller 零改动 | 无需调整方案 |
| 40 | 正面确认：部署顺序安全——deploy.sh 先以**新 tag 的 api 镜像** `docker run … migrate deploy`（新迁移文件在镜像内），成功后才滚动更新 api→admin/web；失败即中止不重启容器；新列全带默认值，旧代码向后兼容 | §8 补一行确认 |
| 41 | **P3 全站 bundle 膨胀**：组件挂 layout，若直接 import Dialog + MarkdownBody，react-markdown/rehype 链会进每个页面的客户端 bundle（即使无活动；现有详情页的 MarkdownBody 在 Server Component 中渲染，不入客户端包） | §6.2 补 bundle 拆分：薄壳 + `next/dynamic` 懒加载渲染体 |

**七轮文档自洽性审计**（v2.7：六轮补丁叠加后通读全文，审内部矛盾/交叉引用/清单错位，均为措辞与实现建议级）：

| # | 七轮发现 | 处理 |
|---|-----------|-----------|
| 42 | §6.2 草图尾部仍写“return Dialog 结构”，与 #41 拆分决策（薄壳不 import Dialog/MarkdownBody）自相矛盾 | 草图改为 return 懒加载的 `<MarketingPopupDialog>` |
| 43 | #41 写“到达展示时机才拉 chunk”：immediate 模式下弹窗会因 chunk 网络加载迟滞（弱网更久） | 改为命中活动并通过过滤后即预热 dynamic import，展示时机零等待 |
| 44 | §5.2 excludePages help 写“每行一条”，但 toForm 用 `join(', ')` 逗号回填，运营看到的回显与说明不符 | help 改“逗号或换行分隔”（normalize 两种都支持） |
| 45 | §4.2 `return { success: true }` 会被全局 TransformInterceptor 再包一层 `{ success, data: { success: true } }`，冗余无害 | 代码块加注记，实现时可直接不返回业务体 |
| 46 | §9 验收写“中英 locale”，漏 zh-TW | 改“全部 locale（zh-CN / en / zh-TW）” |

**八轮业务副作用审查**（v2.8：前七轮全在审“怎么做”，本轮审“这样做对 SEO/可访问性的副作用”——本项目 SEO 是获客主战场，见 docs/web-seo-assessment-and-plan.md）：

| # | 八轮发现 | 处理 |
|---|-----------|-----------|
| 47 | **P2 搜索引擎侵入式弹窗惩罚**：Google 对移动端“落地即遮挡主内容的插页”降权，百度落地页白皮书更严；默认 `immediate + all` 正是高危形态；且爬虫渲染无 sessionStorage 持久性，`alreadyShown` 对爬虫恒假 → 频次控制对搜索引擎无效 | §7 补 SEO 风险行 + §5.2 运营指引（移动端避免 immediate）+ §6.2 渲染体约束（非满屏、易关闭）；搜索来源跳过进 Backlog |
| 48 | P3 可访问性：自动弹出（非用户手势）的 Dialog 抢焦点——Base UI 底座自带 focus trap/ESC/aria-modal，但初始焦点、reduced-motion、关闭后焦点还原需实现时核对 | §6.2 渲染体约束 + §9 补 a11y 验收项 |
| 49 | 正面确认：C 端现无 Lighthouse CI 卡口（perf.yml 只测 admin、手动触发），弹窗不破坏任何现有门禁；SEO 方案阶段三拟新增 C 端 Lighthouse 时，活动进行中会引入测量噪音 | §8 补注记：届时测量选无活动窗口或记录注明 |

**九轮广告合规审查**（v2.9：站点有 ICP 备案、主营国内市场，适用境内广告法规无争议；项目已有先例 docs/baidu-sem-migration-guide.md 的落地页合规自查）：

| # | 九轮发现 | 处理 |
|---|-----------|-----------|
| 50 | **关闭能力是法定要求**：《广告法》第 44 条 + 《互联网广告管理办法》（2023-05-01）第 10 条——弹出广告须显著标明关闭标志、确保一键关闭，不得无关闭标志/倒计时才可关/标志虚假难辨认。八轮的“易关闭/非满屏”当时定位为 SEO 缓解，需升格为硬约束，防日后转化优化时被砍 | §6.2 渲染体约束升格注记 + §7 合规行 |
| 51 | 弹窗文案属商业广告：受广告法第 9 条绝对化用语限制（“最/第一/国家级”等禁用），与 SEM 落地页同口径 | §5.2 运营注记，交叉引用 SEM 指南先例 |
| 52 | 正面确认：localStorage 仅存频次时间戳/会话标记，无个人信息，不触发 PIPL 单独同意，无 Cookie 横幅义务变化 | 无需处理 |

**十轮独立冷启动评审**（v3.0：由不携带前九轮结论的独立评审代理通读全文逐项对码复核；另抽查确认 5 组关键声明无误——TradeShow 模型现状、findOne 全量返回、admin 表单链路、TransformInterceptor/throttler 先例、deploy.sh 迁移顺序）：

| # | 十轮发现 | 处理 |
|---|-----------|-----------|
| 53 | **P2 计数字段可经现有 PUT 篡改**：全局 ValidationPipe `whitelist: false`（main.ts TODO 待修）——DTO 未声明的属性不会被剥除；而 service `update` 将 DTO 剩余属性整体展开写库 → body 携带 `popupViewCount` 等未声明字段可绕过校验直达数据库（既有 `viewCount` 今天同理）。“严格校验只放 DTO”铁律对未声明属性不设防 | §4.3 补计数字段写保护：create/update 显式剔除计数键 |
| 54 | **勘误：v2.2 #3“路由顺序硬约束”系误诊**——`:slug` 是单段路径参数，不匹配两段路径 `marketing/active`，先后声明均正确路由；“否则返回 404”断言不成立 | §4.1 降级为组织风格建议 |
| 55 | “写入侧 sanitizeMarkdown 消毒”名不副实：该函数仅去空字符/trim/50 万字符截断（文件头自述“存原文，渲染端再 sanitize”）；XSS 防线实为渲染侧单层（rehypeSanitize），文档虚构了一层防御 | §2/§4.3/§7 表述如实化，并禁止在 MarkdownBody 之外渲染库内 content |
| 56 | 草图 `alreadyShown` 裸读 storage 无 try/catch（与 markShown 双标）；async IIFE 无整体 catch，同步异常成未处理 rejection（AGENTS.md 绝对禁止第 6 条） | §6.2 草图修正 |
| 57 | scroll 触发在不可滚动页面（内容不足一屏）永不触发，弹窗静默不弹且运营无从得知 | 草图补回退（无滚动条时降级 3s 延时）+ §5.2 help 注明 |
| 58 | `excludePages` 尾斜杠失配：运营填 `/products/` 对 pathname `/products` 静默不匹配（本项目 canonical 尾斜杠缺陷同款教训）；三轮 #23 只修了前导斜杠半边 | 草图匹配前双侧归一去尾斜杠，零校验负担 |
| 59 | 措辞级三处：`~600B` 与白名单含全文 content（上限 50 万字符）矛盾；`ctaText` 中文 schema 默认值在 en/zh-TW 弹中文按钮（属 §6.3 单语限制但未点名）；“运营改完立即生效”对已缓存响应过强 | 对应三处修正 |

**十一轮草图代码级评审**（v3.1：第二个独立代理把 §4/§6 草图当作“即将合入的真实代码”逐行 review，对码 Dialog 源码/normalize 链路/analytics 先例；另确认双端窗口条件一致、缓存存剥离后数据、excludePages 空数组链路等 8 项无误）：

| # | 十一轮发现 | 处理 |
|---|-----------|-----------|
| 60 | **P2 结束日当天全天不弹**：admin datetime 控件只选日期时 endDate 落在当日 00:00，运营心智“结束日期 8/10”= 10 日全天有效，实际 10 日凌晨即停（弹窗与计数同步失效，运营必踩） | §5.2 补 endDate help「精确到分钟，全天有效选 23:59」+ §9 验收 |
| 61 | **P2 ctaUrl 协议相对绕过**：`/^(https?:\/\/|\/)/` 放行 `//evil.com` 与 `/\` 变体——window.open 解析为外站跳转，“仅站内路径”承诺被绕过（钓鱼面） | §4.3 正则补 `(?![/\\])` |
| 62 | **P2 关闭链路与受控 Dialog 冲突**：`!open` 直接卸载渲染体——@tzj/ui Dialog 有 data-closed 出场动画（duration-200），立即卸载则动画跳过、遮罩瞬闪、焦点无还原落点（与八轮 a11y 承诺自相矛盾） | 草图改 open 受控透传、薄壳保持挂载 |
| 63 | P3 `await res.json()` 后缺 cancelled 复查：卸载窗口内仍会注册定时器/scroll 监听且不被清理 | 草图补复查 |
| 64 | P3 会话语义：sessionStorage 按标签页隔离（新标签各弹一次）；bfcache 回退恢复被冻结的 delay 定时器（一回退就弹） | MVP 接受，§6.3 如实声明 |
| 65 | P3 view 计数在懒加载渲染体就绪前发出（弱网“没看到却计曝光+耗频次”）；sendEvent 未对齐 sendBeacon 先例（analytics.ts），关标签页时需预检的 keepalive 请求可能丢失 | view 上报挪渲染体挂载后；sendEvent 改 sendBeacon 优先 |
| 66 | P3 TS strict 编译：草图 `MarketingPopupDialog` / `pruneEntries` 未定义（仅注释描述）；controller `@Header` 未 import | 草图注记补齐 |
| 67 | P3 `s-maxage=60` 与“最长 30s”叙事矛盾且无 CDN 层；叠加后过期活动最长近分钟仍弹但计数 404 | 去掉 s-maxage；§4.1 补“弹而不计”如实注记 |
| 68 | P3 `orderBy publishedAt desc` 对 null 行 Postgres 默认 NULLS FIRST，历史脏数据会排最前 | orderBy 改 nulls last |
| 69 | P3 zod 药方勘误：#21 开的 `z.coerce.number().optional()` 吞不掉 NaN（NaN≠undefined），表单卡死按该药方仍复现；且 delaySeconds=0 提交被 DTO Min(1) 拒、错误落在已隐藏字段 | §5.1 药方改 preprocess（NaN/''/0→undefined） |

**十二轮 admin 链路 + 迁移/部署专项**（v3.2：第三个独立代理专项核查 §5 admin 表单链路与 §3/§8 迁移部署链路——十一轮未覆盖的最后两块；§5 七项声称六项属实、部署链路（先迁移后滚更、失败阻断）与模型无冲突/无 @map 漂移均逐行确认）：

| # | 十二轮发现 | 处理 |
|---|-----------|-----------|
| 70 | **P2 迁移 SQL 可空性漂移**：§3.2 给 `excludePages` 写了 `NOT NULL`，但 Prisma 为标量数组列生成的 DDL **不带 NOT NULL**（0_init L117 `images` 先例）——生产 migrate deploy 列不可空、本地 db push 列可空，正中本项目已踩过的「db push 开发库 vs migrate deploy 生产库漂移」坑（跨库导入校验告警 + migrate diff 噪音） | §3.2 SQL 去掉该列 NOT NULL |
| 71 | P3 #60 时刻勘误：DateTimePicker 无值时默认 `time: '09:00'`（DateTimePicker.tsx L17/L21），只选日期落的是**当天 09:00 而非 00:00**——「结束日上午即停」问题本质不变，但 help 文案与验收口径须如实 | §3/§5.2/§9 三处 00:00→09:00 |
| 72 | P3 tags 口径实锤 + 既有 bug 顺带发现：TagsInput 契约为 `value: string / onChange(string)`（TagsInput.tsx L20-21），方案 §5.2 字符串口径**正确**；反而 customers.tsx 以数组写 zod/defaults/toForm（L31/L267/L285）系既有缺陷——编辑标签后 onChange 回传字符串，`z.array` 校验必失败无法保存 | §5.2 补正面确认；customers 修复不在本方案范围，另行处理 |
| 73 | P3 新字段漏加 zod schema 会被**静默丢弃**：zodResolver 解析产物即提交值（ResourceForm L42-51/L366-372），zod 对象默认剥除未声明键——加进 fields 却漏加 zod 的字段提交时拿到 undefined | §5.2 补自查项「fields 与 zod 键集合必须一致」 |
| 74 | P3 §5.1「错误提示不可见、表单卡死」表述过强：handleInvalid 会弹 toast 展示首条 zod 报错（ResourceForm L337-340），只是 focusFirstInvalidField 对未渲染字段无法滚动定位——实际症状是「弹一条晦涩报错且无从定位修复」 | §5.1 措辞如实化（宽松 zod 处置不变） |

**十三轮验收/测试可执行性专项**（v3.3：第四独立代理审元问题——§9 验收与 §10 测试工时在仓库内是否有现成手段可执行；正面确认：api jest / web vitest 基建齐备（各 13/6 个既有测试文件，Prisma 手写 mock 有 users.service.spec 先例，2h 估算不含搭建成本成立）、check-permissions.mjs 为自动扫描无需登记、bundle/XSS 手动验收可执行）：

| # | 十三轮发现 | 处理 |
|---|-----------|-----------|
| 75 | **P2 压测验收项零工具**：「50 QPS 压测 P99 < 100ms」在仓库内无任何执行手段（无 autocannon/k6/artillery，perf.yml 是 Playwright UI 测量非 HTTP 压测）——写了但没人能跑 | §9 改为可落地表述：`pnpm dlx autocannon` 一次性验证（pnpm dlx 有 ci.yml LHCI 先例） |
| 76 | **P2 频次函数单测形态冲突**：§6.2 草图中 alreadyShown/markShown 未导出、且直接读写 storage（非纯函数），而 web vitest 为 node 环境无 storage 全局——§10「频次纯函数单测」按草图形态不可执行 | §6.2 补注：频次函数提取独立模块导出，测试 stub globalThis storage；2h 内含该提取 |
| 77 | P3 CI 完全不跑单测：ci.yml「Build & Test」步骤实际只执行 build，新增单测（含既有 19 个测试文件）仅本地验证，方案未声明 | §8 如实注记；接入 CI 属独立事项（turbo test 任务已就绪，接线成本低） |
| 78 | P3 PUT 计数剔除验收步骤不自明：admin 表单不发计数字段，走 UI 测不出，需 token + curl 直接构造请求 | §9 补操作提示 |
| 79 | P3 CTR 口径无集中声明：多标签页 session 各计 view 稀释 CTR、无语言/设备维度拆分——散落注记（#64/#65/#67）各自属实但无面向运营的解读须知 | §5.2 列表列处集中声明 |
| 80 | P3 §8「C 端现无 Lighthouse 卡口」归因不全：ci.yml 实有 lighthouse-web job，只是 continue-on-error 非阻断 | §8 表述修正 |
| 81 | P3（自查）§7 表格 `s-maxage=60` 残留：十一轮 #67 只改了 §4.1，§7 未同步，两节自相矛盾 | §7 同步为 max-age=30 |

**十四轮修订完整性审计**（v3.4：第五个独立代理把 §0 的 #1~81 修订记录本身当审计对象，逐项核查「处理」栏声称的修法是否真正落盘、多轮修订间有无回退/覆盖。结论：**76 项完全落盘、0 项未落盘、4 项无需正文动作、1 项部分落盘**（#59，见 #82）；热点交叉引用全部一致——max-age=30 共 6 处、默认时刻 09:00 共 3 处、工时 17.5h 共 4 处且分项相加吻合、「10 个字段」全部引用处一致、频次口径 session/daily/once 共 7 处一致、50 QPS / P99<100ms 共 3 处一致；编号 #1~81 连续无跳号，轮次↔版本映射与版本历史逐条吻合；热点章节多轮叠加修订均为显式勘误，无「重写冲掉早期修订」情况）：

| # | 十四轮发现 | 处理 |
|---|-----------|-----------|
| 82 | P3 **#59 部分落盘残留**（与 #67→#81 同构）：§4.1 已如实化为「过期活动叠加最长约 60 秒仍可能弹出」，但 §5.3「配置出错可秒级回滚」与 §11「秒级关闭兜底」两处同口径表述未同步——对已持有缓存响应的浏览器，回滚生效实为最长约 30~60 秒，非「秒级」 | §5.3 / §11 两处改为 30~60 秒口径并引用 §4.1 |
| 83 | P3 §1 排除清单与 §11 Backlog 表失配：§1 写「排除（Backlog 见 §11）」并列 5 条，但「Redis / 任何新增基础设施」实际归属 §7「明确不做」而非 Backlog，「独立 Stats 看板」两处均未收录 | §1 逐条标注归属（Backlog / 明确不做），§11 补 Stats 看板一行 |
| 84 | 文档信息表「前版」括注归属易误读：v3.3 的前版栏写「v3.2（十三轮…）」，括注描述的是本轮内容而非前版自身（v3.2 系十二轮修订版），与版本历史并列阅读时自相矛盾 | 前版括注改为描述前版自身轮次，此约定沿用 |
| 85 | 观察项：四轮 #31 的「新装饰器需补 IsIn/Max/Matches 导入」提醒未见于 §4.3（对比 @Header 的导入在 §4.1/§6.4 各有内联提醒）；#31 处理栏本身定性为「实现细节不另计工时」，属落盘边缘非缺陷 | §4.3 代码块补一行导入注释，与 @Header 待遇一致 |

**十五轮前提脆弱性与实施窗口冲突审查**（v3.5：第六个独立代理审全新维度——方案依赖的代码库「当前状态」前提中哪些是脆弱的（有 TODO / 并行计划要改），变化后哪些段落静默失效。正面确认：10 类前提中 8 类稳定——TransformInterceptor 全局注册（app.module.ts）、@Public + check-permissions 自动扫描、**Base UI Dialog 迁移已完结非进行中**（b1-base-ui-migration.md 第 3 批 2026-07-28 验收通过、ui 包零 Radix 零 TODO，#62 引用的 data-closed 即迁移后形态）、ResourceForm/normalize 链路零 TODO、vitest node 环境、CI 现状与 deploy.sh 均无进行中改造（deployment-plan.md 所列 ci.yml 调整已全部落地）、TradeShow 模块无并行改动计划；popup-event 计数与自建埋点系孰为两条独立链路无冲突；§10 九分项可无歧义推导拓扑序（schema→API/剥离→admin→web→测试→联调，表格排列即近似拓扑序））：

| # | 十五轮发现 | 处理 |
|---|-----------|-----------|
| 86 | **P2 散点要求无汇总视图**：全篇「实现时/须/必须/注意」类一句话要求约 20+ 处，散布 §3.2/§4.1/§4.3/§5.1/§5.2/§6.2/§6.4/§9——单项均有落点但实施时极易漏（尤其 §6.4 描述同步、导入提醒、CTR tooltip 这类半句话要求） | 新增 §9.1 实施散点 checklist（按实施顺序分 7 组汇总，正文仍为唯一口径源） |
| 87 | P3 **customers.tsx 修复方向反噬风险**：十二轮 #72 将其数组口径定为既有 bug、修复另行处理——若他人修复时选「改 TagsInput 契约为数组」而非「改 customers 的 zod」，§5.2 字符串口径整节随之失效 | §5.2 显式约束修复方向（保持 TagsInput 字符串契约） |
| 88 | P3 whitelist 开启后的文档回收无跟进项：§4.3 计数写保护与 §7「必要防线」行均锚定 main.ts `whitelist: false`（L40 TODO，唯一带代码内 TODO 的前提；阻碍仅 MoveDocumentDto，修复量小），开启后这些表述长期残留为过时防线描述 | §4.3 补跟进项：whitelist 开启后回收两处表述 |
| 89 | 观察项：Base UI 的 escape 处理只响应真实按键，合成 KeyboardEvent 无效（b1 迁移第 3 批验收注记）——日后为 §9 的 ESC 验收项写自动化测试会踩坑 | §9 a11y 项补注：ESC 项手动验收，勿写合成事件断言 |
| 90 | 观察项：SEO 方案阶段二拟将预览解耦到独立 /preview 路由（web-seo-assessment-and-plan.md 阶段二第 5 项）——只动 web 侧路径、API findOne 的 includeUnpublished 判别不变，实质影响低，但 §5.3 预览表述届时需复核 | §5.3 补观察注记 |

---

## 1. 背景与范围

TZJ 需要轻量级营销活动弹窗：发布 C 端促销活动（周年庆、节日促销、新品首发），在站点自动弹窗展示，统计曝光与点击。

**纳入**：
- B 端复用 TradeShow CRUD，`eventType` 扩展 `promotion` 类型
- `isMarketing` 总开关 + 触发方式（立即/延时/滚动）+ 频次控制（session/daily/once）
- 页面排除、设备过滤、CTA 按钮跳转
- 曝光量 / 点击量统计（服务端计数）

**排除**（十四轮 #83 逐条标注归属）：
- banner / landing 展示形态（v1 仅弹窗）→ Backlog（§11）
- A/B 测试、复杂 targeting（地域/来源）→ Backlog（§11）
- 独立 Stats 看板 → Backlog（§11）
- 点击明细日志表（ClickLog）→ Backlog（§11）
- per-locale 多语文案 → Backlog（§11）
- Redis / 任何新增基础设施 → 明确不做（§7）

**为什么扩展 TradeShow 而非新建 Activity 表**：CRUD、发布流、预览令牌、S3 上传、Markdown 编辑、RBAC、审计全部现成；运营无需学新后台。冗余字段（location/boothNumber）成本远低于重复建设成本。

---

## 2. 总体架构

```
B 端 admin（tradeShows ResourceConfig 扩展营销字段，visibleWhen 条件渲染）
        │ 现有 CRUD API（JWT + RBAC，无新增写接口）
        ▼
API @tzj/api trade-shows 模块
  ├ GET  /trade-shows/marketing/active   ← 新增（@Public，30s 内存缓存）
  └ POST /trade-shows/:id/popup-event    ← 新增（@Public + @Throttle，曝光/点击计数）
        ▼
PostgreSQL trade_shows（+10 字段）
        ▲
C 端 web：MarketingPopup（客户端组件，挂 [locale]/layout.tsx）
  localStorage/sessionStorage 频次控制，零额外基础设施
```

技术栈：**零新增依赖**。限流用 `@nestjs/throttler`（现有），XSS 防护用渲染侧 `MarkdownBody` rehypeSanitize（现有；写入侧 `sanitizeMarkdown` 仅规范化非消毒，见 §4.3），缓存用服务内存（现有模式，同 RolesService 权限缓存）。

---

## 3. 数据库设计

> ⚠️ 本节为 schema.prisma 变更，按 AGENTS.md 所有权矩阵须 **A1 审批**后实施。

### 3.1 TradeShow 新增 10 个字段

```prisma
model TradeShow {
  // ── 现有字段全部不动（含 startDate/endDate/sortOrder/viewCount/scheduledAt）──

  // ═══ 营销弹窗（10 个新字段，均带默认值，零破坏性）═══
  isMarketing     Boolean  @default(false)          // 总开关
  triggerMode     String   @default("immediate")    // immediate | delay | scroll
  delaySeconds    Int      @default(3)              // triggerMode=delay 时生效，1~60
  frequency       String   @default("session")      // session | daily | once
  excludePages    String[] @default([])             // 不展示的路径（不含 locale 前缀），如 ["/products"]
  targetDevice    String   @default("all")          // all | mobile | desktop
  ctaText         String   @default("立即参与")      // CTA 按钮文字
  ctaUrl          String?                           // CTA 跳转链接；留空则点击仅关闭弹窗
  popupViewCount  Int      @default(0)              // 弹窗曝光量（与详情页 viewCount 分开）
  popupClickCount Int      @default(0)              // CTA 点击量

  @@index([isMarketing])
}
```

设计要点：

- **展示时间窗口复用 `startDate/endDate`**：促销活动的活动时间即展示窗口，admin 表单已有这两个字段，无需新增。两者可空 = 发布即长期展示。⚠️ 十一轮 #60（十二轮 #71 勘误时刻）：endDate 是精确时刻，datetime 控件只选日期时默认落在当日 **09:00**（DateTimePicker 默认时间）→ 结束日上午即停止展示，后台 help 必须明示（§5.2）。
- **不新增 `scheduleStart/scheduleEnd`**，`scheduledAt`（定时发布）语义不动。
- **不建共享枚举**：沿用 `eventType String @default("exhibition")` 的现有风格，取值约束放 DTO / zod（避免动 `packages/types` 触发额外 A1 审批面）。
- 索引仅 `isMarketing` 一个：表内行数量级为几十，`status`/`startDate` 已有索引，时间窗口过滤无需专门索引。
- `eventType` 注释扩展为 `exhibition | seminar | roadshow | promotion`（无 schema 变化，纯注释）。

### 3.2 迁移（遵守 AGENTS.md 数据库工作流）

```bash
# 本地：非破坏性同步（禁止 migrate dev）
pnpm --filter @tzj/api prisma:push && pnpm --filter @tzj/api prisma:generate
```

生产：在 `apps/api/prisma/migrations/20260731000000_add_marketing_popup_fields/migration.sql` 手写迁移（本地不 apply，deploy.sh 的 `migrate deploy` 自动执行）：

```sql
ALTER TABLE "trade_shows"
  ADD COLUMN IF NOT EXISTS "isMarketing"     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "triggerMode"     TEXT        NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS "delaySeconds"    INTEGER     NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "frequency"       TEXT        NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS "excludePages"    TEXT[]      DEFAULT ARRAY[]::TEXT[],  -- 十二轮 #70：不带 NOT NULL——Prisma 为标量数组列生成的 DDL 即不带（0_init 的 images 先例），带上会造成生产/本地可空性漂移
  ADD COLUMN IF NOT EXISTS "targetDevice"    TEXT        NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS "ctaText"         TEXT        NOT NULL DEFAULT '立即参与',
  ADD COLUMN IF NOT EXISTS "ctaUrl"          TEXT,
  ADD COLUMN IF NOT EXISTS "popupViewCount"  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "popupClickCount" INTEGER     NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "trade_shows_isMarketing_idx" ON "trade_shows"("isMarketing");
```

---

## 4. API 设计（新增 2 个公开端点）

两个端点均标注 `@Public()`（现有装饰器），满足 fail-closed `RolesGuard` 与 CI 门禁 `scripts/check-permissions.mjs`。

### 4.1 GET `/trade-shows/marketing/active` — 当前生效的营销活动

> 路由组织建议（十轮勘误 #54：原“硬约束”系误诊——`:slug` 为单段路径参数，不会匹配两段路径 `marketing/active`，先后声明均正确路由）：仍建议声明在 `@Get(':slug')` 之前，纯可读性考虑。

```typescript
// trade-shows.controller.ts（插在 @Get(':slug') 之前）
@Public()
@Get('marketing/active')
@Header('Cache-Control', 'public, max-age=30')  // @Header 设响应头（@Headers 是读请求头），需补 import；十一轮 #67：去掉 s-maxage=60（无 CDN 层，共享缓存指令徒增过期活动展示窗口）
@ApiOperation({ summary: '获取当前生效的营销弹窗活动（最多 1 条）' })
getActiveMarketing() {
  return this.tradeShowsService.findActiveMarketing();
}
```

```typescript
// trade-shows.service.ts
private marketingCache: { data: unknown[]; expireAt: number } | null = null;

/** 公开接口字段白名单：不泄露 location/boothNumber/审计字段；传输量取决于 content 长度（十轮 #59：正文上限 50 万字符，营销弹窗正文应保持短文案） */
private static readonly MARKETING_SELECT = {
  id: true, title: true, content: true, coverImage: true,
  triggerMode: true, delaySeconds: true, frequency: true,
  excludePages: true, targetDevice: true, ctaText: true, ctaUrl: true,
} satisfies Prisma.TradeShowSelect;

async findActiveMarketing() {
  if (this.marketingCache && this.marketingCache.expireAt > Date.now()) {
    return this.marketingCache.data;
  }
  const now = new Date();
  const data = await this.prisma.tradeShow.findMany({
    where: {
      isMarketing: true,
      status: 'published',
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: [{ sortOrder: 'desc' }, { publishedAt: { sort: 'desc', nulls: 'last' } }],  // 十一轮 #68：Postgres DESC 默认 NULLS FIRST，防历史 null publishedAt 行排最前
    take: 1,   // 同一时间只展示一个活动，多个候选取 sortOrder 最高
    select: TradeShowsService.MARKETING_SELECT,
  });
  this.marketingCache = { data, expireAt: Date.now() + 30_000 };
  return data;
}
```

**缓存失效**：`create` / `update` / `remove` 成功后置 `this.marketingCache = null`（新请求立即生效；已缓存响应的浏览器最长 30s 后回源，max-age=30；多实例部署时靠 TTL 最终一致，同 RolesService 权限缓存的既有取舍）。**例外**：定时发布由 `PublishingService` cron 直写 DB、不经过本 service，缓存只能靠 30s TTL 过期——`scheduledAt` 到点后最多延迟 30s 开始弹窗，可接受。**过期下线延迟（十一轮 #67）**：活动过 endDate 后，服务端 30s 内存缓存 + 浏览器 max-age=30 叠加，最长约 60s 仍可能弹出，此时 popup-event 因窗口条件 404、view 静默丢失——短暂“弹而不计”，量级可忽略，如实声明。

### 4.2 POST `/trade-shows/:id/popup-event` — 曝光/点击计数

```typescript
// dto/popup-event.dto.ts（class-validator，与现有 DTO 风格一致）
export class PopupEventDto {
  @ApiProperty({ enum: ['view', 'click'], description: '事件类型：曝光 | CTA 点击' })
  @IsIn(['view', 'click'])
  type!: 'view' | 'click';
}
```

```typescript
// trade-shows.controller.ts
@Public()
@Throttle({ default: { limit: 30, ttl: 60_000 } })  // 复用现有 throttler，先例：analytics collect
@Post(':id/popup-event')
@ApiOperation({ summary: '记录营销弹窗曝光/点击' })
recordPopupEvent(@Param('id') id: string, @Body() dto: PopupEventDto) {
  return this.tradeShowsService.recordPopupEvent(id, dto.type);
}
```

```typescript
// trade-shows.service.ts —— updateMany 带条件：单条 SQL 原子完成「校验目标为窗口内已发布营销活动 + 计数」，
// 防止对任意行/过期活动刷计数；无 buffer（点击事件 QPS 个位数，直写足够，砍掉 v2.1 的 buffer 设计）
async recordPopupEvent(id: string, type: 'view' | 'click') {
  const now = new Date();
  const result = await this.prisma.tradeShow.updateMany({
    where: {
      id, isMarketing: true, status: 'published',
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    data:
      type === 'view'
        ? { popupViewCount: { increment: 1 } }
        : { popupClickCount: { increment: 1 } },
  });
  if (result.count === 0) throw new NotFoundException('活动不存在、未发布或不在展示窗口内');
  return { success: true };  // 七轮注：会被 TransformInterceptor 再包一层 { success, data }，冗余无害；实现时可直接不返回业务体
}
```

### 4.3 现有 CRUD 的配套改动

`CreateTradeShowDto` 补充营销字段的可选校验（`UpdateTradeShowDto` 经 `PartialType` 自动继承）：

```typescript
// 实现提醒（四轮 #31，十四轮 #85 落盘）：文件头需补 IsIn / Max / Matches / IsArray 等装饰器导入
@IsOptional() @IsBoolean() isMarketing?: boolean;
@IsOptional() @IsIn(['immediate', 'delay', 'scroll']) triggerMode?: string;
@IsOptional() @IsInt() @Min(1) @Max(60) delaySeconds?: number;
@IsOptional() @IsIn(['session', 'daily', 'once']) frequency?: string;
@IsOptional() @IsArray() @IsString({ each: true })
@Matches(/^\//, { each: true, message: '排除路径必须以 / 开头' }) excludePages?: string[];
@IsOptional() @IsIn(['all', 'mobile', 'desktop']) targetDevice?: string;
@IsOptional() @IsString() @MaxLength(50) ctaText?: string;
@IsOptional() @IsString()
@Matches(/^(https?:\/\/|\/(?![/\\]))/, { message: '仅允许 http(s) 链接或站内路径' }) ctaUrl?: string;  // 防 javascript:；十一轮 #61：(?![/\\]) 拒协议相对 //evil.com 与 /\ 变体伪装站内路径跳外站
```

**计数字段写保护（十轮新增，P2 #53）**：全局 ValidationPipe 目前 `whitelist: false`（main.ts TODO：待修 MoveDocumentDto 后开启），DTO 未声明的属性**不会被剥除**；而 service 的 create/update 将 DTO 展开写库——请求体直接携带 `popupViewCount` / `popupClickCount` 即可绕过校验篡改计数（既有 `viewCount` 同理）。处理：create/update 写库前显式剔除这三个计数键（顺带修复既有 `viewCount`；计数只允许经 `increment` 路径变更）；待全局 whitelist 开启后此保护自然冗余但无害。跟进项（十五轮 #88）：whitelist 开启后（阻碍仅 MoveDocumentDto，修复量小）回收本段与 §7「必要防线」表述，避免文档长期残留过时防线描述。

XSS（十轮 #55 如实化）：`content` 写入走现有 `sanitizeMarkdown`（**仅规范化**：去空字符/trim/超长截断，库内存原文，非消毒）；XSS 防线在渲染侧：C 端一律经 `MarkdownBody`（react-markdown + rehypeSanitize）渲染，**不得**在其他位置（邮件/RSS 等）直接渲染库内 content。**不引入 DOMPurify。**

**公开面字段剥离（五轮新增，P2）**：现有公开 `GET /trade-shows`（findAll）靠 `stripInternalContentFields` 只剥离审计字段，`GET :slug`（findOne）公开访问**返回全量字段**（既有行为）。不处理则 10 个营销字段随公开接口外泄——重点是 `popupViewCount / popupClickCount` 计数（竞品可见），营销配置也无必要公开（弹窗组件只从 `marketing/active` 白名单端点取数）。处理：

- `common/utils/content-list.ts` 的 `INTERNAL_KEYS` 追加 10 个营销字段（共享常量，`delete` 不存在的键无害，cases/news/blogs 不受影响）
- trade-shows `findOne` 公开访问补同一 strip（顺带收敛既有审计字段外泄）；后台/预览（includeUnpublished）不剥离，admin 编辑表单回填不受影响

---

## 5. B 端后台

### 5.1 ResourceForm 通用改造：字段条件渲染（本方案的真实成本所在）

现有 `FieldDef`（`apps/admin/src/components/crud/config.ts`）**没有**条件渲染能力，需通用扩展：

```typescript
export interface FieldDef {
  // ── 现有属性不动 ──
  /** 条件显示：返回 false 时该字段不渲染（纯显示过滤，提交值不做剔除——
   *  营销字段服务端一律以 isMarketing 总开关为准，隐藏字段随表单提交默认值无害）。 */
  visibleWhen?: (values: Record<string, unknown>) => boolean;
}
```

实现注记：`ResourceForm` 基于 react-hook-form（`control` + `Controller`），取实时表单值需 `useWatch({ control })` 订阅——这会让整表单随输入重渲染，但表单字段量级 ≤ 20，可接受。**这是共享组件改动，影响全部 6 个 ResourceConfig**——现有资源不传 `visibleWhen` 行为完全不变，但需回归验证，工时如实计入（§10）。

**配套铁律（三轮新增，十二轮 #74 措辞如实化）**：zod resolver 会校验**隐藏字段**。典型踩坑：number 字段以 `valueAsNumber` 注册，运营清空 `delaySeconds` 后把触发方式切回 immediate → 字段隐藏但值为 `NaN` → 校验失败——toast 会弹出首条 zod 报错（handleInvalid），但 focusFirstInvalidField 对未渲染字段无法滚动定位，运营看到一条晦涩报错却无从修复。因此**营销字段的 zod 端一律宽松**，delaySeconds 1~60、枚举等严格校验只放服务端 DTO（§4.3）。**药方勘误（十一轮 #69）**：`z.coerce.number().optional()` 吞不掉 NaN（NaN ≠ undefined，optional 不放行），需 preprocess：`z.preprocess((v) => (v === '' || (typeof v === 'number' && Number.isNaN(v)) || v === 0 ? undefined : v), z.coerce.number().optional())`——顺带把 0 转 undefined（服务端回退默认 3），避免运营填 0 时被 DTO Min(1) 拒且错误提示落在已隐藏字段上。

### 5.2 tradeShows.tsx 配置增量

字段类型全部使用**现有** `FieldType`（switch/select/number/tags/text），无 `section-header`/`tags-input` 之类不存在的类型：

```typescript
// 类型下拉补 promotion 选项：TRADE_SHOW_TYPE_OPTIONS 在 apps/admin/src/features/constants.tsx
// += { label: '营销活动', value: 'promotion' }（web 侧标签见 §6.4）

// fields 追加（zod schema、defaults 同步补齐）：
{ name: 'isMarketing', label: '启用营销弹窗', type: 'switch',
  help: '启用后按下方规则在官网自动弹窗；展示时间窗口即上方「开始/结束日期」' },
{ name: 'triggerMode', label: '触发方式', type: 'select',
  help: 'SEO 提示：移动端避免「立即显示」（搜索引擎对落地即遮挡内容的弹窗降权），建议延时 ≥5 秒或滚动触发；若必须立即显示，建议目标设备选「仅桌面端」；「滚动过半」在内容不足一屏的短页面自动回退为 3 秒延时',
  options: [
    { label: '进入页面立即显示', value: 'immediate' },
    { label: '延时显示', value: 'delay' },
    { label: '滚动过半时显示', value: 'scroll' },
  ],
  visibleWhen: (v) => v.isMarketing === true },
{ name: 'delaySeconds', label: '延时秒数', type: 'number',
  visibleWhen: (v) => v.isMarketing === true && v.triggerMode === 'delay' },
{ name: 'frequency', label: '频次控制', type: 'select',
  options: [
    { label: '每次会话一次', value: 'session' },
    { label: '每日一次', value: 'daily' },
    { label: '仅一次', value: 'once' },
  ],
  visibleWhen: (v) => v.isMarketing === true },
{ name: 'excludePages', label: '排除页面', type: 'tags',
  help: '逗号或换行分隔、以 / 开头的路径（不含语言前缀），如 /products；回显为逗号分隔；访客落地页命中排除则本次会话不弹',
  visibleWhen: (v) => v.isMarketing === true },
{ name: 'targetDevice', label: '目标设备', type: 'select',
  options: [
    { label: '全部', value: 'all' },
    { label: '仅移动端', value: 'mobile' },
    { label: '仅桌面端', value: 'desktop' },
  ],
  visibleWhen: (v) => v.isMarketing === true },
{ name: 'ctaText', label: 'CTA 按钮文字', type: 'text',
  visibleWhen: (v) => v.isMarketing === true },
{ name: 'ctaUrl', label: 'CTA 跳转链接', type: 'text',
  help: '留空则点击按钮仅关闭弹窗',
  visibleWhen: (v) => v.isMarketing === true },
```

列表列：加一列营销标记 + 弹窗数据（`popupViewCount / popupClickCount`，可算 CTR）。**CTR 解读须知（十三轮 #79，建议同时放列头 tooltip）**：计数为趋势参考非审计级精确——多标签页 session 频次下各标签各计一次 view（稀释 CTR）；无语言/设备维度拆分（全量聚合）；缓存期可能「弹而不计」（#67）、sendBeacon 少量丢失。

**表单层口径（三轮修正，与 ResourceForm 现实对齐）**：

- `excludePages` 的表单值是**逗号/换行分隔字符串**（`features/normalize.ts` 的 `normalizeValues` 提交时才 split 成 `string[]`）：zod 用 `z.string().optional()`、defaults 用 `''`、现有 `toForm` 必须补 `excludePages: (r.excludePages ?? []).join(', ')`。十二轮 #72 实锤：TagsInput 契约即 `value: string / onChange(string)`，字符串口径正确；仓库内 customers.tsx 的数组口径系既有缺陷（编辑标签后 `z.array` 校验必失败），勿以其为先例，修复另行处理（十五轮 #87 方向约束：该修复必须选「改 customers 的 zod/defaults/toForm 对齐字符串契约」，不得反向改 TagsInput 契约为数组——否则本节口径整节失效）。normalize 的 `filter(Boolean)` 保证空串 split 产出 `[]` 而非 `['']`，不会撞 DTO `@Matches` each 校验
- 自查项（十二轮 #73）：**fields 与 zod schema 键集合必须一致**——zodResolver 解析产物即提交值，zod 对象默认剥除未声明键，加进 fields 却漏加 zod 的字段会被静默丢弃
- `toForm` 同步补齐其余营销字段回填（isMarketing / triggerMode / delaySeconds / frequency / targetDevice / ctaText / ctaUrl），defaults 同步补齐
- `features/types.ts` 的 `TradeShowItem` 接口加 10 个营销字段（四轮补：`toForm` 回填与列表列的 `popupViewCount / popupClickCount` 都依赖它）
- 营销字段 zod 一律宽松（见 §5.1 铁律），严格校验（delaySeconds 1~60、枚举、路径以 / 开头、ctaUrl 协议）只放 DTO
- 运营内容合规（九轮）：弹窗标题/正文/CTA 属商业广告，禁用“最/第一/国家级”等绝对化用语（广告法第 9 条，与 docs/baidu-sem-migration-guide.md 落地页合规自查同口径），发布流程人工把关
- 结束日期语义（十一轮 #60，十二轮 #71 勘误时刻，运营必读）：给现有 `endDate` 字段补 help「精确到分钟；只选日期时默认为当天 09:00，如需结束日全天有效请把时间改为 23:59」——否则营销活动在结束日上午即停止展示

### 5.3 弹窗预览限制（五轮决策）

现有 previewToken 机制仅覆盖**详情页**预览；弹窗本身发布前无法所见即得预览。MVP 接受该限制，兜底链路：后台随时可关 `isMarketing`，关闭后**约 30~60 秒内全量生效**（服务端缓存即时失效，但已下发的浏览器缓存需等 max-age=30 自然过期，叠加见 §4.1；十四轮 #82 修正原「秒级回滚」表述）；「弹窗发布前预览」进 Backlog（§11）。观察注记（十五轮 #90）：SEO 方案阶段二拟将预览解耦到独立 `/preview` 路由（docs/web-seo-assessment-and-plan.md）——只动 web 侧路径，API findOne 的 includeUnpublished 判别不变，落地时复核本节表述即可。

---

## 6. C 端弹窗组件

### 6.1 挂载位置

web 为 i18n 结构，挂载点是 `apps/web/src/app/[locale]/layout.tsx`（与 `ChatWidget` 并列），**不是** `app/layout.tsx`：

```tsx
<ChatWidget ... />
<MarketingPopup />   {/* 'use client'，内部自行 fetch，不阻塞 SSR */}
```

### 6.2 组件实现草图（`apps/web/src/components/marketing/MarketingPopup.tsx`）

```tsx
'use client';
import { useEffect, useState } from 'react';
import { usePathname } from '@/i18n/navigation';   // 返回不含 locale 前缀的路径
import { env } from '@/lib/env';

const API = env.apiUrl;   // 与 analytics.ts 同款客户端请求模式

interface MarketingActivity {
  id: string; title: string; content: string | null; coverImage: string | null;
  triggerMode: 'immediate' | 'delay' | 'scroll';
  delaySeconds: number;
  frequency: 'session' | 'daily' | 'once';
  excludePages: string[];
  targetDevice: 'all' | 'mobile' | 'desktop';
  ctaText: string; ctaUrl: string | null;
}

/** 频次判定与写回：show 时必须 markShown，否则频次控制失效（v2.1 的 bug）。
 *  十三轮 #76：实现时提取到独立模块（如 marketing/frequency.ts）并导出——否则 §10 的单测项不可执行；
 *  注意非纯函数（读写 storage），web vitest 为 node 环境无 storage 全局，测试中 stub globalThis.sessionStorage/localStorage */
function alreadyShown(a: MarketingActivity): boolean {
  const key = `tzj_popup_${a.id}`;
  try {   // 十轮 #56：读侧同样 try/catch，存储不可用视作未弹过，与 markShown 静默降级同口径
    if (a.frequency === 'session') return sessionStorage.getItem(key) === '1';
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    if (a.frequency === 'once') return true;
    const { lastShownAt } = JSON.parse(raw);
    return new Date(lastShownAt).toDateString() === new Date().toDateString(); // daily
  } catch { return false; }
}

function markShown(a: MarketingActivity) {
  const key = `tzj_popup_${a.id}`;
  try {
    if (a.frequency === 'session') sessionStorage.setItem(key, '1');
    else localStorage.setItem(key, JSON.stringify({ lastShownAt: new Date().toISOString() }));
    pruneEntries();   // tzj_popup_* 条目上限 50，超出删最旧（实现：遍历 localStorage 的 tzj_popup_* 按 lastShownAt 删最旧；sessionStorage 随会话销毁无需清理）
  } catch { /* 隐私模式等存储不可用：静默降级，弹窗仍显示 */ }
}

function sendEvent(id: string, type: 'view' | 'click') {
  const url = `${API}/trade-shows/${id}/popup-event`;
  const payload = JSON.stringify({ type });
  // 十一轮 #65：对齐 analytics.ts 先例——sendBeacon 优先（页面卸载/关标签也可靠送达），fetch keepalive 兜底
  if (navigator.sendBeacon?.(url, new Blob([payload], { type: 'application/json' }))) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => { /* 计数失败不影响交互 */ });
}

export function MarketingPopup() {
  const pathname = usePathname();          // 已剥离 locale 前缀，可直接与 excludePages 匹配
  const [activity, setActivity] = useState<MarketingActivity | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onScroll: (() => void) | undefined;
    (async () => {
      const res = await fetch(`${API}/trade-shows/marketing/active`).catch(() => null);
      if (!res?.ok || cancelled) return;
      // API 全局 TransformInterceptor 包装为 { success, data, ... }，须取 .data
      const json = (await res.json()) as { data?: MarketingActivity[] };
      if (cancelled) return;   // 十一轮 #63：json 解析同为悬挂点，防清理后仍注册定时器/监听
      const [a] = json.data ?? [];
      if (!a) return;

      // 过滤：频次 / 路径 / 设备（路径仅在首次加载评估：落地排除页则本次会话不弹，见 §6.3）
      if (alreadyShown(a)) return;
      const norm = (s: string) => s.replace(/\/+$/, '') || '/';   // 十轮 #58：双侧归一尾斜杠，运营填 /products/ 也能匹配
      const path = norm(pathname);
      if (a.excludePages.some((p) => path === norm(p) || path.startsWith(`${norm(p)}/`))) return;
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (a.targetDevice === 'mobile' && !isMobile) return;
      if (a.targetDevice === 'desktop' && isMobile) return;

      const show = () => {
        if (cancelled) return;
        setActivity(a);       // v2.1 漏了这行导致组件永不渲染
        setOpen(true);
        markShown(a);
        // 十一轮 #65：view 上报不在此发出——渲染体是懒加载 chunk，弱网下可能未就绪甚至失败；
        // 由 MarketingPopupDialog 挂载后的 effect 发 sendEvent(id, 'view')，保证“计了曝光 = 真看到了”
      };

      if (a.triggerMode === 'delay') {
        timer = setTimeout(show, Math.min(Math.max(a.delaySeconds, 1), 60) * 1000);
      } else if (a.triggerMode === 'scroll') {
        if (document.documentElement.scrollHeight <= innerHeight) {
          timer = setTimeout(show, 3000);   // 十轮 #57：不可滚动页面回退 3s 延时，避免永不触发
        } else {
          onScroll = () => {
            const half = (document.documentElement.scrollHeight - innerHeight) / 2;
            if (scrollY >= half && onScroll) { removeEventListener('scroll', onScroll); show(); }
          };
          addEventListener('scroll', onScroll, { passive: true });
        }
      } else {
        show();
      }
    })().catch(() => { /* 十轮 #56：兜底捕获，不外泄未处理 rejection（AGENTS.md 禁令 6） */ });
    return () => {   // 挂在 layout 几乎不卸载，但按规范清理定时器与监听
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (onScroll) removeEventListener('scroll', onScroll);
    };
    // 仅首次挂载执行：SPA 内路由切换不重复弹（频次语义按"访问"而非"页面"）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!activity) return null;   // 十一轮 #62：不能用 open 卸载——Dialog 是受控组件（data-closed 出场动画 + 焦点还原），
                                // open=false 时立即卸载会跳过出场动画、遮罩瞬闪且焦点无还原落点

  const onCta = () => {
    sendEvent(activity.id, 'click');
    if (activity.ctaUrl) window.open(activity.ctaUrl, '_blank', 'noopener');
    setOpen(false);
  };

  // 渲染（七轮对齐 bundle 拆分）：薄壳不 import Dialog/MarkdownBody，只 return 懒加载渲染体
  // MarketingPopupDialog = next/dynamic(() => import('./MarketingPopupDialog'))，文件顶部声明（十一轮 #66：
  // 草图内 MarketingPopupDialog / pruneEntries 需真实定义，strict 下缺一不可编译；controller 侧 @Header 同需补 import）
  // 内部：Dialog（@tzj/ui，open 受控透传 + onOpenChange 回调 setOpen，出场动画由 Dialog 播完，薄壳保持挂载）
  //       + coverImage + MarkdownBody(content) + Button(ctaText)；挂载后 effect 发 sendEvent(id, 'view')（#65）
  // 注意：web 现从未用过 Dialog（仅 Popover/ScrollArea 等），首次引入——圆角/描边由 web 覆盖令牌决定，验收时按 C 端工业风目视核对
  // Markdown 走现有 MarkdownBody（rehypeSanitize），无 dangerouslySetInnerHTML
  return <MarketingPopupDialog open={open} activity={activity} onCta={onCta} onOpenChange={setOpen} />;
}
```

**Bundle 拆分（六轮新增，P3）**：组件挂全站 layout，若直接 import Dialog 与 MarkdownBody，react-markdown/rehype 链会进入每个页面的客户端公共 bundle——即使当前无活动（现有详情页的 MarkdownBody 在 Server Component 渲染，不入客户端包，本组件是它首次进入客户端侧）。实现时拆两层：

- `MarketingPopup` 薄壳：fetch + 频次/路径/设备过滤 + 触发时机，零重依赖（上方草图即此层）
- 弹窗渲染体 `MarketingPopupDialog`（Dialog + MarkdownBody + Image + CTA）用 `next/dynamic` 懒加载；**预热时机（七轮修正）**：命中活动并通过频次/路径/设备过滤后即触发 import 预加载（delay/scroll 等待期间并行完成），到达展示时机零网络等待，immediate 模式也仅多一次并行请求；无活动路径零额外 JS。工时含在 web 3.5h 内。

**渲染体约束（八轮新增 SEO + a11y；九轮升格：前两条同时是《广告法》44 条/《互联网广告管理办法》10 条的法定要求，不得为转化率优化而移除或弱化）**：

- **非满屏**：移动端弹窗高度 ≤ 视口 ~70%，不得完全遮挡主内容（Google 侵入式插页判定的核心口径）
- **易关闭**：可见关闭按钮 + ESC + 遮罩点击三途径均可关（Base UI Dialog 现成能力，实现时不得禁用）
- **a11y**：自动弹出场景初始焦点置于关闭按钮（避免抢走阅读中的焦点上下文），关闭后焦点还原；动画尊重 `prefers-reduced-motion`（focus trap / aria-modal 由 Base UI 底座提供，验收核对即可）

### 6.3 i18n 说明（如实声明限制）

- CMS 内容为单语（与现有 trade-shows 详情页一致），中英 locale 弹同一内容。可接受为 MVP 限制，per-locale 文案进 Backlog。
- `excludePages` 存**不含 locale 前缀**的路径；组件用 `@/i18n/navigation` 的 `usePathname` 匹配（其返回值天然不含前缀），后台 help 文案已注明。
- **`excludePages` 仅在首次加载评估**（effect 依赖 `[]`）：访客落地在排除页 → 本次会话内即使导航到其他页也不弹。MVP 接受此语义（频次按“访问”而非“页面”，后台 help 已明示）；若运营反馈不符预期，再改为路由变化重评估（+0.5h）。
- `ctaText` 的 schema 默认值「立即参与」为中文（十轮 #59）：同属单语限制——en / zh-TW locale 下按钮显示该值，运营面向海外受众时需自行填写对应语言文案。
- 会话语义（十一轮 #64，MVP 接受）：sessionStorage 按标签页隔离——frequency=session 时访客每开新标签页各弹一次；bfcache（Safari 回退缓存）恢复时 effect 不重跑、不重复弹，但 delay 模式下未到点即离开、回退返回时被冻结的定时器恢复计时，可能“一回退就弹”。均如实声明，不做额外处理。

### 6.4 内容面外溢决策：promotion 在 C 端其他入口的展示

`promotion` 类型的 TradeShow 是普通已发布内容，会自然出现在：

| 入口 | 现状影响 | 决策 |
|------|---------|------|
| `/resources/trade-shows` 列表页 | 列表不按类型过滤，promotion 会混入；类型标签对未知值回退显示裸值 `promotion` | **接受展示**（详情页天然是弹窗 CTA 的落地页，列表可见无实害），补齐标签 |
| 详情页"相关推荐" | 取最新 4 条不分类型 | 同上，接受 |
| 站内搜索（`run-search.ts`） | 会命中 | 接受 |
| sitemap | **不受影响**（sitemap 只枚举 cases/blog/news/solutions，不含 trade-shows） | 无需处理 |

补齐标签的配套改动（计入工时）：

- `apps/admin/src/features/constants.tsx` 的 `TRADE_SHOW_TYPE_OPTIONS` 加 `{ label: '营销活动', value: 'promotion' }`
- `apps/web/src/lib/content-labels.ts` 的 `TRADE_SHOW_TYPE_OPTIONS` / `TRADE_SHOW_TYPE_ALIASES` 同步
- web 三语 messages 的 trade-shows `types` 命名空间补 `promotion` key（zh-CN / en / zh-TW）
- API `findAll` 的 `@ApiQuery` eventType 描述与 `CreateTradeShowDto.eventType` 的 `@ApiPropertyOptional` 描述同步更新为 `exhibition|seminar|roadshow|promotion`

> 若日后运营反馈"促销不该出现在展会列表"，再在 web 列表页查询侧排除（一行参数），不动 API 默认行为——`findAll` 同时服务 admin 列表，改默认行为会把 promotion 从后台列表藏掉。

---

## 7. 安全与性能

| 面 | 措施 | 依据 |
|----|------|------|
| 公开读接口 | 30s 服务内存缓存 + `Cache-Control: public, max-age=30`（十三轮 #81：同步 §4.1 去 s-maxage）；全局 120 次/分/IP 限流兜底 | 表仅几十行 + 缓存，50 QPS 下 P99 < 100ms 轻松达标 |
| 计数接口防刷 | `@Throttle` 30 次/分/IP + `updateMany` 条件校验（仅已发布营销活动可计数）；接受计数为"趋势参考"而非审计级精确 | 同 analytics collect 的既有口径 |
| XSS | 渲染侧单层防线：`MarkdownBody` rehypeSanitize（现有，唯一合法渲染路径）；写入侧 `sanitizeMarkdown` 仅规范化非消毒，库内存原文（十轮 #55 如实化） | 零新增依赖 |
| 计数完整性 | create/update 显式剔除计数键（十轮 #53：全局 whitelist 关闭期间未声明属性可直达数据库），计数只走 `increment` | main.ts TODO 未修前的必要防线 |
| 弹窗滥用体验 | 频次控制默认 session + 发布流程人工把关；单活动展示（take 1） | — |
| **SEO 侵入式插页风险（八轮）** | Google 对移动端落地即遮挡主内容的弹窗降权，百度落地页白皮书更严；且爬虫无 sessionStorage 持久性，频次控制对其无效。缓解：渲染体非满屏 + 三途径易关闭（§6.2 约束），运营指引移动端避免 immediate（§5.2 help）；技术手段（搜索来源/爬虫 UA 跳过）进 Backlog，排名数据驱动 | 本项目 SEO 为获客主战场（docs/web-seo-assessment-and-plan.md） |
| **广告合规（九轮）** | 弹出广告须显著标明关闭标志、一键关闭，不得影响用户正常使用；文案禁绝对化用语。localStorage 仅存频次标记无个人信息，不触发 PIPL 单独同意 | 《广告法》44/9 条、《互联网广告管理办法》10 条；站点有 ICP 备案、主营国内 |
| 日志 | API 侧一律 Nest `Logger`，禁止 console.*（AGENTS.md） | — |

**明确不做**：CSRF token（项目公开端点无此机制，限流 + 校验即可）；Redis；buffer 批量写。

---

## 8. 部署

- 本地：`prisma:push`（§3.2）；生产：手写迁移 SQL 随 deploy.sh `migrate deploy` 自动应用
- 部署顺序安全（六轮确认）：deploy.sh 先以新 tag api 镜像跑 `migrate deploy`，成功后才滚动更新 api→admin/web；新列全带默认值，迁移与新代码之间的窗口期内旧代码兼容；迁移失败即中止，不重启容器
- 环境变量：**无新增**；CORS **零变更**（API 为 `CORS_ORIGINS` 白名单，web 域名已在列——analytics 客户端直连先例）
- CI：新端点已标 `@Public()`，`check-permissions.mjs` 通过（十三轮确认：该脚本为自动扫描非白名单，无需登记）；无新依赖，lockfile 不变。⚠️ 十三轮 #77：ci.yml「Build & Test」步骤实际只执行 build，**仓库 CI 现不跑任何单测**——本方案新增测试仅本地验证；接入 CI（turbo test 任务已定义，接线成本低）属独立事项不入本方案
- 测量注记（八轮，十三轮 #80 修正归因）：C 端 Lighthouse 非卡口——ci.yml 有 lighthouse-web job 但 `continue-on-error: true` 不阻断（perf.yml 另侧仅测 admin UI 时延）；日后若升为卡口，活动进行中会引入分数噪音，测量选无活动窗口或记录时注明

---

## 9. 验收标准

- [ ] `prisma:push` 本地同步成功；生产迁移 SQL 评审通过（A1）
- [ ] admin：`isMarketing` 开关联动显隐营销字段；其余 5 个资源表单回归无变化
- [ ] C 端展会列表页 / admin 列表中 `promotion` 显示"营销活动"标签（三语），不出现裸值 `promotion`
- [ ] C 端：已发布 + 时间窗口内（`startDate/endDate`）的营销活动按触发方式弹出；窗口外/草稿不弹
- [ ] 频次控制生效：session 刷新不重弹（同会话）、daily 当日不重弹、once 永不重弹
- [ ] `excludePages` 对全部 locale（zh-CN / en / zh-TW）均正确匹配；设备过滤生效
- [ ] 弹窗打开 → `popupViewCount` +1；CTA 点击 → `popupClickCount` +1；后台列表可见；PUT 请求体携带计数字段被剔除不生效（十轮 #53；十三轮 #78 操作提示：admin 表单不发计数字段，须登录接口取 token 后 curl PUT 带 `popupViewCount` 字段，复查列表值未变）
- [ ] 对草稿/非营销/窗口外活动 POST popup-event 返回 404；限流超阈值返回 429
- [ ] 公开 `GET /trade-shows` 列表与 `GET :slug` 详情不返回营销配置与 popup 计数字段；后台（带 token）仍返回全量
- [ ] DTO 校验：`ctaUrl` 拒绝非 http(s)/站内路径（如 `javascript:`）及协议相对 `//` 与 `/\` 变体（十一轮 #61）；`excludePages` 拒绝不以 / 开头的路径
- [ ] 关闭弹窗有出场动画（无遮罩瞬闪），渲染体保持挂载、open 受控（十一轮 #62）
- [ ] endDate 只选日期（默认当天 09:00，十二轮 #71 勘误）时结束日 09:00 后不弹属预期语义；后台 endDate help 已注明 23:59 用法（十一轮 #60）
- [ ] 迁移 SQL `excludePages` 列不带 NOT NULL，与本地 db push 产物一致（information_schema 比对无漂移，十二轮 #70）
- [ ] admin：清空延时秒数后切换触发方式，表单仍可正常提交（隐藏字段不卡 zod 校验）
- [ ] XSS：正文注入 `<script>` 在弹窗中不执行
- [ ] a11y：ESC / 关闭按钮 / 遮罩三途径可关；焦点困于弹窗内且关闭后还原；移动端弹窗不满屏（≤ ~70% 视口高）。ESC 项手动验收（十五轮 #89：Base UI escape 仅响应真实按键，合成 KeyboardEvent 无效，勿写自动化断言，见 docs/design/b1-base-ui-migration.md 第 3 批验收注记）
- [ ] bundle：无活动时全站不加载弹窗渲染体 chunk（react-markdown/Dialog），Network 面板核对
- [ ] `GET marketing/active` 性能：实现完成后对本地 dev 服务执行一次性 `pnpm dlx autocannon -c 10 -R 50 -d 30 <url>`，P99 < 100ms，结果记入 PR 描述（十三轮 #75：仓库无常驻压测工具，pnpm dlx 有 ci.yml LHCI 先例）

### 9.1 实施散点 checklist（十五轮 #86）

全篇「实现时须…」类一句话要求的汇总视图，按实施顺序分组；**正文各节仍为唯一口径源**，本表只做索引防漏：

1. **Schema/迁移**：`excludePages` 列不带 NOT NULL（§3.2 #70）；本地只走 `prisma:push` 严禁 migrate dev/reset（§3.2）
2. **DTO**：文件头补 IsIn/Max/Matches/IsArray 导入（#31/#85）；ctaUrl 正则含 `(?![/\\])`（#61）；excludePages `@Matches(/^\//, { each })`（#23）
3. **API**：`@Header` 从 @nestjs/common 导入（§4.1）；缓存失效挂 create/update/delete 三处（§4.1）；`updateMany` 补时间窗口条件（#26）；计数键剔除含既有 `viewCount`（#53）；`INTERNAL_KEYS` +10 字段 & findOne 公开访问补 strip（#34/#39）；新端点标 `@Public()` 且装饰器与 HTTP 方法同块书写（check-permissions 按相邻行收集）
4. **admin**：`visibleWhen` 纯显示过滤（#20）；zod 宽松 + preprocess 药方（§5.1 #21/#69）；fields/zod 键集合一致（#73）；`toForm` 补 `join(', ')` 与全字段回填、defaults 同步（#22）；`TradeShowItem` +10 字段（#29）；endDate help 09:00/23:59 口径（#60/#71）；CTR 列头 tooltip（#79）；6 资源回归（§10）
5. **web**：薄壳 + dynamic 懒加载、命中后预热 import（#41/#42/#43）；`open` 受控透传、薄壳保持挂载（#62）；频次函数提取 `marketing/frequency.ts` 导出（#76）；pruneEntries 按 lastShownAt 删最旧（#33）；view 上报挂渲染体挂载后 + sendBeacon 优先（#66/#67）；scroll 短页回退 3s（#57）；excludePages 双侧去尾斜杠归一（#58）；json 后 cancelled 复查（#65）；读侧 try/catch + IIFE 兜底 catch（#56）；非满屏 ≤70% + 三途径易关（法定，#47/#50）；初始焦点/reduced-motion/关闭焦点还原（#48）
6. **i18n/标签**：admin `constants.tsx` + web `content-labels.ts` + 三语 messages + eventType 两处 description 同步（#19/#31，§6.4）
7. **验收**：autocannon 结果记入 PR（#75）；curl PUT 计数剔除验证（#78）；ESC 手动验收（#89）

---

## 10. 工时估算（如实版）

| 任务 | 工时 |
|------|------|
| Schema 变更 + DTO 扩展 + 手写迁移 SQL | 1.5h |
| API：marketing/active + popup-event + 缓存失效 | 2.5h |
| API：公开接口营销字段剥离（INTERNAL_KEYS + findOne strip） | 0.5h |
| admin：ResourceForm `visibleWhen` 通用支持 + 6 资源回归 | 3h |
| admin：tradeShows 配置（字段/列/zod/defaults） | 1.5h |
| web：MarketingPopup 组件 + layout 集成 | 3.5h |
| promotion 类型标签补齐（admin constants + web content-labels + 三语 messages） | 1h |
| 单元测试（service 过滤与计数、频次函数——含提取独立模块导出 + storage stub，十三轮 #76；api jest / web vitest 基建已就绪无搭建成本） | 2h |
| 联调 + 验收清单过一遍 | 2h |
| **合计** | **17.5h ≈ 2 人日**（含风险缓冲 ≈ **2.5~3 人日**） |

> v2.1 的"9.5h"未计入 ResourceForm 通用改造回归、i18n 处理与曝光计数闭环，不采信。
>
> v2.3 的 8 项修正均为实现级微调（DTO 两行正则、where 两行条件、zod 口径、清理函数），不改架构；v2.5 因公开面字段剥离 +0.5h，合计 17.5h。

---

## 11. Backlog（数据驱动，按需迭代）

| 功能 | 触发条件 |
|------|---------|
| banner / landing 展示形态 | 运营明确提出需求 |
| per-locale 弹窗文案 | 海外流量占比显著且运营反馈 |
| 点击明细日志（ClickLog 表） | 需要按访客/时段分析时 |
| A/B 测试、复杂 targeting | 有真实实验需求后评估 |
| 搜索来源/爬虫 UA 跳过弹窗、exit-intent 触发 | 自然搜索流量排名出现可归因于弹窗的下降时（现靠 §6.2 约束 + §5.2 运营指引缓解） |
| 独立 Stats 看板（十四轮 #83 补录） | 计数列表列（§5.2）不够用、需要趋势图/多活动对比时 |
| 弹窗发布前预览 | 运营实际配置出错反馈后（现靠后台可随时关闭兜底，约 30~60 秒内全量生效，见 §4.1/§5.3） |

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.1 | 2026-07-31 | TradeShow 扩展方案（评审发现 17 项问题，废弃） |
| v2.2 | 2026-07-31 | 评审修订：修复全部阻塞问题，砍冗余依赖与虚假承诺，对齐代码库既有约定；二轮自审补 3 项（响应包装解析、promotion 内容面外溢决策、visibleWhen 简化） |
| v2.3 | 2026-07-31 | 三轮核查（20 项声明逐条对码验证）补 8 项：隐藏字段 zod 宽松铁律、excludePages 表单口径/路径校验、ctaUrl 协议校验、计数接口时间窗口、定时发布缓存例外、excludePages 首载语义明示、constants.tsx 笔误、组件清理 |
| v2.4 | 2026-07-31 | 四轮收尾核查补 5 项 P3：TradeShowItem 类型补齐、web 首次引入 Dialog 注记、eventType DTO 现状澄清与 description 同步、CORS 零变更确认、pruneEntries 实现说明 |
| **v2.5** | 2026-07-31 | 五轮行为语义审查：修复 P2 公开面外泄（INTERNAL_KEYS + findOne strip，+0.5h）、弹窗预览限制决策入 §5.3、迁移 SQL 数组默认值对齐既有风格；另 2 项正面确认（详情页条件渲染、admin 列表全量字段） |
| **v2.6** | 2026-07-31 | 六轮定点核查：确认 findOne 剥离可实现（controller 已有 includeUnpublished 判别）与部署顺序安全（新镜像先迁移后滚动更新）；补 P3 bundle 拆分（薄壳 + next/dynamic 懒加载渲染体） |
| **v2.7** | 2026-07-31 | 七轮文档自洽性审计：草图对齐 bundle 拆分（薄壳 return 懒加载渲染体）、chunk 预热时机修正、excludePages help 与回显格式对齐、计数接口双重包装注记、验收三语措辞；均为措辞/实现建议级 |
| **v2.8** | 2026-07-31 | 八轮业务副作用审查：补 P2 SEO 侵入式插页风险（渲染体非满屏/易关闭约束 + 运营指引 + Backlog 爬虫跳过）、a11y 约束与验收项、Lighthouse 测量噪音注记 |
| **v2.9** | 2026-07-31 | 九轮广告合规审查：关闭能力升格为法定要求（广告法 44 条/互联网广告管理办法 10 条，不得为转化优化移除）、文案绝对化用语禁用注记、PIPL 零触发正面确认 |
| **v3.0** | 2026-07-31 | 十轮独立冷启动评审（无前置结论的独立代理对码复核）：修 P2 计数篡改（whitelist:false + update 展开，create/update 显式剔除计数键）；勘误 v2.2 #3 路由顺序硬约束（误诊）；sanitizeMarkdown 表述如实化；草图补读侧 try/catch 与 IIFE 兜底 catch；scroll 短页回退；excludePages 尾斜杠归一 |
| **v3.1** | 2026-07-31 | 十一轮草图代码级评审（第二独立代理把草图当真实代码逐行 review）：修 3 项 P2——endDate 当天失效（help 明示 23:59）、ctaUrl 协议相对绕过（正则补 (?![/\\])）、受控 Dialog 卸载冲突（open 透传、薄壳保持挂载）；另修 json 后 cancelled 复查、view 上报挪渲染体挂载后 + sendBeacon 先例对齐、s-maxage 去除、orderBy nulls last、zod 药方 preprocess 勘误；工时 17.5h 不变；待 A1 审批 schema |
| **v3.2** | 2026-07-31 | 十二轮 admin 链路 + 迁移/部署专项（第三独立代理 + 控件源码亲验）：修 P2 迁移 SQL excludePages NOT NULL 漂移（Prisma 数组列 DDL 不带 NOT NULL）；勘误 #60 时刻（DateTimePicker 默认 09:00 而非 00:00，help/验收同步）；实锤 tags 字符串口径（customers 数组口径系既有 bug，另行处理）；补 fields/zod 键集合一致自查项；#21「表单卡死」措辞如实化；部署链路与模型零冲突逐行确认；工时 17.5h 不变 |
| **v3.3** | 2026-07-31 | 十三轮验收/测试可执行性专项（第四独立代理审元问题）：修 P2 压测项零工具（改 pnpm dlx autocannon 一次性验证）、P2 频次函数单测形态冲突（提取导出 + storage stub）；补 CI 不跑单测注记、PUT 验收操作提示、CTR 口径集中声明、Lighthouse 归因修正；自查修 §7 s-maxage 残留（十一轮 #67 落盘遗漏）；正面确认两端测试基建齐备、2h 估算成立；工时 17.5h 不变 |
| **v3.4** | 2026-07-31 | 十四轮修订完整性审计（第五独立代理把 §0 的 81 项修订记录当审计对象）：确认 76 项完全落盘、0 项未落盘、热点交叉引用（缓存 30s/09:00/17.5h/10 字段/频次口径/性能口径）全部一致、编号连续且轮次↔版本映射无误、多轮叠加无互相冲掉；修 1 项部分落盘残留（#59「秒级回滚」→ §5.3/§11 同步为 30~60 秒口径）、§1 排除清单归属标注 + §11 补 Stats 看板、「前版」括注归属约定、§4.3 导入提醒补齐；工时 17.5h 不变 |
| **v3.5** | 2026-07-31 | 十五轮前提脆弱性与实施窗口冲突审查（第六独立代理审方案对代码库现状的依赖前提）：确认 10 类前提中 8 类稳定（Dialog 迁移已完结、部署/CI 无进行中改造、实施顺序可无歧义推导）；修 P2 散点要求无汇总（新增 §9.1 实施散点 checklist 七组索引）、customers 修复方向约束（保持 TagsInput 字符串契约）、whitelist 开启后文档回收跟进项；补 Base UI escape 仅响应真实按键验收注记、SEO 预览路由解耦观察注记；工时 17.5h 不变 |
