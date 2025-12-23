-- AlterTable
ALTER TABLE "board_elements" ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "videoType" TEXT,
ADD COLUMN "displayMode" TEXT,
ADD COLUMN "videoMeta" JSONB;
