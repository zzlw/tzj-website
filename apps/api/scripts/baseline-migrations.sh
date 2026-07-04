#!/usr/bin/env bash
# 将已有 schema（通常由 db push 创建）标记为已应用全部迁移，避免 migrate deploy 报 P3005。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API="$ROOT/apps/api"
ENV_FILE="$ROOT/.env"
PRISMA="$API/node_modules/prisma/build/index.js"
MIGRATIONS_DIR="$API/prisma/migrations"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 $ENV_FILE，请先 cp .env.example .env" >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "未找到 migrations 目录: $MIGRATIONS_DIR" >&2
  exit 1
fi

echo "正在 baseline：将现有迁移标记为已应用…"
for dir in "$MIGRATIONS_DIR"/*/; do
  name="$(basename "$dir")"
  node --env-file="$ENV_FILE" "$PRISMA" migrate resolve --applied "$name"
done

echo "完成。可运行 pnpm db:migrate 验证。"
