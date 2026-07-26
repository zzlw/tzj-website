# 技术方案：CapJS 无感验证（PoW CAPTCHA）集成

> 状态：**已搁置（决策记录，不实施）**
>
> **搁置决策（2026-07 拍板）**：系统为小型官网 CMS（管理员个位数、总用户短期 <100、1C2G 单机），本方案不实施。理由：① PoW 防的是大规模自动化撞库，对针对个位数管理员账号的定向低频攻击成本≈0；② 现有 Throttler 限流 + 5 次失败锁 15 分钟 + 即将落地的 2FA（硬阻断）已覆盖其威胁面；③ 引入小众供应链依赖、widget、BFF 路由与监控配套的长期维护成本，与收益不匹配。**复启条件**：web 端开放注册/表单遭大规模滥用，或登录接口出现真实的自动化撞库流量（审计日志可见）；届时须先重评 Cloudflare Turnstile（§10.2 已升为首选评估项）而非直接启用本方案。本文档保留作设计决策记录。
>
> ⚠️ 本方案 §10.6 识别的「统一真实 IP 解析口径」不随本方案搁置——它是现网活问题，已升格为独立 P0 前置工程项（见 2FA 方案 §0.1 / §14.7），须单独落地。
> 适用范围：`apps/api`（NestJS）+ `apps/admin`（Next.js App Router BFF）
> 关联方案：[TOTP 2FA](./2fa-totp-design.md)（两者都改登录链路；**最终裁定：2FA 已定稿待实施，本方案搁置**，见上方决策记录与 §9。**注意：`verify-2fa` 不挂 `CapGuard`**——TOTP 步骤时 widget 的 capToken 早已过期，且其自身已有 pendingToken + 限流 + 重放防护，无需叠加 captcha）
> 目标环境：1C2G VPS —— **无持久化存储依赖（无 Docker/Redis/文件缓存）**；允许与 2FA 方案同款的进程内短 TTL 结构（单实例前提）。（复核修正：原「零内存状态」硬约束与 2FA 方案的进程内 jti Set 构成双重标准，且其代价是放弃 `consumeNonce` 留下 60s 重放窗，得不偿失，已放宽——见 §4.2/§6）

---

## 1. 选型结论：`capjs-core`（而非 `@cap.js/server`）

Cap 官方提供两个服务端包，差异关键：

| 包 | 状态模型 | 适配性 |
|----|---------|-------|
| `@cap.js/server` | **有状态**：challenge/token 默认存内存 + 文件（`.data/`），可换 Redis | ❌ 默认写磁盘文件，违反本项目「无持久化存储依赖」约束（复核后约束已放宽为允许进程内短 TTL 结构，但文件持久化仍在禁列） |
| `capjs-core` | **无状态**：challenge 打包成 HS256 签名 JWT，内部元数据 AES-256-GCM 加密，验证纯靠密码学，不依赖任何存储 | ✅ 选用 |

> **与既有 `ALIYUN_CAPTCHA_*` 的关系**：项目 `integration.registry.ts` 中已有阿里云验证码配置（`ALIYUN_CAPTCHA_*`），那是面向 web/C 端业务集成（如留言、表单）的可插拔验证码设施，**与本方案目标不同**——本方案是 admin 登录链路的专用 PoW 人机验证，二者互不替代、不冲突。若未来希望 web 端也统一到 CapJS，可另行评估，不在本方案范围。

`capjs-core` 核心 API（已对照官方 README 核实）：

```ts
import { generateChallenge, validateChallenge } from 'capjs-core';

// 生成：返回 { challenge: {c,s,d}, token(签名JWT), expires }
generateChallenge(secret, { scope, expiresMs, ... });

// 验证：前端解出 solutions 后回传，纯密码学校验
validateChallenge(secret, { token, solutions }, { scope, signToken, consumeNonce? });
```

- `secret` = 环境变量 `CAP_SECRET`（≥32 字节高熵随机值，与 §4.5 env 校验 `min(32)` 一致），同时用于 JWT 签名与元数据加密。
- 难度参数保持库默认（`challengeCount=50, difficulty=4`）：**PoW 计算发生在访客浏览器**，服务端验证只是少量 SHA-256 重算，1C2G VPS 上单次验证 <1ms，无 CPU 压力。

前端使用官方 `@cap.js/widget`（Web Component，支持隐形/无感模式）。

### 1.1 前置假设：admin 后台暴露模型

> **本方案当前按「admin 后台公网可达」设计**。这是 PoW 投入 ROI 的边界前提，评审者须先确认。

- **公网可达（当前采用）**：admin 域名直接暴露公网 → 撞库/凭据填充攻击面大，PoW 抬高机器成本、配合 2FA 的投入合理，本方案即为此场景定制。
- **内网 / VPN / 堡垒机可达（可降级）**：若实际仅企业内网或经零信任网关可达，网络层已做粗粒度隔离，PoW 的边际收益下降，可按需省略以降维护成本（仍建议保留 2FA）。
- **混合**：公网可达但限定来源国/区域 → 在网络层 + 本方案间取交集，本方案仍适用。

> 若后续暴露模型变更，须重新评估 §6 的限流阈值，而非照搬本文档数值。

## 2. 依赖引入（需 A1 审批）

| 包 | 位置 | 说明 |
|----|------|------|
| `capjs-core` | `apps/api` | 服务端生成/验证，零原生依赖 |
| `@cap.js/widget` | `apps/admin` | 前端求解组件，~12KB，仅登录页动态加载 |

## 3. 整体流程

```
┌─ 浏览器（登录页）────────────────────────────────────────────┐
│ <cap-widget>（隐形模式）                                       │
│   ① POST {BFF}/api/auth/cap/challenge → 拿 {challenge, token} │
│   ② Web Worker 后台解 PoW（用户无感，~0.5-2s）                  │
│   ③ POST {BFF}/api/auth/cap/redeem {token, solutions}          │
│      ← 兑换得 capToken（我方签发的短时效 HMAC-JWT）              │
│   ④ 提交登录：POST {BFF}/api/auth/login                        │
│      { username, password, capToken }                          │
└──────────────────────┬───────────────────────────────────────┘
                       │ BFF 纯透传（Next.js route handlers）
┌─ NestJS ─────────────▼───────────────────────────────────────┐
│ POST /api/v1/auth/cap/challenge  @Public  → generateChallenge │
│ POST /api/v1/auth/cap/redeem     @Public  → validateChallenge │
│      成功时用 signToken 签发我方 capToken（60s TTL, scope 绑定）│
│ POST /api/v1/auth/login  @UseGuards(CapGuard)                 │
│      CapGuard 无状态验签 capToken → 失败 401 / 通过进登录逻辑    │
└──────────────────────────────────────────────────────────────┘
```

设计要点：**challenge 与 redeem 无持久化状态**——challenge 本身是自包含签名 JWT；redeem 后我们不存 token，改为签发自己的短时效 capToken，`CapGuard` 纯验签。唯一运行态是进程内「已消费 tokenKey」Set（60s TTL 滚动清理；复核修正引入，用于闭合 capToken 重放，见 §4.2/§6）。

## 4. 后端设计（`apps/api/src/cap/`）

### 4.1 模块结构

```
cap/
├── cap.module.ts       # 全局模块，导出 CapService
├── cap.service.ts      # 封装 capjs-core + capToken 签发/验签
├── cap.controller.ts   # /auth/cap/challenge、/auth/cap/redeem
└── cap.guard.ts        # CapGuard：从 body.capToken 验签
```

### 4.2 `CapService`（核心逻辑，含注释的实现骨架）

```ts
@Injectable()
export class CapService {
  private readonly secret: string;      // CAP_SECRET（≥32B）：仅供 capjs-core 挑战签名/元数据加密
  private readonly tokenSecret: string;  // CAP_TOKEN_SECRET（≥32B，与 CAP_SECRET 不同源）：仅用于我方 capToken JWT 签名——密钥隔离，避免一钥多用
  private static readonly SCOPE = 'admin-login';          // scope 绑定，防跨场景挪用
  private static readonly CHALLENGE_TTL_MS = 2 * 60_000;  // challenge 2 分钟过期
  private static readonly CAP_TOKEN_TTL_S = 60;           // capToken 60 秒过期（解完即登，够用且收窄重放窗口）

  /** ① 生成挑战：完全无状态，challenge 元数据加密封装在返回的 token 里 */
  async createChallenge() {
    return generateChallenge(this.secret, {
      scope: CapService.SCOPE,
      expiresMs: CapService.CHALLENGE_TTL_MS,
      // 其余难度参数保持默认，避免 1C2G 上的额外开销（PoW 在客户端算）
    });
  }

  /** ② 校验解题结果，签发我方 capToken（HS256 JWT，含 scope/exp/jti/username） */
  async redeem(body: { token: string; solutions: number[]; username?: string }) {
    // ⚠️ 落地前务必在 `pnpm add capjs-core` 后实测其真实返回形状（result.success /
    //    result.token / result.expires）与选项名（signToken / consumeNonce），以发布版本为准，
    //    README 可能滞后。若 generateChallenge 不支持 scope 参数，则 scope 仅作用于我方
    //    capToken（自证自验），需在生成侧确认其有效性。
    const result = await validateChallenge(this.secret, body, {
      scope: CapService.SCOPE,
      // signToken：用我们自己的 JWT 替代默认赎回令牌 → CapGuard 可独立无状态验签。
      // 关键：把 username 写进 capToken，将重放限制到「同一账号」，无法跨账号撞库。
      signToken: async (data) =>
        this.jwt.signAsync(
          { type: 'cap', scope: CapService.SCOPE, username: body.username, sig: data.tokenKey },
          { secret: this.tokenSecret, expiresIn: CapService.CAP_TOKEN_TTL_S },
        ),
      // consumeNonce 必传（复核修正，原「故意不传」已废止）：一次性消费用进程内
      // Set<tokenKey>（60s TTL 滚动清理），与 2FA 方案 pendingToken jti 单用同源实现，
      // 单实例前提下无需 Redis；多实例扩容时迁 Postgres 一次性 jti 表（项目已有 PG）。
      consumeNonce: async (tokenKey) => this.consumeOnce(tokenKey), // 已消费 → false → 验证失败
    });
    if (!result.success) throw new UnauthorizedException('人机验证失败，请刷新重试');
    return { capToken: result.token, expires: result.expires };
  }

  /** ③ Guard 用：无状态验签 capToken，返回载荷（失败返回 null） */
  async verifyCapToken(
    capToken: string,
  ): Promise<{ type: string; scope: string; username?: string } | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ type: string; scope: string; username?: string }>(
        capToken,
        { secret: this.tokenSecret },
      );
      if (payload.type !== 'cap' || payload.scope !== CapService.SCOPE) return null;
      return payload;
    } catch {
      return null; // 过期 / 篡改 / scope 不符
    }
  }
}
```

### 4.3 `CapGuard`

```ts
/** 仅用在 login 路由上（verify-2fa 不挂本 Guard，见 §2/§8）：body.capToken 缺失或非法 → 401 */
@Injectable()
export class CapGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // CAP_ENABLED=false：开发态免解题直通；生产态【允许】置 false 作止血通道（复核修正：
    // 原「生产被代码拒绝」与 §8「一个环境变量即完全旁路」的回滚承诺自相矛盾，已废止）。
    // 治理对齐 2FA §9 kill-switch：生产置 false 触发 cap_killswitch_activated 审计 +
    // 实时告警 + 配置漂移监控（§8/§10.1），降级「可用但可见」。
    if (!this.config.get('CAP_ENABLED', true)) {
      if (this.config.get('NODE_ENV') === 'production') this.alertKillSwitchOnce(); // 幂等去抖：只告警，不阻断
      return true;
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    // ⚠️ Guard 先于 ValidationPipe 执行（复核追加）：此处 body 是未经 DTO 校验的原始输入，只做窄类型读取，不得信任其结构
    const body = req.body as { capToken?: string; username?: string };
    const payload = await this.cap.verifyCapToken(body.capToken ?? '');
    if (!payload) {
      throw new UnauthorizedException('人机验证未通过');
    }
    // 绑定账号（可选增强，非安全关键）：仅当 capToken 自带 username 且本次登录 username 已填，
    // 且二者不符时才拒绝。capToken 未绑 username（widget 自动 redeem 的常见情形）时跳过——
    // 跨账号重放的真正防线是 scope 绑定 + per-IP 限流（见 §6）。
    if (payload.username && body.username && payload.username !== body.username) {
      throw new UnauthorizedException('人机验证与账号不匹配');
    }
    return true;
  }
}
```

### 4.4 路由与限流

| 方法 | 路径 | 鉴权 | 限流（@Throttle） | 说明 |
|------|------|------|------|------|
| POST | `/auth/cap/challenge` | `@Public` | 20/min/IP | widget 自动调用；生成开销极低但仍限流防刷 |
| POST | `/auth/cap/redeem` | `@Public` | 10/min/IP | 验证 solutions + 签发 capToken |
| POST | `/auth/login` | `@Public` + **CapGuard** | 现有 | Guard 排在 Throttler 之后、业务逻辑之前 |

`LoginDto` 增加 `capToken: string`（`@IsString() @IsNotEmpty()`，`CAP_ENABLED=false` 时 `@IsOptional()` 由 Guard 统一放行）。

### 4.5 环境变量（`env.validation.ts` 新增）

```ts
CAP_SECRET: z.string().min(32),                          // 高熵随机；仅供 capjs-core，与 JWT_SECRET 不同源
CAP_TOKEN_SECRET: z.string().min(32),                     // 我方 capToken 专用签名密钥，与 CAP_SECRET / JWT_SECRET 三者互不相同源
// ⚠️ 不要用 z.coerce.boolean()：它对任意非空字符串都判 true，连 "false" 也会变 true，逃生开关会失效。
CAP_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
```

⚠️ **fail-fast 的适用边界（复核修正，替换原 superRefine 方案）**：启动期 fail-fast 只留给**密钥缺失**（`CAP_SECRET` / `CAP_TOKEN_SECRET` 缺失或长度不足 → 拒绝启动，与 2FA 方案对 `SECRETS_ENCRYPTION_KEY` 的要求同款）。**不得**用 superRefine 拒绝 `NODE_ENV==='production' && CAP_ENABLED=false` 启动：① 与 §8「一个环境变量即完全旁路」的回滚承诺直接矛盾；② capjs-core 库自身故障（供应链小众库，§10.1 已识别为集中度风险）时，若置 false 会被拒绝启动，则唯一止血途径变成紧急改代码发版，自废武功。正确姿势：生产置 false 可启动，但启动日志打 ERROR 横幅 + 一次性告警（§4.3 `alertKillSwitchOnce`）+ 配置漂移监控（§10.1），用「可见性」而非「阻断」管控降级风险。

## 5. 前端设计（`apps/admin`）

### 5.1 BFF 透传路由（新增，各 ~15 行）

```
app/api/auth/cap/challenge/route.ts   → 透传 POST {API_BASE}/auth/cap/challenge
app/api/auth/cap/redeem/route.ts      → 透传 POST {API_BASE}/auth/cap/redeem
app/api/auth/login/route.ts           → 改造：body 追加 capToken 一并转发
```

保持"浏览器只与 BFF 同源通信"的现有架构，NestJS 不需要放开 CORS。

> **BFF 卫生要求（复核追加，与 2FA §7.1 对齐）**：现有 login route 的 `retryFetch(..., { retryWrites: true }) // login 无副作用` 注释在本方案落地后不再成立——capToken 是一次性消耗品（consumeNonce 单用），重试会用已消费的 capToken 再次提交必然 401，且登录本身会累计失败计数/触发审计。登录类请求（login / cap/redeem）必须关闭写重试。

### 5.2 登录页改造（`app/login/page.tsx`）

```tsx
'use client';
// ① 动态引入 widget（仅登录页加载，不进全局 bundle）
useEffect(() => { import('@cap.js/widget'); }, []);

// ② 隐形模式：无 UI，页面加载后 widget 自动 challenge → 后台 Worker 解题 → redeem
<cap-widget
  data-cap-api-endpoint={`${BASE_PATH}/api/auth/cap/`}  // widget 自动拼 challenge/redeem
  data-cap-hidden                                        // 无感模式
  onSolve={(e) => setCapToken(e.detail.token)}           // ③ 拿到 capToken 存入 state
/>
// ⚠️ 账号绑定实效性说明：@cap.js/widget 为「页面加载即自动 redeem」，此时用户通常尚未填写 username，
// 故 capToken 绝大多数情况处于「未绑定」状态——文档原「若已填写则附加」机制基本是空转。
// 结论：跨账号重放的真正防线是 ① scope 绑定 admin-login + ② per-IP @Throttle(10/min) 兜底，
// 而非 username 绑定。保留 username 绑定作为「可选增强」（用户在解题前已填 username 时才生效），
// 但不得将其视作安全关键控制。CapGuard 的 username 一致性检查改为「仅正向校验」：
// 只有当 capToken 自带 username 且本次登录 username 已填且二者不符时才拒绝，未绑 username 时跳过。

// ④ 提交登录时带上：
body: JSON.stringify({ username, password, capToken })

// 边界处理：
// - capToken 尚未就绪（解题中）→ 提交按钮 loading「安全校验中…」，通常 <2s
// - capToken 过期（60s）/ 登录失败重试 → 调 widget.reset() 重新解题后再提交
// - widget 加载失败 → 提示刷新页面（不静默绕过）
```

TypeScript 类型：为 `cap-widget` 自定义元素补 `declare global { namespace JSX ... }` 声明，避免 `any`（放 `apps/admin/src/types/cap-widget.d.ts`）。

## 6. 安全分析与权衡（重放问题已由 consumeNonce 闭合，见 §4.2）

| 威胁 | 对策 |
|------|------|
| 机器人批量撞库 | PoW 每次登录尝试强制消耗客户端算力（默认难度 ≈0.5-2s CPU），批量攻击成本线性放大；叠加现有 Throttler + 账号锁定 |
| challenge 伪造/篡改 | challenge token 为 HS256 签名 JWT + AES-256-GCM 加密元数据，无 `CAP_SECRET` 无法伪造 |
| capToken 伪造 | 同上，我方 HS256 签名，60s 过期 + scope 绑定 |
| capToken **重放** | ✅ **已闭合（复核修正）**：`consumeNonce` 改为必传（§4.2），进程内已消费 tokenKey Set（60s TTL）保证同一 capToken 仅能登录一次，原「60s 窗口内同 token 反复撞密码」的残留风险消除。username/scope 绑定降为纵深补充而非主防线。代价：单实例限定（多实例需迁 Postgres jti 表，见 §4.2），与 2FA 方案的单实例前提一致 |
| 跨场景挪用 | `scope` 在 generate/validate/capToken 三处一致校验 |
| DoS 打 challenge 接口 | 生成本身 <1ms 且无状态无存储泄漏面；20/min/IP 限流兜底 |
| 人工打码农场（human CAPTCHA farm） | PoW 抬高的是「机器」成本，廉价人工（按千次计费）仍可绕过。对 admin 登录这类低流量、高价值目标，农场攻击不经济，风险可接受；若未来 web 端大规模接入则需重新评估，并考虑行为风控（设备指纹 / 登录节奏）补位。 |

**CSRF 态势（补充声明）**：登录 / `verify-2fa` 接口均为 POST，凭据（capToken / 动态码）位于请求 **body** 而非 cookie，跨站请求无法注入；且 BFF 写入的 httpOnly Cookie 均为 `sameSite: lax`，浏览器在跨站 POST 时不携带——双重防护下 CSRF 风险可忽略。本方案依赖此前提，此前未显式声明，特此补明。

## 7. 资源开销评估（1C2G VPS）

- **内存**：仅一个进程内「已消费 tokenKey」Set（60s TTL 滚动清理，条目数 ≈ 每分钟登录尝试数，量级可忽略；复核修正：原「零常驻状态」已随 consumeNonce 必传而更新，见 §4.2），无 token 表、无文件缓存。
- **CPU**：`generateChallenge` 一次 HMAC + 少量随机数；`validateChallenge` 重算 50 个 SHA-256，均为亚毫秒级。PoW 主开销 100% 在访客浏览器。
- **磁盘**：无（对比 `@cap.js/server` 默认会写 `.data/` 文件——这正是弃用它的原因之一）。
- ⚠️ **单实例依赖声明**：上述「零状态」指 CapJS 挑战本身；但 `@Throttle`（§4.4）为 per-IP 应用层限流，默认不跨副本共享。多实例部署时限流被稀释（需边缘/网关层兜底，见 §10.5）。本方案当前按单实例设计。

## 8. 实施顺序与回滚

1. `CapModule/CapService/CapController` + 单测（challenge 往返、篡改拒绝、scope 不符拒绝、过期拒绝、**同一 token 二次消费拒绝（consumeNonce 单用，复核追加）**）；**装包后加最小冒烟单测锁定 capjs-core 的真实 API 形状**；并在目标低配机实测 PoW solve 耗时，据此确认/调参默认 `difficulty`（避免形同虚设或误伤正常用户）
2. `CapGuard` + `LoginDto.capToken`；`CAP_ENABLED=false` 下全链路直通验证
3. BFF 三个路由 + 登录页 widget 集成
4. E2E：真实浏览器解题登录、token 过期重试、`CAP_ENABLED` 开关两态
5. **`/auth/2fa/verify` 不挂 `CapGuard`**（TOTP 步骤时 widget 的 capToken 已过期，且其自身已有 pendingToken + 限流 + 重放防护）。CapGuard 仅用于首次 `/auth/login`。`LoginResult` 联合体（含 `requires2fa` / `pendingToken`）与 `capToken` 字段须在 `packages/types` **同一 PR** 合并定义，避免两次破坏性调整。

回滚：`CAP_ENABLED=false` 一个环境变量即完全旁路（Guard 直通 + DTO 可选），无需回滚代码或数据；无数据库变更。
⚠️ **旁路开关本身是攻击面（治理硬要求）**：能改生产 env 的人（或投毒的依赖）把它置 `false`，PoW 即静默全失效，等于把安全控制降级成后门。**管控要求**：① 生产环境**允许**置 `CAP_ENABLED=false`（止血通道必须存在；复核修正：原「被代码拒绝」与本节回滚承诺自相矛盾，已废止，见 §4.3/§4.5），但置位即刻触发 `cap_killswitch_activated` 审计 + 实时告警；② 将 `CAP_ENABLED` 纳入**配置漂移监控**——任何运行态与基线（应为 `true`）不符即触发安全告警 + 审计记录；③ 变更须走审批 + 留痕，禁止未经评审的临时关闭。回滚开关的价值在于「可快速止血」，但必须以「受控 + 可观测」为前提，而非裸后门。

## 9. 与 2FA 方案的实施顺序（复核修正：结论已倒转）

两个方案都动 `POST /auth/login` 链路。**原建议「CapJS 先行（改动小、可开关旁路、无 schema 变更）」已推翻**，修订为：**2FA（或 Passkey，见 2FA §11 决策注）绝对优先，本方案缓行/可选**。理由：

1. **实施顺序应按安全收益排序，而非改动大小**。admin 后台的真实威胁是定向凭据攻击（弱口令/泄露凭据/撞库命中），对此 PoW 几乎无效——攻击者针对个位数管理员账号的低频尝试，每次 0.5-2s 的 PoW 成本≈ 0；而 2FA 对它是硬阻断。
2. **2FA 落地后，PoW 的净增量是「限流/审计日志降噪」的 nice-to-have**：密码即使被撞出，无第二因子仍无法登录。降噪价值真实存在但不紧迫，应在 2FA 稳定运行后再评估是否仍需本方案（届时一并重评 Turnstile 替代，见 §10.2）。
3. **两方案共同的 P0 前置是「统一真实 IP 解析口径」**（本方案 §10.6 / 2FA §14.7）：这是现网已存在的问题，不依赖任一方案落地，应单独先行。

保留不变的约束：**2FA 的 `verify-2fa` 不复用 CapGuard**（TOTP 第二步时 widget 的 capToken 已过期，且其自身已有 pendingToken + 限流 + 重放防护，见 §2/§8）——CapGuard 仅挂在首次 `/auth/login`。若未来本方案与 2FA 并行开发，登录接口的 DTO/响应契约变更需在 `packages/types` 一次性合并定义，避免两次破坏性调整。

## 10. 企业治理补充（上市公司合规基线）

> 本节满足上市公司安全与供应链评审要求。实施前须经安全/合规官会签。

### 10.1 供应链：SBOM + 版本锁 + CVE 监控
`capjs-core` / `@cap.js/widget` 社区规模小、维护者单一，属供应商集中度风险。
- 纳入 **SBOM**（CycloneDX）与 CVE 监控。
- `package.json` **锁版本 + 完整性哈希**（`pnpm-lock` 已带 integrity，须设评审 gate 阻止未审新增依赖）。
- 装包后冒烟测试（§8）锁定 API 形状，作为供应商兼容性验收。
- **配置漂移监控**：将 `CAP_ENABLED`（运行态须恒为 `true`）纳入配置基线比对，与基线不符即安全告警（呼应 §8 旁路开关治理）。

### 10.2 弃用 fallback 预案
维护者弃坑/投毒时须可替换：预案切到 Cloudflare Turnstile / hCaptcha 或自研 PoW 中间件，使 CapJS 从单点依赖降级为可替换组件。

> **复核追加：Turnstile 应升为首选评估项，而非仅作 fallback**。对比本方案：Turnstile 零服务端代码（只需一次 siteverify 调用）、大厂维护无弃坑风险、token 天然单用（无需自建 consumeNonce）、行为信号对打码农场的防护优于纯 PoW；代价是引入第三方依赖与可用性耦合（国内网络环境需实测）。若最终仍选 CapJS，选型记录须写明「为何排除 Turnstile」（如：数据不出境、国内可达性、零外部依赖偏好），而非默认自建。

### 10.3 上线验收门禁
与 2FA 方案一致（见 2FA §12.4）：登录链路重大变更上线前过独立安全评估 / 渗透测试 + go/no-go 评审，不仅止于 §8 功能与冒烟测试。

### 10.4 可观测性度量与安全告警
建立 dashboard：PoW 解题耗时分布、challenge/redeem 失败率、capToken 过期重试率——衡量真实用户体验与安全收益。
⚠️ **仅指标不够，须有安全告警（补齐检测盲区）**：2FA 方案 §6.4 已对 `force_disabled` / `recovery_used` / 异常 IP 等接实时告警，本方案须对齐。对以下异常接**实时告警**（而非仅落指标）：① `login` 请求缺 `capToken` 突增（疑似 PoW 被绕过 / 配置漂移）；② `capToken` 校验失败率异常飙升（疑似伪造或客户端异常）；③ `redeem` 失败率异常（疑似解题农场或接口被探测）；④ `CAP_ENABLED` 运行态与基线不符（呼应 §8 / §10.1 配置漂移）。告警对接运维通知（邮件 / Webhook），否则 PoW 被绕过时无人响应。

### 10.5 边缘层限流（纵深最外层）
应用层 `@Throttle`（§4.4）为单实例天花板。公网暴露模型（§1.1）下须在**边缘（Cloudflare / WAF / 网关）**再叠 `/auth/login` 与 `/auth/cap/redeem` 的限流与异常流量清洗，作为最外层兜底（与 2FA §14.6 协同）。

### 10.6 BFF 代理拓扑下的真实客户端 IP 透传（🔴 重大·per-IP 限流的存活前提）
本方案坚持「浏览器只与 BFF 同源通信，BFF 服务端 `fetch` 转发 NestJS」（§3、§5.1）。后果与 2FA §14.7 同源：NestJS 的 `req.ip` **恒为 BFF 服务器 IP**，则 §4.4 的 `challenge` 20/min/IP、`redeem` 10/min/IP **全部塌缩为单一共享桶**——攻击者每分钟打满 20 个 challenge，即可让**全体管理员**的 widget 无法取到挑战、登录页卡在「安全校验中…」，PoW 限流被反向武器化为登录 DoS。§10.4 的「`login` 缺 capToken 突增」等告警也会因源 IP 失真而无法定位攻击来源。
⚠️ **且这不是未来风险，是现网活问题（复核追加）**：`apps/api/src/common/utils/client-ip.ts` 的 `extractClientIp` 当前**无条件采信任意 `X-Forwarded-For` 第一段**，任何直连客户端都可伪造 IP 污染审计/会话记录、绕过 IP 封禁；同时 ThrottlerGuard 默认取 `req.ip`，与 `extractClientIp` 两套口径并存。本项已与 2FA §14.7 合并升格为**两方案共同的 P0 前置工程项**，不依赖任一方案落地，应单独先行修复。
**必修（与 2FA §14.7 同一套修法，须在同一 PR 落地）**：① BFF 转发 cap/challenge、cap/redeem、login 时显式附带 `X-Forwarded-For: <浏览器真实出口 IP>`；② NestJS `trust proxy` 只信任 BFF 来源，不无条件信任任意 XFF；③ Throttler `getTracker` 取解析后的真实客户端 IP；④ 测试：并发两浏览器不同 IP 时 challenge/redeem 限流应各自独立计数。

## 11. ERP 边界（企业资源规划系统视角）

> ERP 系统的非人身份（API/EDI/批处理/RPA）本就不走浏览器登录页，PoW 对其无作用亦不应作用。

- **覆盖范围声明**：CapJS PoW 仅保护「人类交互登录通道」（`/auth/login`）。§13.1 定义的非人身份（SERVICE / BOT）走 mTLS / OAuth Client Credentials / 源 IP 白名单（见 2FA §13.1），**不在本方案范围**，实施者不得误给服务账号套 PoW。
- **与 IdP 的关系**：若 ERP 已有中央 IdP 且其人机验证覆盖登录，CapJS 可作为该通道不可用时的兜底，而非重复建设（呼应 2FA §13.5）。
