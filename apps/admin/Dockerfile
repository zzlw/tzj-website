# ============================================================
# TZJ Admin — Next.js 15 Production Dockerfile
# ============================================================
# Build context: monorepo root
# Build command: docker build -f apps/admin/Dockerfile -t tzj/admin .
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
COPY apps/admin/package.json apps/admin/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/dnd/package.json packages/dnd/

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 3: Builder (Turbo Build) ───────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_ADMIN_API_URL
ARG NEXT_PUBLIC_S3_PUBLIC_DOMAIN
ARG NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_ADMIN_API_URL=$NEXT_PUBLIC_ADMIN_API_URL
ENV NEXT_PUBLIC_S3_PUBLIC_DOMAIN=$NEXT_PUBLIC_S3_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
RUN node apps/admin/scripts/copy-vditor-assets.mjs
RUN npx turbo run build --filter=@tzj/admin

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
COPY --from=builder /app/apps/admin/public ./public

# 复制 .next/standalone (自动打包好的所有依赖)
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./

# 复制静态产物
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/admin/server.js"]
