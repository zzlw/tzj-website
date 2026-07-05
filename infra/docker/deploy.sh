#!/usr/bin/env bash
set -euo pipefail
cd /opt/tzj

if [[ ! -f .env.prod ]]; then
  echo "缺少 /opt/tzj/.env.prod" >&2
  exit 1
fi

TAG_FROM_CI="${IMAGE_TAG:-}"

set -a
# shellcheck disable=SC1091
source .env.prod
set +a

: "${IMAGE_REGISTRY:?IMAGE_REGISTRY required}"
if [[ -n "$TAG_FROM_CI" ]]; then
  IMAGE_TAG="$TAG_FROM_CI"
fi
: "${IMAGE_TAG:?IMAGE_TAG required}"

echo "==> Ensure postgres"
docker compose -f docker-compose.prod.yml up -d postgres
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml ps postgres 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 2
done

echo "==> Pull images ${IMAGE_TAG}"
docker compose -f docker-compose.prod.yml pull api web admin

echo "==> Migrate"
docker run --rm --network tzj_default --env-file .env.prod \
  -e NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
  -e COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
  "${IMAGE_REGISTRY}/tzj-api:${IMAGE_TAG}" \
  sh -c '
    if [ -x node_modules/.bin/prisma ]; then
      PB=node_modules/.bin/prisma
    else
      PB=node_modules/.pnpm/node_modules/.bin/prisma
    fi
    "$PB" migrate deploy || "$PB" db push --skip-generate
  '

echo "==> Up api"
docker compose -f docker-compose.prod.yml up -d --no-deps api
for i in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:4000/api/v1/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Up admin + web"
docker compose -f docker-compose.prod.yml up -d --no-deps admin web

curl -fsS http://127.0.0.1:4000/api/v1/health
curl -fsS -o /dev/null -w "web:%{http_code}\n" http://127.0.0.1:3000/
curl -fsS -o /dev/null -w "admin:%{http_code}\n" http://127.0.0.1:3002/
echo "✅ Deploy done"
