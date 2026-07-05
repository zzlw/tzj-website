#!/usr/bin/env bash
# 一次性：空 PostgreSQL → db push 建表 → baseline 全部迁移记录
# 用法：./scripts/bootstrap-fresh-db.sh [api-tag]
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/tzj}"
cd "$DEPLOY_DIR"

ENV_FILE=".env.prod"
LOCAL_ENV_FILE=".env.prod.local"
NETWORK="tzj_default"

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  # shellcheck disable=SC1091
  source "$LOCAL_ENV_FILE"
  set +a
  TAG="${API_TAG:-${IMAGE_TAG:-latest}}"
else
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  # shellcheck disable=SC1091
  source "$LOCAL_ENV_FILE"
  set +a
fi

API_IMAGE="${IMAGE_REGISTRY}/tzj-api:${TAG}"
RUN=(docker run --rm --network "$NETWORK" \
  -e NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
  --env-file "$ENV_FILE" --env-file "$LOCAL_ENV_FILE" \
  "$API_IMAGE")

echo "==> Ensure postgres"
docker compose -f docker-compose.prod.yml \
  --env-file "$ENV_FILE" --env-file "$LOCAL_ENV_FILE" \
  up -d postgres
sleep 5

echo "==> db push（空库建表，仅首次 bootstrap）"
"${RUN[@]}" sh -c '
  if [ -x node_modules/.bin/prisma ]; then PB=node_modules/.bin/prisma; else PB=node_modules/.pnpm/node_modules/.bin/prisma; fi
  "$PB" db push --skip-generate
'

echo "==> baseline：标记全部迁移为已应用"
"${RUN[@]}" sh -c '
  if [ -x node_modules/.bin/prisma ]; then PB=node_modules/.bin/prisma; else PB=node_modules/.pnpm/node_modules/.bin/prisma; fi
  for d in prisma/migrations/*/; do
    "$PB" migrate resolve --applied "$(basename "$d")"
  done
'

echo "✅ Bootstrap 完成。后续 deploy 仅使用 prisma migrate deploy"
