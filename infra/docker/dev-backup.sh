#!/usr/bin/env bash
# 一键导出 MinIO + PostgreSQL（换机开发前完整备份）
# 用法: ./infra/docker/dev-backup.sh [输出根目录]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATE="$(date +%Y%m%d)"
OUT="${1:-$ROOT/../tzj-dev-backup-$DATE}"

echo "=== TZJ 开发环境备份 → $OUT ==="
mkdir -p "$OUT"

"$ROOT/infra/docker/minio-export.sh" "$OUT/minio"
"$ROOT/infra/docker/postgres-export.sh" "$OUT/postgres"

ARCHIVE="${OUT}.tar.gz"
tar -czf "$ARCHIVE" -C "$(dirname "$OUT")" "$(basename "$OUT")"

echo ""
echo "✓ 备份完成"
echo "  目录: $OUT"
echo "  压缩包: $ARCHIVE ($(du -sh "$ARCHIVE" | awk '{print $1}'))"
