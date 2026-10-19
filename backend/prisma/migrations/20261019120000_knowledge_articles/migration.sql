-- CreateTable: Knowledge base articles (ISO 27001 A.7.5 documented knowledge)
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "authorId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_displayId_key" ON "knowledge_articles"("displayId");

-- CreateIndex
CREATE INDEX "knowledge_articles_category_idx" ON "knowledge_articles"("category");

-- CreateIndex
CREATE INDEX "knowledge_articles_status_idx" ON "knowledge_articles"("status");

-- CreateIndex
CREATE INDEX "knowledge_articles_relatedEntityId_idx" ON "knowledge_articles"("relatedEntityId");
