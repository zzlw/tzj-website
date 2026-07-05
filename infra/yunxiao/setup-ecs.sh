#!/usr/bin/env bash
# 在 ECS 上初始化 Codeup 克隆与部署凭证（root 执行）
# 本地：ssh root@REDACTED-IP 'bash -s' < infra/yunxiao/setup-ecs.sh
set -euo pipefail

BUILD_DIR=/opt/tzj/build
REPO=git@codeup.aliyun.com:6a4a4fd4a6fcee143fa2797d/tzj-website.git
DEPLOY_ENV=/opt/tzj/.env.deploy

mkdir -p /opt/tzj "$BUILD_DIR"

if [[ ! -d "$BUILD_DIR/.git" ]]; then
  echo "==> clone $REPO → $BUILD_DIR"
  mkdir -p ~/.ssh
  ssh-keyscan codeup.aliyun.com >> ~/.ssh/known_hosts 2>/dev/null || true
  if [[ -f /root/.ssh/codeup_deploy ]]; then
    cat > ~/.ssh/config <<'CFG'
Host codeup.aliyun.com
  IdentityFile ~/.ssh/codeup_deploy
  IdentitiesOnly yes
CFG
    chmod 600 ~/.ssh/config
  fi
  git clone "$REPO" "$BUILD_DIR"
else
  echo "==> repo exists: $BUILD_DIR"
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

# Docker 镜像加速（国内拉基础镜像）
mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://docker.1ms.run", "https://docker.m.daocloud.io"]
}
EOF
systemctl restart docker

echo "✅ ECS 初始化完成"
echo "   代码目录: $BUILD_DIR"
echo "   部署凭证: $DEPLOY_ENV"
