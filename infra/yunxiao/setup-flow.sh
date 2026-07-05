#!/usr/bin/env bash
# 通过云效 CLI 创建流水线（需 PAT 具备 Flow 写入权限）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PIPELINE_YAML="$ROOT/infra/yunxiao/pipeline.yml"

: "${ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID:?set ALIBABA_CLOUD_YUNXIAO_ORGANIZATION_ID}"
: "${ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN:?set ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN}"

CONTENT=$(python3 - "$PIPELINE_YAML" <<'PY'
import json, pathlib, sys
print(json.dumps(pathlib.Path(sys.argv[1]).read_text()))
PY
)

aliyun devops flow-create-pipeline \
  --name "TZJ Deploy Production" \
  --content "$(python3 -c "import json; print(json.loads('''$CONTENT'''))")"

echo "✅ 流水线已创建。请在控制台替换 YAML 中的占位符后校验运行。"
