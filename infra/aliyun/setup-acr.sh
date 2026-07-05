#!/usr/bin/env bash
# TZJ — 阿里云 ACR 个人版（新域名 crpi-*.personal.cr.aliyuncs.com）GitHub 变量写入
# 用法：./infra/aliyun/setup-acr.sh

set -euo pipefail

REGION="cn-beijing"
# 2024-09 后新建的个人版实例使用独立域名（控制台 → 概览 → 公网）
INSTANCE_ID="${ACR_INSTANCE_ID:-REDACTED-ACR}"
REGISTRY="${ACR_REGISTRY:-${INSTANCE_ID}.${REGION}.personal.cr.aliyuncs.com}"
NAMESPACE="${ACR_NAMESPACE:-tzj}"
REPO="${GITHUB_REPO:-zzlw/tzj-website}"

echo "==> ACR 个人版"
echo "    实例 ID: ${INSTANCE_ID}"
echo "    Registry: ${REGISTRY}"
echo "    命名空间: ${NAMESPACE}"
echo ""
echo "── 镜像地址 ──────────────────────────────────────────────"
echo "   ${REGISTRY}/${NAMESPACE}/tzj-web:<tag>"
echo "   ${REGISTRY}/${NAMESPACE}/tzj-admin:<tag>"
echo "   ${REGISTRY}/${NAMESPACE}/tzj-api:<tag>"
echo ""
echo "── 访问凭证（控制台 → 仓库管理 → 访问凭证）──────────────"
echo "   https://cr.console.aliyun.com/${REGION}/instances/${INSTANCE_ID}/credential"
echo ""

if command -v gh >/dev/null 2>&1; then
  gh variable set ACR_INSTANCE_ID --body "${INSTANCE_ID}" -R "${REPO}"
  gh variable set ACR_REGISTRY --body "${REGISTRY}" -R "${REPO}"
  gh variable set ACR_NAMESPACE --body "${NAMESPACE}" -R "${REPO}"
  gh variable set IMAGE_REGISTRY --body "${REGISTRY}/${NAMESPACE}" -R "${REPO}"
  echo "✓ GitHub Variables 已更新"
  echo ""
  if gh secret list -R "${REPO}" 2>/dev/null | grep -q '^ACR_USERNAME'; then
    echo "✓ ACR_USERNAME secret 已存在"
  else
    echo "待写入: gh secret set ACR_USERNAME --body \"<访问凭证页登录名>\" -R ${REPO}"
  fi
  if gh secret list -R "${REPO}" 2>/dev/null | grep -q '^ACR_PASSWORD'; then
    echo "✓ ACR_PASSWORD secret 已存在"
  else
    echo "待写入: gh secret set ACR_PASSWORD --body \"<访问凭证页固定密码>\" -R ${REPO}"
  fi
fi

echo ""
echo "ECS /opt/tzj/.env.prod → IMAGE_REGISTRY=${REGISTRY}/${NAMESPACE}"
