# ============================================================
# TZJ API — NestJS 11 Production Dockerfile
# ============================================================
# Build context: monorepo root
# Build command: docker build -f apps/api/Dockerfile -t tzj/api .
# ============================================================

# ── Stage 1: Builder ─────────────────────────────────────────
FROM node:22-alpine AS builder
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.aliyun.com|g' /etc/apk/repositories \
  && apk add --no-cache libc6-compat python3 make g++
RUN pnpm install --frozen-lockfile

COPY . .

RUN find . -name '*.tsbuildinfo' -delete
RUN pnpm --filter @tzj/api exec prisma generate
RUN npx turbo run build --filter=@tzj/api...

# ── Stage 2: Production ──────────────────────────────────────
FROM node:22-alpine AS production
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.aliyun.com|g' /etc/apk/repositories \
  && apk add --no-cache wget openssl

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# 复制构建产物和依赖
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
