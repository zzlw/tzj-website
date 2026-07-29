#!/usr/bin/env bash
# ============================================================
# TZJ — ECS 部署：更新 tag → pull → migrate（api）→ 滚动更新
# 用法：deploy.sh <api|web|admin|all> <tag>
#   deploy.sh all d2e7ac7          # 全量部署（云效 VMDeploy / 日常发布）
#   deploy.sh api d2e7ac7          # 仅 api（含 migrate）
#   deploy.sh web d2e7ac7          # 仅 web（--no-deps，不重启 postgres/api）
#
# 兼容旧调用：无参数且已 export IMAGE_TAG 时等价于 deploy.sh all "$IMAGE_TAG"
#
# 环境文件（/opt/tzj）：
#   .env.prod        — 非敏感配置 + 运行时变量（api 容器 env_file）
#   .env.prod.local  — 镜像 tag + 可选密钥（gitignore，deploy 自动维护 TAG）
#   .env.deploy      — ACR 凭证（可选，存在则自动 docker login）
# ============================================================
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/tzj}"
cd "$DEPLOY_DIR"

ENV_FILE=".env.prod"
LOCAL_ENV_FILE=".env.prod.local"
COMPOSE_FILE="docker-compose.prod.yml"
ACME_OVERRIDE="docker-compose.acme.override.yml"
PROJECT_NAME="tzj"
NETWORK="${PROJECT_NAME}_default"

COMPOSE_FILES=(-f "$COMPOSE_FILE")
if [[ -f "$ACME_OVERRIDE" ]]; then
  COMPOSE_FILES+=(-f "$ACME_OVERRIDE")
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 ${DEPLOY_DIR}/${ENV_FILE}，请从 infra/docker/.env.prod.example 复制" >&2
  exit 1
fi

if [[ ! -f "$LOCAL_ENV_FILE" ]]; then
  echo "缺少 ${DEPLOY_DIR}/${LOCAL_ENV_FILE}，请：cp .env.prod.local.example .env.prod.local" >&2
  exit 1
fi

compose() {
  docker compose "${COMPOSE_FILES[@]}" \
    --env-file "$ENV_FILE" \
    --env-file "$LOCAL_ENV_FILE" \
    "$@"
}

docker_login_if_needed() {
  if [[ -f .env.deploy ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env.deploy
    set +a
    echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin
  fi
}

persist_tag() {
  local var=$1
  local tag=$2
  if ! [[ "$var" =~ ^[A-Z0-9_]+$ ]]; then
    echo "invalid tag variable: $var" >&2
    exit 1
  fi
  if grep -q "^${var}=" "$LOCAL_ENV_FILE"; then
    sed -i.bak "s|^${var}=.*|${var}=${tag}|" "$LOCAL_ENV_FILE" && rm -f "${LOCAL_ENV_FILE}.bak"
  else
    printf '%s=%s\n' "$var" "$tag" >>"$LOCAL_ENV_FILE"
  fi
}

service_tag_var() {
  case "$1" in
    api) echo API_TAG ;;
    web) echo WEB_TAG ;;
    admin) echo ADMIN_TAG ;;
    *) echo "unknown service: $1" >&2; exit 1 ;;
  esac
}

run_migrate() {
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  # shellcheck disable=SC1091
  source "$LOCAL_ENV_FILE"
  set +a

  local api_tag="${API_TAG:-${IMAGE_TAG:-latest}}"
  local api_image="${IMAGE_REGISTRY}/tzj-api:${api_tag}"
  local migrate_env=(--env-file "$ENV_FILE" --env-file "$LOCAL_ENV_FILE")

  # Prisma migration engine（schema-engine）无法解析 compose 服务名 postgres：建立 TCP 后
  # pg 握手挂起，~60s 后抛 P1001（同镜像的 query engine / node getaddrinfo 解析均正常，
  # 仅 migration engine 的 DNS 解析器命中此坑）。解析 postgres 容器当前 IP 并 --add-host
  # 钉进 /etc/hosts（getaddrinfo 优先命中，绕过 DNS），每次部署重算，postgres 重启换 IP 亦安全。
  local add_host_args=()
  local pg_cid pg_ip
  pg_cid=$(compose ps -q postgres 2>/dev/null || true)
  if [[ -n "$pg_cid" ]]; then
    pg_ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$pg_cid" 2>/dev/null || true)
    if [[ -n "$pg_ip" ]]; then
      add_host_args=(--add-host "postgres:${pg_ip}")
      echo "==> Migrate 解析 postgres -> ${pg_ip}（绕过 schema-engine DNS 坑）"
    fi
  fi

  echo "==> Migrate (${api_image})"
  docker run --rm --network "$NETWORK" \
    ${add_host_args[@]+"${add_host_args[@]}"} \
    -e NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    -e COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
    "${migrate_env[@]}" \
    "$api_image" \
    sh -c '
      if [ -x node_modules/.bin/prisma ]; then
        PB=node_modules/.bin/prisma
      else
        PB=node_modules/.pnpm/node_modules/.bin/prisma
      fi
      if ! "$PB" migrate deploy; then
        echo "migrate deploy 失败" >&2
        exit 1
      fi
    '
}

wait_api_healthy() {
  for _ in $(seq 1 45); do
    if compose exec -T api wget -qO- http://127.0.0.1:4000/api/v1/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "api health check timeout" >&2
  return 1
}

smoke_test() {
  compose exec -T api wget -qO- http://127.0.0.1:4000/api/v1/health
  compose exec -T web wget -qO- http://127.0.0.1:3000/ >/dev/null
  echo "web:ok"
  compose exec -T admin wget -qO- http://127.0.0.1:3000/ >/dev/null
  echo "admin:ok"
}

# ── 参数解析（兼容 VMDeploy：仅 export IMAGE_TAG）────────────────
if [[ $# -eq 0 ]]; then
  if [[ -n "${IMAGE_TAG:-}" ]]; then
    set -- all "$IMAGE_TAG"
  else
    echo "用法: deploy.sh <api|web|admin|all> <tag>" >&2
    exit 1
  fi
fi

SERVICE=$1
TAG=${2:-latest}

case "$SERVICE" in
  api | web | admin) SERVICES=$SERVICE ;;
  all) SERVICES="api web admin" ;;
  *)
    echo "用法: deploy.sh <api|web|admin|all> <tag>" >&2
    exit 1
    ;;
esac

docker_login_if_needed

for s in $SERVICES; do
  persist_tag "$(service_tag_var "$s")" "$TAG"
done
if [[ "$SERVICE" == "all" ]]; then
  persist_tag "IMAGE_TAG" "$TAG"
fi

# postgres：部署 api 或全量时需要
if [[ "$SERVICE" == "all" || "$SERVICE" == "api" ]]; then
  echo "==> Ensure postgres"
  compose up -d postgres
  for _ in $(seq 1 30); do
    if compose ps postgres 2>/dev/null | grep -q healthy; then
      break
    fi
    sleep 2
  done
fi

if [[ "$SERVICE" == "all" || "$SERVICE" == "api" ]]; then
  run_migrate
fi

echo "==> Pull images ($SERVICES → $TAG)"
compose pull $SERVICES

echo "==> Rolling update ($SERVICES)"
if [[ "$SERVICE" == "all" ]]; then
  compose up -d --no-deps api
  wait_api_healthy
  compose up -d --no-deps admin web
else
  compose up -d --no-deps $SERVICES
  if [[ "$SERVICE" == "api" ]]; then
    wait_api_healthy
  fi
fi

echo "==> Prune dangling images"
docker image prune -f >/dev/null

echo "==> Ensure gateway (+ acme if needed)"
compose up -d --force-recreate --no-deps gateway
compose up -d --no-deps acme

compose ps $SERVICES gateway

if [[ "$SERVICE" == "all" || "$SERVICE" == "api" ]]; then
  smoke_test
fi

echo "✅ Deploy done: $SERVICES → $TAG"
