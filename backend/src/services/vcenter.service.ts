/**
 * vCenter Service
 *
 * Manages vCenter server configurations and imports VMs via vSphere REST API.
 * Uses VMware credentials for authentication with vCenter servers.
 */

import { prisma } from '../config/database';
import { vmwareCredentialService } from './vmware.credential';
import { AppError } from '../middleware/errorHandler';

export interface VCenterDto {
  id: string;
  name: string;
  host: string;
  port: number;
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

export interface VCenterVM {
  name: string;
  uuid: string;
  guestOS: string;
  cpuCount: number;
  memoryMB: number;
  ipAddress: string | null;
  powerState: string; // poweredOn, poweredOff, suspended
  datastore: string;
  host: string;
  folder: string;
}

interface VCenterApiResponse {
  values: Array<{
    'self_link'?: string;
    id?: string;
    name?: string;
    uuid?: string;
    guest?: { fullName?: string };
    hardware?: { numCpus?: number; memorySize?: number };
    runtime?: { powerState?: string; host?: string };
    config?: { template?: boolean };
  }>;
  page_count?: number;
}

interface VCenterLoginResponse {
  token: string;
}

export class VCenterService {
  private async authenticate(vcenterId: string): Promise<{ baseUrl: string; token: string }> {
    const server = await prisma.vCenterServer.findUnique({ where: { id: vcenterId } });
    if (!server) {
      throw new AppError('vCenter server not found', 404);
    }

    const credentials = await vmwareCredentialService.getDecryptedCredentials(server.credentialId);
    const baseUrl = `https://${server.host}:${server.port}`;

    try {
      const response = await fetch(`${baseUrl}/rest/com/vmware/cis/session`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`,
        },
        // Node.js 18+ fetch doesn't verify by default in some cases, but for production use agent options
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new AppError(`vCenter authentication failed (${response.status}): ${errorText.slice(0, 200)}`, 401);
      }

      const data = (await response.json()) as VCenterLoginResponse;
      return { baseUrl, token: data.token };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to connect to vCenter: ${(error as Error).message}`, 502);
    }
  }

  async listServers(): Promise<VCenterDto[]> {
    const servers = await prisma.vCenterServer.findMany({
      include: {
        credential: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return servers.map((s) => ({
      id: s.id,
      name: s.name,
      host: s.host,
      port: s.port,
      credentialId: s.credentialId,
      credentialName: s.credential.name,
      enabled: s.enabled,
      lastSyncAt: s.lastSyncAt,
      lastSyncStatus: s.lastSyncStatus,
      lastSyncError: s.lastSyncError,
      vmCount: s.vmCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async createServer(data: { name: string; host: string; port?: number; credentialId: string }): Promise<VCenterDto> {
    // Validate credential exists
    const credential = await prisma.vmwareCredential.findUnique({ where: { id: data.credentialId } });
    if (!credential) {
      throw new AppError('Credential not found', 404);
    }

    const port = data.port || 443;

    // Check unique constraint
    const existing = await prisma.vCenterServer.findFirst({ where: { host: data.host, port } });
    if (existing) {
      throw new AppError('vCenter server with this host and port already exists', 409);
    }

    const server = await prisma.vCenterServer.create({
      data: {
        name: data.name,
        host: data.host,
        port,
        credentialId: data.credentialId,
      },
      include: { credential: true },
    });

    return this.mapToDto(server);
  }

  async updateServer(
    id: string,
    data: Partial<{ name: string; host: string; port: number; credentialId: string; enabled: boolean }>
  ): Promise<VCenterDto> {
    const existing = await prisma.vCenterServer.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('vCenter server not found', 404);
    }

    // Validate credential if changing
    if (data.credentialId && data.credentialId !== existing.credentialId) {
      const cred = await prisma.vmwareCredential.findUnique({ where: { id: data.credentialId } });
      if (!cred) {
        throw new AppError('Credential not found', 404);
      }
    }

    // Check unique constraint for host+port (excluding current server)
    if (data.host || data.port !== undefined) {
      const duplicate = await prisma.vCenterServer.findFirst({
        where: {
          host: data.host ?? existing.host,
          port: data.port ?? existing.port,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new AppError('vCenter server with this host and port already exists', 409);
      }
    }

    const server = await prisma.vCenterServer.update({
      where: { id },
      data,
      include: { credential: true },
    });

    return this.mapToDto(server);
  }

  async deleteServer(id: string): Promise<{ message: string }> {
    const server = await prisma.vCenterServer.findUnique({ where: { id } });
    if (!server) {
      throw new AppError('vCenter server not found', 404);
    }

    await prisma.vCenterServer.delete({ where: { id } });
    return { message: 'vCenter server deleted successfully' };
  }

  /**
   * Import VMs from vCenter using REST API (vSphere 6.5+/7.0)
   */
  async importVMs(vcenterId: string, options?: { dryRun?: boolean }): Promise<{ imported: number; updated: number; errors: string[] }> {
    const server = await prisma.vCenterServer.findUnique({ where: { id: vcenterId } });
    if (!server) {
      throw new AppError('vCenter server not found', 404);
    }

    if (!server.enabled) {
      throw new AppError('vCenter server is disabled', 400);
    }

    const errors: string[] = [];
    let imported = 0;
    let updated = 0;

    try {
      // Update status to pending
      await prisma.vCenterServer.update({
        where: { id: vcenterId },
        data: { lastSyncStatus: 'pending', lastSyncError: null },
      });

      const { baseUrl, token } = await this.authenticate(vcenterId);

      // Find or create asset type for virtual machines
      let vmAssetType = await prisma.assetType.findFirst({
        where: { name: 'Virtual Machine' },
      });

      if (!vmAssetType) {
        vmAssetType = await prisma.assetType.create({
          data: {
            name: 'Virtual Machine',
            description: 'VMware virtual machine imported from vCenter',
            category: 'infrastructure',
          },
        });
      }

      // Fetch all VMs via REST API with pagination
      const allVms = await this.fetchAllVMs(baseUrl, token);

      for (const vm of allVms) {
        try {
          if (!vm.uuid || !vm.name) continue;

          const externalId = `vcenter:${vcenterId}:${vm.uuid}`;

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
                  model: vm.guestOS || undefined,
                  dataSource: 'vcenter',
                  lastDetectedAt: new Date(),
                  status: vm.powerState === 'poweredOn' ? 'active' : existingAsset.status,
                },
              });
            }
            updated++;
          } else {
            if (!options?.dryRun) {
              await prisma.asset.create({
                data: {
                  displayId: '', // Will be generated by the DB trigger or service layer
                  name: vm.name,
                  description: this.buildVmDescription(vm),
                  assetTypeId: vmAssetType.id,
                  subType: 'vmware_vm',
                  model: vm.guestOS || undefined,
                  externalId,
                  dataSource: 'vcenter',
                  lastDetectedAt: new Date(),
                  status: vm.powerState === 'poweredOn' ? 'active' : 'inactive',
                },
              });
            }
            imported++;
          }
        } catch (err) {
          errors.push(`Failed to import VM "${vm.name}": ${(err as Error).message}`);
        }
      }

      // Update vCenter server with sync results
      if (!options?.dryRun) {
        await prisma.vCenterServer.update({
          where: { id: vcenterId },
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
        await prisma.vCenterServer.update({
          where: { id: vcenterId },
          data: { lastSyncStatus: 'error', lastSyncError: msg },
        });
      }
      throw error;
    }
  }

  /**
   * Fetch all VMs from vCenter with pagination
   */
  private async fetchAllVMs(baseUrl: string, token: string): Promise<VCenterVM[]> {
    const vms: VCenterVM[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const url = `${baseUrl}/api/vcenter/vm?page=${page}&page_size=100&fields=name,uuid,guest,hardware,runtime`;
        const response = await fetch(url, {
          headers: {
            'vmware-api-session-id': token,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
          break;
        }

        const data = (await response.json()) as VCenterApiResponse;
        const values = data.values || [];

        for (const vm of values) {
          // Skip templates
          if (vm.config?.template) continue;

          vms.push({
            name: vm.name || 'Unknown',
            uuid: vm.uuid || '',
            guestOS: vm.guest?.fullName || '',
            cpuCount: vm.hardware?.numCpus || 0,
            memoryMB: Math.round((vm.hardware?.memorySize || 0) / (1024 * 1024)),
            ipAddress: null, // Would need additional API call to get IP
            powerState: vm.runtime?.powerState || 'unknown',
            datastore: '', // Would need additional API call
            host: this.extractHostname(vm.runtime?.host) || '',
            folder: '',
          });
        }

        hasMore = values.length === 100;
        page++;
      } catch {
        break;
      }
    }

    return vms;
  }

  /**
   * Test connection to a vCenter server
   */
  async testConnection(vcenterId: string): Promise<{ success: boolean; message: string }> {
    const server = await prisma.vCenterServer.findUnique({ where: { id: vcenterId } });
    if (!server) {
      throw new AppError('vCenter server not found', 404);
    }

    try {
      const { token } = await this.authenticate(vcenterId);

      // Try to fetch VM count as a connectivity test
      const response = await fetch(`https://${server.host}:${server.port}/api/vcenter/vm?page=0&page_size=1`, {
        headers: {
          'vmware-api-session-id': token,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (response.ok) {
        return { success: true, message: 'Successfully connected to vCenter server' };
      } else {
        return { success: false, message: `API returned status ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  private buildVmDescription(vm: VCenterVM): string {
    const parts = [
      `Guest OS: ${vm.guestOS || 'Unknown'}`,
      `CPUs: ${vm.cpuCount}`,
      `Memory: ${vm.memoryMB} MB`,
      `Power State: ${vm.powerState}`,
    ];
    if (vm.ipAddress) parts.push(`IP: ${vm.ipAddress}`);
    return parts.join(' | ');
  }

  private extractHostname(hostRef?: string): string | null {
    if (!hostRef) return null;
    // Host ref format: /rest/vcenter/host/host-123 or similar
    const match = hostRef.match(/[^/]+$/);
    return match ? match[0] : null;
  }

  private mapToDto(server: any): VCenterDto {
    return {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
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

export const vcenterService = new VCenterService();
