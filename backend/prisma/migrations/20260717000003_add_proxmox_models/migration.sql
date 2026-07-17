-- Proxmox Credential - shared credentials for PVE
CREATE TABLE "proxmox_credentials" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_encrypted" TEXT,
    "api_token" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxmox_credentials_pkey" PRIMARY KEY ("id")
);

-- Proxmox Server configuration
CREATE TABLE "proxmox_servers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8006,
    "node_id" TEXT,
    "credential_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "last_sync_error" TEXT,
    "vm_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxmox_servers_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on host + port + nodeId
CREATE UNIQUE INDEX "proxmox_servers_host_port_node_id_key" ON "proxmox_servers"("host", "port", "node_id");

-- Index on credentialId
CREATE INDEX "proxmox_servers_credential_id_idx" ON "proxmox_servers"("credential_id");

-- Foreign key to credential
ALTER TABLE "proxmox_servers" ADD CONSTRAINT "proxmox_servers_credential_id_fkey" 
    FOREIGN KEY ("credential_id") REFERENCES "proxmox_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
