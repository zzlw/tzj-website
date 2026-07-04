#!/usr/bin/env bash
# 将 pg_dump 备份导入本地 PostgreSQL（新电脑恢复）
# 用法: ./infra/docker/postgres-import.sh /path/to/tzj-db-export-YYYYMMDD
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="${POSTGRES_CONTAINER:-tzj_postgres_dev}"
DB_USER="${POSTGRES_USER:-tzj_admin}"
DB_NAME="${POSTGRES_DB:-tzj_dev}"
SRC="${1:?请指定导出目录，例如 ../tzj-db-export-20260705}"
DUMP="$SRC/${DB_NAME}.dump"

if [[ ! -f "$DUMP" ]]; then
  echo "未找到 $DUMP，请确认导出目录结构正确。" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "PostgreSQL 未运行。请先执行: pnpm db:up" >&2
  exit 1
fi

echo "→ 导入数据库: $DB_NAME"
echo "→ 来源: $DUMP"
echo "  （将覆盖现有 schema 与数据）"

docker cp "$DUMP" "$CONTAINER:/tmp/${DB_NAME}.dump"
docker exec "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-acl "/tmp/${DB_NAME}.dump"
docker exec "$CONTAINER" rm "/tmp/${DB_NAME}.dump"

echo "✓ 导入完成"
