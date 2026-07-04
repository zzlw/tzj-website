#!/usr/bin/env bash
# 将宿主机目录导入本地 MinIO bucket（新电脑恢复）
# 用法: ./infra/docker/minio-import.sh /path/to/tzj-minio-export-YYYYMMDD
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NETWORK="${MINIO_DOCKER_NETWORK:-docker_tzj-dev}"
BUCKET="${S3_BUCKET:-tzj-uploads-dev}"
ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
USER="${MINIO_ROOT_USER:-minioadmin}"
PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"
SRC="${1:?请指定导出目录，例如 ../tzj-minio-export-20260705}"

if [[ ! -d "$SRC/$BUCKET" ]]; then
  echo "未找到 $SRC/$BUCKET，请确认导出目录结构正确。" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx tzj_minio_dev; then
  echo "MinIO 未运行。请先执行: pnpm db:up" >&2
  exit 1
fi

echo "→ 导入到 bucket: $BUCKET"
echo "→ 来源: $SRC/$BUCKET"

docker run --rm \
  --network "$NETWORK" \
  --entrypoint /bin/sh \
  -v "$SRC:/import:ro" \
  minio/mc \
  -c "mc alias set local $ENDPOINT $USER $PASS && mc mb --ignore-existing local/$BUCKET && mc mirror --overwrite /import/$BUCKET local/$BUCKET"

echo "✓ 导入完成"
