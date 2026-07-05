#!/usr/bin/env bash
# ============================================================
# TZJ — 【应急】在 ECS 上本地 build + push ACR + deploy
# ============================================================
# 默认 CI 已改为云效公共集群构建（见 infra/yunxiao/pipeline.yml），
# 仅在云效不可用时手动 SSH 执行本脚本。工作目录 /opt/tzj/build
# 依赖：/opt/tzj/.env.deploy（ACR 凭证）、/opt/tzj/.env.prod（运行时）
# ============================================================

set -euo pipefail

BUILD_DIR="${BUILD_DIR:-/opt/tzj/build}"
DEPLOY_ENV="${DEPLOY_ENV:-/opt/tzj/.env.deploy}"
cd "$BUILD_DIR"

if [[ -f "$DEPLOY_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV"
  set +a
fi

ACR_REGISTRY="${ACR_REGISTRY:-REDACTED-ACR}"
ACR_NAMESPACE="${ACR_NAMESPACE:-REDACTED-NAMESPACE}"
IMAGE_PREFIX="${ACR_REGISTRY}/${ACR_NAMESPACE}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
APPS=(api admin web)

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://tzj-api.jiawen.live/api/v1}"
NEXT_PUBLIC_ADMIN_API_URL="${NEXT_PUBLIC_ADMIN_API_URL:-https://tzj-api.jiawen.live/api/v1}"
NEXT_PUBLIC_S3_PUBLIC_DOMAIN="${NEXT_PUBLIC_S3_PUBLIC_DOMAIN:-https://tzj-static.jiawen.live}"
NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://tzj.jiawen.live}"
NEXT_PUBLIC_WEB_URL="${NEXT_PUBLIC_WEB_URL:-https://tzj.jiawen.live}"

: "${ACR_USERNAME:?missing ACR_USERNAME in $DEPLOY_ENV}"
: "${ACR_PASSWORD:?missing ACR_PASSWORD in $DEPLOY_ENV}"

echo "==> TZJ deploy-on-ecs"
echo "    dir:  $BUILD_DIR"
echo "    tag:  $IMAGE_TAG"
echo "    repo: $IMAGE_PREFIX"

echo "==> git sync"
git fetch origin main
git reset --hard "origin/main"

echo "==> ACR login"
echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin

build_one() {
  local app="$1"
  local img="${IMAGE_PREFIX}/tzj-${app}"
  local -a args=()
  echo ""
  echo "==> Build ${app} → ${img}:${IMAGE_TAG}"
  if [[ "$app" == "web" || "$app" == "admin" ]]; then
    args+=(
      --build-arg "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
      --build-arg "NEXT_PUBLIC_ADMIN_API_URL=${NEXT_PUBLIC_ADMIN_API_URL}"
      --build-arg "NEXT_PUBLIC_S3_PUBLIC_DOMAIN=${NEXT_PUBLIC_S3_PUBLIC_DOMAIN}"
      --build-arg "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}"
      --build-arg "NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}"
    )
  fi
  DOCKER_BUILDKIT=0 docker build \
    -f "apps/${app}/Dockerfile" \
    "${args[@]}" \
    -t "${img}:${IMAGE_TAG}" \
    -t "${img}:latest" \
    .
  docker push "${img}:${IMAGE_TAG}"
  docker push "${img}:latest"
}

for app in "${APPS[@]}"; do
  build_one "$app"
done

echo ""
echo "==> Deploy"
export IMAGE_TAG IMAGE_REGISTRY="$IMAGE_PREFIX"
cd /opt/tzj
chmod +x deploy.sh
./deploy.sh

echo "✅ deploy-on-ecs done — ${IMAGE_PREFIX}/tzj-*:${IMAGE_TAG}"
