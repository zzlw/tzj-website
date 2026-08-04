#!/usr/bin/env bash
# ============================================================
# 阿里云 OSS — 应用聊天附件直传所需的 CORS 规则
# ============================================================
# 生产 bucket（tzj-prod-media，正式账号 account-b 下新建；旧桶 tzj-media-static-assets 已弃用）需允许浏览器用预签名 PUT URL
# 直传聊天附件，并公开 GET 读取。两种应用方式：
#
#   方式 B（推荐，ossutil 原生 API，OSS 确定支持）：
#     export S3_ACCESS_KEY_ID=xxx S3_ACCESS_KEY_SECRET=yyy
#     bash infra/docker/oss/apply-cors.sh
#
#   方式 A（mc 路线，仅备选）：OSS 的 S3 兼容层只覆盖数据面 API，
#     PutBucketCors / PutBucketPolicy 等桶管控 API 不在兼容范围，mc 路线预计失败；
#     若实测可用则与 ossutil 等价（等价配置见同目录 cors.json）。
#     mc alias set oss <endpoint> <key> <secret> && mc cors set oss/tzj-prod-media <xml>
#
# 注意：ossutil 的 cors put 会「替换」bucket 全部 CORS 规则，
#       若已有 GET 规则，请把它们合并进 cors.json 再执行。
# ============================================================
set -euo pipefail

OSS_BUCKET="${OSS_BUCKET:-tzj-prod-media}"
OSS_ENDPOINT="${OSS_ENDPOINT:-${S3_ENDPOINT:-https://oss-cn-beijing.aliyuncs.com}}"
ACCESS_KEY="${S3_ACCESS_KEY_ID:-}"
SECRET_KEY="${S3_ACCESS_KEY_SECRET:-}"
OSS_DIR="$(cd "$(dirname "$0")" && pwd)"
CORS_JSON="${OSS_DIR}/cors.json"

if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" ]]; then
  echo "缺少 S3_ACCESS_KEY_ID / S3_ACCESS_KEY_SECRET 环境变量" >&2
  exit 1
fi

if command -v ossutil >/dev/null 2>&1; then
  echo "==> 方式 B（ossutil 原生 API）：CORS 应用到 oss://${OSS_BUCKET} (${OSS_ENDPOINT})"
  ossutil cors --method put "oss://${OSS_BUCKET}" "${CORS_JSON}" \
    -e "${OSS_ENDPOINT}" -i "${ACCESS_KEY}" -k "${SECRET_KEY}"
  echo "==> 公开读（bucket ACL public-read）"
  ossutil set-acl "oss://${OSS_BUCKET}/" public-read \
    -e "${OSS_ENDPOINT}" -i "${ACCESS_KEY}" -k "${SECRET_KEY}"
  echo "✅ OSS CORS + 公开读已应用（ossutil）。"
elif command -v mc >/dev/null 2>&1; then
  echo "⚠️ 未检测到 ossutil，改用 mc（备选）。注意：OSS 桶管控 API 不在 S3 兼容范围，mc cors set 预计失败；失败请安装 ossutil 重跑或走控制台。" >&2
  echo "==> 通过 mc 将 CORS 应用到 oss://${OSS_BUCKET} (${OSS_ENDPOINT})"
  mc alias set oss "${OSS_ENDPOINT}" "${ACCESS_KEY}" "${SECRET_KEY}"
  mc anonymous set public "oss/${OSS_BUCKET}"
  mc cors set "oss/${OSS_BUCKET}" "${OSS_DIR}/../minio/cors.xml"
  echo "✅ OSS CORS 已应用（mc）。若此步失败，请改用 ossutil：ossutil cors --method put oss://${OSS_BUCKET} ${CORS_JSON} -e ${OSS_ENDPOINT} -i <key> -k <secret>"
else
  echo "未检测到 ossutil 或 mc。请安装 ossutil 后重跑：" >&2
  echo "  ossutil cors --method put oss://${OSS_BUCKET} ${CORS_JSON} -e ${OSS_ENDPOINT} -i <key> -k <secret>" >&2
  exit 1
fi
