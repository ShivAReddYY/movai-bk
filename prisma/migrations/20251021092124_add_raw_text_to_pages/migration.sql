/*
  Warnings:

  - You are about to drop the `script_pages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "movai_v2"."script_pages" DROP CONSTRAINT "script_pages_scriptId_fkey";

-- DropTable
DROP TABLE "movai_v2"."script_pages";

-- CreateTable
CREATE TABLE "ScriptPage" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "formatted" JSONB NOT NULL DEFAULT '[]',
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScriptPage_scriptId_idx" ON "ScriptPage"("scriptId");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptPage_scriptId_pageNumber_key" ON "ScriptPage"("scriptId", "pageNumber");

-- AddForeignKey
ALTER TABLE "ScriptPage" ADD CONSTRAINT "ScriptPage_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
