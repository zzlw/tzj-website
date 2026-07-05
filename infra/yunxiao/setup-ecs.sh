#!/usr/bin/env bash
# 在 ECS 上初始化部署目录（root 执行，无需 git clone）
# 本地：ssh root@REDACTED-IP 'bash -s' < infra/yunxiao/setup-ecs.sh
set -euo pipefail

DEPLOY_DIR=/opt/tzj
DEPLOY_ENV=$DEPLOY_DIR/.env.deploy

mkdir -p "$DEPLOY_DIR"

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

# Docker 镜像加速（国内拉基础镜像）
mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://docker.1ms.run", "https://docker.m.daocloud.io"]
}
EOF
systemctl restart docker

echo "✅ ECS 初始化完成"
echo "   部署目录: $DEPLOY_DIR"
echo "   ACR 凭证: $DEPLOY_ENV"
echo "   需已有: docker-compose.prod.yml、deploy.sh、.env.prod（首次可 scp 上传）"
