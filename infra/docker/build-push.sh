#!/usr/bin/env bash
# 本地构建三镜像并推送阿里云 ACR（应急 / 调试，生产以 GitHub Actions 为准）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

REGISTRY="${IMAGE_REGISTRY:-REDACTED-ACR/tzj}"
TAG="${IMAGE_TAG:-latest}"
ACR_HOST="${REGISTRY%%/*}"

BUILD_ARGS_WEB=(
  --build-arg "NEXT_PUBLIC_API_URL=https://tzj-api.jiawen.live/api/v1"
  --build-arg "NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://tzj-static.jiawen.live"
  --build-arg "NEXT_PUBLIC_SITE_URL=https://tzj.jiawen.live"
  --build-arg "NEXT_PUBLIC_WEB_URL=https://tzj.jiawen.live"
)
BUILD_ARGS_ADMIN=(
  --build-arg "NEXT_PUBLIC_ADMIN_API_URL=https://tzj-api.jiawen.live/api/v1"
  --build-arg "NEXT_PUBLIC_S3_PUBLIC_DOMAIN=https://tzj-static.jiawen.live"
  --build-arg "NEXT_PUBLIC_WEB_URL=https://tzj.jiawen.live"
)

if [[ -z "${ACR_USERNAME:-}" || -z "${ACR_PASSWORD:-}" ]]; then
  echo "请设置 ACR_USERNAME / ACR_PASSWORD（ACR 控制台固定密码）" >&2
  exit 1
fi

echo "==> Login ${ACR_HOST}"
echo "${ACR_PASSWORD}" | docker login "${ACR_HOST}" -u "${ACR_USERNAME}" --password-stdin

echo "==> Build api"
docker build -f apps/api/Dockerfile -t "${REGISTRY}/tzj-api:${TAG}" .

echo "==> Build web"
docker build -f apps/web/Dockerfile "${BUILD_ARGS_WEB[@]}" -t "${REGISTRY}/tzj-web:${TAG}" .

echo "==> Build admin"
docker build -f apps/admin/Dockerfile "${BUILD_ARGS_ADMIN[@]}" -t "${REGISTRY}/tzj-admin:${TAG}" .

echo "==> Push"
docker push "${REGISTRY}/tzj-api:${TAG}"
docker push "${REGISTRY}/tzj-web:${TAG}"
docker push "${REGISTRY}/tzj-admin:${TAG}"

echo "✅ Pushed ${REGISTRY}/tzj-*:${TAG}"
