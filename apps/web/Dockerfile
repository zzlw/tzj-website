# ============================================================
# TZJ Web — Next.js 15 Production Dockerfile
# ============================================================
# Build context: monorepo root
# Build command: docker build -f apps/web/Dockerfile -t tzj/web .
# Uses: Next.js Standalone Output (最小化镜像体积)
# ============================================================

# 云效北京构建集群无法访问 docker.io，使用 DaoCloud 镜像加速
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine

# ── Stage 1: Base ────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.aliyun.com|g' /etc/apk/repositories \
  && apk add --no-cache libc6-compat
WORKDIR /app

# ── Stage 2: Dependencies ────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
# deps 阶段仅有 package.json，跳过 postinstall（copy-vditor-assets 在 builder 阶段显式执行）
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 3: Builder (Turbo Build) ───────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_S3_PUBLIC_DOMAIN
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_S3_PUBLIC_DOMAIN=$NEXT_PUBLIC_S3_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
RUN node apps/web/scripts/copy-vditor-assets.mjs
RUN npx turbo run build --filter=@tzj/web

# ── Stage 4: Runner (Standalone 模式提取) ────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制 public 静态资源
# standalone server.js 位于 /app/apps/web/server.js 且启动时 process.chdir(__dirname)，
# Next 从 cwd/public 提供静态资源 → 必须落到 /app/apps/web/public（与 .next/static 同级），
# 否则 public 资源（如 vditor-assets）全部 404。
COPY --from=builder /app/apps/web/public ./apps/web/public

# 复制 .next/standalone (自动打包好的所有依赖)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# 复制静态产物
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
