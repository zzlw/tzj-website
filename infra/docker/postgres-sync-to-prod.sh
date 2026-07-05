#!/usr/bin/env bash
# 方案 A：本地 PostgreSQL → ECS 生产库（整库覆盖）
#
# 流程：本地 pg_dump → 上传 OSS → 云助手在 ECS 上 pg_restore
# 依赖：pnpm db:up、~/.zshrc 中的 aliyun CLI 凭证
#
# 用法：
#   ./infra/docker/postgres-sync-to-prod.sh
#   ./infra/docker/postgres-sync-to-prod.sh --dry-run
#   ./infra/docker/postgres-sync-to-prod.sh --dump-only /tmp/my-export
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXPORT_DIR="${EXPORT_DIR:-/tmp/tzj-db-sync-prod}"
OSS_BUCKET="${OSS_BUCKET:-tzj-media-static-assets}"
OSS_KEY="${OSS_KEY:-_db-sync/tzj_dev.dump}"
ECS_INSTANCE_ID="${TZJ_ECS_INSTANCE_ID:-i-2ze7narz240e4nfb6aoy}"
ECS_REGION="${TZJ_ECS_REGION:-cn-beijing}"
DRY_RUN=false
DUMP_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --dump-only) DUMP_ONLY=true ;;
  esac
done

if [[ $# -gt 0 && "$1" != --* ]]; then
  EXPORT_DIR="$1"
fi

: "${ALIBABA_CLOUD_ACCESS_KEY_ID:?需要 aliyun CLI 凭证（~/.zshrc 或环境变量）}"

log() { echo "==> $*"; }

log "导出本地数据库"
"$ROOT/infra/docker/postgres-export.sh" "$EXPORT_DIR"
DUMP="$EXPORT_DIR/tzj_dev.dump"

if $DUMP_ONLY; then
  log "仅导出，跳过上传与导入: $DUMP"
  exit 0
fi

log "上传到 oss://${OSS_BUCKET}/${OSS_KEY}"
if $DRY_RUN; then
  echo "(dry-run) aliyun oss cp $DUMP oss://${OSS_BUCKET}/${OSS_KEY} --force"
else
  aliyun oss cp "$DUMP" "oss://${OSS_BUCKET}/${OSS_KEY}" --force
fi

SIGNED_URL="$(aliyun oss sign "oss://${OSS_BUCKET}/${OSS_KEY}" --timeout 7200 2>&1 | head -1)"
if [[ "$SIGNED_URL" != https://* ]]; then
  echo "无法生成 OSS 签名 URL: $SIGNED_URL" >&2
  exit 1
fi

RESTORE_SCRIPT="$(cat <<SCRIPT
#!/bin/bash
set -euo pipefail
cd /opt/tzj
set -a
. ./.env.prod
set +a
mkdir -p /opt/tzj/backups
STAMP=\$(date +%Y%m%d%H%M%S)
echo "==> Backup production DB"
docker exec tzj-postgres-1 pg_dump -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" --no-owner --no-acl -Fc -f /tmp/prod_backup.dump
docker cp tzj-postgres-1:/tmp/prod_backup.dump "/opt/tzj/backups/prod-before-sync-\${STAMP}.dump"
echo "==> Download dump from OSS"
curl -fsSL -o /tmp/tzj_dev.dump '${SIGNED_URL}'
echo "downloaded \$(wc -c </tmp/tzj_dev.dump) bytes"
echo "==> Stop app containers"
docker stop tzj-api-1 tzj-web-1 tzj-admin-1 2>/dev/null || true
echo "==> Restore (overwrite prod data)"
docker cp /tmp/tzj_dev.dump tzj-postgres-1:/tmp/tzj_dev.dump
docker exec tzj-postgres-1 pg_restore -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" --clean --if-exists --no-owner --no-acl /tmp/tzj_dev.dump || true
echo "==> Restart app containers"
docker compose -f docker-compose.prod.yml -f docker-compose.acme.override.yml --env-file .env.prod --env-file .env.prod.local up -d api web admin
echo "==> Verify"
docker exec tzj-postgres-1 psql -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -c "SELECT COUNT(*) AS doc_folders FROM doc_folders;" -c "SELECT COUNT(*) AS internal_docs FROM internal_documents;" -c "SELECT COUNT(*) AS cases FROM cases;"
rm -f /tmp/tzj_dev.dump
echo DONE
SCRIPT
)"

if $DRY_RUN; then
  log "dry-run：跳过云助手执行"
  exit 0
fi

log "通过云助手在 ECS 上导入（实例 ${ECS_INSTANCE_ID}）"
INVOKE_ID="$(aliyun ecs RunCommand \
  --RegionId "$ECS_REGION" \
  --Type RunShellScript \
  --CommandContent "$RESTORE_SCRIPT" \
  --InstanceId.1 "$ECS_INSTANCE_ID" \
  --Timeout 120 \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['InvokeId'])")"

log "等待导入完成（InvokeId: ${INVOKE_ID}）"
for _ in $(seq 1 30); do
  sleep 3
  STATUS="$(aliyun ecs DescribeInvocationResults --RegionId "$ECS_REGION" --InvokeId "$INVOKE_ID" \
    | python3 -c "import sys,json,base64; r=json.load(sys.stdin)['Invocation']['InvocationResults']['InvocationResult'][0]; print(r.get('InvocationStatus',''))")"
  if [[ "$STATUS" == "Success" ]]; then
    aliyun ecs DescribeInvocationResults --RegionId "$ECS_REGION" --InvokeId "$INVOKE_ID" \
      | python3 -c "import sys,json,base64; r=json.load(sys.stdin)['Invocation']['InvocationResults']['InvocationResult'][0]; print(base64.b64decode(r.get('Output','')).decode('utf-8','replace'))"
    log "✅ 生产库已同步"
    exit 0
  fi
  if [[ "$STATUS" == "Failed" || "$STATUS" == "Cancelled" ]]; then
    aliyun ecs DescribeInvocationResults --RegionId "$ECS_REGION" --InvokeId "$INVOKE_ID" \
      | python3 -c "import sys,json,base64; r=json.load(sys.stdin)['Invocation']['InvocationResults']['InvocationResult'][0]; print(base64.b64decode(r.get('Output','')).decode('utf-8','replace')); print('ERROR:', r.get('ErrorInfo',''))"
    exit 1
  fi
done

echo "导入超时，请到 ECS 云助手查看 InvokeId=${INVOKE_ID}" >&2
exit 1
