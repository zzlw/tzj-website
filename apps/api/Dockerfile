# ============================================================
# TZJ API — NestJS 11 Production Dockerfile
# ============================================================
# Build context: monorepo root
# Build command: docker build -f apps/api/Dockerfile -t tzj/api .
# ============================================================

# 云效北京构建集群无法访问 docker.io，使用 DaoCloud 镜像加速
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine

# ── Stage 1: Builder ─────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
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
# 打包 api 及生产依赖（pnpm 扁平 node_modules，避免根 node_modules 软链在运行时失效）
RUN pnpm --filter @tzj/api deploy --prod /prod/api

# ── Stage 2: Production ──────────────────────────────────────
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine
FROM ${NODE_IMAGE} AS production
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.aliyun.com|g' /etc/apk/repositories \
  && apk add --no-cache wget openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /prod/api ./

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
