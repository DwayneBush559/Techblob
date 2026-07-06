-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('UPLOAD', 'YOUTUBE');

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "authorName" VARCHAR(120),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "sourceType" "VideoSource" NOT NULL DEFAULT 'UPLOAD';

-- CreateIndex
CREATE UNIQUE INDEX "videos_sourceType_externalId_key" ON "videos"("sourceType", "externalId");

