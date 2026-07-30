-- 灵犀 AI 投放报告：会话与消息两张新表（纯新增，无破坏性变更）
-- 见 docs/lingxi-ai-report-design.md §5.7

-- CreateTable
CREATE TABLE "lingxi_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lingxi_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lingxi_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lingxi_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lingxi_conversations_userId_updatedAt_idx" ON "lingxi_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "lingxi_conversations_deletedAt_idx" ON "lingxi_conversations"("deletedAt");

-- CreateIndex
CREATE INDEX "lingxi_messages_conversationId_createdAt_idx" ON "lingxi_messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "lingxi_conversations" ADD CONSTRAINT "lingxi_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lingxi_messages" ADD CONSTRAINT "lingxi_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "lingxi_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
