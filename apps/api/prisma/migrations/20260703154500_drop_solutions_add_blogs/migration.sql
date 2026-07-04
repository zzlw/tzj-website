-- Drop solutions CMS (custom pages in apps/web); add blogs table
DROP TABLE IF EXISTS "solutions";

CREATE TABLE "blogs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT,
    "coverImage" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "readTime" TEXT,
    "author" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blogs_slug_key" ON "blogs"("slug");
CREATE INDEX "blogs_category_idx" ON "blogs"("category");
CREATE INDEX "blogs_status_idx" ON "blogs"("status");
CREATE INDEX "blogs_publishedAt_idx" ON "blogs"("publishedAt");
