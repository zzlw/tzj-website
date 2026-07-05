#!/usr/bin/env bash
# ============================================================
# 云效 Flow — ECS 一键接入 Runner（方式 A，CLI 自动化）
# ============================================================
# 依赖：~/.zshrc 中的 ALIBABA_CLOUD_YUNXIAO_* 与 aliyun devops CLI
#
# 用法：
#   ./infra/yunxiao/setup-runner-ecs.sh
#   ./infra/yunxiao/setup-runner-ecs.sh --verify-only
#   ./infra/yunxiao/setup-runner-ecs.sh --reinstall
# ============================================================

set -euo pipefail

ORG_ID="${ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID:-6a4a4fd4a6fcee143fa2797d}"
HOST_GROUP_ID="${TZJ_HOST_GROUP_ID:-351710}"
HOST_GROUP_UUID="${TZJ_HOST_GROUP_UUID:-at8qhfefzyif3ao8}"
ECS_INSTANCE_ID="${TZJ_ECS_INSTANCE_ID:-i-2ze7narz240e4nfb6aoy}"
ECS_IP="${TZJ_ECS_IP:-REDACTED-IP}"
ECS_NAME="${TZJ_ECS_NAME:-launch-advisor-20260705}"
ECS_REGION="${TZJ_ECS_REGION:-cn-beijing}"
SERVICE_CONNECTION_ID="${TZJ_ECS_SERVICE_CONNECTION_ID:-920915}"

VERIFY_ONLY=false
REINSTALL=false
for arg in "$@"; do
  case "$arg" in
    --verify-only) VERIFY_ONLY=true ;;
    --reinstall) REINSTALL=true ;;
  esac
done

: "${ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN:?set ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN in ~/.zshrc}"

devops() {
  aliyun devops "$@" --organization-id "$ORG_ID"
}

log() { echo "==> $*"; }

verify_ecs_runner() {
  log "检查 ECS ${ECS_IP} 上的 Runner..."
  ssh -o ConnectTimeout=10 "root@${ECS_IP}" '
    set -e
    echo "--- systemd runner services ---"
    systemctl list-units --type=service --all | grep runner || true
    echo "--- /root/yunxiao ---"
    ls -la /root/yunxiao 2>/dev/null || echo "(empty)"
    echo "--- cloud assistant ---"
    systemctl is-active aliyun.service
  '
}

verify_host_group() {
  log "主机组 ${HOST_GROUP_ID} 状态："
  devops flow-get-host-group --id "$HOST_GROUP_ID" | python3 -m json.tool
}

trigger_ecs_install() {
  local machine_json
  machine_json=$(python3 - <<PY
import json
print(json.dumps([{
  "aliyunRegionId": "${ECS_REGION}",
  "machineSn": "${ECS_INSTANCE_ID}",
  "instanceName": "${ECS_NAME}",
  "ip": "${ECS_IP}",
}]))
PY
)

  if $REINSTALL; then
    log "从主机组移除 ECS ${ECS_INSTANCE_ID}..."
    devops flow-delete-machine-group-machines \
      --id "$HOST_GROUP_ID" \
      --machine-sns "$ECS_INSTANCE_ID" || true
    sleep 2
  fi

  log "触发 ECS 一键接入（UpdateHostGroup + machineInfos）..."
  devops flow-update-host-group \
    --id "$HOST_GROUP_ID" \
    --type ECS \
    --name tzj-prod-ecs \
    --service-connection-id "$SERVICE_CONNECTION_ID" \
    --ecs-type ECS_ALIYUN \
    --aliyun-region "$ECS_REGION" \
    --machine-infos "$machine_json"
}

wait_for_runner() {
  local i
  log "等待 Runner 安装（最多 3 分钟）..."
  for i in $(seq 1 18); do
    if ssh -o ConnectTimeout=10 "root@${ECS_IP}" \
      'systemctl list-units --type=service --all 2>/dev/null | grep -q "runner-.*running"'; then
      log "Runner 已在线"
      return 0
    fi
    sleep 10
  done
  return 1
}

main() {
  if $VERIFY_ONLY; then
    verify_host_group
    verify_ecs_runner
    exit 0
  fi

  log "组织: ${ORG_ID}"
  log "主机组: ${HOST_GROUP_ID} (${HOST_GROUP_UUID})"
  log "ECS: ${ECS_INSTANCE_ID} @ ${ECS_IP}"
  log "ECS 服务连接: ${SERVICE_CONNECTION_ID}"

  verify_host_group || true

  if trigger_ecs_install; then
    log "云效已接受主机组更新"
  else
    echo ""
    echo "❌ ECS 一键接入失败（常见错误 3000005）"
    echo ""
    echo "根因通常是：云效 ECS 服务连接的 RAM 授权无效，导致云效无法通过云助手下发安装命令。"
    echo "请在控制台修复（约 1 分钟）："
    echo "  1. 打开 https://devops.aliyun.com → 流水线 Flow → 全局设置 → 服务连接"
    echo "  2. 找到 ECS 连接（tzj-ecs / tzj-ecs-v2）→ 编辑 → 重新授权 RAM"
    echo "  3. 完成后重新运行: $0 --reinstall"
    echo ""
    echo "验证云助手（本脚本已测过应正常）："
    echo "  aliyun ecs RunCommand --RegionId cn-beijing --InstanceId ${ECS_INSTANCE_ID} ..."
    exit 1
  fi

  if wait_for_runner; then
    verify_ecs_runner
    log "✅ Runner 安装成功，可在云效重试流水线部署阶段"
  else
    echo ""
    echo "⚠️  主机组已更新但 ECS 上仍未检测到 Runner 服务。"
    echo "请到 云效 → 主机组 tzj-prod-ecs → 查看安装进度/日志。"
    echo "若仍为 3000005，请按上方 RAM 重新授权步骤操作后: $0 --reinstall"
    exit 1
  fi
}

main "$@"
