# 「预约咨询」按钮接入实时聊天链路方案

> 日期：2026-08-03
> 状态：**已完成** ✅ — 全站 54 处按钮均已接入智能分流链路（25 处直接页面 + 28 处 CtaBand + 1 处 Footer），仅 404 页面保留原生 `/contact` 链接（待确认）

---

## 1. 背景与目标

### 1.1 现状

C 端全站共有 **54 处**「预约咨询」按钮（25 处直接页面 + 28 处 CtaBand + 1 处 Footer），当前已全部接入与营销弹窗相同的实时聊天三级分流链路：

```
点击 CTA → fetchAgentAvailability()
  ├─ 有坐席在线 (online + away > 0) → openChat({ message }) → 弹出聊天面板 + 自动发送场景化消息
  ├─ 无坐席 + 可拨号手机 → tel: 直接拨号
  └─ 兜底 → 降级到 /contact 联系表单
```

### 1.2 目标（已达成）

1. **点击瞬间** 实时请求坐席可用性（`fetchAgentAvailability()`） ✅
2. **有坐席在线** → 打开客服聊天面板（`openChat()`），自动发送场景化开场消息 ✅
3. **无坐席 + 可拨号移动设备** → 直接唤起拨号（`tel:`） ✅
4. **兜底（真正无人/桌面设备）** → 降级到 `/contact` 联系表单页 ✅

---

## 2. 基础设施

> 全部已实现，零后端变更。

| 模块 | 文件 | 作用 |
|------|------|------|
| 打开聊天面板事件 | `features/chat/open-chat.ts` | `openChat({ message })` → CustomEvent `tzj:chat:open` |
| 坐席可用性查询 | `features/chat/api.ts` → `fetchAgentAvailability()` | 公开端点，无需 token |
| ChatWidget 事件监听 | `components/chat/ChatWidget.tsx` L607-617 | 监听 `OPEN_CHAT_EVENT`，打开面板并自动发送消息 |
| 营销弹窗参考实现 | `components/marketing/MarketingPopup.tsx` L125-144 | 完整的三级分流逻辑（`onCta`） |
| 移动设备检测 | `lib/device.ts` → `isDialableMobile()` | UA 判断是否可拨号 |
| 核心 Hook | `features/chat/use-book-consult-chat.ts` | `useBookConsultChat({ message?, fallbackHref? })` — 三级分流 |
| 智能按钮组件 | `components/chat/BookConsultButton.tsx` | 外观与 `RbButton` 一致，点击走 Hook 分流 |
| 文本链接组件 | `components/chat/BookConsultLink.tsx` | 外观与原 `<Link>` 一致，点击走 Hook 分流 |
| 电话号码 Context | `features/chat/AgentPhoneContext.tsx` | `AgentPhoneProvider` + `useAgentPhone()` — 全局可用 |
| 根 layout 注入 | `app/[locale]/layout.tsx` L117/L153 | `<AgentPhoneProvider phone={siteSettings.contact.phone}>` |
| CtaBand 改造 | `components/sections/blocks.tsx` L221-253 | async server component，`BookConsultButton` + `tCommon('bookConsultGeneral')` 兜底 |
| Footer 改造 | `components/layout/Footer.tsx` L46 | `BookConsultButton variant="light"` + `tCommon('bookConsultFooter')` |

**关键设计**：

- 电话号码来自 `siteSettings.contact.phone`（站点联系信息），**不是** `agentProfile`（客服资料只有 `name / avatar / title / greeting / responseMinutes`，无 `phone` 字段）
- `useBookConsultChat` 内部通过 `useAgentPhone()` Context 自动获取电话，调用方无需逐 prop 透传
- `BookConsultButton` / `BookConsultLink` 均不接受 `phone` prop——所有电话逻辑由 Context + Hook 内部处理

### 2.1 核心 Hook API

```typescript
// features/chat/use-book-consult-chat.ts

interface BookConsultOptions {
  /** 场景化开场消息（不传则仅打开面板，不自动发送消息） */
  message?: string;
  /** 兜底跳转路径（默认 /contact） */
  fallbackHref?: string;
}

export function useBookConsultChat(options: BookConsultOptions = {}) {
  const { message, fallbackHref = '/contact' } = options;
  const phone = useAgentPhone(); // ← 从 AgentPhoneContext 自动获取

  const handleClick = useCallback(async () => {
    const avail = await fetchAgentAvailability().catch(() => null);
    if (avail && avail.online + avail.away > 0) {
      openChat({ message: message?.trim() || undefined });
      return;
    }
    if (avail && avail.online + avail.away === 0 && phone?.trim() && isDialableMobile()) {
      window.location.href = `tel:${phone.replace(/-/g, '')}`;
      return;
    }
    window.location.href = fallbackHref;
  }, [message, fallbackHref, phone]);

  return { handleClick };
}
```

---

## 3. 全站接入清单

### 3.1 场景化开场消息 i18n key（三语已齐）

已在 `messages/{zh-CN,zh-TW,en}.json` 的 `common` 命名空间下定义 6 个 key：

| i18n key | 适用场景 | 中文 | 英文 |
|----------|----------|------|------|
| `bookConsultProduct` | 产品页 Hero / CTA | "您好，我对贵司的训练装备很感兴趣，想进一步了解产品方案和报价。" | "Hi, I'm interested in your training equipment and would like to learn more about products and pricing." |
| `bookConsultContent` | 博客/新闻/展会/FAQ/资源等阅读型页面 | "您好，我阅读了贵司的内容，想进一步咨询交流。" | "Hi, I've read your content and would like to discuss further." |
| `bookConsultCase` | 案例列表 / 案例详情 | "您好，我看了贵司的案例，想了解类似方案的详情。" | "Hi, I've seen your case studies and would like to learn about similar solutions." |
| `bookConsultSolution` | 解决方案详情 | "您好，我对贵司的解决方案感兴趣，想详细咨询。" | "Hi, I'm interested in your solutions and would like a detailed consultation." |
| `bookConsultGeneral` | 通用 CTA / CtaBand / why-us | "您好，我想咨询一下，方便详细介绍吗？" | "Hi, I'd like to make an inquiry. Could you provide more details?" |
| `bookConsultFooter` | Footer CTA | "您好，我想咨询应急救援训练装备相关信息。" | "Hi, I'd like to inquire about emergency rescue training equipment." |

> 另有 `marketingInterest` key（`"我想了解「{title}」"`）仅被营销弹窗 `MarketingPopup.tsx` L130 使用，不属于预约咨询按钮体系。

### 3.2 已接入页面完整清单

**产品页（`bookConsultProduct`）：**

| 页面 | 文件 | 按钮 |
|------|------|------|
| `/burn-rooms` Hero | `burn-rooms/page.tsx` L37 | `BookConsultButton variant="light"` |
| `/burn-rooms` CTA | `burn-rooms/page.tsx` L143 | `BookConsultButton` |
| `/fixed-tower` Hero | `fixed-tower/page.tsx` L58 | `BookConsultButton variant="light"` |
| `/fixed-tower` CTA | `fixed-tower/page.tsx` L163 | `BookConsultButton` |
| `/fixed-tower/series` | `fixed-tower/series/page.tsx` L182 | `BookConsultButton` |
| `/modular-tower` Hero | `modular-tower/page.tsx` L40 | `BookConsultButton variant="light"` |
| `/modular-tower` CTA | `modular-tower/page.tsx` L172 | `BookConsultButton` |
| `/modular-tower/series` | `modular-tower/series/page.tsx` L111 | `BookConsultButton` |
| `/accessories` Hero | `accessories/page.tsx` L74 | `BookConsultButton variant="light"` |
| `/accessories` CTA | `accessories/page.tsx` L197 | `BookConsultButton` |

**内容/阅读型页面（`bookConsultContent`）：**

| 页面 | 文件 | 按钮 |
|------|------|------|
| `/resources` CTA | `resources/page.tsx` L82 | `BookConsultButton` |
| `/resources/blog` CTA | `resources/blog/page.tsx` L202 | `BookConsultButton` |
| `/resources/blog/[slug]` 文中 | `blog/[slug]/page.tsx` L130 | `BookConsultButton` |
| `/resources/blog/[slug]` 底部 | `blog/[slug]/page.tsx` L170 | `BookConsultLink` |
| `/resources/news` CTA | `resources/news/page.tsx` L140 | `BookConsultButton` |
| `/resources/news/[slug]` 文中 | `news/[slug]/page.tsx` L125 | `BookConsultButton` |
| `/resources/news/[slug]` 底部 | `news/[slug]/page.tsx` L165 | `BookConsultLink` |
| `/resources/trade-shows/[slug]` 文中 | `trade-shows/[slug]/page.tsx` L147 | `BookConsultButton` |
| `/resources/trade-shows/[slug]` 底部 | `trade-shows/[slug]/page.tsx` L187 | `BookConsultLink` |
| `/resources/faqs` | `resources/faqs/page.tsx` L56 | `BookConsultButton` |

**案例（`bookConsultCase`）：**

| 页面 | 文件 | 按钮 |
|------|------|------|
| `/cases` CTA | `cases/page.tsx` L174 | `BookConsultButton` |
| `/cases/[slug]` 咨询 | `cases/[slug]/page.tsx` L171 | `BookConsultButton className="w-full"` |
| `/cases/[slug]` 底部 | `cases/[slug]/page.tsx` L182 | `BookConsultLink` |

**解决方案（`bookConsultSolution`）：**

| 页面 | 文件 | 按钮 |
|------|------|------|
| `/solutions/[slug]` CTA | `solutions/[slug]/page.tsx` L213 | `BookConsultButton` |

**通用 / 其他：**

| 页面 | 文件 | 按钮 | i18n key |
|------|------|------|----------|
| `/why-us` CTA | `why-us/page.tsx` L146 | `BookConsultButton` | `bookConsultGeneral` |
| Footer CTA | `components/layout/Footer.tsx` L46 | `BookConsultButton variant="light"` | `bookConsultFooter` |
| CtaBand（28 处） | `components/sections/blocks.tsx` L246 | `BookConsultButton` | `primaryMessage ?? bookConsultGeneral` |

<details>
<summary>CtaBand 28 处使用页面完整清单</summary>

**产品子页（14 处）：**

| 页面 | 文件 |
|------|------|
| `/accessories/competition` | `accessories/competition/page.tsx` L131 |
| `/accessories/fitness-equipment` | `accessories/fitness-equipment/page.tsx` L135 |
| `/accessories/hazmat` | `accessories/hazmat/page.tsx` L142 |
| `/accessories/maritime` | `accessories/maritime/page.tsx` L175 |
| `/accessories/tactical` | `accessories/tactical/page.tsx` L140 |
| `/burn-rooms/cfbt` | `burn-rooms/cfbt/page.tsx` L128 |
| `/burn-rooms/comparison` | `burn-rooms/comparison/page.tsx` L95 |
| `/burn-rooms/fire-simulation` | `burn-rooms/fire-simulation/page.tsx` L131 |
| `/burn-rooms/liner` | `burn-rooms/liner/page.tsx` L129 |
| `/fixed-tower/climbing-tower` | `fixed-tower/climbing-tower/page.tsx` L124 |
| `/fixed-tower/custom` | `fixed-tower/custom/page.tsx` L77 |
| `/modular-tower/custom` | `modular-tower/custom/page.tsx` L92 |
| `/modular-tower/vs-containers` | `modular-tower/vs-containers/page.tsx` L93 |
| `/towers` | `towers/page.tsx` L50 |

**内容/资源页（6 处）：**

| 页面 | 文件 |
|------|------|
| `/education-center` | `education-center/page.tsx` L122 |
| `/resources/design-center` | `resources/design-center/page.tsx` L109 |
| `/resources/how-to-buy` | `resources/how-to-buy/page.tsx` L111 |
| `/resources/inspections` | `resources/inspections/page.tsx` L134 |
| `/resources/trade-shows` | `resources/trade-shows/page.tsx` L192 |
| `/resources/warranty` | `resources/warranty/page.tsx` L131 |

**解决方案（1 处）：**

| 页面 | 文件 |
|------|------|
| `/solutions` | `solutions/page.tsx` L88 |

**专业培训（3 处）：**

| 页面 | 文件 |
|------|------|
| `/specialized-training` | `specialized-training/page.tsx` L79 |
| `/specialized-training/psychological` | `specialized-training/psychological/page.tsx` L128 |
| `/specialized-training/rope-rescue` | `specialized-training/rope-rescue/page.tsx` L128 |

**为什么选择我们（4 处）：**

| 页面 | 文件 |
|------|------|
| `/why-us/certification` | `why-us/certification/page.tsx` L65 |
| `/why-us/global` | `why-us/global/page.tsx` L119 |
| `/why-us/story` | `why-us/story/page.tsx` L89 |
| `/why-us/team` | `why-us/team/page.tsx` L66 |

> 所有 CtaBand 均显式传入 `primaryLabel={tCta('bookConsult')}`，按钮文案统一为「预约咨询」。`primaryMessage` 均未传，因此全部走 `bookConsultGeneral` 兜底。

</details>

**未迁移（待确认）：**

| 页面 | 文件 | 行号 | 当前代码 | 说明 |
|------|------|------|----------|------|
| 404 | `app/[locale]/not-found.tsx` | L16 | `<Link href="/contact">` | 404 场景保留跳转表单可能更合适 |

---

## 4. 关键设计决策

### 4.1 为什么不直接改 `RbButton`？

`RbButton` 是纯 UI 组件，被大量用于非咨询场景（"查看更多"、"下载 PDF" 等）。将聊天逻辑耦合进去会破坏其通用性。保持 `RbButton` 纯粹，通过 `BookConsultButton` 组合复用更合理。

### 4.2 为什么保留 `/contact` 作为兜底？

无坐席在线 + 非移动设备时，联系表单仍是有效的转化渠道。完全移除 `/contact` 会导致这部分访客无路可走。

### 4.3 为什么用 CustomEvent 而非直接调用 ChatWidget 方法？

`ChatWidget` 挂载在全站 layout，但任意页面组件无法直接引用其内部状态。`openChat()` 通过 `window.CustomEvent` 解耦，是项目中已有的成熟模式（营销弹窗已使用），保持一致性。

### 4.4 电话号码为什么用 Context 而非 prop 传递？

54 处逐个传 `phone` prop 容易遗漏且冗余。Context 一次注册、全局消费，符合 React 最佳实践。且 `ChatWidget` 和 `MarketingPopup` 已在消费同一数据源（`siteSettings.contact.phone`），提取为 Context 不增加复杂度。

### 4.5 CtaBand 为什么是 async server component？

CtaBand 需要调用 `getTranslations('common')` 获取 i18n 文案作为 `BookConsultButton` 的 `message` 兜底值。Next.js 中 `getTranslations` 是 async 服务端 API，因此 CtaBand 必须声明为 `async function`。`BookConsultButton` 作为 `'use client'` 组件接收序列化后的 `message` string prop，无冲突。

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `fetchAgentAvailability()` 请求失败 | 无法判断坐席状态 | `.catch(() => null)` 后直接降级到 `/contact`，不阻断用户 |
| 聊天面板加载延迟（懒加载 chunk） | 点击后短暂等待 | ChatWidget chunk 在首次营销弹窗触发时已预热缓存；且 `openChat` 事件在 ChatWidget 挂载后即可响应 |
| 未来新增页面遗漏接入 | 新页面仍走 `/contact` 跳转 | 新增 CTA 按钮时优先使用 `BookConsultButton`；Code Review 检查 |
| 场景化消息需随业务迭代 | 文案可能需要调整 | i18n key 集中在 `common` 命名空间，修改一处全局生效 |

---

## 6. 未来扩展

- **A/B 测试**：可通过 feature flag 控制「预约咨询」走聊天 vs 表单，对比转化率
- **智能消息模板**：结合 URL path + 页面 title 自动生成更精准的开场白（如案例页自动带入案例标题）
- **离线留言模式**：无坐席时不降级到表单，而是在聊天面板内留言（类似 Intercom 的 offline 模式）
- **404 页面决策**：确认 404 页面的 `/contact` 链接是否也需要接入聊天链路
