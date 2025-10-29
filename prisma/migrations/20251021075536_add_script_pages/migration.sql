-- CreateTable
CREATE TABLE "script_pages" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "formatted" JSONB NOT NULL,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "script_pages_scriptId_idx" ON "script_pages"("scriptId");

-- CreateIndex
CREATE UNIQUE INDEX "script_pages_scriptId_pageNumber_key" ON "script_pages"("scriptId", "pageNumber");

-- AddForeignKey
ALTER TABLE "script_pages" ADD CONSTRAINT "script_pages_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
