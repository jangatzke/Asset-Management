-- ==========================================
-- ITIL 4 Ticket System (generic ticket container + type extensions)
-- ==========================================

-- ---- Generic ITIL ticket container ----------------------------------------
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "urgency" TEXT NOT NULL DEFAULT 'medium',
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "requesterId" TEXT,
    "assigneeId" TEXT,
    "managerId" TEXT,
    "slaTargetAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "firstResponseDueAt" TIMESTAMP(3),
    "resolutionDueAt" TIMESTAMP(3),
    "slaBreachedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tickets_displayId_key" ON "tickets"("displayId");
CREATE INDEX "tickets_type_status_idx" ON "tickets"("type", "status");
CREATE INDEX "tickets_assigneeId_status_idx" ON "tickets"("assigneeId", "status");
CREATE INDEX "tickets_slaTargetAt_idx" ON "tickets"("slaTargetAt");

-- ---- Generic asset link (all ticket types) --------------------------------
CREATE TABLE "ticket_assets" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_assets_ticketId_assetId_key" ON "ticket_assets"("ticketId", "assetId");

ALTER TABLE "ticket_assets"
    ADD CONSTRAINT "ticket_assets_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "ticket_assets"
    ADD CONSTRAINT "ticket_assets_assetId_fkey"
    FOREIGN KEY ("assetId")
    REFERENCES "assets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ---- Comments / updates (internal notes vs. user-visible) ------------------
CREATE TABLE "ticket_comments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ticket_comments_ticketId_createdAt_idx" ON "ticket_comments"("ticketId", "createdAt");

ALTER TABLE "ticket_comments"
    ADD CONSTRAINT "ticket_comments_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ---- Cross-ticket links ----------------------------------------------------
CREATE TABLE "ticket_links" (
    "id" TEXT NOT NULL,
    "fromTicketId" TEXT NOT NULL,
    "toTicketId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_links_fromTicketId_toTicketId_linkType_key" ON "ticket_links"("fromTicketId", "toTicketId", "linkType");

ALTER TABLE "ticket_links"
    ADD CONSTRAINT "ticket_links_fromTicketId_fkey"
    FOREIGN KEY ("fromTicketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "ticket_links"
    ADD CONSTRAINT "ticket_links_toTicketId_fkey"
    FOREIGN KEY ("toTicketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ---- Per-ticket tamper-evident history -------------------------------------
CREATE TABLE "ticket_history_entries" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldChanges" JSONB,
    "summary" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_history_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ticket_history_entries_ticketId_createdAt_idx" ON "ticket_history_entries"("ticketId", "createdAt");
CREATE INDEX "ticket_history_entries_action_idx" ON "ticket_history_entries"("action");

ALTER TABLE "ticket_history_entries"
    ADD CONSTRAINT "ticket_history_entries_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ---- Ticket escalation -----------------------------------------------------
CREATE TABLE "ticket_escalations" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "escalationType" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "escalatedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "ticket_escalations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ticket_escalations_ticketId_status_idx" ON "ticket_escalations"("ticketId", "status");

ALTER TABLE "ticket_escalations"
    ADD CONSTRAINT "ticket_escalations_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ---- Ticket type configuration ---------------------------------------------
CREATE TABLE "ticket_type_configs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "slaPolicy" JSONB,
    "defaultPriority" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ticket_type_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_type_configs_type_key" ON "ticket_type_configs"("type");

-- ---- Service catalog -------------------------------------------------------
CREATE TABLE "service_catalog_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ticketType" TEXT NOT NULL DEFAULT 'service_request',
    "fulfillment" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_catalog_items_code_key" ON "service_catalog_items"("code");

-- ---- Problem extension -----------------------------------------------------
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "rootCause" TEXT,
    "workaround" TEXT,
    "permanentFix" TEXT,
    "relatedIncidentIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "problems_ticketId_key" ON "problems"("ticketId");

ALTER TABLE "problems"
    ADD CONSTRAINT "problems_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ---- Change extension ------------------------------------------------------
CREATE TABLE "changes" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL DEFAULT 'standard',
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "cabApproved" BOOLEAN NOT NULL DEFAULT false,
    "cabApprovedBy" TEXT,
    "cabApprovedAt" TIMESTAMP(3),
    "implementationPlan" TEXT,
    "rollbackPlan" TEXT,
    "backoutDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "changes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "changes_ticketId_key" ON "changes"("ticketId");

ALTER TABLE "changes"
    ADD CONSTRAINT "changes_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- ---- Service request extension ---------------------------------------------
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_requests_ticketId_key" ON "service_requests"("ticketId");
CREATE INDEX "service_requests_catalogItemId_idx" ON "service_requests"("catalogItemId");

ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "tickets"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId")
    REFERENCES "service_catalog_items"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- ---- Link incidents to their ticket (1:1 extension) ------------------------
ALTER TABLE "incidents"
    ADD COLUMN "ticketId" TEXT;

CREATE UNIQUE INDEX "incidents_ticketId_key" ON "incidents"("ticketId");

ALTER TABLE "incidents"
    ADD CONSTRAINT "incidents_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "tickets"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
