# 营销弹窗 CTA 在坐席 away 状态下未触发聊天而跳转页面

> 日期：2026-08-03
> 状态：待修复
> 影响范围：www.tzjii.com（C 端营销弹窗「领取活动权益」按钮）
> 相关文件：`apps/web/src/components/marketing/MarketingPopup.tsx`

---

## 一、问题现象

用户反馈：明明有客服在线，点击营销弹窗的「领取活动权益」按钮后，没有打开客服聊天面板，而是直接跳转到了活动详情页。

---

## 二、排查过程与关键证据

### 证据 1：网关日志——API 请求正常返回 200

```
111.205.43.243 - - [03/Aug/2026:07:25:41 +0000]
  "GET /api/v1/chat-rooms/agent-availability HTTP/2.0" 200 162
  "https://www.tzjii.com/"
```

`agent-availability` 端点返回 **200**，响应体 162 字节，说明 API 本身工作正常，不存在网络/CORS/500 等问题。

### 证据 2：API 实际返回数据——坐席状态为 away

```bash
docker exec tzj-api-1 node -e \
  "fetch('http://localhost:4000/api/v1/chat-rooms/agent-availability')
   .then(r=>r.json())
   .then(d=>console.log(JSON.stringify(d,null,2)))"
```

```json
{
  "success": true,
  "data": {
    "online": 0,
    "away": 1,
    "lastOnlineAt": 1785741901599
  }
}
```

**坐席状态是 `away`（离开），不是 `online`（在线）。** `away` 坐席仍然持有存活的 Socket.IO 连接，可以接收消息（代码注释明确写了"away 坐席仍可接消息不算无人"）。

---

## 三、根因分析

### 3.1 直接原因：CTA 路由条件未覆盖 away 状态

[MarketingPopup.tsx](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/components/marketing/MarketingPopup.tsx#L124-L144) 的 `onCta` 函数有三级智能路由：

```typescript
const onCta = async () => {
  sendPopupEvent(activity.id, 'click');
  const avail = await fetchAgentAvailability().catch(() => null);

  // 分支 1：有客服在线 → 打开聊天面板
  if (avail && avail.online > 0) {          // ← away 时 online===0，不满足
    setOpen(false);
    openChat({ message: ... });
    return;
  }

  // 分支 2：完全无人 + 可拨号设备 → 唤起拨号
  if (avail && avail.online + avail.away === 0 && phone?.trim() && isDialableMobile()) {
    // ← away===1，总和为 1，不满足
    window.location.href = `tel:${phone}`;
    return;
  }

  // 分支 3：兜底 → 页面跳转
  if (activity.externalUrl?.trim()) {
    window.open(activity.externalUrl, '_blank', 'noopener');
  } else {
    router.push(`/resources/trade-shows/${activity.slug}`);  // ← 落入了这里
  }
  setOpen(false);
};
```

**问题链路：**

| 步骤 | 条件 | 结果 |
|------|------|------|
| 分支 1 | `avail.online > 0` | `0 > 0` → **false**，跳过 |
| 分支 2 | `avail.online + avail.away === 0` | `0 + 1 === 0` → **false**，跳过 |
| 分支 3（兜底） | 无条件 | **执行页面跳转** |

坐席处于 `away` 状态时，前两个分支都不满足，代码直接落入兜底的页面跳转逻辑。

### 3.2 深层原因：与 C 端聊天挂件的在线判定口径不一致

C 端聊天挂件通过 `useAgentPresence` hook 展示坐席状态，内含 **90 秒 away 防抖宽限**（[useAgentPresence.ts L148](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/features/chat/useAgentPresence.ts#L148) + [presence.ts L18-L22](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/features/chat/presence.ts#L18-L22)）：

```typescript
// useAgentPresence.ts — away 持续超过 90 秒才在访客侧降级
const AWAY_DISPLAY_GRACE_MS = 90_000;

// presence.ts — 瞬时 away 仍呈现为 online
if (status === 'away') return stableAway ? 'away' : 'online';
```

而营销弹窗 CTA 直接调用 `fetchAgentAvailability()` 获取**服务端原始计数**，用 `avail.online > 0` 做判断，完全绕过了这套宽限逻辑。

**导致矛盾体验：**

| 场景 | 聊天挂件显示 | 营销弹窗 CTA 行为 |
|------|-------------|------------------|
| 坐席 `away`（< 90s） | 🟢 在线 | ❌ 页面跳转（`online===0`） |
| 坐席 `away`（> 90s） |  离开中 | ❌ 页面跳转（`online===0`） |
| 坐席 `online` | 🟢 在线 | ✅ 打开聊天 |

访客看到聊天挂件显示「在线客服」，点击营销弹窗的「领取活动权益」却跳转到活动页——两个入口对「在线」的定义不同。

---

## 四、解决方案

### 方案：分支 1 条件扩展为 `online + away > 0`

`away` 坐席持有存活连接、可以接收消息，与 `online` 坐席在「能否接待聊天」这一点上没有本质区别。应将分支 1 的判定口径与分支 2 的「完全无人」口径对齐：

```diff
- if (avail && avail.online > 0) {
+ if (avail && avail.online + avail.away > 0) {
    setOpen(false);
    openChat({ message: tCommon('marketingInterest', { title: activity.title }) });
    return;
  }
```

**修改后路由逻辑：**

| 坐席状态 | 分支 1（打开聊天） | 分支 2（拨号） | 分支 3（跳转） |
|----------|-------------------|---------------|---------------|
| `online > 0` | ✅ | — | — |
| `away > 0`（无 online） | ✅ | — | — |
| `online === 0 && away === 0` + 可拨号 | — | ✅ | — |
| `online === 0 && away === 0` + 不可拨号 | — | — | ✅ |

### 一致性说明

此修改与以下现有逻辑保持口径一致：

- `ChatWidget.tryDialInstead`（[L624-L631](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/components/chat/ChatWidget.tsx#L624-L631)）：拨号判定用 `avail.online + avail.away > 0` 判断「有人」
- `agentAggregateStatus`（[chat.gateway.ts L467-L477](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/api/src/support/chat.gateway.ts#L467-L477)）：`anyOnline || anyAway` → 返回 `'online'` 或 `'away'`
- `useAgentPresence.effectivePresence`（[L115-L116](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/features/chat/useAgentPresence.ts#L115-L116)）：`agentsOnline > 0 → online`；`agentsOnline === 0 && agentsAway > 0 → away`（C 端聊天挂件将 away 视为「有人」）
- 代码注释（[L120-L121](file:///Users/gavin/Documents/tzj/tzj-website-reconstruction/apps/web/src/components/marketing/MarketingPopup.tsx#L120-L121)）：「away 坐席仍可接消息不算无人」

> **注意**：营销弹窗 CTA 作为一次性点击动作，不适用 `useAgentPresence` 的 90 秒显示防抖（那是针对持续性 UI 展示的）。但判定「是否有人可接待」时应与聊天挂件使用相同的 `online + away` 口径，避免访客看到「在线客服」却触发页面跳转的矛盾体验。

### 涉及文件

| 文件 | 改动 |
|------|------|
| `apps/web/src/components/marketing/MarketingPopup.tsx` | L127：`avail.online > 0` → `avail.online + avail.away > 0` |

### 验证方式

1. 部署后在管理后台将坐席状态设为 `away`
2. 访问 www.tzjii.com，等待营销弹窗出现
3. 点击「领取活动权益」→ 应打开客服聊天面板并自动发送首条消息
4. 将坐席状态设为 `online` → 同样应打开聊天面板
5. 坐席全部离线 → 应走拨号或页面跳转兜底
