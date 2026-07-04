#!/usr/bin/env bash
# 一键恢复 MinIO + PostgreSQL（新电脑开发环境）
# 用法: ./infra/docker/dev-restore.sh /path/to/tzj-dev-backup-YYYYMMDD
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${1:?请指定备份目录，例如 ../tzj-dev-backup-20260705}"

if [[ ! -d "$SRC/minio" || ! -d "$SRC/postgres" ]]; then
  echo "备份目录需包含 minio/ 与 postgres/ 子目录。" >&2
  echo "若分别备份，可手动执行:" >&2
  echo "  ./infra/docker/postgres-import.sh <postgres目录>" >&2
  echo "  ./infra/docker/minio-import.sh <minio目录>" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx tzj_postgres_dev; then
  echo "请先启动依赖: pnpm db:up" >&2
  exit 1
fi

echo "=== TZJ 开发环境恢复 ← $SRC ==="

"$ROOT/infra/docker/postgres-import.sh" "$SRC/postgres"
"$ROOT/infra/docker/minio-import.sh" "$SRC/minio"

echo ""
echo "✓ 恢复完成。可启动: pnpm dev"
