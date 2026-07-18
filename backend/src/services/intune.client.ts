import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getAuthService } from './intune.auth';
import { AppError } from '../middleware/errorHandler';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';

export const MANAGED_DEVICE_SELECT_FIELDS = [
  'id',
  'deviceName',
  'serialNumber',
  'manufacturer',
  'model',
  'operatingSystem',
  'osVersion',
  'deviceEnrollmentType',
  'managementAgent',
  'complianceState',
  'managementState',
  'enrolledDateTime',
  'lastSyncDateTime',
  'emailAddress',
  'userDisplayName',
  'userPrincipalName',
  'azureADDeviceId',
  'wiFiMacAddress',
  'ethernetMacAddress',
] as const;

export const DETECTED_APP_SELECT_FIELDS = ['id', 'displayName', 'version', 'publisher', 'sizeInByte'] as const;

export const REQUIRED_GRAPH_APP_ROLES = ['DeviceManagementManagedDevices.Read.All'] as const;

export interface ManagedDevice {
  id: string;
  deviceName?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  operatingSystem?: string;
  osVersion?: string;
  deviceEnrollmentType?: string;
  managementAgent?: string;
  complianceState?: string;
  managementState?: string;
  enrolledDateTime?: string;
  lastSyncDateTime?: string;
  emailAddress?: string;
  userDisplayName?: string;
  userPrincipalName?: string;
  azureADDeviceId?: string;
  wiFiMacAddress?: string;
  ethernetMacAddress?: string;
}

export interface PermissionValidationResult {
  valid: boolean;
  requiredPermissions: string[];
  verifiedPermissions: string[];
  missingPermissions: string[];
  message: string;
}

interface GraphPage<T> {
  value?: T[];
  '@odata.nextLink'?: string;
  '@odata.nextlink'?: string;
}

function encodeSelect(fields: readonly string[]): string {
  return encodeURIComponent(fields.join(','));
}

function parseRetryAfter(value: unknown, fallbackMs: number): number {
  if (typeof value !== 'string') return fallbackMs;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return fallbackMs;
}

export class IntuneHttpClient {
  private readonly client: AxiosInstance;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(maxRetries = 3, baseDelayMs = 5000, client?: AxiosInstance, sleepFn?: (ms: number) => Promise<void>) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.client = client ?? axios.create({ timeout: 60_000 });
    this.sleepFn = sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private async getAuthToken(): Promise<string> {
    const authService = getAuthService();
    if (!authService) throw new AppError('Intune auth service not initialized', 500);
    return authService.getAccessToken();
  }

  private async requestWithRetry<T>(method: 'get' | 'post', url: string, options?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const token = await this.getAuthToken();
        const requestOptions: AxiosRequestConfig = {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
          },
        };
        return method === 'get'
          ? await this.client.get<T>(url, requestOptions)
          : await this.client.post<T>(url, options?.data, requestOptions);
      } catch (error) {
        lastError = error as Error;
        if (axios.isAxiosError(error) && error.response?.status === 429 && attempt < this.maxRetries) {
          const delayMs = parseRetryAfter(error.response.headers?.['retry-after'], this.baseDelayMs * Math.pow(2, attempt));
          await this.sleepFn(delayMs);
          continue;
        }
        if (axios.isAxiosError(error) && error.response?.status === 401 && attempt < this.maxRetries) {
          await getAuthService()?.refreshAccessToken();
          continue;
        }
        if (axios.isAxiosError(error) && (!error.response || error.response.status >= 500) && attempt < this.maxRetries) {
          await this.sleepFn(this.baseDelayMs * Math.pow(2, attempt));
          continue;
        }
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          const graphMessage = (error.response.data as any)?.error?.message || (error.response.data as any)?.error?.code;
          throw new AppError(`Microsoft Graph error (${status}): ${graphMessage || error.message}`, status);
        }
        throw error;
      }
    }

    throw new AppError(`Microsoft Graph request failed after ${this.maxRetries} retries: ${lastError?.message}`, 500);
  }

  async get<T>(url: string, options?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>('get', url, options);
  }

  async getAll<T>(url: string): Promise<T[]> {
    const allResults: T[] = [];
    let currentUrl: string | undefined = url;
    while (currentUrl) {
      const pageUrl = currentUrl;
      const response: AxiosResponse<GraphPage<T>> = await this.get<GraphPage<T>>(pageUrl);
      allResults.push(...(response.data.value ?? []));
      currentUrl = response.data['@odata.nextLink'] ?? response.data['@odata.nextlink'];
    }
    return allResults;
  }

  async getAllDevices(): Promise<ManagedDevice[]> {
    const url = `${GRAPH_ROOT}/deviceManagement/managedDevices?$select=${encodeSelect(MANAGED_DEVICE_SELECT_FIELDS)}`;
    return this.getAll<ManagedDevice>(url);
  }

  async getDeviceDetails(intuneId: string): Promise<ManagedDevice | null> {
    const url = `${GRAPH_ROOT}/deviceManagement/managedDevices/${encodeURIComponent(intuneId)}?$select=${encodeSelect(MANAGED_DEVICE_SELECT_FIELDS)}`;
    try {
      const response = await this.get<ManagedDevice>(url);
      return response.data;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async getDetectedApps(deviceId: string): Promise<any[]> {
    const url = `${GRAPH_ROOT}/deviceManagement/managedDevices/${encodeURIComponent(deviceId)}/detectedApps?$select=${encodeSelect(DETECTED_APP_SELECT_FIELDS)}`;
    return this.getAll<any>(url);
  }

  async validateApplicationPermissions(): Promise<PermissionValidationResult> {
    try {
      await this.get(`${GRAPH_ROOT}/deviceManagement/managedDevices?$top=1&$select=id`);
      return {
        valid: true,
        requiredPermissions: [...REQUIRED_GRAPH_APP_ROLES],
        verifiedPermissions: [...REQUIRED_GRAPH_APP_ROLES],
        missingPermissions: [],
        message: 'Required Microsoft Graph application permissions are available.',
      };
    } catch (error) {
      const message = (error as Error).message;
      const permissionDenied = message.includes('403') || message.toLowerCase().includes('privilege') || message.toLowerCase().includes('permission');
      return {
        valid: false,
        requiredPermissions: [...REQUIRED_GRAPH_APP_ROLES],
        verifiedPermissions: [],
        missingPermissions: permissionDenied ? [...REQUIRED_GRAPH_APP_ROLES] : [],
        message: permissionDenied
          ? `Missing Microsoft Graph application permission: ${REQUIRED_GRAPH_APP_ROLES.join(', ')}. Grant admin consent for Application permissions only.`
          : message,
      };
    }
  }

  async checkHealth(): Promise<{ healthy: boolean; error?: string; permissions: PermissionValidationResult }> {
    const permissions = await this.validateApplicationPermissions();
    return { healthy: permissions.valid, error: permissions.valid ? undefined : permissions.message, permissions };
  }
}

let httpClient: IntuneHttpClient | null = null;

export function getHttpClient(): IntuneHttpClient | null {
  return httpClient;
}

export function initializeHttpClient(maxRetries = 3, baseDelayMs = 5000): IntuneHttpClient {
  httpClient = new IntuneHttpClient(maxRetries, baseDelayMs);
  return httpClient;
}

export function setHttpClientForTests(client: IntuneHttpClient | null): void {
  httpClient = client;
}

