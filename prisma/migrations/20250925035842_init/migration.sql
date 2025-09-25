-- CreateTable
CREATE TABLE "ChatUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "calledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "modelName" TEXT,
    "prompt" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urlId" TEXT,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "revisionId" TEXT,
    "annotations" JSONB,
    "isDiscarded" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "parts" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "pages" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Page_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'section',
    "action" TEXT NOT NULL DEFAULT 'add',
    "actionId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "domId" TEXT NOT NULL,
    "rootDomId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Section_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deployment_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ChatUsage_userId_idx" ON "ChatUsage"("userId");

-- CreateIndex
CREATE INDEX "ChatUsage_messageId_idx" ON "ChatUsage"("messageId");

-- CreateIndex
CREATE INDEX "ChatUsage_chatId_idx" ON "ChatUsage"("chatId");

-- CreateIndex
CREATE INDEX "ChatUsage_calledAt_idx" ON "ChatUsage"("calledAt");

-- CreateIndex
CREATE INDEX "ChatUsage_status_idx" ON "ChatUsage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_urlId_key" ON "Chat"("urlId");

-- CreateIndex
CREATE INDEX "Chat_userId_idx" ON "Chat"("userId");

-- CreateIndex
CREATE INDEX "Chat_urlId_idx" ON "Chat"("urlId");

-- CreateIndex
CREATE INDEX "Message_chatId_idx" ON "Message"("chatId");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_messageId_key" ON "Page"("messageId");

-- CreateIndex
CREATE INDEX "Page_messageId_idx" ON "Page"("messageId");

-- CreateIndex
CREATE INDEX "Section_messageId_idx" ON "Section"("messageId");

-- CreateIndex
CREATE INDEX "Section_domId_idx" ON "Section"("domId");

-- CreateIndex
CREATE INDEX "Section_rootDomId_idx" ON "Section"("rootDomId");

-- CreateIndex
CREATE INDEX "Deployment_userId_idx" ON "Deployment"("userId");

-- CreateIndex
CREATE INDEX "Deployment_chatId_idx" ON "Deployment"("chatId");

-- CreateIndex
CREATE INDEX "Deployment_platform_idx" ON "Deployment"("platform");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE INDEX "Deployment_createdAt_idx" ON "Deployment"("createdAt");

-- CreateIndex
CREATE INDEX "UserSetting_userId_idx" ON "UserSetting"("userId");

-- CreateIndex
CREATE INDEX "UserSetting_category_idx" ON "UserSetting"("category");

-- CreateIndex
CREATE INDEX "UserSetting_key_idx" ON "UserSetting"("key");

-- CreateIndex
CREATE INDEX "UserSetting_isSecret_idx" ON "UserSetting"("isSecret");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetting_userId_category_key_key" ON "UserSetting"("userId", "category", "key");
