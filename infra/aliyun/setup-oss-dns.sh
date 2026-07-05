#!/usr/bin/env bash
# TZJ 生产环境 — 阿里云 OSS + DNS 一键初始化
# 依赖：本机已配置 aliyun CLI（aliyun configure list 可用）
# 用法：./infra/aliyun/setup-oss-dns.sh

set -euo pipefail

REGION="cn-beijing"
DOMAIN="jiawen.live"
ECS_IP="REDACTED-IP"
BUCKET="tzj-media-static-assets"
OSS_ENDPOINT="oss-${REGION}.aliyuncs.com"
CORS_FILE="$(dirname "$0")/oss-cors.xml"

echo "==> 区域: ${REGION}  域名: ${DOMAIN}  ECS: ${ECS_IP}  Bucket: ${BUCKET}"

# ── 1. OSS Bucket（已存在则跳过）────────────────────────────
if aliyun oss ls 2>/dev/null | grep -q "oss://${BUCKET}"; then
  echo "✓ Bucket 已存在: ${BUCKET}"
else
  echo "→ 创建 Bucket..."
  aliyun oss mb "oss://${BUCKET}" --storage-class Standard --acl private
fi

# ── 2. CORS（允许 C 端 / 后台跨域读图）──────────────────────
echo "→ 配置 CORS..."
aliyun oss cors --method put "oss://${BUCKET}" "${CORS_FILE}" 2>/dev/null || true

# ── 3. 公共读策略（content/ uploads/ cms/ 前缀）──────────────
POLICY=$(cat <<EOF
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": ["*"],
      "Action": ["oss:GetObject"],
      "Resource": [
        "acs:oss:*:*:${BUCKET}/content/*",
        "acs:oss:*:*:${BUCKET}/uploads/*",
        "acs:oss:*:*:${BUCKET}/cms/*"
      ]
    }
  ]
}
EOF
)
echo "${POLICY}" > /tmp/tzj-oss-policy.json
aliyun oss bucket-policy --method put "oss://${BUCKET}" /tmp/tzj-oss-policy.json 2>/dev/null || \
  echo "⚠ bucket-policy 需控制台或 ossutil 手动确认"

# ── 4. 绑定自定义域名（控制台亦可）──────────────────────────
# CNAME: tzj-static.jiawen.live → ${BUCKET}.${OSS_ENDPOINT}
echo "→ 提示：OSS 控制台 → Bucket → 传输管理 → 绑定域名 tzj-static.${DOMAIN}"

# ── 5. DNS 解析 ─────────────────────────────────────────────
add_a() {
  local rr=$1
  if aliyun alidns DescribeDomainRecords --DomainName "${DOMAIN}" --RRKeyWord "${rr}" --Type A 2>/dev/null \
    | grep -q "${ECS_IP}"; then
    echo "✓ DNS A 已存在: ${rr}.${DOMAIN} → ${ECS_IP}"
  else
    echo "→ 添加 A 记录: ${rr}.${DOMAIN} → ${ECS_IP}"
    aliyun alidns AddDomainRecord \
      --DomainName "${DOMAIN}" \
      --RR "${rr}" \
      --Type A \
      --Value "${ECS_IP}" \
      --TTL 600
  fi
}

add_cname() {
  local rr=$1 value=$2
  if aliyun alidns DescribeDomainRecords --DomainName "${DOMAIN}" --RRKeyWord "${rr}" --Type CNAME 2>/dev/null \
    | grep -q "${value}"; then
    echo "✓ DNS CNAME 已存在: ${rr}.${DOMAIN} → ${value}"
  else
    echo "→ 添加 CNAME: ${rr}.${DOMAIN} → ${value}"
    aliyun alidns AddDomainRecord \
      --DomainName "${DOMAIN}" \
      --RR "${rr}" \
      --Type CNAME \
      --Value "${value}" \
      --TTL 600
  fi
}

add_a "tzj"
add_a "tzj-admin"
add_a "tzj-api"
add_cname "tzj-static" "${BUCKET}.${OSS_ENDPOINT}"

echo ""
echo "✅ 完成。请验证："
echo "   dig +short tzj.${DOMAIN}"
echo "   dig +short tzj-static.${DOMAIN}"
echo "   aliyun oss ls oss://${BUCKET}/"
