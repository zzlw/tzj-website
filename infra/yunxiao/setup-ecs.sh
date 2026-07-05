#!/usr/bin/env bash
# 在 ECS 上初始化部署目录（root 执行，无需 git clone）
# 本地：ssh root@REDACTED-IP 'bash -s' < infra/yunxiao/setup-ecs.sh
set -euo pipefail

DEPLOY_DIR=/opt/tzj
DEPLOY_ENV=$DEPLOY_DIR/.env.deploy
CERT_LIVE=$DEPLOY_DIR/nginx/certs/live

mkdir -p "$DEPLOY_DIR" "$CERT_LIVE" "$DEPLOY_DIR/scripts"

if [[ ! -f "$DEPLOY_DIR/.env.prod.local" ]] && [[ -f "$DEPLOY_DIR/.env.prod.local.example" ]]; then
  cp "$DEPLOY_DIR/.env.prod.local.example" "$DEPLOY_DIR/.env.prod.local"
  echo "⚠️  已创建 $DEPLOY_DIR/.env.prod.local"
fi

if [[ ! -f "$DEPLOY_ENV" ]]; then
  cat >"$DEPLOY_ENV" <<'EOF'
ACR_REGISTRY=REDACTED-ACR
ACR_NAMESPACE=REDACTED-NAMESPACE
ACR_USERNAME=your-acr-username
ACR_PASSWORD=CHANGE_ME
EOF
  chmod 600 "$DEPLOY_ENV"
  echo "⚠️  请编辑 $DEPLOY_ENV 填写 ACR_PASSWORD"
fi

# 释放 80/443 给 compose gateway（若仍用宿主机 nginx 会端口冲突）
if systemctl is-active nginx >/dev/null 2>&1; then
  echo "==> 停止宿主机 nginx，改由 compose gateway 接管 80/443"
  systemctl stop nginx
  systemctl disable nginx || true
fi

# 迁移已有 acme.sh / 手动证书到 gateway 目录
if [[ -f /etc/nginx/ssl/jiawen.live.cer && -f /etc/nginx/ssl/jiawen.live.key ]]; then
  cp /etc/nginx/ssl/jiawen.live.cer "$CERT_LIVE/fullchain.pem"
  cp /etc/nginx/ssl/jiawen.live.key "$CERT_LIVE/privkey.pem"
  echo "==> 已复制现有 TLS 证书到 $CERT_LIVE"
fi

mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://docker.1ms.run", "https://docker.m.daocloud.io"]
}
EOF
systemctl restart docker

echo "✅ ECS 初始化完成"
echo "   部署目录: $DEPLOY_DIR"
echo "   证书目录: $CERT_LIVE"
echo "   首次 HTTPS：make cert-selfsigned → deploy → cert-issue（需 ALI_KEY/ALI_SECRET）"
echo "   全新空库：./scripts/bootstrap-fresh-db.sh <tag>"
