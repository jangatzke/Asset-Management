-- Phase 1: granular permissions and scoped role assignments
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_name_key" ON "permissions"("name");

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");
CREATE INDEX IF NOT EXISTS "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "legalEntityId" TEXT;
ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
CREATE INDEX IF NOT EXISTS "user_roles_userId_roleName_idx" ON "user_roles"("userId", "roleName");
CREATE INDEX IF NOT EXISTS "user_roles_legalEntityId_idx" ON "user_roles"("legalEntityId");
CREATE INDEX IF NOT EXISTS "user_roles_organizationUnitId_idx" ON "user_roles"("organizationUnitId");
CREATE INDEX IF NOT EXISTS "user_roles_scopeId_idx" ON "user_roles"("scopeId");
CREATE INDEX IF NOT EXISTS "user_roles_siteId_idx" ON "user_roles"("siteId");

ALTER TABLE "group_roles" ADD COLUMN IF NOT EXISTS "legalEntityId" TEXT;
ALTER TABLE "group_roles" ADD COLUMN IF NOT EXISTS "organizationUnitId" TEXT;
ALTER TABLE "group_roles" ADD COLUMN IF NOT EXISTS "scopeId" TEXT;
ALTER TABLE "group_roles" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
CREATE INDEX IF NOT EXISTS "group_roles_groupId_roleName_idx" ON "group_roles"("groupId", "roleName");
CREATE INDEX IF NOT EXISTS "group_roles_legalEntityId_idx" ON "group_roles"("legalEntityId");
CREATE INDEX IF NOT EXISTS "group_roles_organizationUnitId_idx" ON "group_roles"("organizationUnitId");
CREATE INDEX IF NOT EXISTS "group_roles_scopeId_idx" ON "group_roles"("scopeId");
CREATE INDEX IF NOT EXISTS "group_roles_siteId_idx" ON "group_roles"("siteId");

CREATE TABLE IF NOT EXISTS "isms_scope_legal_entities" (
  "id" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "isms_scope_legal_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "isms_scope_legal_entities_scopeId_legalEntityId_key" ON "isms_scope_legal_entities"("scopeId", "legalEntityId");
CREATE INDEX IF NOT EXISTS "isms_scope_legal_entities_legalEntityId_idx" ON "isms_scope_legal_entities"("legalEntityId");
ALTER TABLE "isms_scope_legal_entities" ADD CONSTRAINT "isms_scope_legal_entities_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "isms_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "isms_scope_legal_entities" ADD CONSTRAINT "isms_scope_legal_entities_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
