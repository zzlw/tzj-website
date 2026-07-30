# C 端网站 Bot 防护方案

> **版本**: v1.5（代码级核查：三项 P0 已在代码中落地，状态转为待验收）  
> **约束条件**（第一约束，全文决策均以此为前提）:  
> - 小而美团队，后台用户 ≤ 100 人  
> - 服务器：2 核 2G，单实例部署（经 `docker-compose.prod.yml` 确认）  
> - 默认不启用第三方服务（阿里云验证码已集成，作为应急闸门默认关闭）  
> - **防止过度设计**（简洁实用优先）  
> **评估范围**: C 端询盘表单（`apps/web` → `POST /api/v1/contact`）

---

## 执行摘要

### 已有防护

| 防线 | 说明 | 局限 |
|------|------|------|
| 全局限流 120 次/分/IP | `ThrottlerModule` + `ClientIpThrottlerGuard`，覆盖所有路由 | 对 contact 而言过于宽松 |
| 前端 HoneyPot | 隐藏 `website` 字段，触发后静默成功不发请求 | **仅拦浏览器 bot**，直连脚本不经过 |
| 阿里云验证码闸门 | `AliyunCaptchaService`，后台开关启用，零代码改动 | 默认关闭 |
| IP 封禁 | `IpBanGuard` + admin 面板，手动封禁攻击源 | 被动响应 |
| Helmet.js | HTTP 安全头 | — |
| `extractClientIp` | 仅受信代理才采信 XFF | ~~nginx XFF 首段伪造漏洞~~（P0-1 已修复） |

### P0 实施状态（v1.5 代码级核实：全部已落地 ✅）

| 优先级 | 改动 | 文件 | 状态 |
|--------|------|------|------|
| **P0-1** | nginx XFF 覆写为 `$remote_addr` | `infra/docker/nginx/templates/tzj.conf.template` (3 处) | ✅ 已修改 |
| **P0-2** | Contact 专属限流 `@Throttle 5次/分` | `apps/api/src/contact/contact.controller.ts` (2 行：import + 装饰器) | ✅ 已修改 |
| **P0-3** | 前端 429 专属提示 | `apps/web/src/components/sections/ContactSection.tsx` + i18n 三语 `tooFrequent` | ✅ 已修改 |

> 按依赖顺序排列：P0-1 是 P0-2 生效的前提。三项改动待部署后按「三、验收」逐项核验。

---

## 一、威胁模型

| # | 攻击类型 | 风险 | 对应防线 |
|---|---------|------|---------|
| 1 | XFF 首段伪造绕过所有 IP 防线 | 🔴 高 | P0-1 nginx 修复 |
| 2 | 直连 POST 批量 spam | 🔴 高 | P0-2 专属限流 |
| 3 | 浏览器自动化填表 | 🟡 中 | HoneyPot（已有） |
| 4 | API 滥用 / 简单 DoS | 🟡 中 | 全局 120 次/分 + P0-2 收紧 |
| 5 | XSS 注入（message 存储型） | 🟡 中 | P1: 后端 sanitize |
| 6 | 换 IP 池 / 打码农场 | 🟢 低 | 验证码闸门 + IP 封禁 + 人工兜底 |

**XFF 伪造攻击链**（v1.3 发现，v1.5 已随 P0-1 修复，保留供验收对照）:
```
攻击者带 X-Forwarded-For: fake-ip 直连 nginx
  → nginx 追加: "fake-ip, real-ip"（$proxy_add_x_forwarded_for）
  → API 直连方为 docker 私网（受信）→ extractClientIp 取首段 = fake-ip
  → 每请求换伪造 IP → 无限绕过限流、封禁、污染审计
```

---

## 二、实施方案

### P0-1: 修复 nginx XFF 首段伪造漏洞

**文件**: `infra/docker/nginx/templates/tzj.conf.template`

**现状**（3 处 server block 均为）:
```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

**修复**（边缘第一跳覆写为 socket 地址）:
```nginx
proxy_set_header X-Forwarded-For $remote_addr;
```

- 本架构 nginx 为唯一入口（无上游 CDN/LB），`$remote_addr` 即真实客户端 IP
- 影响：`extractClientIp` / `IpBanGuard` / `AuditLog` / `Throttler` / 访客归因全部修正
- 若未来加 CDN，需在 CDN 与 nginx 间用 `set_real_ip_from` + `real_ip_header` 处理
- 相关文件：生产以 `infra/docker/nginx/templates/tzj.conf.template` 为准（compose gateway）；宿主机弃用版 nginx 配置已删除

**验证**:
```bash
# 伪造 XFF 连续 6 次，第 6 次应返回 429（证明伪造 IP 被忽略）
for i in {1..6}; do
  curl -s -o /dev/null -w "$i: %{http_code}\n" \
    -H "X-Forwarded-For: 1.2.3.$i" \
    -X POST https://api.tzjii.com/api/v1/contact \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","phone":"13800138000","message":"Test"}'
done
```

---

### P0-2: Contact Controller 专属限流

**文件**: `apps/api/src/contact/contact.controller.ts`

```typescript
import { Throttle } from '@nestjs/throttler';

@Public()
@Throttle({ default: { limit: 5, ttl: 60_000 } }) // 每 IP 每分钟最多 5 次
@Post()
@ApiOperation({ summary: '提交联系信息（官网留言）' })
async create(
  @Body() dto: CreateContactDto,
  @Headers('x-captcha-verify-param') captchaVerifyParam: string | undefined,
) {
  await this.aliyunCaptchaService.verify(captchaVerifyParam);
  return this.contactService.create(dto);
}
```

**参数依据**:
- `limit: 5`: 真实用户不可能 1 分钟提交 5 次询盘
- `ClientIpThrottlerGuard` 已全局注册，`@Throttle` 即插即用
- 配额余量：`fetchApi` 超时 POST 最多重试 3 次/次提交（429 不重试），`limit: 5` 已留余量
- 先例：`two-factor.controller.ts` 已用相同的 5 次/分 `STRICT_THROTTLE`，风格一致

---

### P0-3: 前端 429 专属提示

**文件**: `apps/web/src/components/sections/ContactSection.tsx`

现状 `catch {}` 吞掉所有错误统一显示 `t('status.error')`。补充 429 分支：

```tsx
} catch (err) {
  setStatus('error');
  setStatusMessage(
    err instanceof ApiError && err.status === 429
      ? t('status.tooFrequent') // 新增 i18n key（三语）
      : t('status.error'),
  );
  return false;
}
```

**i18n 新增** (`apps/web/src/messages/{en,zh-CN,zh-TW}.json`):
- en: `"tooFrequent": "Too many submissions. Please try again later."`
- zh-CN: `"tooFrequent": "提交过于频繁，请稍后再试"`
- zh-TW: `"tooFrequent": "提交過於頻繁，請稍後再試"`

> `ApiError` 已从 `apps/web/src/lib/api.ts` 导出，可直接使用。

---

### 持续攻击升级路径（零开发）

| 级别 | 手段 | 操作 |
|------|------|------|
| 1 | P0 专属限流 | 默认常开 |
| 2 | 阿里云验证码闸门 | admin「集成管理」开启，前端 `useAliyunCaptchaConfig` 自动联动，**无需发版** |
| 3 | IP 封禁 | admin「安全防护」面板手动封禁 |
| 4 | 收紧全局限流 | 调 `THROTTLE_LIMIT` / `THROTTLE_TTL` 环境变量后重启 |

---

### 明确不做

PoW 验证码、自研滑块、Redis 限流、默认开启第三方验证码、后端时间戳校验（客户端自报可选字段，100% 可绕过）。

### P1（按需）

| 项 | 触发条件 |
|----|---------|
| Message XSS 过滤（后端 sanitize） | Admin 富文本渲染询盘内容时 |
| 限流拦截日志（warn 级） | 需要观测效果时 |

### P2（默认不做）

| 项 | 触发条件 |
|----|---------|
| 前端 <3 秒提交提示 + 防抖 | 用户连点误触限流反馈时 |
| HoneyPot 后端化 | 浏览器 bot 直接回放 payload 时 |
| HoneyPot 动态字段名 | 单一字段被大量绕过时 |

---

## 三、验收

### 生产上线验收（强制，不通过禁止上线）

| 验收项 | 方法 | 预期 |
|-------|------|------|
| XFF 伪造已修复 | 带伪造 XFF 连续提交 6 次 | 第 6 次 429（伪造 IP 被忽略） |
| 限流口径为真实客户端 IP | 两台不同网络设备各提交 5 次 | 各自独立 429，互不挤兑 |
| 来源 IP 正确 | 提交后查 admin 询盘详情来源 IP | 显示访客公网 IP |
| 429 前端提示 | 触发限流后观察表单 | 显示"提交过于频繁" |

### 功能测试

| 测试项 | 预期 |
|-------|------|
| HoneyPot 触发 | 静默成功，不发请求 |
| 专属限流 | 第 6 次 429 |
| 验证码闸门（后台激活后） | 无 verify-param 返回 403 |
| 正常提交 | 流程与现状一致 |

**上线后观测**: 每周查看垃圾询盘量与 429 日志，若垃圾仍明显则按升级路径逐级启用。

---

## 四、回滚与风险

### 回滚

| 改动 | 回滚方式 | 时间窗 |
|------|---------|--------|
| P0-1 nginx 修复 | 恢复 `$proxy_add_x_forwarded_for` → `docker compose up -d nginx` | <2 分钟 |
| P0-2 专属限流 | `git revert` → 重新部署 api | <5 分钟 |
| P0-3 前端提示 | `git revert` → 重新部署 web | <5 分钟 |

**误伤轻量替代**（优先于回滚）: 调高 `limit: 5` → `10`，适用于共享出口 IP 场景（展会/公司 Wi-Fi）。

### 风险清单

| 风险 | 可能性 | 影响 | 缓解 |
|------|-------|------|------|
| ~~XFF 首段伪造~~ | ~~已确认~~ | ~~高~~ | P0-1 修复 |
| 限流误伤（共享出口 IP） | 低 | 中 | P0-3 友好提示 + 调高 limit |
| 弱网重试消耗配额 | 低 | 低 | limit: 5 已留余量 |
| 换 IP 池绕过 | 低 | 低 | 升级路径 2/3 |

---

## 附录

- [NestJS Throttler](https://docs.nestjs.com/techniques/rate-limiting)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**方案状态**: 三项 P0 已在代码中实施（v1.5 核实），待部署 + 生产验收  
**下次复审**: 2026-10-29（季度）
