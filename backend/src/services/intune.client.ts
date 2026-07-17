/**
 * Intune HTTP Client
 * 
 * Axios-based HTTP client for Microsoft Graph API with:
 * - Automatic token injection
 * - Odata pagination following
 * - Rate limiting (HTTP 429) with Retry-After handling
 * - Retry logic with exponential backoff
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getAuthService } from './intune.auth';
import { AppError } from '../middleware/errorHandler';

export interface GraphApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ code: string; message: string }>;
  };
}

export interface GraphApiResponse<T> {
  data: T[];
  nextLink?: string;
  value?: T[];
  '@odata.nextLink'?: string;
  '@odata.nextlink'?: string;
}

export class IntuneHttpClient {
  private client: AxiosInstance;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(maxRetries: number = 3, baseDelayMs: number = 5000) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.client = axios.create({
      timeout: 60000,
    });
  }

  /**
   * Get a valid access token from the auth service
   */
  private async getAuthToken(): Promise<string> {
    const authService = getAuthService();
    if (!authService) {
      throw new AppError('Intune auth service not initialized', 500);
    }
    return authService.getAccessToken();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make a single API request with retry logic
   */
  private async requestWithRetry<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Get fresh token for each attempt
        const token = await this.getAuthToken();

        const response = await this.client[method](url, options?.data, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
          },
          timeout: 60000,
        });

        return response;
      } catch (error) {
        lastError = error as Error;

        // Check for rate limiting (HTTP 429)
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delayMs = retryAfter
            ? parseInt(retryAfter) * 1000
            : this.baseDelayMs * Math.pow(2, attempt);

          console.warn(`[IntuneClient] Rate limited (429). Retrying after ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delayMs);
          continue;
        }

        // Check for auth failure (HTTP 401)
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          console.error('[IntuneClient] Authentication failed. Token may be invalid.');
          // Force token refresh and retry once
          const authService = getAuthService();
          if (authService) {
            await authService.refreshAccessToken();
          }
          if (attempt < this.maxRetries) continue;
          break;
        }

        // Network errors - retry with backoff
        if (axios.isAxiosError(error) && !error.response) {
          const delayMs = this.baseDelayMs * Math.pow(2, attempt);
          console.warn(`[IntuneClient] Network error: ${error.message}. Retrying after ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delayMs);
          continue;
        }

        // Non-retryable errors - throw immediately
        if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
          const status = error.response.status;
          const message = error.response.data?.error?.message || error.response.data?.error?.code || error.message;
          throw new AppError(`Intune API error (${status}): ${message}`, status);
        }

        // Server errors - retry
        if (axios.isAxiosError(error) && error.response && error.response.status >= 500) {
          const delayMs = this.baseDelayMs * Math.pow(2, attempt);
          console.warn(`[IntuneClient] Server error (${error.response?.status}). Retrying after ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delayMs);
          continue;
        }

        // Other errors - throw
        throw lastError;
      }
    }

    throw new AppError(`Intune API request failed after ${this.maxRetries} retries: ${lastError?.message}`, 500);
  }

  /**
   * GET request with retry logic
   */
  async get<T>(url: string, options?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>('get', url, options);
  }

  /**
   * POST request with retry logic
   */
  async post<T>(url: string, data?: any, options?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>('post', url, { ...options, data });
  }

  /**
   * Follow odata pagination and return all results
   */
  async getAll<T>(url: string): Promise<T[]> {
    const allResults: T[] = [];
    let currentUrl = url;
    let pageCount = 0;

    while (currentUrl) {
      pageCount++;
      console.log(`[IntuneClient] Fetching page ${pageCount}: ${currentUrl.substring(0, 100)}...`);

      const response = await this.get<GraphApiResponse<T>>(currentUrl);
      const data = response.data as any;

      // Add current page results
      if (data.value && Array.isArray(data.value)) {
        allResults.push(...data.value);
      } else if (Array.isArray(data)) {
        allResults.push(...data);
      }

      // Check for next page
      currentUrl = data['@odata.nextLink'] || data['@odata.nextlink'] || null;
    }

    console.log(`[IntuneClient] Fetched ${allResults.length} items across ${pageCount} pages`);
    return allResults;
  }

  /**
   * Get a single page of results
   */
  async getPage<T>(url: string): Promise<GraphApiResponse<T>> {
    const response = await this.get<GraphApiResponse<T>>(url);
    const data = response.data;

    return {
      data: data.value || [],
      nextLink: data['@odata.nextLink'] || data['@odata.nextlink'] || undefined,
    };
  }

  /**
   * Get all devices from Intune
   */
  async getAllDevices(): Promise<any[]> {
    const url = 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices';
    const select = [
      'id',
      'deviceName',
      'serialNumber',
      'manufacturer',
      'model',
      'osName',
      'osVersion',
      'deviceEnrollmentType',
      'managementType',
      'complianceStatus',
      'deviceState',
      'enrollmentDateTime',
      'lastSyncDateTime',
      'primaryUserEmailaddress',
      'primaryUserDisplayName',
      'compliancePolicyName',
      'configurationPolicyName',
      'intuneLicenseState',
      'deviceWpdsStatus',
    ].join(',');

    return this.getAll(`${url}?$select=${select}`);
  }

  /**
   * Get detected apps for a specific device
   */
  async getDetectedApps(deviceId: string): Promise<any[]> {
    const url = `https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/${deviceId}/detectedApps`;
    const select = [
      'name',
      'version',
      'publisher',
      'platform',
      'appIdentity',
      'isManaged',
    ].join(',');

    return this.getAll(`${url}?$select=${select}`);
  }

  /**
   * Get device details by Intune ID
   */
  async getDeviceDetails(intuneId: string): Promise<any> {
    const url = `https://graph.microsoft.com/v1.0/devices?$filter=deviceId eq '${intuneId}'&$select=id,deviceId,deviceName,serialNumber,manufacturer,model,osName,osVersion,deviceEnrollmentType,managementType,complianceStatus,deviceState,enrollmentDateTime,lastSyncDateTime,primaryUserEmailaddress,primaryUserDisplayName,compliancePolicyName,configurationPolicyName,intuneLicenseState,deviceWpdsStatus`;

    const response = await this.get<any>(url);
    return response.data?.value?.[0] || null;
  }

  /**
   * Check health of the Intune API connection
   */
  async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await this.get<any>('https://graph.microsoft.com/v1.0/$metadata');
      return { healthy: response.status === 200 };
    } catch (error) {
      return { healthy: false, error: (error as Error).message };
    }
  }
}

// Singleton instance (initialized via config)
let httpClient: IntuneHttpClient | null = null;

export function getHttpClient(): IntuneHttpClient | null {
  return httpClient;
}

export function initializeHttpClient(maxRetries: number = 3, baseDelayMs: number = 5000): IntuneHttpClient {
  httpClient = new IntuneHttpClient(maxRetries, baseDelayMs);
  return httpClient;
}
