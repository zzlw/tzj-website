#!/usr/bin/env bash
# ECS 首次初始化：阿里云 Docker 加速器 + Docker Compose
# 在服务器上以 root 执行，或：ssh root@REDACTED-IP 'bash -s' < infra/docker/setup-docker-mirror.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

mkdir -p /etc/docker
tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}
EOF

if ! command -v docker >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-v2
fi

systemctl daemon-reload
systemctl enable docker
systemctl restart docker

docker --version
docker compose version
docker info | grep -A2 "Registry Mirrors"
