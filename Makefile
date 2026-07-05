# TZJ monorepo — 本地开发与 ECS 部署入口
# 借鉴 REDACTED-NAMESPACE-deploy：统一 compose / deploy / 证书 reload 命令

INFRA := infra/docker
PROD_ENV := --env-file $(INFRA)/.env.prod.example
# 服务器上使用 /opt/tzj/.env.prod + .env.prod.local

.PHONY: dev dev-down prod-deploy prod-status prod-logs deploy-ssh-help

# ── 本地开发 ─────────────────────────────────────────────────
dev:
	docker compose -f $(INFRA)/docker-compose.dev.yml up --build --remove-orphans

dev-down:
	docker compose -f $(INFRA)/docker-compose.dev.yml down --remove-orphans

# ── 生产（在 ECS /opt/tzj 上执行，或 DEPLOY_DIR 指向该目录）──
# 例：cd /opt/tzj && make -f /path/to/repo/Makefile prod-deploy TAG=d2e7ac7
DEPLOY_DIR ?= /opt/tzj
TAG ?= latest
SERVICE ?= all

prod-deploy:
	cd $(DEPLOY_DIR) && ./deploy.sh $(SERVICE) $(TAG)

prod-status:
	cd $(DEPLOY_DIR) && docker compose -f docker-compose.prod.yml \
		--env-file .env.prod --env-file .env.prod.local ps

prod-logs:
	cd $(DEPLOY_DIR) && docker compose -f docker-compose.prod.yml \
		--env-file .env.prod --env-file .env.prod.local logs -f --tail=100

# 宿主机 Nginx 平滑 reload（证书更新后）
prod-nginx-reload:
	nginx -t && nginx -s reload

deploy-ssh-help:
	@echo "GitHub Actions 备用部署：Actions → Deploy ECS (SSH) → 选择 service + tag"
	@echo "主路径仍为云效 Flow；Runner 离线时用此 workflow 回滚/发布"
