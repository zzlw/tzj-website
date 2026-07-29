# TZJ monorepo — 本地开发入口
# 服务器运维 target 已拆至 infra/docker/Makefile（随 scp 落地为 /opt/tzj/Makefile，
# 服务器上用 make -C /opt/tzj <target>；本机不再提供 prod/cert 类 target）

INFRA := infra/docker

.PHONY: dev dev-down db-push db-migrate db-index

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

# 全文检索索引：pg_trgm 扩展 + chat_messages.content GIN 索引（幂等，建表后跑一次即可）
# 注意：API 启动时会自动幂等创建该索引（见 PgTrgmMessageSearchService.onModuleInit），
#       本目标仅为受限库（应用账号无 DDL 权限、设 CHAT_SEARCH_AUTO_INDEX=false）的手动兜底
db-index:
	@echo "==> 应用聊天全文检索索引 (pg_trgm + GIN)"
	pnpm --filter @tzj/api prisma:index:search
