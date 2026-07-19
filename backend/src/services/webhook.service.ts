import crypto from 'crypto';
import axios, { AxiosRequestConfig } from 'axios';

export type WebhookEvent = 
  | 'asset.created' | 'asset.updated' | 'asset.deleted'
  | 'risk.created' | 'risk.updated' | 'risk.assessed'
  | 'control.created' | 'control.updated' | 'control.verified'
  | 'incident.created' | 'incident.updated' | 'incident.closed'
  | 'user.created' | 'user.updated' | 'user.deleted'
  | 'system.health.check';

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
}

/**
 * Generate HMAC signature for webhook payload.
 */
export function generateHmacSignature(secret: string, payload: WebhookPayload): string {
  const timestamp = Date.now();
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  return `t=${timestamp},s=${hmac.digest('hex')}`;
}

/**
 * Verify HMAC signature from incoming webhook.
 */
export function verifyHmacSignature(secret: string, payload: unknown, signature: string): boolean {
  try {
    const timestampMatch = signature.match(/t=(\d+)/);
    
    if (!timestampMatch) return false;

    const expectedMessage = `${timestampMatch[1]}.${JSON.stringify(payload)}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(expectedMessage).digest('hex');
    const expectedSignature = `t=${timestampMatch[1]},s=${expectedHmac}`;
    
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Deliver a webhook to all matching active webhooks.
 */
export async function deliverWebhook(
  payload: WebhookPayload,
  webhookConfig?: { url?: string; secret?: string; maxRetries?: number; timeoutMs?: number }
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();

  try {
    const config: AxiosRequestConfig = {
      method: 'POST',
      url: webhookConfig?.url || process.env.WEBHOOK_DEFAULT_URL || '',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.type,
        'X-Webhook-Timestamp': String(Date.now()),
      },
      data: payload,
      timeout: webhookConfig?.timeoutMs || 10000,
      httpAgent: undefined,
      httpsAgent: undefined,
    };

    const response = await axios(config);

    return {
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      durationMs: Date.now() - startTime,
      attemptNumber: 1,
    };
  } catch (error) {
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
 * Deliver webhook with retry logic.
 */
export async function deliverWebhookWithRetry(
  payload: WebhookPayload,
  webhookConfig?: { url?: string; secret?: string; maxRetries?: number; timeoutMs?: number }
): Promise<WebhookDeliveryResult> {
  const maxRetries = webhookConfig?.maxRetries ?? 3;
  let lastError: WebhookDeliveryResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await deliverWebhook(payload, {
      ...webhookConfig,
      maxRetries: 1, // We handle retries here
    });

    if (result.success) {
      return { ...result, attemptNumber: attempt };
    }

    lastError = result;

    // Exponential backoff: 1s, 2s, 4s, ...
    if (attempt < maxRetries) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return lastError || { success: false, errorMessage: 'No attempts made', attemptNumber: maxRetries };
}

/**
 * Broadcast an event to all matching webhooks.
 */
export async function broadcastEvent(
  eventType: WebhookEvent,
  data: Record<string, unknown>,
  activeWebhooks: Array<{ id: string; url: string; secret: string }>
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
        maxRetries: 3,
        timeoutMs: 10000,
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
