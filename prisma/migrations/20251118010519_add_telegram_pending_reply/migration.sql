-- CreateTable
CREATE TABLE "telegram_pending_replies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "parentCommentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_pending_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telegram_pending_replies_chatId_idx" ON "telegram_pending_replies"("chatId");

-- CreateIndex
CREATE INDEX "telegram_pending_replies_userId_idx" ON "telegram_pending_replies"("userId");
