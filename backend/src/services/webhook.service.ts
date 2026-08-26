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
import { createWebhookHttpsAgent, validateWebhookUrl } from './urlValidator';

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

// Permit modest sender/receiver clock skew, but never accept a signature that
// is arbitrarily far in the future (which would otherwise remain valid until
// its timestamp enters the normal replay window).
const MAX_FUTURE_SIGNATURE_SKEW_MS = 5 * 60 * 1000;

const HMAC_SHA256_HEX_LENGTH = 64;

/**
 * Produce the exact canonical JSON representation covered by a signature.
 * This representation is also used as the HTTP request body so recipients
 * which verify the received raw body can reproduce the MAC without guessing
 * JSON key insertion order.
 */
function serializeWebhookPayload(payload: unknown): string {
  return JSON.stringify(sortObjectKeys(payload));
}

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 * Signature format: t=<unix_timestamp_ms>,s=<hex_hmac>
 * The signature covers the timestamp and the JSON-serialized payload.
 *
 * @param secret - The HMAC secret key
 * @param payload - The webhook payload
 * @param timestamp - Unix timestamp in milliseconds to include in the signed
 *   message. Defaults to the current time; provide this value when a
 *   reproducible signature is required.
 * @returns Signed string with timestamp and HMAC hex digest
 */
export function generateHmacSignature(
  secret: string,
  payload: WebhookPayload,
  timestamp: number = Date.now()
): string {
  const message = `${timestamp}.${serializeWebhookPayload(payload)}`;
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
 * 2. Timestamp age/skew (rejects expired and excessively future signatures)
 * 3. HMAC-SHA256 match
 *
 * @param secret - The shared secret
 * @param payload - The received payload
 * @param signature - The signature header value
 * @param maxAgeMs - Maximum allowed age in milliseconds (default: 5 min)
 * @returns true if signature is valid and not expired
 */
export function verifyHmacSignature(
  secret: string,
  payload: unknown,
  signature: string,
  maxAgeMs: number = DEFAULT_MAX_SIGNATURE_AGE_MS
): boolean {
  // Treat a malformed runtime value as the secure default; prevent a negative
  // value from being used to widen the accepted replay window.
  const effectiveMaxAge = Number.isFinite(maxAgeMs)
    ? Math.min(Math.max(0, maxAgeMs), MAX_ALLOWED_SIGNATURE_AGE_MS)
    : DEFAULT_MAX_SIGNATURE_AGE_MS;

  try {
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    const timestampMatch = signature.match(new RegExp(`^t=(\\d{1,16}),s=([a-f0-9]{${HMAC_SHA256_HEX_LENGTH}})$`));
    if (!timestampMatch) {
      return false;
    }

    const timestampText = timestampMatch[1];
    const signatureTimestamp = Number(timestampText);
    if (!Number.isSafeInteger(signatureTimestamp)) {
      return false;
    }

    const now = Date.now();

    // Replay protection: reject expired timestamps and timestamps too far in
    // the future. The latter also prevents an attacker with a valid old MAC
    // from extending its usable replay period by choosing a distant timestamp.
    if (now - signatureTimestamp > effectiveMaxAge) {
      return false;
    }

    if (signatureTimestamp - now > MAX_FUTURE_SIGNATURE_SKEW_MS) {
      return false;
    }

    // Recompute expected signature
    const expectedMessage = `${timestampText}.${serializeWebhookPayload(payload)}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(expectedMessage).digest('hex');

    // Both values are fixed-size, decoded SHA-256 digests. This avoids a
    // variable-length header comparison and preserves constant-time equality.
    return crypto.timingSafeEqual(
      Buffer.from(timestampMatch[2], 'hex'),
      Buffer.from(expectedHmac, 'hex')
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
    // Delivery may occur long after a webhook was created. Validate the URL
    // again before constructing its outbound-only transport.
    const urlValidation = validateWebhookUrl(config.url);
    if (!urlValidation.valid) {
      return {
        success: false,
        errorMessage: `URL validation failed: ${urlValidation.reason}`,
        durationMs: Date.now() - startTime,
        attemptNumber: 1,
      };
    }

    // Generate HMAC signature. Capture the timestamp explicitly so the
    // X-Webhook-Timestamp header always matches the value used to sign,
    // instead of re-parsing it out of the signature string.
    const timestamp = Date.now();
    const signature = generateHmacSignature(config.secret, payload, timestamp);
    const serializedPayload = serializeWebhookPayload(payload);

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
      // Sign and send exactly the same bytes. Axios would otherwise serialize
      // the original object using insertion order while the signature uses
      // canonical key order, making raw-body verification unreliable.
      data: serializedPayload,
      timeout: config.timeoutMs || 10000,
      // This agent resolves and validates DNS immediately before socket
      // creation, then connects to that concrete address to prevent rebinding.
      httpsAgent: createWebhookHttpsAgent(),
      // Do not honor HTTP(S)_PROXY/NO_PROXY environment variables. A proxy
      // would resolve the hostname outside the validated connection path.
      proxy: false,
      // Disable redirect following to prevent SSRF via redirect to internal IPs
      maxRedirects: 0,
      validateStatus: () => true, // Don't throw on any status
    };

    const response = await axios(axiosConfig);

    // Explicitly reject redirects (3xx) - with maxRedirects: 0, axios won't follow them
    // but the server may still return a 3xx status. We treat this as a failure.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location || 'unknown';
      console.warn(`[Webhook] Redirect encountered for ${config.url}: ${response.status} -> ${location}. Redirect following is disabled (maxRedirects: 0).`);
      return {
        success: false,
        statusCode: response.status,
        errorMessage: `Redirect not followed: server returned ${response.status} (Location: ${location}). Redirect following is disabled for SSRF protection.`,
        durationMs: Date.now() - startTime,
        attemptNumber: 1,
        signature,
      };
    }

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
    const result = await deliverWebhook(payload, config);

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
