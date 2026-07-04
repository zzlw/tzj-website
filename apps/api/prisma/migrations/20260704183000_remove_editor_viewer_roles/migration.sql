-- 移除已废弃的 editor/viewer 预置角色，并将相关账号迁移为 admin
UPDATE "users" SET "role" = 'admin' WHERE "role" IN ('editor', 'viewer');
DELETE FROM "access_roles" WHERE "slug" IN ('editor', 'viewer');
