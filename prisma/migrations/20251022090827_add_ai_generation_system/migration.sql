/*
  Warnings:

  - You are about to drop the `ScriptPage` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AIGenerationType" AS ENUM ('VIDEO', 'IMAGE', 'AUDIO', 'VOICE_CLONE', 'COSTUME', 'CHARACTER', 'STORYBOARD', 'LOCATION', 'PROPS', 'SOUNDTRACK', 'SOUND_EFFECTS', 'VIDEO_EXTENSION', 'IMAGE_TO_VIDEO', 'VIDEO_COMPOSITE');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIModel" AS ENUM ('VEO_3_1', 'VEO_3_1_FAST', 'VEO_3', 'VEO_3_FAST', 'VEO_2', 'IMAGEN_3', 'NANO_BANANA', 'GEMINI_PRO', 'ELEVEN_LABS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AspectRatio" AS ENUM ('RATIO_16_9', 'RATIO_9_16', 'RATIO_1_1', 'RATIO_4_3');

-- CreateEnum
CREATE TYPE "VideoResolution" AS ENUM ('RES_720P', 'RES_1080P', 'RES_4K');

-- DropForeignKey
ALTER TABLE "movai_v2"."ScriptPage" DROP CONSTRAINT "ScriptPage_scriptId_fkey";

-- DropTable
DROP TABLE "movai_v2"."ScriptPage";

-- CreateTable
CREATE TABLE "script_pages" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "formatted" JSONB NOT NULL DEFAULT '[]',
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "sceneId" TEXT,
    "characterId" TEXT,
    "createdById" TEXT NOT NULL,
    "type" "AIGenerationType" NOT NULL,
    "model" "AIModel" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "sourceAssetId" TEXT,
    "referenceImages" TEXT[],
    "config" JSONB,
    "aspectRatio" "AspectRatio",
    "resolution" "VideoResolution",
    "duration" INTEGER,
    "outputUrl" TEXT,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT,
    "metadata" JSONB,
    "costCredits" DOUBLE PRECISION,
    "operationId" TEXT,
    "operationName" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentGenerationId" TEXT,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_assets" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "generationId" TEXT,
    "type" "AIGenerationType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "aspectRatio" "AspectRatio",
    "usedInScenes" TEXT[],
    "tags" TEXT[],
    "metadata" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_queue" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_generation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_api_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "videoGenerations" INTEGER NOT NULL DEFAULT 0,
    "imageGenerations" INTEGER NOT NULL DEFAULT 0,
    "audioGenerations" INTEGER NOT NULL DEFAULT 0,
    "totalCreditsUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyVideoLimit" INTEGER NOT NULL DEFAULT 50,
    "monthlyImageLimit" INTEGER NOT NULL DEFAULT 200,
    "monthlyAudioLimit" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "user_api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "script_pages_scriptId_idx" ON "script_pages"("scriptId");

-- CreateIndex
CREATE UNIQUE INDEX "script_pages_scriptId_pageNumber_key" ON "script_pages"("scriptId", "pageNumber");

-- CreateIndex
CREATE INDEX "ai_generations_scriptId_idx" ON "ai_generations"("scriptId");

-- CreateIndex
CREATE INDEX "ai_generations_sceneId_idx" ON "ai_generations"("sceneId");

-- CreateIndex
CREATE INDEX "ai_generations_characterId_idx" ON "ai_generations"("characterId");

-- CreateIndex
CREATE INDEX "ai_generations_createdById_idx" ON "ai_generations"("createdById");

-- CreateIndex
CREATE INDEX "ai_generations_status_idx" ON "ai_generations"("status");

-- CreateIndex
CREATE INDEX "ai_generations_type_idx" ON "ai_generations"("type");

-- CreateIndex
CREATE INDEX "ai_generations_createdAt_idx" ON "ai_generations"("createdAt");

-- CreateIndex
CREATE INDEX "ai_assets_scriptId_idx" ON "ai_assets"("scriptId");

-- CreateIndex
CREATE INDEX "ai_assets_generationId_idx" ON "ai_assets"("generationId");

-- CreateIndex
CREATE INDEX "ai_assets_type_idx" ON "ai_assets"("type");

-- CreateIndex
CREATE INDEX "ai_assets_createdAt_idx" ON "ai_assets"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generation_queue_generationId_key" ON "ai_generation_queue"("generationId");

-- CreateIndex
CREATE INDEX "ai_generation_queue_scheduledFor_idx" ON "ai_generation_queue"("scheduledFor");

-- CreateIndex
CREATE INDEX "ai_generation_queue_processedAt_idx" ON "ai_generation_queue"("processedAt");

-- CreateIndex
CREATE INDEX "user_api_usage_userId_idx" ON "user_api_usage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_api_usage_userId_date_key" ON "user_api_usage"("userId", "date");

-- AddForeignKey
ALTER TABLE "script_pages" ADD CONSTRAINT "script_pages_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "ai_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_parentGenerationId_fkey" FOREIGN KEY ("parentGenerationId") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_assets" ADD CONSTRAINT "ai_assets_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_assets" ADD CONSTRAINT "ai_assets_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
