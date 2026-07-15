#!/usr/bin/env bash
# ============================================================
# 阿里云 OSS — 应用聊天附件直传所需的 CORS 规则
# ============================================================
# 生产 bucket（tzj-media-static-assets）需允许浏览器用预签名 PUT URL
# 直传聊天附件，并公开 GET 读取。两种应用方式二选一：
#
#   方式 A（推荐，统一用 mc，与 MinIO 共用同一份 S3 CORS XML）：
#     export S3_ACCESS_KEY_ID=xxx S3_ACCESS_KEY_SECRET=yyy
#     bash infra/docker/oss/apply-cors.sh
#
#   方式 B（ossutil 原生 JSON，等价配置见同目录 cors.json）：
#     ossutil cors --method put oss://tzj-media-static-assets \
#       infra/docker/oss/cors.json -e oss-cn-beijing.aliyuncs.com \
#       -i <key> -k <secret>
#     # 注意：ossutil 的 put 会「替换」bucket 全部 CORS 规则，
#     #       若已有 GET 规则，请把它们合并进 cors.json 再执行。
# ============================================================
set -euo pipefail

OSS_BUCKET="${OSS_BUCKET:-tzj-media-static-assets}"
OSS_ENDPOINT="${OSS_ENDPOINT:-${S3_ENDPOINT:-https://oss-cn-beijing.aliyuncs.com}}"
ACCESS_KEY="${S3_ACCESS_KEY_ID:-}"
SECRET_KEY="${S3_ACCESS_KEY_SECRET:-}"
CORS_XML="$(cd "$(dirname "$0")/.." && pwd)/minio/cors.xml"

if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" ]]; then
  echo "缺少 S3_ACCESS_KEY_ID / S3_ACCESS_KEY_SECRET 环境变量" >&2
  exit 1
fi

if ! command -v mc >/dev/null 2>&1; then
  echo "未检测到 mc（MinIO Client）。请二选一：" >&2
  echo "  1) 安装 mc：https://min.io/docs/minio/linux/reference/minmc.html" >&2
  echo "  2) 改用 ossutil：ossutil cors --method put oss://${OSS_BUCKET} infra/docker/oss/cors.json -e ${OSS_ENDPOINT} -i <key> -k <secret>" >&2
  exit 1
fi

echo "==> 通过 mc 将 CORS 应用到 oss://${OSS_BUCKET} (${OSS_ENDPOINT})"
mc alias set oss "${OSS_ENDPOINT}" "${ACCESS_KEY}" "${SECRET_KEY}"
mc anonymous set public "oss/${OSS_BUCKET}"
mc cors set "oss/${OSS_BUCKET}" "${CORS_XML}"
echo "✅ OSS CORS 已应用（含公开读 + 预签名 PUT 直传）。"
