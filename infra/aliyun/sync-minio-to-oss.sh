#!/usr/bin/env bash
# 将本地 MinIO 导出目录同步到阿里云 OSS（供 API 读写；公开访问走 gateway 静态目录）
# 用法: ./infra/aliyun/sync-minio-to-oss.sh [minio-export-dir]
set -euo pipefail

BUCKET="${OSS_BUCKET:-tzj-media-static-assets}"
SRC="${1:-../../tzj-minio-export-20260705/tzj-uploads-dev}"

if [[ ! -d "$SRC" ]]; then
  echo "导出目录不存在: $SRC" >&2
  echo "先运行: ./infra/docker/minio-export.sh" >&2
  exit 1
fi

echo "==> 同步 $SRC → oss://${BUCKET}/"
aliyun oss sync "$SRC/" "oss://${BUCKET}/" --update --force
echo "✅ OSS 同步完成（对象默认私有；公开读需 gateway 或控制台放开 Block Public Access）"
