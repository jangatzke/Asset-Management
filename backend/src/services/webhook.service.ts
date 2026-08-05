/**
 * Webhook Service - Security-hardened webhook delivery
 *
 * Features:
 * - HMAC-SHA256 signature generation and verification with timestamp enforcement
 * - Secure delivery with signature headers
 * - Queue-based async delivery
 */

import crypto from 'crypto';
import axios, { AxiosRequestConfig } from 'axios';

export type WebhookEvent =
  | 'asset.created' | 'asset.updated' | 'asset.deleted'
  | 'risk.created' | 'risk.updated' | 'risk.assessed'
  | 'control.created' | 'control.updated' | 'control.verified'
  | 'incident.created' | 'incident.updated' | 'incident.closed'
  | 'user.created' | 'user.updated' | 'user.deleted'
  | 'system.health.check'
  | 'webhook.delivery.failed'
  | 'webhook.delivery.success';

export interface WebhookPayload {
  id: string;
  type: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  durationMs?: number;
  attemptNumber: number;
  signature?: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  maxRetries?: number;
  timeoutMs?: number;
  maxSignatureAgeMs?: number;
}

// Default max age for webhook signatures (5 minutes)
const DEFAULT_MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

// Maximum allowed signature age (30 minutes absolute limit)
const MAX_ALLOWED_SIGNATURE_AGE_MS = 30 * 60 * 1000;

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 * Signature format: t=<unix_timestamp>,s=<hex_hmac>
 * The signature covers the timestamp and the JSON-serialized payload.
 *
 * @param secret - The HMAC secret key
 * @param payload - The webhook payload
 * @returns Signed string with timestamp and HMAC hex digest
 */
export function generateHmacSignature(secret: string, payload: WebhookPayload): string {
  const timestamp = Date.now();
  // Sort payload keys for deterministic signing
  const sortedPayload = sortObjectKeys(payload);
  const message = `${timestamp}.${JSON.stringify(sortedPayload)}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  return `t=${timestamp},s=${hmac.digest('hex')}`;
}

/**
 * Recursively sort object keys for deterministic JSON serialization.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Verify HMAC signature from an incoming webhook.
 *
 * Validates:
 * 1. Signature format (t=<timestamp>,s=<hex>)
 * 2. Timestamp age (rejects signatures older than maxAgeMs)
 * 3. HMAC-SHA256 match
 *
 * @param secret - The shared secret
 * @param payload - The received payload
 * @param signature - The signature header value
 * @param maxAgeMs - Maximum allowed age in ms (default: 5 min)
 * @returns true if signature is valid and not expired
 */
export function verifyHmacSignature(
  secret: string,
  payload: unknown,
  signature: string,
  maxAgeMs: number = DEFAULT_MAX_SIGNATURE_AGE_MS
): boolean {
  // Enforce absolute maximum age
  const effectiveMaxAge = Math.min(maxAgeMs, MAX_ALLOWED_SIGNATURE_AGE_MS);

  try {
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    const timestampMatch = signature.match(/^t=(\d+),s=([a-f0-9]+)$/);
    if (!timestampMatch) {
      return false;
    }

    const signatureTimestamp = parseInt(timestampMatch[1], 10);
    const now = Date.now();

    // Replay attack protection: reject old signatures
    if (now - signatureTimestamp > effectiveMaxAge) {
      return false;
    }

    // Recompute expected signature
    const sortedPayload = sortObjectKeys(payload);
    const expectedMessage = `${signatureTimestamp}.${JSON.stringify(sortedPayload)}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(expectedMessage).digest('hex');
    const expectedSignature = `t=${signatureTimestamp},s=${expectedHmac}`;

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Deliver a single webhook with HMAC signature.
 *
 * Signs the payload with HMAC-SHA256 and includes signature headers:
 * - X-Webhook-Signature: HMAC signature
 * - X-Webhook-Timestamp: Unix timestamp
 * - X-Webhook-Id: Event ID
 *
 * @param payload - The webhook payload
 * @param config - Delivery configuration
 * @returns Delivery result
 */
export async function deliverWebhook(
  payload: WebhookPayload,
  config: WebhookConfig
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();

  try {
    // Generate HMAC signature
    const signature = generateHmacSignature(config.secret, payload);
    const timestamp = parseInt(signature.match(/^t=(\d+)/)?.[1] || String(Date.now()), 10);

    const axiosConfig: AxiosRequestConfig = {
      method: 'POST',
      url: config.url,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.type,
        'X-Webhook-Timestamp': String(timestamp),
        'X-Webhook-Signature': signature,
        'X-Webhook-Id': payload.id,
      },
      data: payload,
      timeout: config.timeoutMs || 10000,
      httpAgent: undefined,
      httpsAgent: undefined,
      // Follow redirects but limit to 5
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on any status
    };

    const response = await axios(axiosConfig);

    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      statusCode: response.status,
      durationMs: Date.now() - startTime,
      attemptNumber: 1,
      signature,
    };
  } catch (error: unknown) {
    const axiosError = error as any;
    
    return {
      success: false,
      statusCode: axiosError.response?.status,
      errorMessage: axiosError.message,
      durationMs: Date.now() - startTime,
      attemptNumber: 1,
    };
  }
}

/**
 * Deliver webhook with retry logic and exponential backoff.
 *
 * @param payload - The webhook payload
 * @param config - Delivery configuration
 * @returns Final delivery result after all retries
 */
export async function deliverWebhookWithRetry(
  payload: WebhookPayload,
  config: WebhookConfig
): Promise<WebhookDeliveryResult> {
  const maxRetries = config.maxRetries ?? 5;
  let lastError: WebhookDeliveryResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await deliverWebhook(payload, {
      ...config,
      maxRetries: 1, // We handle retries here
    });

    if (result.success) {
      return { ...result, attemptNumber: attempt };
    }

    lastError = result;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s)
    if (attempt < maxRetries) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return lastError || { success: false, errorMessage: 'No attempts made', attemptNumber: maxRetries };
}

/**
 * Broadcast an event to all matching webhooks.
 * Used by the queue worker for async delivery.
 *
 * @param eventType - Event type
 * @param data - Event data
 * @param activeWebhooks - Array of active webhook configs from DB
 * @returns Array of delivery results
 */
export async function broadcastEvent(
  eventType: WebhookEvent,
  data: Record<string, unknown>,
  activeWebhooks: Array<{ id: string; url: string; secret: string; maxRetries: number; timeoutMs: number }>
): Promise<Array<{ webhookId: string; result: WebhookDeliveryResult }>> {
  const results = [];

  for (const webhook of activeWebhooks) {
    try {
      const payload: WebhookPayload = {
        id: crypto.randomUUID(),
        type: eventType,
        timestamp: new Date().toISOString(),
        data,
      };

      const result = await deliverWebhookWithRetry(payload, {
        url: webhook.url,
        secret: webhook.secret,
        maxRetries: webhook.maxRetries,
        timeoutMs: webhook.timeoutMs,
      });

      results.push({ webhookId: webhook.id, result });
    } catch (error) {
      results.push({
        webhookId: webhook.id,
        result: { success: false, errorMessage: String(error), attemptNumber: 0 },
      });
    }
  }

  return results;
}
