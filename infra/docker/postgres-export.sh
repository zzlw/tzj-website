#!/usr/bin/env bash
# 导出本地 PostgreSQL 数据库（换机开发前备份）
# 用法: ./infra/docker/postgres-export.sh [输出目录]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="${POSTGRES_CONTAINER:-tzj_postgres_dev}"
DB_USER="${POSTGRES_USER:-tzj_admin}"
DB_NAME="${POSTGRES_DB:-tzj_dev}"
OUT="${1:-$ROOT/../tzj-db-export-$(date +%Y%m%d)}"
DUMP="$OUT/${DB_NAME}.dump"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "PostgreSQL 未运行。请先执行: pnpm db:up" >&2
  exit 1
fi

mkdir -p "$OUT"

echo "→ 导出数据库: $DB_NAME"
echo "→ 目标文件: $DUMP"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl -Fc -f "/tmp/${DB_NAME}.dump"
docker cp "$CONTAINER:/tmp/${DB_NAME}.dump" "$DUMP"
docker exec "$CONTAINER" rm "/tmp/${DB_NAME}.dump"

echo "✓ 完成: $(du -sh "$DUMP" | awk '{print $1}')"
