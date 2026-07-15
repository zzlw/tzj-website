# TZJ monorepo — 本地开发与 ECS 部署入口

INFRA := infra/docker
DEPLOY_DIR ?= /opt/tzj
TAG ?= latest
SERVICE ?= all

PROD := docker compose -f $(DEPLOY_DIR)/docker-compose.prod.yml \
	--env-file $(DEPLOY_DIR)/.env.prod \
	--env-file $(DEPLOY_DIR)/.env.prod.local

.PHONY: dev dev-down db-push db-migrate prod-deploy prod-status prod-logs prod-gateway-reload \
        cert-selfsigned cert-issue cert-deploy-cdn cert-renew deploy-ssh-help

dev:
	docker compose -f $(INFRA)/docker-compose.dev.yml up --build --remove-orphans

dev-down:
	docker compose -f $(INFRA)/docker-compose.dev.yml down --remove-orphans

# 本地开发：把 schema 直接同步到数据库（不含迁移历史，适合快速迭代）
# 注意：生产环境请用 db-migrate（走 Prisma migration，幂等且可回滚）
db-push:
	@echo "==> Prisma db push (本地开发，同步 schema → 数据库)"
	pnpm --filter @tzj/api prisma:push

# 生产 / 预发：应用 migrations 目录下的迁移（deploy.sh 也会自动调用）
db-migrate:
	@echo "==> Prisma migrate deploy (应用 migrations/ 下的迁移)"
	pnpm --filter @tzj/api prisma:migrate:deploy

prod-deploy:
	cd $(DEPLOY_DIR) && ./deploy.sh $(SERVICE) $(TAG)

prod-status:
	$(PROD) ps

prod-logs:
	$(PROD) logs -f --tail=100

prod-gateway-reload:
	$(PROD) exec gateway nginx -s reload

# 首次：cert-selfsigned → prod-deploy → cert-issue → prod-gateway-reload
cert-selfsigned:
	mkdir -p $(INFRA)/nginx/certs/live
	docker run --rm -v $(CURDIR)/$(INFRA)/nginx/certs/live:/out alpine/openssl req -x509 -nodes \
		-newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -days 365 \
		-keyout /out/privkey.pem -out /out/fullchain.pem \
		-subj "/CN=self-signed-placeholder"

cert-issue:
	$(PROD) exec acme sh /scripts/issue.sh

cert-deploy-cdn:
	$(PROD) exec acme sh /scripts/deploy-cdn.sh

cert-renew:
	$(PROD) exec acme acme.sh --renew-all --force
	$(PROD) exec gateway nginx -s reload

deploy-ssh-help:
	@echo "主路径：云效 Flow；备用：GitHub Actions → Deploy ECS (SSH)"
