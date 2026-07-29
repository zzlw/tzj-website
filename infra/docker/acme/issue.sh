#!/bin/sh
# 首次签发：make -C /opt/tzj cert-issue（compose exec acme sh /scripts/issue.sh）
# Let's Encrypt + DNS-01 泛域名 + install-cert；续期后 nginx 由 90-periodic-reload.sh 自动 reload
# tzjii.com NS 在阿里云 → 用 dns_ali（CF_* 留空；若域名 NS 迁到 Cloudflare 才配 CF_API_TOKEN）
set -e

: "${ACME_EMAIL:?配置 ACME_EMAIL}"
: "${BASE_DOMAIN:?配置 BASE_DOMAIN（如 tzjii.com）}"

if [ -n "${CF_API_TOKEN:-}" ]; then
  export CF_Token="$CF_API_TOKEN"
  [ -n "${CF_ZONE_ID:-}" ] && export CF_Zone_ID="$CF_ZONE_ID"
  DNS_PROVIDER=dns_cf
  echo "==> 使用 Cloudflare DNS-01（NS 在 Cloudflare）"
elif [ -n "${Ali_Key:-}" ] && [ -n "${Ali_Secret:-}" ]; then
  DNS_PROVIDER=dns_ali
  echo "==> 使用阿里云 DNS-01（NS 在阿里云）"
else
  echo "请在 .env.prod.local 配置 CF_API_TOKEN（Cloudflare NS）或 ALI_KEY/ALI_SECRET（阿里云 NS）" >&2
  exit 1
fi

echo "==> 注册 ACME 账户（Let's Encrypt）"
acme.sh --register-account -m "$ACME_EMAIL" --server letsencrypt

echo "==> DNS-01 签发泛域名：$BASE_DOMAIN + *.$BASE_DOMAIN"
acme.sh --issue --server letsencrypt --keylength 2048 \
  --dns "$DNS_PROVIDER" \
  -d "$BASE_DOMAIN" -d "*.$BASE_DOMAIN"

echo "==> 安装证书到 /certs/live（续期后自动重装）"
mkdir -p /certs/live
acme.sh --install-cert -d "$BASE_DOMAIN" \
  --fullchain-file /certs/live/fullchain.pem \
  --key-file /certs/live/privkey.pem

echo "==> 完成。执行 make -C /opt/tzj gateway-reload"
