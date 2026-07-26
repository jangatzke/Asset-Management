import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireScopes } from '../middleware/apiScopes';
import { deliverWebhookWithRetry, WebhookEvent } from '../services/webhook.service';

const router = Router();

// In-memory store for webhooks (replace with DB in production)
interface WebhookRecord {
  id: string;
  displayId: string;
  name: string;
  description?: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  isArchived: boolean;
  lastDeliveryStatus?: string;
  lastDeliveredAt?: Date;
  failureCount: number;
  maxRetries: number;
  timeoutMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const webhooks = new Map<string, WebhookRecord>();
let displayCounter = 1;

/**
 * Generate display ID for webhook.
 */
function generateDisplayId(): string {
  const id = `WHK-${String(displayCounter).padStart(4, '0')}`;
  displayCounter++;
  return id;
}

// ==================== Webhook Routes ====================

/**
 * GET /api/v1/webhooks - List webhooks
 */
router.get('/', requireScopes('webhooks:read'), (_req: Request, res: Response) => {
  const webhookList = Array.from(webhooks.values())
    .filter(w => !w.isArchived)
    .map(({ secret, ...safe }) => safe);

  res.json({ data: webhookList });
});

/**
 * POST /api/v1/webhooks - Create webhook
 */
router.post('/', requireScopes('webhooks:write'), (req: Request, res: Response) => {
  const { name, description, url, events = [], maxRetries = 3, timeoutMs = 10000 } = req.body;

  if (!name || !url) {
    res.status(400).json({ error: 'Validation Error', message: 'name and url are required' });
    return;
  }

  const secret = crypto.randomUUID();
  const id = crypto.randomUUID();
  
  const webhook: WebhookRecord = {
    id,
    displayId: generateDisplayId(),
    name,
    description,
    url,
    secret,
    events: events as WebhookEvent[],
    isActive: true,
    isArchived: false,
    failureCount: 0,
    maxRetries,
    timeoutMs,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  webhooks.set(id, webhook);

  // Return without secret
  const { secret: _, ...safeWebhook } = webhook;
  res.status(201).json({ data: safeWebhook });
});

/**
 * POST /api/v1/webhooks/broadcast - Broadcast event to all matching webhooks
 */
router.post('/broadcast', requireScopes('webhooks:write'), async (req: Request, res: Response) => {
  const { eventType, data } = req.body;

  if (!eventType || !data) {
    res.status(400).json({ error: 'Validation Error', message: 'eventType and data are required' });
    return;
  }

  // Find active webhooks that listen to this event type
  const matchingWebhooks = Array.from(webhooks.values()).filter(w => 
    w.isActive && !w.isArchived && w.events.includes(eventType as WebhookEvent)
  );

  const results = [];

  for (const webhook of matchingWebhooks) {
    const payload = {
      id: crypto.randomUUID(),
      type: eventType as WebhookEvent,
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      const result = await deliverWebhookWithRetry(payload, {
        url: webhook.url,
        secret: webhook.secret,
        maxRetries: webhook.maxRetries,
        timeoutMs: webhook.timeoutMs,
      });

      if (result.success) {
        webhook.lastDeliveryStatus = 'success';
        webhook.lastDeliveredAt = new Date();
        webhook.failureCount = 0;
      } else {
        webhook.lastDeliveryStatus = 'failed';
        webhook.failureCount++;
      }

      results.push({ webhookId: webhook.id, result });
    } catch (error) {
      webhook.lastDeliveryStatus = 'failed';
      webhook.failureCount++;
      results.push({ webhookId: webhook.id, result: { success: false, errorMessage: String(error) } });
    }

    // Update each webhook's timestamp after processing
    webhook.updatedAt = new Date();
  }

  res.json({ data: results });
});

/**
 * GET /api/v1/webhooks/:id - Get webhook
 */
router.get('/:id', requireScopes('webhooks:read'), (req: Request, res: Response) => {
  const webhook = webhooks.get(req.params.id);

  if (!webhook || webhook.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
    return;
  }

  const { secret, ...safeWebhook } = webhook;
  res.json({ data: safeWebhook });
});

/**
 * PATCH /api/v1/webhooks/:id - Update webhook
 */
router.patch('/:id', requireScopes('webhooks:write'), (req: Request, res: Response) => {
  const webhook = webhooks.get(req.params.id);

  if (!webhook || webhook.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
    return;
  }

  const { name, description, url, events, maxRetries, timeoutMs } = req.body;

  if (name !== undefined) webhook.name = name;
  if (description !== undefined) webhook.description = description;
  if (url !== undefined) webhook.url = url;
  if (events !== undefined) webhook.events = events as WebhookEvent[];
  if (maxRetries !== undefined) webhook.maxRetries = maxRetries;
  if (timeoutMs !== undefined) webhook.timeoutMs = timeoutMs;

  webhook.updatedAt = new Date();

  const { secret, ...safeWebhook } = webhook;
  res.json({ data: safeWebhook });
});

/**
 * DELETE /api/v1/webhooks/:id - Delete webhook (soft delete)
 */
router.delete('/:id', requireScopes('webhooks:write'), (req: Request, res: Response) => {
  const webhook = webhooks.get(req.params.id);

  if (!webhook || webhook.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
    return;
  }

  webhook.isArchived = true;
  webhook.updatedAt = new Date();

  res.json({ data: { id: webhook.id, deleted: true } });
});

/**
 * POST /api/v1/webhooks/:id/test - Test webhook delivery
 */
router.post('/:id/test', requireScopes('webhooks:write'), async (req: Request, res: Response) => {
  const webhook = webhooks.get(req.params.id);

  if (!webhook || webhook.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
    return;
  }

  const testPayload = {
    id: crypto.randomUUID(),
    type: 'system.health.check' as WebhookEvent,
    timestamp: new Date().toISOString(),
    data: { test: true, message: 'Webhook test payload' },
  };

  try {
    const result = await deliverWebhookWithRetry(testPayload, {
      url: webhook.url,
      secret: webhook.secret,
      maxRetries: webhook.maxRetries,
      timeoutMs: webhook.timeoutMs,
    });

    if (result.success) {
      webhook.lastDeliveryStatus = 'success';
      webhook.lastDeliveredAt = new Date();
      webhook.failureCount = 0;
    } else {
      webhook.lastDeliveryStatus = 'failed';
      webhook.failureCount++;
    }

    webhook.updatedAt = new Date();

    res.json({ data: result });
  } catch (error) {
    webhook.lastDeliveryStatus = 'failed';
    webhook.failureCount++;
    webhook.updatedAt = new Date();

    res.status(502).json({ error: 'Webhook Delivery Failed', message: String(error) });
  }
});

export const webhookRouter = router;
