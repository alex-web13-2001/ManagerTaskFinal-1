-- AlterTable
ALTER TABLE "comments" ADD COLUMN "mentionedUsers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "task_subscribers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_subscribers_taskId_idx" ON "task_subscribers"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_subscribers_taskId_userId_key" ON "task_subscribers"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "task_subscribers" ADD CONSTRAINT "task_subscribers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_subscribers" ADD CONSTRAINT "task_subscribers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
