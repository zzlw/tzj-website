-- 个人文件夹：owner_id 为空表示组织共享文件夹（内部文档库）

ALTER TABLE "doc_folders" ADD COLUMN "owner_id" TEXT;

ALTER TABLE "doc_folders"
  ADD CONSTRAINT "doc_folders_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "doc_folders_parent_id_slug_key";

CREATE UNIQUE INDEX "doc_folders_owner_id_parent_id_slug_key"
  ON "doc_folders"("owner_id", "parent_id", "slug");

CREATE INDEX "doc_folders_owner_id_idx" ON "doc_folders"("owner_id");
