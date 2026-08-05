# TZJ 服务器运维入口 — 随 deploy.yml 的 scp（strip_components: 2）落地为 /opt/tzj/Makefile
# 用法：make -C /opt/tzj <target>
# 本文件假设服务器布局（/opt/tzj），本机开发请用仓库根 Makefile

DEPLOY_DIR ?= /opt/tzj
TAG ?= latest
SERVICE ?= all

# 与 deploy.sh 的 compose() 对齐：acme override 存在时叠加（生产用预构建镜像 tzj-acme:prod）
COMPOSE_FILES := -f $(DEPLOY_DIR)/docker-compose.prod.yml
ifneq ($(wildcard $(DEPLOY_DIR)/docker-compose.acme.override.yml),)
COMPOSE_FILES += -f $(DEPLOY_DIR)/docker-compose.acme.override.yml
endif

# compose 文件含 :?required 插值，双 --env-file 缺一不可
PROD := docker compose $(COMPOSE_FILES) \
	--env-file $(DEPLOY_DIR)/.env.prod \
	--env-file $(DEPLOY_DIR)/.env.prod.local

.PHONY: prod-deploy prod-status prod-logs gateway-reload infra-up \
        cert-selfsigned acme-build cert-issue cert-renew

prod-deploy:
	cd $(DEPLOY_DIR) && ./deploy.sh $(SERVICE) $(TAG)

prod-status:
	$(PROD) ps

prod-logs:
	$(PROD) logs -f --tail=100

gateway-reload:
	$(PROD) exec gateway nginx -s reload

# ── 首次上线：cert-selfsigned → acme-build → infra-up → cert-issue → gateway-reload ──

# 自签占位证书（让 gateway 能起，真证书由 cert-issue 覆盖）
cert-selfsigned:
	mkdir -p $(DEPLOY_DIR)/nginx/certs/live
	docker run --rm -v $(DEPLOY_DIR)/nginx/certs/live:/out alpine/openssl req -x509 -nodes \
		-newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -days 365 \
		-keyout /out/privkey.pem -out /out/fullchain.pem \
		-subj "/CN=self-signed-placeholder"

# acme.override 把 build 置空，首次必须不带 override 显式构建 tzj-acme:prod
acme-build:
	docker compose -f $(DEPLOY_DIR)/docker-compose.prod.yml \
		--env-file $(DEPLOY_DIR)/.env.prod --env-file $(DEPLOY_DIR)/.env.prod.local \
		build acme

# 基础设施容器（应用容器由 deploy.sh 滚动管理，不在此列）
# --no-deps：首次引导时应用镜像尚未构建，gateway 的 depends_on(api/web/admin) 会触发
# 拉取不存在的镜像而失败；nginx 用 resolver 延迟解析上游，脱离应用容器可正常启动
infra-up:
	$(PROD) up -d --no-deps postgres acme gateway

# acme DNS-01 签发真证书（tzjii.com + *.tzjii.com）
cert-issue:
	$(PROD) exec acme sh /scripts/issue.sh

cert-renew:
	$(PROD) exec acme acme.sh --renew-all --force
	$(PROD) exec gateway nginx -s reload
