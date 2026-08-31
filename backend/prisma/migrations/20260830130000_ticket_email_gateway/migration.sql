-- ==========================================
-- Ticket Email Gateway + User reference integrity
-- (additive; no destructive changes)
-- ==========================================

-- ---- Foreign keys: ticket user references --------------------------------
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tickets_requesterId_idx" ON "tickets"("requesterId");
CREATE INDEX "tickets_managerId_idx" ON "tickets"("managerId");

-- ---- Email gateway configuration ------------------------------------------
CREATE TABLE "email_gateway_config" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "inboundProvider" TEXT NOT NULL DEFAULT 'imap',
    "imapHost" TEXT,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "imapUser" TEXT,
    "imapPassword" TEXT,
    "imapMailbox" TEXT DEFAULT 'INBOX',
    "imapAuthType" TEXT DEFAULT 'password',
    "exchangeTenantId" TEXT,
    "exchangeClientId" TEXT,
    "exchangeClientSecretRef" TEXT,
    "exchangeScopes" TEXT DEFAULT 'https://outlook.office365.com/.default',
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "smtpAuthType" TEXT DEFAULT 'none',
    "smtpFromEmail" TEXT,
    "smtpRejectUnauthorized" BOOLEAN NOT NULL DEFAULT true,
    "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "subjectPrefix" TEXT DEFAULT '[ITSM]',
    "defaultTicketType" TEXT DEFAULT 'incident',
    "autoAssignToEmail" TEXT,
    "exchangeAccessToken" TEXT,
    "exchangeAccessTokenExpiry" TIMESTAMP(3),
    "lastPollAt" TIMESTAMP(3),
    "lastPollStatus" TEXT,
    "lastPollMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "email_gateway_config_pkey" PRIMARY KEY ("id")
);

-- ---- Email messages (dedup + audit trail) ---------------------------------
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "receivedAt" TIMESTAMP(3),
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "status" TEXT NOT NULL DEFAULT 'received',
    "ticketId" TEXT,
    "userId" TEXT,
    "error" TEXT,
    "rawHeaders" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_messages_messageId_key" ON "email_messages"("messageId");
CREATE INDEX "email_messages_status_receivedAt_idx" ON "email_messages"("status", "receivedAt");
CREATE INDEX "email_messages_ticketId_idx" ON "email_messages"("ticketId");

ALTER TABLE "email_messages"
  ADD CONSTRAINT "email_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
