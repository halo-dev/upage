-- CreateTable
CREATE TABLE "PageV2" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actionIds" JSONB,
    "headMeta" JSONB,
    "headLinks" JSONB,
    "headScripts" JSONB,
    "headStyles" JSONB,
    "headRaw" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PageV2_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PageAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PageAsset_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PageV2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "pageV2Id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'section',
    "action" TEXT NOT NULL DEFAULT 'add',
    "actionId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "domId" TEXT NOT NULL,
    "rootDomId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "placement" TEXT NOT NULL DEFAULT 'body',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Section_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Section_pageV2Id_fkey" FOREIGN KEY ("pageV2Id") REFERENCES "PageV2" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Section" ("action", "actionId", "content", "createdAt", "domId", "id", "messageId", "pageName", "rootDomId", "sort", "type", "updatedAt") SELECT "action", "actionId", "content", "createdAt", "domId", "id", "messageId", "pageName", "rootDomId", "sort", "type", "updatedAt" FROM "Section";
DROP TABLE "Section";
ALTER TABLE "new_Section" RENAME TO "Section";
CREATE INDEX "Section_messageId_idx" ON "Section"("messageId");
CREATE INDEX "Section_pageV2Id_idx" ON "Section"("pageV2Id");
CREATE INDEX "Section_domId_idx" ON "Section"("domId");
CREATE INDEX "Section_rootDomId_idx" ON "Section"("rootDomId");
CREATE INDEX "Section_placement_idx" ON "Section"("placement");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PageV2_messageId_idx" ON "PageV2"("messageId");

-- CreateIndex
CREATE INDEX "PageV2_name_idx" ON "PageV2"("name");

-- CreateIndex
CREATE INDEX "PageV2_messageId_name_idx" ON "PageV2"("messageId", "name");

-- CreateIndex
CREATE INDEX "PageAsset_pageId_idx" ON "PageAsset"("pageId");

-- CreateIndex
CREATE INDEX "PageAsset_filename_idx" ON "PageAsset"("filename");
