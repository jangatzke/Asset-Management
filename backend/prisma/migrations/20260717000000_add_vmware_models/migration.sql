-- Create vmware_credentials table
CREATE TABLE "vmware_credentials" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "username"   TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "isDefault"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "updatedAt"  TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vmware_credentials_pkey" PRIMARY KEY ("id")
);

-- Create vcenter_servers table
CREATE TABLE "vcenter_servers" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "host"           TEXT NOT NULL,
    "port"           INTEGER NOT NULL DEFAULT 443,
    "credentialId"   TEXT NOT NULL,
    "enabled"        BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt"     TIMESTAMPTZ(3),
    "lastSyncStatus" TEXT,
    "lastSyncError"  TEXT,
    "vmCount"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vcenter_servers_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on host+port
CREATE UNIQUE INDEX "vcenter_servers_host_port_key" ON "vcenter_servers"("host", "port");

-- Index on credentialId
CREATE INDEX "vcenter_servers_credentialId_idx" ON "vcenter_servers"("credentialId");

-- Foreign key: vcenter_servers.credentialId -> vmware_credentials.id
ALTER TABLE "vcenter_servers"
  ADD CONSTRAINT "vcenter_servers_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "vmware_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
