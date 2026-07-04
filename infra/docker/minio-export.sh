#!/usr/bin/env bash
# 导出本地 MinIO bucket 到宿主机目录（换机开发前备份）
# 用法: ./infra/docker/minio-export.sh [输出目录]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker/docker-compose.dev.yml"
NETWORK="${MINIO_DOCKER_NETWORK:-docker_tzj-dev}"
BUCKET="${S3_BUCKET:-tzj-uploads-dev}"
ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
USER="${MINIO_ROOT_USER:-minioadmin}"
PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"
OUT="${1:-$ROOT/../tzj-minio-export-$(date +%Y%m%d)}"

if ! docker ps --format '{{.Names}}' | grep -qx tzj_minio_dev; then
  echo "MinIO 未运行。请先执行: pnpm db:up" >&2
  exit 1
fi

mkdir -p "$OUT"

echo "→ 导出 bucket: $BUCKET"
echo "→ 目标目录: $OUT/$BUCKET"

docker run --rm \
  --network "$NETWORK" \
  --entrypoint /bin/sh \
  -v "$OUT:/export" \
  minio/mc \
  -c "mc alias set local $ENDPOINT $USER $PASS && mc mirror --overwrite local/$BUCKET /export/$BUCKET"

echo "✓ 完成: $(du -sh "$OUT" | awk '{print $1}')，$(find "$OUT" -type f | wc -l | tr -d ' ') 个文件"
