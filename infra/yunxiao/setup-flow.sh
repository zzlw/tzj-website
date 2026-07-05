#!/usr/bin/env bash
# 通过云效 CLI 创建/更新流水线（需 PAT 具备 Flow 写入权限）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PIPELINE_YAML="$ROOT/infra/yunxiao/pipeline.yml"

: "${ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID:?set ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID}"
: "${ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN:?set ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN}"

if grep -q 'CODEUP_SERVICE_CONNECTION' "$PIPELINE_YAML"; then
  echo "⚠️  请先在 infra/yunxiao/pipeline.yml 中将 CODEUP_SERVICE_CONNECTION 替换为 Codeup 服务连接 uuid"
  echo "   控制台：Flow → 全局设置 → 服务连接 → 新建 Codeup → 复制 uuid"
  exit 1
fi

CONTENT="$(<"$PIPELINE_YAML")"

if aliyun devops flow-list-pipelines 2>/dev/null | grep -q 'TZJ Deploy Production'; then
  echo "流水线已存在，请控制台 YAML 编辑导入，或使用 flow-update-pipeline（若 CLI 支持）"
else
  aliyun devops flow-create-pipeline \
    --name "TZJ Deploy Production" \
    --content "$CONTENT"
  echo "✅ 流水线已创建"
fi

echo ""
echo "后续："
echo "  1. 绑定变量组 tzj-prod-secrets（ACR 凭证，部署阶段 VMDeploy 脚本会读 ECS /opt/tzj/.env.deploy）"
echo "  2. 确认主机组 tzj-prod-ecs runner 在线"
echo "  3. 手动运行一次验证 build → ACR → ECS deploy"
