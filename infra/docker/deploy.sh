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
  # 静态资源断言：favicon 已托管 OSS statics/（本地不再提供兜底），
  # 从容器内直接验证 OSS URL；browser-support/vditor 验证镜像 public 复制链路
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
  compose exec -T web sh -c '
    wget -qO /dev/null http://127.0.0.1:3000/ &&
    wget -qO /dev/null '"${S3_PUBLIC_DOMAIN}"'/statics/favicon.ico &&
    wget -qO /dev/null http://127.0.0.1:3000/browser-support.js &&
    wget -qO /dev/null http://127.0.0.1:3000/vditor-assets/dist/js/lute/lute.min.js
  '
  echo "web:ok"
  compose exec -T admin sh -c '
    wget -qO /dev/null http://127.0.0.1:3000/login &&
    wget -qO /dev/null http://127.0.0.1:3000/vditor-assets/dist/js/lute/lute.min.js
  '
  echo "admin:ok"
}

CDN_SYNC_DIR="${DEPLOY_DIR}/cdn-sync"

# 将 Next 构建产物与 public 辅助静态资源同步到 OSS（static.tzjii.com CDN 源站）。
# 必须在滚动更新前执行：新镜像 HTML 已烘焙 assetPrefix（NEXT_PUBLIC_ASSET_PREFIX），
# _next/static 若未先上传会出现整站 CSS/JS 404。
sync_cdn_static() {
  local app=$1
  local bucket
  local image
  local extractor="tzj-cdn-extract-${app}"
  local local_count oss_count

  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  # shellcheck disable=SC1091
  source "$LOCAL_ENV_FILE"
  set +a

  bucket="${S3_BUCKET:-}"
  image="${IMAGE_REGISTRY:-}/tzj-${app}:${TAG}"
  if [[ -z "$bucket" ]]; then
    echo "缺少 S3_BUCKET（.env.prod），无法同步 CDN 静态资源" >&2
    exit 1
  fi
  if [[ -z "${ALI_KEY:-}" || -z "${ALI_SECRET:-}" ]]; then
    echo "缺少 ALI_KEY/ALI_SECRET（.env.prod.local），无法同步 CDN 静态资源" >&2
    exit 1
  fi

  echo "==> Extract ${app} 构建产物（${image}）"
  rm -rf "${CDN_SYNC_DIR}/${app}"
  mkdir -p "${CDN_SYNC_DIR}/${app}"
  docker rm -f "$extractor" >/dev/null 2>&1 || true
  docker create --name "$extractor" "$image" >/dev/null
  docker cp "${extractor}:/app/apps/${app}/.next/static" "${CDN_SYNC_DIR}/${app}/next-static"
  docker cp "${extractor}:/app/apps/${app}/public/vditor-assets" "${CDN_SYNC_DIR}/${app}/vditor-assets"
  if [[ "$app" == "web" ]]; then
    docker cp "${extractor}:/app/apps/web/public/browser-support.js" "${CDN_SYNC_DIR}/web/browser-support.js"
    docker cp "${extractor}:/app/apps/web/public/apple-touch-icon.png" "${CDN_SYNC_DIR}/web/apple-touch-icon.png"
  fi
  if [[ "$app" == "admin" ]]; then
    docker cp "${extractor}:/app/apps/admin/public/sounds" "${CDN_SYNC_DIR}/admin/sounds"
  fi
  docker rm -f "$extractor" >/dev/null

  local oss_args=(-e oss-cn-beijing-internal.aliyuncs.com --region cn-beijing -i "$ALI_KEY" -k "$ALI_SECRET")

  echo "==> Upload ${app} _next/static → oss://${bucket}/next/${app}/_next/static"
  ossutil sync "${CDN_SYNC_DIR}/${app}/next-static" "oss://${bucket}/next/${app}/_next/static" \
    "${oss_args[@]}" --cache-control "public, max-age=31536000, immutable"

  echo "==> Upload ${app} vditor-assets → oss://${bucket}/statics/vditor-assets"
  ossutil sync "${CDN_SYNC_DIR}/${app}/vditor-assets" "oss://${bucket}/statics/vditor-assets" \
    "${oss_args[@]}" --cache-control "public, max-age=86400"

  if [[ "$app" == "web" ]]; then
    echo "==> Upload web public 静态资源（statics/）"
    ossutil cp "${CDN_SYNC_DIR}/web/browser-support.js" "oss://${bucket}/statics/browser-support.js" \
      "${oss_args[@]}" --cache-control "public, max-age=86400" -f
    ossutil cp "${CDN_SYNC_DIR}/web/apple-touch-icon.png" "oss://${bucket}/statics/apple-touch-icon.png" \
      "${oss_args[@]}" --cache-control "public, max-age=86400" -f
  fi
  if [[ "$app" == "admin" ]]; then
    echo "==> Upload admin sounds → oss://${bucket}/statics/sounds"
    ossutil sync "${CDN_SYNC_DIR}/admin/sounds" "oss://${bucket}/statics/sounds" \
      "${oss_args[@]}" --cache-control "public, max-age=86400"
  fi

  # 校验：OSS 上前缀对象数 ≥ 本地文件数（历史部署会累积旧 hash，故用 ≥ 而非 =）
  local_count=$(find "${CDN_SYNC_DIR}/${app}/next-static" -type f | wc -l | tr -d ' ')
  oss_count=$(ossutil ls -r "oss://${bucket}/next/${app}/_next/static/" "${oss_args[@]}" 2>/dev/null \
    | grep -Eo 'Object Number is: [0-9]+' | awk '{print $4}' | tail -1)
  oss_count=${oss_count:-0}
  if [[ "$oss_count" -lt "$local_count" ]]; then
    echo "静态资源同步校验失败：${app} 本地 ${local_count} 个，OSS ${oss_count} 个" >&2
    exit 1
  fi
  echo "==> ${app} 静态资源同步完成（OSS ≥ ${local_count} 个）"
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

echo "==> Sync CDN 静态资源（OSS）"
if [[ "$SERVICE" == "all" || "$SERVICE" == "web" || "$SERVICE" == "admin" ]]; then
  for s in web admin; do
    case " $SERVICES " in
      *" $s "*) sync_cdn_static "$s" ;;
    esac
  done
fi

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

# 冒烟断言：不论部署哪个服务都全量跑（历史上 public 404 曾因缺部署后验证两次进入生产）
smoke_test

echo "✅ Deploy done: $SERVICES → $TAG"
