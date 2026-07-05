-- 文档标签注册表（组织 / 个人各自独立命名空间）

CREATE TABLE "doc_tags" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_tags_owner_id_slug_key" ON "doc_tags"("owner_id", "slug");
CREATE INDEX "doc_tags_owner_id_idx" ON "doc_tags"("owner_id");

ALTER TABLE "doc_tags" ADD CONSTRAINT "doc_tags_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "doc_tags" ADD CONSTRAINT "doc_tags_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
