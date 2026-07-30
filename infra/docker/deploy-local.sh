#!/usr/bin/env bash
# ============================================================
# TZJ — 本地构建 → push ACR → SSH 部署 ECS
# ============================================================
# 替代 GitHub Actions deploy（跨境 SSH 慢/不稳定时用）
#
# 准备:
#   cp infra/docker/.env.deploy.local.example infra/docker/.env.deploy.local
#   # 填写 ACR_PASSWORD 等
#
# 用法:
#   ./infra/docker/deploy-local.sh              # build + push + deploy
#   ./infra/docker/deploy-local.sh --build-only # 只构建并 push
#   ./infra/docker/deploy-local.sh --deploy-only # 只部署已有 tag（需 IMAGE_TAG）
#   ./infra/docker/deploy-local.sh --app web     # 只构建/部署单个服务
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
ECS_HOST="${ECS_HOST:-REDACTED-IP}" # 真生产；REDACTED-IP 是旧项目废弃服务器，严禁使用
ECS_USER="${ECS_USER:-root}"
if [[ -z "${ECS_SSH_KEY:-}" ]]; then
  for candidate in "${HOME}/.ssh/id_ed25519" "${HOME}/.ssh/id_rsa"; do
    if [[ -f "$candidate" ]]; then
      ECS_SSH_KEY="$candidate"
      break
    fi
  done
fi
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "${ECS_SSH_KEY:-}" ]]; then
  SSH_OPTS=(-i "$ECS_SSH_KEY" "${SSH_OPTS[@]}")
fi
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.tzjii.com/api/v1}"
NEXT_PUBLIC_ADMIN_API_URL="${NEXT_PUBLIC_ADMIN_API_URL:-https://api.tzjii.com/api/v1}"
NEXT_PUBLIC_S3_PUBLIC_DOMAIN="${NEXT_PUBLIC_S3_PUBLIC_DOMAIN:-https://static.tzjii.com/tzj-uploads-prod}"
NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://www.tzjii.com}"
NEXT_PUBLIC_WEB_URL="${NEXT_PUBLIC_WEB_URL:-https://www.tzjii.com}"

APPS=(web admin api)
DO_BUILD=1
DO_DEPLOY=1
ONLY_APP=""

usage() {
  sed -n '2,20p' "$0" | tail -n +2
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help) usage 0 ;;
    --build-only) DO_DEPLOY=0; shift ;;
    --deploy-only) DO_BUILD=0; shift ;;
    --app) ONLY_APP="${2:?--app requires web|admin|api}"; shift 2 ;;
    --tag) IMAGE_TAG="${2:?--tag requires value}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

if [[ -n "$ONLY_APP" ]]; then
  APPS=("$ONLY_APP")
fi

require_var() {
  if [[ -z "${!1:-}" ]]; then
    echo "缺少 $1，请写入 ${ENV_FILE} 或 export 环境变量" >&2
    exit 1
  fi
}

build_app() {
  local app="$1"
  local image="${IMAGE_PREFIX}/tzj-${app}"
  local -a args=()

  echo ""
  echo "==> Build tzj-${app} (${DOCKER_PLATFORM}) → ${image}:${IMAGE_TAG}"

  if [[ "$app" == "web" || "$app" == "admin" ]]; then
    args+=(
      --build-arg "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
      --build-arg "NEXT_PUBLIC_ADMIN_API_URL=${NEXT_PUBLIC_ADMIN_API_URL}"
      --build-arg "NEXT_PUBLIC_S3_PUBLIC_DOMAIN=${NEXT_PUBLIC_S3_PUBLIC_DOMAIN}"
      --build-arg "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}"
      --build-arg "NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}"
    )
  fi

  docker build \
    --platform "$DOCKER_PLATFORM" \
    -f "apps/${app}/Dockerfile" \
    ${args[@]+"${args[@]}"} \
    -t "${image}:${IMAGE_TAG}" \
    -t "${image}:latest" \
    .
}

push_app() {
  local app="$1"
  local image="${IMAGE_PREFIX}/tzj-${app}"
  echo "==> Push ${image}:${IMAGE_TAG} + :latest"
  docker push "${image}:${IMAGE_TAG}"
  docker push "${image}:latest"
}

deploy_remote() {
  echo ""
  echo "==> Upload compose & deploy.sh → ${ECS_USER}@${ECS_HOST}:/opt/tzj/"
  scp "${SSH_OPTS[@]}" \
    infra/docker/docker-compose.prod.yml \
    infra/docker/deploy.sh \
    "${ECS_USER}@${ECS_HOST}:/opt/tzj/"

  echo "==> Deploy on ECS (IMAGE_TAG=${IMAGE_TAG})"
  ssh "${SSH_OPTS[@]}" \
    "${ECS_USER}@${ECS_HOST}" \
    "ACR_REGISTRY=${ACR_REGISTRY} ACR_USERNAME=${ACR_USERNAME} ACR_PASSWORD=${ACR_PASSWORD} IMAGE_TAG=${IMAGE_TAG} IMAGE_REGISTRY=${IMAGE_PREFIX} bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/tzj
chmod +x deploy.sh
echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin
export IMAGE_TAG IMAGE_REGISTRY
./deploy.sh
REMOTE
}

echo "TZJ local deploy"
echo "  registry: ${IMAGE_PREFIX}"
echo "  tag:      ${IMAGE_TAG}"
echo "  apps:     ${APPS[*]}"
echo "  platform: ${DOCKER_PLATFORM}"

if [[ "$DO_BUILD" == 1 ]]; then
  require_var ACR_USERNAME
  require_var ACR_PASSWORD
  echo "==> docker login ${ACR_REGISTRY}"
  echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" -u "$ACR_USERNAME" --password-stdin
  for app in "${APPS[@]}"; do
    build_app "$app"
    push_app "$app"
  done
fi

if [[ "$DO_DEPLOY" == 1 ]]; then
  require_var ACR_USERNAME
  require_var ACR_PASSWORD
  if [[ -n "${ECS_SSH_KEY:-}" && ! -f "$ECS_SSH_KEY" ]]; then
    echo "SSH 密钥不存在: ${ECS_SSH_KEY}" >&2
    exit 1
  fi
  deploy_remote
fi

echo ""
echo "✅ Done — ${IMAGE_PREFIX}/tzj-{web,admin,api}:${IMAGE_TAG}"
