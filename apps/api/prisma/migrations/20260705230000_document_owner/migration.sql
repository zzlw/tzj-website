-- 个人文档与组织文档互斥：owner_id 为空 = 内部文档库，非空 = 所属用户的「我的文档」

ALTER TABLE "internal_documents" ADD COLUMN "owner_id" TEXT;

ALTER TABLE "internal_documents"
  ADD CONSTRAINT "internal_documents_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "internal_documents_owner_id_idx" ON "internal_documents"("owner_id");
