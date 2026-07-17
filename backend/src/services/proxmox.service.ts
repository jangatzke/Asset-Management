/**
 * Proxmox Service
 *
 * Manages Proxmox VE server configurations and imports VMs/Containers via Proxmox API.
 * Uses Proxmox credentials for authentication with PVE servers.
 */

import { prisma } from '../config/database';
import { proxmoxCredentialService } from './proxmox.credential';
import { AppError } from '../middleware/errorHandler';

export interface ProxmoxServerDto {
  id: string;
  name: string;
  host: string;
  port: number;
  nodeId: string | null;
  credentialId: string;
  credentialName?: string;
  enabled: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  vmCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProxmoxVM {
  name: string;
  vmid: number;
  type: 'qemu' | 'lxc';
  node: string;
  status: string; // running, stopped, paused
  cpuCount?: number;
  memoryMB?: number;
  maxDiskMB?: number;
  templates?: boolean;
  ipAddresses?: string[];
  tags?: string;
}

interface ProxmoxTicketResponse {
  data: {
    ticket: string;
    CSRFPreventionToken: string;
  };
}

interface ProxmoxAPIResponse<T> {
  data: T;
}

export class ProxmoxService {
  private async authenticate(proxmoxId: string) {
    const server = await prisma.proxmoxServer.findUnique({ where: { id: proxmoxId } });
    if (!server) {
      throw new AppError('Proxmox server not found', 404);
    }

    const credentials = await proxmoxCredentialService.getDecryptedCredentials(server.credentialId);
    const baseUrl = `https://${server.host}:${server.port}`;

    // API Token authentication (Bearer token)
    if (credentials.apiToken) {
      return {
        baseUrl,
        headers: <Record<string, string>>{
          Authorization: `PVEAPIToken=${credentials.apiToken}`,
        },
      };
    }

    // Password-based authentication (ticket)
    if (credentials.password) {
      try {
        const response = await fetch(`${baseUrl}/api2/json/access/ticket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}`,
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new AppError(`Proxmox authentication failed (${response.status}): ${errorText.slice(0, 200)}`, 401);
        }

        const data = (await response.json()) as ProxmoxTicketResponse;
        return {
          baseUrl,
          headers: <Record<string, string>>{
            Cookie: `PVEAuthCookie=${data.data.ticket}`,
            CSRFPreventionToken: data.data.CSRFPreventionToken,
          },
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Failed to connect to Proxmox: ${(error as Error).message}`, 502);
      }
    }

    throw new AppError('Credential has neither password nor API token configured', 400);
  }

  async listServers(): Promise<ProxmoxServerDto[]> {
    const servers = await prisma.proxmoxServer.findMany({
      include: {
        credential: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return servers.map((s) => this.mapToDto(s));
  }

  async createServer(data: {
    name: string;
    host: string;
    port?: number;
    nodeId?: string;
    credentialId: string;
  }): Promise<ProxmoxServerDto> {
    // Validate credential exists
    const credential = await prisma.proxmoxCredential.findUnique({ where: { id: data.credentialId } });
    if (!credential) {
      throw new AppError('Credential not found', 404);
    }

    const port = data.port || 8006;

    // Check unique constraint
    const existing = await prisma.proxmoxServer.findFirst({
      where: {
        host: data.host,
        port,
        nodeId: data.nodeId || null,
      },
    });
    if (existing) {
      throw new AppError('Proxmox server with this host, port, and node already exists', 409);
    }

    const server = await prisma.proxmoxServer.create({
      data: {
        name: data.name,
        host: data.host,
        port,
        nodeId: data.nodeId || null,
        credentialId: data.credentialId,
      },
      include: { credential: true },
    });

    return this.mapToDto(server);
  }

  async updateServer(
    id: string,
    data: Partial<{ name: string; host: string; port: number; nodeId: string; credentialId: string; enabled: boolean }>
  ): Promise<ProxmoxServerDto> {
    const existing = await prisma.proxmoxServer.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Proxmox server not found', 404);
    }

    // Validate credential if changing
    if (data.credentialId && data.credentialId !== existing.credentialId) {
      const cred = await prisma.proxmoxCredential.findUnique({ where: { id: data.credentialId } });
      if (!cred) {
        throw new AppError('Credential not found', 404);
      }
    }

    // Check unique constraint for host+port+nodeId (excluding current server)
    if (data.host || data.port !== undefined || data.nodeId !== undefined) {
      const duplicate = await prisma.proxmoxServer.findFirst({
        where: {
          host: data.host ?? existing.host,
          port: data.port ?? existing.port,
          nodeId: data.nodeId ?? existing.nodeId,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new AppError('Proxmox server with this host, port, and node already exists', 409);
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.host !== undefined) updateData.host = data.host;
    if (data.port !== undefined) updateData.port = data.port;
    if (data.nodeId !== undefined) updateData.nodeId = data.nodeId || null;
    if (data.credentialId !== undefined) updateData.credentialId = data.credentialId;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    const server = await prisma.proxmoxServer.update({
      where: { id },
      data: updateData,
      include: { credential: true },
    });

    return this.mapToDto(server);
  }

  async deleteServer(id: string): Promise<{ message: string }> {
    const server = await prisma.proxmoxServer.findUnique({ where: { id } });
    if (!server) {
      throw new AppError('Proxmox server not found', 404);
    }

    await prisma.proxmoxServer.delete({ where: { id } });
    return { message: 'Proxmox server deleted successfully' };
  }

  /**
   * Import VMs and Containers from Proxmox API.
   * Fetches QEMU VMs and LXC containers, creates/updates Asset records.
   */
  async importVMs(proxmoxId: string, options?: { dryRun?: boolean }): Promise<{ imported: number; updated: number; errors: string[] }> {
    const server = await prisma.proxmoxServer.findUnique({ where: { id: proxmoxId } });
    if (!server) {
      throw new AppError('Proxmox server not found', 404);
    }

    if (!server.enabled) {
      throw new AppError('Proxmox server is disabled', 400);
    }

    const errors: string[] = [];
    let imported = 0;
    let updated = 0;

    try {
      // Update status to pending
      await prisma.proxmoxServer.update({
        where: { id: proxmoxId },
        data: { lastSyncStatus: 'pending', lastSyncError: null },
      });

      const { baseUrl, headers } = await this.authenticate(proxmoxId);

      // Determine which nodes to import from
      let nodes: string[] = [];
      if (server.nodeId) {
        nodes = [server.nodeId];
      } else {
        // Fetch all nodes
        const nodeResponse = await fetch(`${baseUrl}/api2/json/nodes`, {
          headers,
          signal: AbortSignal.timeout(30_000),
        });
        if (nodeResponse.ok) {
          const data = (await nodeResponse.json()) as ProxmoxAPIResponse<Array<{ node: string }>>;
          nodes = data.data.map((n) => n.node);
        } else {
          throw new AppError('Failed to fetch nodes from Proxmox', 502);
        }
      }

      // Find or create asset type for virtual machines
      let vmAssetType = await prisma.assetType.findFirst({
        where: { name: 'Virtual Machine' },
      });
      if (!vmAssetType) {
        vmAssetType = await prisma.assetType.create({
          data: {
            name: 'Virtual Machine',
            description: 'Proxmox virtual machine (QEMU) imported from PVE',
            category: 'infrastructure',
          },
        });
      }

      // Find or create asset type for containers
      let containerAssetType = await prisma.assetType.findFirst({
        where: { name: 'Container' },
      });
      if (!containerAssetType) {
        containerAssetType = await prisma.assetType.create({
          data: {
            name: 'Container',
            description: 'Proxmox LXC container imported from PVE',
            category: 'infrastructure',
          },
        });
      }

      // Collect all VMs and containers
      const allVms: ProxmoxVM[] = [];

      for (const node of nodes) {
        try {
          // Fetch QEMU VMs
          const qemuResponse = await fetch(`${baseUrl}/api2/json/nodes/${node}/qemu`, {
            headers,
            signal: AbortSignal.timeout(60_000),
          });
          if (qemuResponse.ok) {
            const data = (await qemuResponse.json()) as ProxmoxAPIResponse<Array<Record<string, unknown>>>;
            for (const vm of data.data) {
              allVms.push(this.parseProxmoxVM(vm, node, 'qemu'));
            }
          }

          // Fetch LXC containers
          const lxcResponse = await fetch(`${baseUrl}/api2/json/nodes/${node}/lxc`, {
            headers,
            signal: AbortSignal.timeout(60_000),
          });
          if (lxcResponse.ok) {
            const data = (await lxcResponse.json()) as ProxmoxAPIResponse<Array<Record<string, unknown>>>;
            for (const vm of data.data) {
              allVms.push(this.parseProxmoxVM(vm, node, 'lxc'));
            }
          }
        } catch (err) {
          errors.push(`Failed to fetch VMs/containers from node "${node}": ${(err as Error).message}`);
        }
      }

      // Process each VM/container
      for (const vm of allVms) {
        try {
          if (!vm.vmid || !vm.name) continue;

          const externalId = `proxmox:${proxmoxId}:${vm.type}_${vm.vmid}`;

          // Check if asset already exists by external ID
          let existingAsset = await prisma.asset.findFirst({
            where: { externalId },
          });

          if (existingAsset) {
            if (!options?.dryRun) {
              await prisma.asset.update({
                where: { id: existingAsset.id },
                data: {
                  name: vm.name,
                  description: this.buildVmDescription(vm),
                  model: `${vm.type.toUpperCase()} on ${vm.node}`,
                  dataSource: 'proxmox',
                  lastDetectedAt: new Date(),
                  status: vm.status === 'running' ? 'active' : existingAsset.status,
                },
              });
            }
            updated++;
          } else {
            if (!options?.dryRun) {
              await prisma.asset.create({
                data: {
                  displayId: '',
                  name: vm.name,
                  description: this.buildVmDescription(vm),
                  assetTypeId: vm.type === 'qemu' ? vmAssetType.id : containerAssetType.id,
                  subType: vm.type === 'qemu' ? 'proxmox_vm' : 'proxmox_container',
                  model: `${vm.type.toUpperCase()} on ${vm.node}`,
                  externalId,
                  dataSource: 'proxmox',
                  lastDetectedAt: new Date(),
                  status: vm.status === 'running' ? 'active' : 'inactive',
                },
              });
            }
            imported++;
          }
        } catch (err) {
          errors.push(`Failed to import ${vm.type} "${vm.name}" (VMID: ${vm.vmid}): ${(err as Error).message}`);
        }
      }

      // Update Proxmox server with sync results
      if (!options?.dryRun) {
        await prisma.proxmoxServer.update({
          where: { id: proxmoxId },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: errors.length > 0 && imported === 0 && updated === 0 ? 'error' : 'success',
            lastSyncError: errors.length > 0 ? errors.join('; ') : null,
            vmCount: allVms.length,
          },
        });
      }

      return { imported, updated, errors };
    } catch (error) {
      const msg = (error as Error).message;
      if (!options?.dryRun) {
        await prisma.proxmoxServer.update({
          where: { id: proxmoxId },
          data: { lastSyncStatus: 'error', lastSyncError: msg },
        });
      }
      throw error;
    }
  }

  /**
   * Test connection to a Proxmox server
   */
  async testConnection(proxmoxId: string): Promise<{ success: boolean; message: string }> {
    const server = await prisma.proxmoxServer.findUnique({ where: { id: proxmoxId } });
    if (!server) {
      throw new AppError('Proxmox server not found', 404);
    }

    try {
      const { baseUrl, headers } = await this.authenticate(proxmoxId);

      // Try to fetch nodes as a connectivity test
      const response = await fetch(`${baseUrl}/api2/json/nodes`, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });

      if (response.ok) {
        return { success: true, message: 'Successfully connected to Proxmox server' };
      } else {
        const errorText = await response.text().catch(() => '');
        return { success: false, message: `API returned status ${response.status}: ${errorText.slice(0, 200)}` };
      }
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  private parseProxmoxVM(raw: Record<string, unknown>, node: string, type: 'qemu' | 'lxc'): ProxmoxVM {
    const vmid = Number(raw.vmid);
    return {
      name: (raw.name as string) || `Unnamed-${vmid}`,
      vmid,
      type,
      node,
      status: (raw.status as string) || 'stopped',
      cpuCount: raw.maxcpu ? Number(raw.maxcpu) : undefined,
      memoryMB: raw.maxmem ? Math.round(Number(raw.maxmem) / (1024 * 1024)) : undefined,
      maxDiskMB: raw.maxdisk ? Math.round(Number(raw.maxdisk) / (1024 * 1024)) : undefined,
      templates: raw.template ? Boolean(raw.template) : undefined,
      ipAddresses: Array.isArray(raw['ip-addresses'])
        ? (raw['ip-addresses'] as unknown[]).filter(Boolean).map(String)
        : [],
      tags: raw.tags ? String(raw.tags) : undefined,
    };
  }

  private buildVmDescription(vm: ProxmoxVM): string {
    const parts = [
      `Type: ${vm.type.toUpperCase()}`,
      `Node: ${vm.node}`,
      `Status: ${vm.status}`,
    ];
    if (vm.cpuCount) parts.push(`CPUs: ${vm.cpuCount}`);
    if (vm.memoryMB) parts.push(`Memory: ${vm.memoryMB} MB`);
    if (vm.maxDiskMB) parts.push(`Disk: ${vm.maxDiskMB} MB`);
    if (vm.ipAddresses?.length) parts.push(`IPs: ${vm.ipAddresses.join(', ')}`);
    return parts.join(' | ');
  }

  private mapToDto(server: any): ProxmoxServerDto {
    return {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      nodeId: server.nodeId,
      credentialId: server.credentialId,
      credentialName: server.credential?.name,
      enabled: server.enabled,
      lastSyncAt: server.lastSyncAt,
      lastSyncStatus: server.lastSyncStatus,
      lastSyncError: server.lastSyncError,
      vmCount: server.vmCount,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  }
}

export const proxmoxService = new ProxmoxService();
