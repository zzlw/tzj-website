#!/bin/sh
# 首次签发：make -C /opt/tzj cert-issue（或 compose exec acme sh /scripts/issue.sh）
set -e

: "${ACME_EMAIL:?配置 ACME_EMAIL}"
: "${BASE_DOMAIN:?配置 BASE_DOMAIN（如 jiawen.live）}"
: "${Ali_Key:?配置 ALI_KEY（.env.prod.local）}"
: "${Ali_Secret:?配置 ALI_SECRET（.env.prod.local）}"

echo "==> 注册 ACME 账户"
acme.sh --register-account -m "$ACME_EMAIL" --server letsencrypt

echo "==> DNS-01 签发：$BASE_DOMAIN + *.$BASE_DOMAIN"
acme.sh --issue --server letsencrypt --keylength 2048 \
  --dns dns_ali \
  -d "$BASE_DOMAIN" -d "*.$BASE_DOMAIN" \
  --renew-hook "sh /scripts/deploy-cdn.sh"

echo "==> 安装证书到 /certs/live"
mkdir -p /certs/live
acme.sh --install-cert -d "$BASE_DOMAIN" \
  --fullchain-file /certs/live/fullchain.pem \
  --key-file /certs/live/privkey.pem

echo "==> 推送 CDN 证书（$STATIC_DOMAIN）"
sh /scripts/deploy-cdn.sh

echo "==> 完成。执行 make prod-gateway-reload 或等待 gateway 自动 reload"
