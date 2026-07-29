# 生产环境静态资源 404 与 Chat BFF 500/502 排查与解决方案

> 日期：2026-07-30
> 状态：代码修复已全部实施（见 §5 实施记录），待部署后线上验证
> 影响范围：www.tzjii.com（C 端）、admin.tzjii.com（B 端）

---

## 一、线上错误现象

### 1.1 www.tzjii.com（apps/web）

| 错误 | 现象 |
|------|------|
| `GET /browser-support.js` → 404 | 且返回体为 HTML 404 页（`content-type: text/html`），浏览器因 strict MIME checking 拒绝执行 |
| `GET /vditor-assets/dist/js/lute/lute.min.js` → 404 | 同上，触发 `Uncaught (in promise) Event {type: 'error', target: script}`（Vditor 动态加载 lute 引擎失败） |

### 1.2 admin.tzjii.com（apps/admin）

| 错误 | 现象 |
|------|------|
| `GET /api/bff/chat-rooms/ROOM-651866N9` → 500 | 轮询持续失败（`setInterval` 驱动，每轮 500） |
| `POST /api/chat/token` → 502 Bad Gateway | 坐席 chat token 兑换失败，socket 无法握手 |
| `lute.min.js` preload 警告 | "preloaded using link preload but not used within a few seconds" |
| `/login?from=%2F` 下资源 404 | 与 1.1 同类（public 资源缺失） |

---

## 二、排查过程与关键证据

### 证据 1：线上实测——整个 public 目录都 404（2026-07-30 00:45 +0800）

```
curl -sI https://www.tzjii.com/browser-support.js   → 404 (text/html)
curl -sI https://www.tzjii.com/favicon.ico          → 404 (text/html)   ← 关键！
curl -sI https://admin.tzjii.com/vditor-assets/dist/js/lute/lute.min.js → 404
```

**连 `favicon.ico` 都是 404**——`favicon.ico` 在 `apps/web/public/` 中一直存在，与 vditor
复制脚本无关。这排除了「copy-vditor-assets 脚本没跑」的假设，指向 **public 目录整体
没有被 standalone server 找到**。

### 证据 2：Dockerfile runner 阶段 public 复制到了错误层级

`apps/web/Dockerfile`（apps/admin/Dockerfile 同样问题）：

```dockerfile
# 复制 public 静态资源
COPY --from=builder /app/apps/web/public ./public          # ← 落在 /app/public

# 复制 .next/standalone (自动打包好的所有依赖)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# 复制静态产物
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
                                                            # ← 正确落在 /app/apps/web/.next/static
CMD ["node", "apps/web/server.js"]                          # ← server 在 /app/apps/web/
```

Next.js `output: 'standalone'` 在 **monorepo 布局**下，standalone 产物结构为：

```
.next/standalone/
├── node_modules/
├── package.json
└── apps/web/
    ├── server.js        ← 服务入口
    └── .next/           ← 需要手动补 static
```

官方要求 `public` 与 `.next/static` 必须复制到 **与 server.js 同级的应用目录下**，即：

- ✅ `/app/apps/web/public`（server.js 从这里读 public）
- ❌ `/app/public`（现状——server 永远找不到，所有 public 资源 404）

`.next/static` 复制对了（`./apps/web/.next/static`），唯独 `public` 放错层级。
这就是为什么 JS/CSS chunk 都正常、页面能打开，但 **一切 public 下的文件
（favicon.ico、browser-support.js、vditor-assets/**）全部 404**。

404 响应是 Next 渲染的 HTML 404 页，因此 MIME 为 `text/html`，浏览器拒绝作为脚本
执行——这解释了 "Refused to execute script ... MIME type ('text/html')"。

### 证据 3：为什么"又"出现——上次修复只修了链路上半段

git 历史（2026-07-29 `50dc1ca`）：

> fix(prod): 修复 admin 生产 vditor 资源 404 …… copy-vditor-assets.mjs 写死
> apps/*/node_modules/vditor 路径 …… 改用 createRequire 模块解析定位。

上次修复解决的是 **builder 阶段**「vditor dist 没有被拷进 `apps/*/public`」的问题
（脚本静默 skip）。修复后 builder 内的 public 确实齐了，但 **runner 阶段把 public
落盘到 `/app/public` 的错位问题一直存在**，所以 404 在生产从未真正消失——上次
只是换了个环节继续 404。`favicon.ico` 404 是这一结论的直接证明。

### 证据 4：chat 500/502 是 api 容器重启窗口的瞬时故障

线上复测（错误发生后）：

```
GET  https://api.tzjii.com/api/v1/chat-rooms/ROOM-651866N9 → 401（未带凭证，预期）
POST https://api.tzjii.com/api/v1/chat-rooms/token          → 401（未带凭证，预期）
GET  https://api.tzjii.com/api/v1/health → healthy, uptime≈1249s（约 20 分钟）
```

**api 此刻健康，但 uptime 只有约 20 分钟**——api 容器在错误发生的时间窗口内重启过。
错误链路还原：

```
admin 前端轮询 /api/bff/chat-rooms/ROOM-xxx
  → admin BFF（catch-all 路由）fetch API_BASE 上游
      → api 容器重启中，连接被拒
          → BFF 无 try/catch，fetch 异常未捕获 → Next 返回 500  ← 现象一
admin 前端 POST /api/chat/token
  → token BFF 路由 fetch 上游，异常进入 catch → 显式返回 502     ← 现象二
```

同一根因（上游 api 短暂不可达），两个路由因错误处理策略不同而表现为 500 与 502。

两处放大因素：

1. **admin BFF 走公网回环**：`docker-compose.prod.yml` 中 admin 服务没有 `env_file`，
   运行时无 `ADMIN_API_URL`，BFF 只能回落到构建期烘焙的
   `NEXT_PUBLIC_ADMIN_API_URL`（公网 `https://api.tzjii.com/...`）。请求出容器 →
   公网 DNS/TLS → nginx gateway → api 容器，链路长且依赖公网证书/DNS，任何一环抖动
   都会放大为 5xx；正确做法是 BFF 走 compose 内网 `http://api:4000`。
2. **BFF catch-all 无兜底**：`apps/admin/src/app/api/bff/[...path]/route.ts` 的
   `proxy()` 整个函数没有 try/catch，上游连接失败直接变成未捕获异常（Next 500 +
   服务端 error 日志），且给前端的响应体不可判别。

api 为什么重启：`docker-compose.prod.yml` 给 api 配置 `mem_limit: 512m`、
`NODE_OPTIONS: --max-old-space-size=384`，health 显示 rss 已 280MB（启动仅 20 分钟）。
高度怀疑内存触顶被 OOM kill 后由 `restart: unless-stopped` 拉起。**需要上服务器确认**
（见 §4.5 验证命令）。

### 证据 5：admin 的 lute preload 警告——web 已修，admin 漏改

2026-07-29 已在 `docs/web-frontend-ui-code-assessment.md` P2-8 记录过该问题并修复了
web：`apps/web/src/app/[locale]/layout.tsx` 已改为 `rel="prefetch"`。但
`apps/admin/src/app/layout.tsx` L39 仍是：

```tsx
<link rel="preload" as="script" href="/vditor-assets/dist/js/lute/lute.min.js" />
```

lute 仅在打开 Markdown 编辑器时使用，登录页/聊天页首屏必然触发 "preloaded but not
used" 警告；叠加当前该资源 404（返回 HTML），警告必现。

---

## 三、根因总结

| # | 现象 | 根因 | 性质 |
|---|------|------|------|
| 1 | web/admin 所有 public 资源 404（browser-support.js、vditor-assets、favicon.ico） | 两个 Dockerfile runner 阶段将 public 复制到 `/app/public`，而 monorepo standalone 要求位于 `/app/apps/<app>/public`（与 server.js 同级） | **持续性缺陷**，每次部署必现 |
| 2 | admin `/api/bff/chat-rooms/*` 500 | api 容器重启窗口上游不可达 + BFF catch-all 无 try/catch，异常未捕获 | 瞬时故障 + 代码健壮性缺陷 |
| 3 | admin `/api/chat/token` 502 | 同上游不可达（该路由有 catch，按设计返回 502） | 瞬时故障的正确暴露 |
| 4 | admin BFF 走公网回环放大故障面 | compose 未给 admin 注入运行时 `ADMIN_API_URL`（内网地址） | 配置缺陷 |
| 5 | lute preload 警告 | admin layout 仍用 `rel="preload"`（web 已改 prefetch，admin 漏改） | 遗留项 |
| 6 | api 疑似 OOM 重启 | mem_limit 512m 偏紧（rss 20 分钟即 280MB） | 待服务器取证 |

---

## 四、解决方案

### 4.1 修复 Dockerfile public 层级错位（P0，根治 404）

`apps/web/Dockerfile`：

```dockerfile
# 修改前
COPY --from=builder /app/apps/web/public ./public
# 修改后（与 server.js 同级；补 --chown 与 static 保持一致）
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
```

`apps/admin/Dockerfile`：

```dockerfile
# 修改前
COPY --from=builder /app/apps/admin/public ./public
# 修改后
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public
```

注意 COPY 顺序：public 的复制需放在 standalone 复制**之后**（或保持现有顺序亦可，
COPY 目录合并不冲突），确保最终镜像内 `/app/apps/<app>/public` 存在。

### 4.2 admin BFF 改走 compose 内网（P0，缩短链路降低故障面）

`infra/docker/docker-compose.prod.yml` 的 admin 服务补运行时环境变量：

```yaml
  admin:
    image: ${IMAGE_REGISTRY}/tzj-admin:${ADMIN_TAG:-${IMAGE_TAG:-latest}}
    environment:
      NODE_OPTIONS: "--max-old-space-size=256"
      ADMIN_API_URL: "http://api:4000/api/v1"   # ← 新增：BFF 服务端直连内网 api
```

说明：`apps/admin/src/lib/config.ts` 的 `API_BASE` 取值顺序为
`ADMIN_API_URL → NEXT_PUBLIC_ADMIN_API_URL → 默认`，注入后仅影响服务端（BFF/中间件），
浏览器端仍使用构建期烘焙的公网地址，无副作用。`proxy.ts`（Edge 中间件）同源生效。

### 4.3 BFF catch-all 补异常兜底（P1，500 → 可判别的 502）

`apps/admin/src/app/api/bff/[...path]/route.ts`：将 `proxy()` 内两次上游调用
（`forward()` 与 refresh 流程）包入 try/catch，上游连接失败时返回：

```ts
return NextResponse.json(
  { success: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: '服务暂时不可用，请稍后重试' } },
  { status: 502 },
);
```

收益：api 滚动重启/瞬断期间，前端轮询收到语义明确的 502 JSON 而非 Next 500 HTML，
`console` 不再刷屏未捕获异常，前端可按 502 做退避重试。

### 4.4 admin lute preload → prefetch（P2，对齐 web 既有修复）

`apps/admin/src/app/layout.tsx`：

```tsx
// 修改前
<link rel="preload" as="script" href="/vditor-assets/dist/js/lute/lute.min.js" />
// 修改后（编辑器为按需场景，空闲预取进缓存即可，避免「preloaded but not used」警告）
<link rel="prefetch" as="script" href="/vditor-assets/dist/js/lute/lute.min.js" />
```

### 4.5 api 重启原因取证与内存余量（P1，服务器操作）

上 ECS 执行：

```bash
# 确认 api 是否被 OOM kill 及重启次数
docker inspect $(docker ps -qf name=api) --format '{{.State.OOMKilled}} {{.RestartCount}} {{.State.StartedAt}}'
docker events --since 24h --filter event=oom --filter event=die 2>/dev/null | head
dmesg -T 2>/dev/null | grep -i -E 'killed process|oom' | tail
```

若确认 OOM：将 `mem_limit` 提至 `768m`、`--max-old-space-size=512`（ECS 内存允许的
前提下），并观察 `docker stats` 一周。若非 OOM（如部署重启），记录时间点与
deploy workflow 运行记录比对即可闭环。

### 4.6 部署后冒烟检查（P2，防回归）

本问题两次进入生产的共性是：**部署后没有对 public 资源做验证**。实施方式：增强
`infra/docker/deploy.sh` 的 `smoke_test()`（容器内 wget，不依赖公网 DNS/证书，
比在 workflow 里 curl 公网域名更可靠），并改为**不论部署哪个服务都全量执行**：

```bash
smoke_test() {
  compose exec -T api wget -qO- http://127.0.0.1:4000/api/v1/health
  # public 资源断言：曾因 standalone public 目录错位导致整站 public 404
  compose exec -T web sh -c '
    wget -qO /dev/null http://127.0.0.1:3000/ &&
    wget -qO /dev/null http://127.0.0.1:3000/favicon.ico &&
    wget -qO /dev/null http://127.0.0.1:3000/browser-support.js &&
    wget -qO /dev/null http://127.0.0.1:3000/vditor-assets/dist/js/lute/lute.min.js
  '
  compose exec -T admin sh -c '
    wget -qO /dev/null http://127.0.0.1:3000/login &&
    wget -qO /dev/null http://127.0.0.1:3000/vditor-assets/dist/js/lute/lute.min.js
  '
}
```

wget 非 2xx 退出码非零 → `set -euo pipefail` 下 deploy.sh 直接失败，部署不会
静默带病上线。

也可先在本地验证镜像结构（不必等上线）：

```bash
docker build -f apps/web/Dockerfile -t tzj-web:test .
docker run --rm tzj-web:test ls apps/web/public   # 应列出 favicon.ico、browser-support.js、vditor-assets
```

---

## 五、实施记录与验证清单

### 实施记录（2026-07-30）

| 改动 | 文件 | 状态 |
|------|------|------|
| 4.1 public 复制到 `./apps/<app>/public`（补 --chown） | `apps/web/Dockerfile`、`apps/admin/Dockerfile` | ✅ 已改 |
| 4.2 admin 注入 `ADMIN_API_URL: http://api:4000/api/v1` | `infra/docker/docker-compose.prod.yml` | ✅ 已改 |
| 4.3 BFF catch-all 补 try/catch → 502 JSON（`UPSTREAM_UNAVAILABLE`） | `apps/admin/src/app/api/bff/[...path]/route.ts` | ✅ 已改，biome lint 通过 |
| 4.4 lute preload → prefetch | `apps/admin/src/app/layout.tsx` | ✅ 已改 |
| 4.6 冒烟断言（容器内 public 资源检查，改为每次部署必跑） | `infra/docker/deploy.sh`（`bash -n` 通过） | ✅ 已改 |
| 4.5 api OOM 取证 | 服务器操作 | ⏳ 待上 ECS 执行 |

本地未安装 Docker，镜像结构验证（§4.6 本地命令）留待 CI 构建后由 deploy.sh
冒烟断言闭环；push 后若冒烟失败部署会直接中断，不会带病上线。

### 回归确认（部署后逐项勾销）

- [ ] `www.tzjii.com/browser-support.js` 200，无 "Refused to execute script"
- [ ] `www.tzjii.com` 与 `admin.tzjii.com` 的 `/vditor-assets/dist/js/lute/lute.min.js` 200
- [ ] `www.tzjii.com/favicon.ico` 200
- [ ] admin 聊天页控制台无 lute preload 警告
- [ ] api 重启窗口内，admin 前端得到 502 JSON（而非 500），恢复后自动续上

---

## 六、经验沉淀

1. **Next.js monorepo standalone 的三件套必须同级**：`server.js`、`.next/static`、
   `public` 三者都要位于 `standalone/apps/<app>/` 下。只对 static 做对齐而漏掉
   public，会出现「页面正常、chunk 正常、唯独 public 全 404」的迷惑现象——
   **用 `favicon.ico` 是否 404 可以最快区分「个别资源缺失」与「public 整体错位」**。
2. **修复链路问题要端到端验证**：7-29 修复 copy 脚本后仅确认了 builder 内文件存在，
   未在最终镜像/线上验证 URL 可达，导致同一症状"复发"。冒烟断言（4.6）是最低成本
   的闭环手段。
3. **BFF 代理必须有上游异常兜底**：catch-all 转发无 try/catch，会把网络层瞬断放大为
   前端不可判别的 500 与服务端异常日志刷屏。
4. **容器间调用走内网服务名**，不要让服务端到服务端的调用出公网绕 gateway 回环。
