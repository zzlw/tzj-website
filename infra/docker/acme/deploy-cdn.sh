#!/bin/sh
# 续期 hook：推送证书到 CDN 加速域名（tzj-static.jiawen.live）
set -e

: "${BASE_DOMAIN:?缺少 BASE_DOMAIN}"
: "${STATIC_DOMAIN:?缺少 STATIC_DOMAIN}"
: "${Ali_Key:?缺少 ALI_KEY}"
: "${Ali_Secret:?缺少 ALI_SECRET}"

CERT_HOME="${LE_CONFIG_HOME:-/acme.sh}"
CERT_DIR="$CERT_HOME/$BASE_DOMAIN"
[ -f "$CERT_DIR/fullchain.cer" ] || CERT_DIR="$CERT_HOME/${BASE_DOMAIN}_ecc"
[ -f "$CERT_DIR/fullchain.cer" ] || { echo "未找到证书，请先 cert-issue"; exit 1; }

CERT_NAME="acme-${BASE_DOMAIN}-$(date +%Y%m%d%H%M%S)"

echo "==> CDN SetCdnDomainSSLCertificate ${STATIC_DOMAIN}"
aliyun cdn SetCdnDomainSSLCertificate \
  --access-key-id "$Ali_Key" \
  --access-key-secret "$Ali_Secret" \
  --region cn-hangzhou \
  --DomainName "$STATIC_DOMAIN" \
  --CertName "$CERT_NAME" \
  --CertType upload \
  --SSLProtocol on \
  --SSLPub "$(cat "$CERT_DIR/fullchain.cer")" \
  --SSLPri "$(cat "$CERT_DIR/$BASE_DOMAIN.key")"

echo "==> CDN 证书已更新"
