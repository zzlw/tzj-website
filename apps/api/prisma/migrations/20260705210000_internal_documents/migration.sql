-- CreateTable
CREATE TABLE "doc_folders" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_documents" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_by_id" TEXT,
    "last_operator" TEXT,
    "last_operator_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_document_revisions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "editor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_document_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doc_folders_parent_id_slug_key" ON "doc_folders"("parent_id", "slug");

-- CreateIndex
CREATE INDEX "doc_folders_sort_order_idx" ON "doc_folders"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "internal_documents_slug_key" ON "internal_documents"("slug");

-- CreateIndex
CREATE INDEX "internal_documents_folder_id_idx" ON "internal_documents"("folder_id");

-- CreateIndex
CREATE INDEX "internal_documents_status_updated_at_idx" ON "internal_documents"("status", "updated_at");

-- CreateIndex
CREATE INDEX "internal_documents_is_pinned_idx" ON "internal_documents"("is_pinned");

-- CreateIndex
CREATE INDEX "internal_documents_created_by_id_idx" ON "internal_documents"("created_by_id");

-- CreateIndex
CREATE INDEX "internal_documents_last_operator_id_idx" ON "internal_documents"("last_operator_id");

-- CreateIndex
CREATE INDEX "internal_document_revisions_document_id_created_at_idx" ON "internal_document_revisions"("document_id", "created_at");

-- AddForeignKey
ALTER TABLE "doc_folders" ADD CONSTRAINT "doc_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "doc_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "doc_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_documents" ADD CONSTRAINT "internal_documents_last_operator_id_fkey" FOREIGN KEY ("last_operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_document_revisions" ADD CONSTRAINT "internal_document_revisions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "internal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_document_revisions" ADD CONSTRAINT "internal_document_revisions_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
