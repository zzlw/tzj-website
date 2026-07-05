#!/usr/bin/env bash
# ============================================================
# TZJ — ECS 原生构建 → push ACR → deploy
# ============================================================
# 在 ECS 上 docker build（x86 原生，无 Mac 交叉编译）
# 本地用法:
#   ./infra/docker/deploy-ecs-build.sh
#   ./infra/docker/deploy-ecs-build.sh --app api
#   ./infra/docker/deploy-ecs-build.sh --deploy-only
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ROOT}/infra/docker/.env.deploy.local"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

ACR_REGISTRY="${ACR_REGISTRY:-REDACTED-ACR}"
ACR_NAMESPACE="${ACR_NAMESPACE:-REDACTED-NAMESPACE}"
IMAGE_PREFIX="${ACR_REGISTRY}/${ACR_NAMESPACE}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
ECS_HOST="${ECS_HOST:-REDACTED-IP}"
ECS_USER="${ECS_USER:-root}"
ECS_SSH_KEY="${ECS_SSH_KEY:-}"
ECS_BUILD_DIR="/opt/tzj/build"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh ${SSH_OPTS[*]}"
if [[ -n "$ECS_SSH_KEY" && -f "$ECS_SSH_KEY" ]]; then
  SSH_OPTS=(-i "$ECS_SSH_KEY" "${SSH_OPTS[@]}")
  RSYNC_SSH="ssh -i ${ECS_SSH_KEY} -o StrictHostKeyChecking=accept-new"
fi

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://tzj-api.jiawen.live/api/v1}"
NEXT_PUBLIC_ADMIN_API_URL="${NEXT_PUBLIC_ADMIN_API_URL:-https://tzj-api.jiawen.live/api/v1}"
NEXT_PUBLIC_S3_PUBLIC_DOMAIN="${NEXT_PUBLIC_S3_PUBLIC_DOMAIN:-https://tzj-static.jiawen.live}"
NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://tzj.jiawen.live}"
NEXT_PUBLIC_WEB_URL="${NEXT_PUBLIC_WEB_URL:-https://tzj.jiawen.live}"

APPS=(api admin web)
DO_SYNC=1
DO_SEED=1
DO_BUILD=1
DO_DEPLOY=1
ONLY_APP=""

usage() {
  sed -n '2,12p' "$0" | tail -n +2
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help) usage 0 ;;
    --no-sync) DO_SYNC=0; shift ;;
    --no-seed) DO_SEED=0; shift ;;
    --build-only) DO_DEPLOY=0; shift ;;
    --deploy-only) DO_SYNC=0; DO_SEED=0; DO_BUILD=0; shift ;;
    --app) ONLY_APP="${2:?--app requires web|admin|api}"; shift 2 ;;
    --tag) IMAGE_TAG="${2:?--tag requires value}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

[[ -n "$ONLY_APP" ]] && APPS=("$ONLY_APP")

require_var() {
  [[ -n "${!1:-}" ]] || { echo "缺少 $1（${ENV_FILE}）" >&2; exit 1; }
}

ssh_ecs() {
  ssh "${SSH_OPTS[@]}" "${ECS_USER}@${ECS_HOST}" "$@"
}

echo "TZJ ECS native build"
echo "  host:     ${ECS_USER}@${ECS_HOST}"
echo "  registry: ${IMAGE_PREFIX}"
echo "  tag:      ${IMAGE_TAG}"
echo "  apps:     ${APPS[*]}"

if [[ "$DO_SYNC" == 1 ]]; then
  echo ""
  echo "==> rsync 源码 → ECS:${ECS_BUILD_DIR}"
  ssh_ecs "mkdir -p ${ECS_BUILD_DIR}"
  rsync -az --delete \
    -e "$RSYNC_SSH" \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude '.turbo' \
    --exclude 'apps/web/public/media' \
    --exclude 'apps/web/public/docs' \
    "${ROOT}/" "${ECS_USER}@${ECS_HOST}:${ECS_BUILD_DIR}/"
fi

if [[ "$DO_SEED" == 1 ]]; then
  echo ""
  echo "==> 预传基础镜像 node:22-alpine + postgres:15-alpine（避免 ECS 拉 Docker Hub）"
  docker pull --platform linux/amd64 node:22-alpine >/dev/null
  docker pull --platform linux/amd64 postgres:15-alpine >/dev/null
  docker save node:22-alpine postgres:15-alpine | gzip -1 | \
    ssh "${SSH_OPTS[@]}" "${ECS_USER}@${ECS_HOST}" 'gunzip | docker load'
fi

if [[ "$DO_BUILD" == 1 || "$DO_DEPLOY" == 1 ]]; then
  require_var ACR_USERNAME
  require_var ACR_PASSWORD
fi

if [[ "$DO_BUILD" == 1 ]]; then
  echo ""
  echo "==> ECS 配置 Docker 镜像加速"
  ssh_ecs "bash -s" <<'SETUP'
set -euo pipefail
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://docker.1ms.run", "https://docker.m.daocloud.io"]
}
EOF
systemctl restart docker
sleep 2
SETUP

  APPS_STR=$(IFS=,; echo "${APPS[*]}")

  ssh "${SSH_OPTS[@]}" \
    "${ECS_USER}@${ECS_HOST}" \
    env \
    "ACR_REGISTRY=${ACR_REGISTRY}" \
    "ACR_NAMESPACE=${ACR_NAMESPACE}" \
    "ACR_USERNAME=${ACR_USERNAME}" \
    "ACR_PASSWORD=${ACR_PASSWORD}" \
    "IMAGE_TAG=${IMAGE_TAG}" \
    "BUILD_DIR=${ECS_BUILD_DIR}" \
    "APPS_STR=${APPS_STR}" \
    "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" \
    "NEXT_PUBLIC_ADMIN_API_URL=${NEXT_PUBLIC_ADMIN_API_URL}" \
    "NEXT_PUBLIC_S3_PUBLIC_DOMAIN=${NEXT_PUBLIC_S3_PUBLIC_DOMAIN}" \
    "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}" \
    "NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}" \
    bash -s <<'REMOTE'
set -euo pipefail
PREFIX="${ACR_REGISTRY}/${ACR_NAMESPACE}"
cd "$BUILD_DIR"

echo "==> ACR login"
echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin

build_one() {
  local app="$1"
  local img="${PREFIX}/tzj-${app}"
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
    . || return 1
  docker push "${img}:${IMAGE_TAG}" || return 1
  docker push "${img}:latest" || return 1
}

for app in ${APPS_STR//,/ }; do
  build_one "$app" || exit 1
done
REMOTE
  [[ $? -eq 0 ]] || exit 1
fi

if [[ "$DO_DEPLOY" == 1 ]]; then
  echo ""
  echo "==> Deploy on ECS"
  scp "${SSH_OPTS[@]}" \
    infra/docker/docker-compose.prod.yml \
    infra/docker/deploy.sh \
    "${ECS_USER}@${ECS_HOST}:/opt/tzj/"
  ssh "${SSH_OPTS[@]}" \
    "${ECS_USER}@${ECS_HOST}" \
    env "IMAGE_TAG=${IMAGE_TAG}" "IMAGE_REGISTRY=${IMAGE_PREFIX}" \
    bash -s <<'REMOTE'
set -euo pipefail
cd /opt/tzj
chmod +x deploy.sh
export IMAGE_TAG IMAGE_REGISTRY
./deploy.sh
REMOTE
fi

echo ""
echo "✅ ECS build & deploy done — ${IMAGE_PREFIX}/tzj-*:${IMAGE_TAG}"
