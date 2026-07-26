-- Phase 8: API, Betrieb und Nachweise

-- Service Accounts (API-Scopes)
CREATE TABLE "service_accounts" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "displayId" VARCHAR UNIQUE DEFAULT '',
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "userId" TEXT, -- optional: linked to a user account
    "accessTokenHash" VARCHAR NOT NULL,
    "accessTokenSalt" VARCHAR NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "expiresAt" TIMESTAMP WITH TIME ZONE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP WITH time zone,
    "createdAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now(),
    "createdBy" VARCHAR,
    "updatedBy" VARCHAR
);

CREATE INDEX "service_accounts_userId_idx" ON "service_accounts"("userId");
CREATE INDEX "service_accounts_isActive_idx" ON "service_accounts"("isActive");
CREATE INDEX "service_accounts_isArchived_idx" ON "service_accounts"("isArchived");

-- API Audit Log (separate from regular audit log for API operations)
CREATE TABLE "api_audit_logs" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "correlationId" VARCHAR NOT NULL,
    "serviceAccountId" TEXT,
    "userId" TEXT,
    "method" VARCHAR NOT NULL,
    "path" VARCHAR NOT NULL,
    "statusCode" INTEGER,
    "requestSize" BIGINT DEFAULT 0,
    "responseSize" BIGINT DEFAULT 0,
    "durationMs" INTEGER,
    "ipAddress" VARCHAR,
    "userAgent" TEXT,
    "idempotencyKey" VARCHAR,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now()
);

CREATE INDEX "api_audit_logs_correlationId_idx" ON "api_audit_logs"("correlationId");
CREATE INDEX "api_audit_logs_serviceAccountId_idx" ON "api_audit_logs"("serviceAccountId");
CREATE INDEX "api_audit_logs_createdAt_idx" ON "api_audit_logs"("createdAt");

-- Idempotency Keys
CREATE TABLE "idempotency_keys" (
    "key" VARCHAR PRIMARY KEY,
    "serviceAccountId" TEXT NOT NULL,
    "userId" TEXT,
    "httpMethod" VARCHAR NOT NULL,
    "routePattern" VARCHAR NOT NULL,
    "requestBodyHash" VARCHAR NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseHeaders" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "responseBodyPreview" TEXT, -- first 1000 chars of response body
    "expiresAt" TIMESTAMP WITH time zone NOT NULL,
    "createdAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now()
);

CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");
CREATE INDEX "idempotency_keys_serviceAccountId_idx" ON "idempotency_keys"("serviceAccountId");

-- Webhooks
CREATE TABLE "webhooks" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "displayId" VARCHAR UNIQUE DEFAULT '',
    "name" VARCHAR NOT NULL,
    "description" TEXT,
    "url" VARCHAR NOT NULL,
    "secret" VARCHAR NOT NULL, -- HMAC secret for signature verification
    "events" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastDeliveryStatus" VARCHAR, -- success, failed, pending
    "lastDeliveredAt" TIMESTAMP WITH time zone,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now(),
    "createdBy" VARCHAR,
    "updatedBy" VARCHAR
);

CREATE INDEX "webhooks_isActive_idx" ON "webhooks"("isActive");
CREATE INDEX "webhooks_events_idx" ON "webhooks" USING GIN ("events");

-- Webhook Deliveries (audit trail)
CREATE TABLE "webhook_deliveries" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "webhookId" TEXT NOT NULL REFERENCES "webhooks"("id") ON DELETE CASCADE,
    "eventId" VARCHAR NOT NULL, -- event type identifier
    "url" VARCHAR NOT NULL,
    "httpMethod" VARCHAR NOT NULL DEFAULT 'POST',
    "requestHeaders" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "requestBodyHash" VARCHAR NOT NULL,
    "responseStatus" INTEGER,
    "responseHeaders" JSONB,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now()
);

CREATE INDEX "webhook_deliveries_webhookId_idx" ON "webhook_deliveries"("webhookId");
CREATE INDEX "webhook_deliveries_eventId_idx" ON "webhook_deliveries"("eventId");
CREATE INDEX "webhook_deliveries_createdAt_idx" ON "webhook_deliveries"("createdAt");

-- API Rate Limits (per service account / user)
CREATE TABLE "api_rate_limits" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "serviceAccountId" TEXT,
    "userId" TEXT,
    "endpointPattern" VARCHAR NOT NULL DEFAULT '*',
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "requestsPerHour" INTEGER NOT NULL DEFAULT 1000,
    "burstSize" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now()
);

CREATE INDEX "api_rate_limits_serviceAccountId_idx" ON "api_rate_limits"("serviceAccountId");
CREATE INDEX "api_rate_limits_userId_idx" ON "api_rate_limits"("userId");

-- API Scopes (reference table)
CREATE TABLE "api_scopes" (
    "scope" VARCHAR PRIMARY KEY,
    "description" TEXT,
    "category" VARCHAR NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP WITH time zone NOT NULL DEFAULT now()
);

-- Insert default scopes
INSERT INTO "api_scopes" ("scope", "description", "category") VALUES
    ('assets:read', 'Read asset data', 'asset'),
    ('assets:write', 'Create/update/delete assets', 'asset'),
    ('risks:read', 'Read risk data', 'risk'),
    ('risks:write', 'Create/update/delete risks', 'risk'),
    ('controls:read', 'Read control data', 'control'),
    ('controls:write', 'Create/update/delete controls', 'control'),
    ('incidents:read', 'Read incident data', 'incident'),
    ('incidents:write', 'Create/update/delete incidents', 'incident'),
    ('admin:read', 'Read admin configuration', 'admin'),
    ('admin:write', 'Modify admin configuration', 'admin'),
    ('webhooks:read', 'Read webhook configuration', 'webhook'),
    ('webhooks:write', 'Create/update/delete webhooks', 'webhook'),
    ('serviceaccounts:read', 'Read service account configuration', 'serviceaccount'),
    ('serviceaccounts:write', 'Create/update/delete service accounts', 'serviceaccount'),
    ('system:health', 'Access system health endpoints', 'system');
