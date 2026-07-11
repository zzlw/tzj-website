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
  && apk add --no-cache libc6-compat python3 make g++ vips-dev
RUN pnpm install --frozen-lockfile

COPY . .

RUN find . -name '*.tsbuildinfo' -delete
RUN pnpm --filter @tzj/api exec prisma generate
RUN npx turbo run build --filter=@tzj/api...
# 打包 api 及生产依赖（pnpm 扁平 node_modules，避免根 node_modules 软链在运行时失效）
RUN pnpm --filter @tzj/api deploy --prod --legacy /prod/api
# deploy --prod 会留下未初始化的 @prisma/client stub；复制 builder 内已 generate 的完整 .prisma（含 query engine）
RUN set -e; \
    ENGINE="$(find /app/node_modules -path '*/.prisma/client/libquery_engine*' -print -quit)"; \
    test -n "$ENGINE"; \
    DOT_PRISMA="$(dirname "$(dirname "$ENGINE")")"; \
    cp -r "$DOT_PRISMA" /prod/api/node_modules/.prisma; \
    find /prod/api/node_modules -type d -path '*/node_modules/@prisma/client' | while read -r client; do \
      dest="$(dirname "$(dirname "$client")")/.prisma"; \
      rm -rf "$dest"; \
      cp -r "$DOT_PRISMA" "$dest"; \
    done

# ── Stage 2: Production ──────────────────────────────────────
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine
FROM ${NODE_IMAGE} AS production
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.aliyun.com|g' /etc/apk/repositories \
  && apk add --no-cache wget openssl vips vips-dev libc6-compat

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /prod/api ./

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
