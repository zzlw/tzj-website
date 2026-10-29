#!/bin/sh
# =============================================================
# 把当前证书推送到阿里云 CDN 加速域名（www + static）
# - 首次由 issue.sh 调用；之后作为 acme.sh renew-hook 在每次续期后自动执行
# - 读 acme.sh 内部证书目录（非 /certs/live），保证拿到最新证书
# - SetCdnDomainSSLCertificate（CertType=upload）；HTTPS 在 CDN 边缘终结
# - 所需权限：cdn:SetCdnDomainSSLCertificate（或 AliyunCDNFullAccess）
# =============================================================
set -e

: "${BASE_DOMAIN:?缺少 BASE_DOMAIN}"
: "${Ali_Key:?缺少 ALI_KEY / Ali_Key}"
: "${Ali_Secret:?缺少 ALI_SECRET / Ali_Secret}"

command -v aliyun >/dev/null 2>&1 || {
  echo "容器内无 aliyun CLI，请 make -C /opt/tzj acme-build 后重建 acme 服务" >&2
  exit 1
}

WEB_DOMAIN="${WEB_DOMAIN:-www.${BASE_DOMAIN}}"
STATIC_DOMAIN="${STATIC_DOMAIN:-static.${BASE_DOMAIN}}"

CERT_HOME="${LE_CONFIG_HOME:-/acme.sh}"
CERT_DIR="$CERT_HOME/$BASE_DOMAIN"
[ -f "$CERT_DIR/fullchain.cer" ] || CERT_DIR="$CERT_HOME/${BASE_DOMAIN}_ecc"
[ -f "$CERT_DIR/fullchain.cer" ] || { echo "未找到证书，请先执行 make cert-issue" >&2; exit 1; }

KEY_FILE="$CERT_DIR/$BASE_DOMAIN.key"
[ -f "$KEY_FILE" ] || KEY_FILE="$CERT_DIR/${BASE_DOMAIN}.key"
[ -f "$KEY_FILE" ] || { echo "未找到私钥: $CERT_DIR" >&2; exit 1; }

CERT_NAME="acme-${BASE_DOMAIN}-$(date +%Y%m%d%H%M%S)"
SSL_PUB="$(cat "$CERT_DIR/fullchain.cer")"
SSL_PRI="$(cat "$KEY_FILE")"

push_one() {
  domain="$1"
  echo "==> 推送证书到 CDN 加速域名 ${domain}（CertName: ${CERT_NAME}）"
  aliyun cdn SetCdnDomainSSLCertificate \
    --access-key-id "$Ali_Key" \
    --access-key-secret "$Ali_Secret" \
    --region cn-hangzhou \
    --DomainName "$domain" \
    --CertName "${CERT_NAME}-${domain}" \
    --CertType upload \
    --SSLProtocol on \
    --SSLPub "$SSL_PUB" \
    --SSLPri "$SSL_PRI"
}

push_one "$WEB_DOMAIN"
push_one "$STATIC_DOMAIN"

echo "==> CDN 证书配置完成：https://${WEB_DOMAIN} 与 https://${STATIC_DOMAIN}（边缘生效约需数分钟）"
