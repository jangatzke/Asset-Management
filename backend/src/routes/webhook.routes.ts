/**
 * Webhook Routes - Security-hardened webhook management
 *
 * Features:
 * - URL validation with SSRF protection
 * - HMAC signature generation on webhook creation
 * - Bounded maxRetries (0-10) and timeoutMs (1000-30000)
 * - Async queue-based delivery (returns 202 Accepted)
 * - Delivery status tracking
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireScopes } from '../middleware/apiScopes';
import { WebhookEvent, WebhookPayload } from '../services/webhook.service';
import { validateWebhookUrl, checkWebhookUrlSSRF } from '../services/urlValidator';
import { queueWebhookDelivery } from '../services/webhookQueue.service';
import { prisma } from '../config/database';
import { createWebhookSchema, updateWebhookSchema, broadcastSchema } from '../dtos/webhook.dto';

const router = Router();

// ==================== Webhook Routes ====================

/**
 * GET /api/v1/webhooks - List webhooks
 */
router.get('/', requireScopes('webhooks:read'), async (_req: Request, res: Response) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        displayId: true,
        name: true,
        description: true,
        url: true,
        events: true,
        isActive: true,
        lastDeliveryStatus: true,
        lastDeliveredAt: true,
        failureCount: true,
        maxRetries: true,
        timeoutMs: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ data: webhooks });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * POST /api/v1/webhooks - Create webhook
 */
router.post('/', requireScopes('webhooks:write'), async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const parsed = createWebhookSchema.safeParse(body);
    
    if (!parsed.success) {
      res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid request body',
        details: parsed.error.errors 
      });
      return;
    }

    const { name, description, url, events = [], maxRetries = 5, timeoutMs = 10000 } = parsed.data;

    // SSRF validation at save time
    const validation = validateWebhookUrl(url);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation Error', message: validation.reason });
      return;
    }

    // Full DNS resolution check (non-blocking warning)
    const ssrfCheck = await checkWebhookUrlSSRF(url);
    if (!ssrfCheck.valid) {
      res.status(400).json({ error: 'SSRF Protection', message: ssrfCheck.reason });
      return;
    }

    // Generate HMAC secret for this webhook
    const secret = crypto.randomUUID();
    const id = crypto.randomUUID();
    
    // Generate display ID
    const lastWebhook = await prisma.webhook.findFirst({
      orderBy: { displayId: 'desc' },
      select: { displayId: true },
    });
    
    let displayId = 'WHK-0001';
    if (lastWebhook?.displayId) {
      const num = parseInt(lastWebhook.displayId.split('-')[1], 10) + 1;
      displayId = `WHK-${String(num).padStart(4, '0')}`;
    }

    const webhook = await prisma.webhook.create({
      data: {
        id,
        displayId,
        name,
        description,
        url,
        secret,
        events: events as string[],
        isActive: true,
        status: 'active',
        maxRetries,
        timeoutMs,
      },
    });

    // Log the secret once - return it in the response
    // In production, consider a secure out-of-band delivery mechanism
    console.info(`[Webhook] Created webhook ${displayId} with secret: ${secret}`);

    res.status(201).json({ 
      data: {
        id: webhook.id,
        displayId: webhook.displayId,
        name: webhook.name,
        description: webhook.description,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        maxRetries: webhook.maxRetries,
        timeoutMs: webhook.timeoutMs,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        _secret: secret, // WARNING: Only returned once on creation
      },
      warning: 'Secret is only returned once on creation. Store it securely.'
    });
  } catch (error) {
    console.error('[Webhook] Error creating webhook:', error);
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * POST /api/v1/webhooks/broadcast - Broadcast event to all matching webhooks (async)
 */
router.post('/broadcast', requireScopes('webhooks:write'), async (req: Request, res: Response) => {
  try {
    const parsed = broadcastSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid request body',
        details: parsed.error.errors 
      });
      return;
    }

    const { eventType, data } = parsed.data;

    // Find active webhooks that listen to this event type
    const matchingWebhooks = await prisma.webhook.findMany({
      where: {
        isActive: true,
        isArchived: false,
        status: 'active',
        events: { has: eventType },
      },
      select: { id: true, url: true, secret: true, maxRetries: true, timeoutMs: true },
    });

    // Create payload
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      type: eventType as WebhookEvent,
      timestamp: new Date().toISOString(),
      data,
    };

    // Queue all deliveries asynchronously
    const queuedJobs = [];
    for (const webhook of matchingWebhooks) {
      const jobId = await queueWebhookDelivery(webhook.id, payload);
      queuedJobs.push({ webhookId: webhook.id, jobId });
    }

    // Return 202 Accepted immediately
    res.status(202).json({ 
      data: queuedJobs,
      message: `Webhook delivery queued for ${matchingWebhooks.length} webhook(s)` 
    });
  } catch (error) {
    console.error('[Webhook] Error broadcasting event:', error);
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * GET /api/v1/webhooks/:id - Get webhook
 */
router.get('/:id', requireScopes('webhooks:read'), async (req: Request, res: Response) => {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: req.params.id },
    });

    if (!webhook || webhook.isArchived) {
      res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
      return;
    }

    res.json({ 
      data: {
        id: webhook.id,
        displayId: webhook.displayId,
        name: webhook.name,
        description: webhook.description,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        lastDeliveryStatus: webhook.lastDeliveryStatus,
        lastDeliveredAt: webhook.lastDeliveredAt,
        failureCount: webhook.failureCount,
        maxRetries: webhook.maxRetries,
        timeoutMs: webhook.timeoutMs,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * PATCH /api/v1/webhooks/:id - Update webhook
 */
router.patch('/:id', requireScopes('webhooks:write'), async (req: Request, res: Response) => {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: req.params.id },
    });

    if (!webhook || webhook.isArchived) {
      res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
      return;
    }

    const parsed = updateWebhookSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid request body',
        details: parsed.error.errors 
      });
      return;
    }

    const { name, description, url, events, maxRetries, timeoutMs } = parsed.data;

    // Validate URL if changed
    if (url && url !== webhook.url) {
      const validation = validateWebhookUrl(url);
      if (!validation.valid) {
        res.status(400).json({ error: 'Validation Error', message: validation.reason });
        return;
      }

      const ssrfCheck = await checkWebhookUrlSSRF(url);
      if (!ssrfCheck.valid) {
        res.status(400).json({ error: 'SSRF Protection', message: ssrfCheck.reason });
        return;
      }
    }

    // Bounded values
    const boundedMaxRetries = maxRetries !== undefined 
      ? Math.min(Math.max(maxRetries, 0), 10) 
      : webhook.maxRetries;
    const boundedTimeoutMs = timeoutMs !== undefined
      ? Math.min(Math.max(timeoutMs, 1000), 30000)
      : webhook.timeoutMs;

    const updated = await prisma.webhook.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(url !== undefined && { url }),
        ...(events !== undefined && { events: events as string[] }),
        maxRetries: boundedMaxRetries,
        timeoutMs: boundedTimeoutMs,
        updatedAt: new Date(),
      },
      select: {
        id: true, displayId: true, name: true, description: true, url: true,
        events: true, isActive: true, lastDeliveryStatus: true, lastDeliveredAt: true,
        failureCount: true, maxRetries: true, timeoutMs: true, createdAt: true, updatedAt: true,
      },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('[Webhook] Error updating webhook:', error);
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * DELETE /api/v1/webhooks/:id - Delete webhook (soft delete)
 */
router.delete('/:id', requireScopes('webhooks:write'), async (req: Request, res: Response) => {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: req.params.id },
    });

    if (!webhook || webhook.isArchived) {
      res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
      return;
    }

    await prisma.webhook.update({
      where: { id: req.params.id },
      data: { isArchived: true, updatedAt: new Date() },
    });

    res.json({ data: { id: webhook.id, deleted: true } });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * POST /api/v1/webhooks/:id/test - Test webhook delivery (async)
 */
router.post('/:id/test', requireScopes('webhooks:write'), async (req: Request, res: Response) => {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: req.params.id },
    });

    if (!webhook || webhook.isArchived) {
      res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
      return;
    }

    const testPayload: WebhookPayload = {
      id: crypto.randomUUID(),
      type: 'system.health.check',
      timestamp: new Date().toISOString(),
      data: { test: true, message: 'Webhook test payload' },
    };

    const jobId = await queueWebhookDelivery(webhook.id, testPayload);

    res.status(202).json({ 
      data: { jobId, message: 'Test webhook queued for delivery' } 
    });
  } catch (error) {
    console.error('[Webhook] Error testing webhook:', error);
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * GET /api/v1/webhooks/deliveries/:deliveryId - Get delivery status
 */
router.get('/deliveries/:deliveryId', requireScopes('webhooks:read'), async (req: Request, res: Response) => {
  try {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: req.params.deliveryId },
      include: { webhook: true },
    });

    if (!delivery) {
      res.status(404).json({ error: 'Not Found', message: 'Delivery not found' });
      return;
    }

    res.json({ data: delivery });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * GET /api/v1/webhooks/deliveries - List deliveries with filtering
 */
router.get('/deliveries', requireScopes('webhooks:read'), async (req: Request, res: Response) => {
  try {
    const { webhookId, status, limit = 50, offset = 0 } = req.query;

    const where: Record<string, unknown> = {};
    if (webhookId) {
      where.webhookId = webhookId as string;
    }
    if (status) {
      where.status = status as string;
    }

    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        take: Math.min(parseInt(limit as string, 10), 100),
        skip: parseInt(offset as string, 10),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webhookDelivery.count({ where }),
    ]);

    res.json({ 
      data: deliveries, 
      pagination: { total, limit: parseInt(limit as string, 10), offset: parseInt(offset as string, 10) } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

/**
 * POST /api/v1/webhooks/:id/regenerate-secret - Regenerate HMAC secret
 */
router.post('/:id/regenerate-secret', requireScopes('webhooks:write'), async (req: Request, res: Response) => {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: req.params.id },
    });

    if (!webhook || webhook.isArchived) {
      res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
      return;
    }

    const newSecret = crypto.randomUUID();
    
    await prisma.webhook.update({
      where: { id: req.params.id },
      data: { secret: newSecret, updatedAt: new Date() },
    });

    console.info(`[Webhook] Secret regenerated for webhook ${webhook.displayId}`);

    res.status(200).json({ 
      data: { 
        message: 'Secret regenerated',
        _newSecret: newSecret,
      },
      warning: 'New secret is only returned once. Notify your webhook consumers.'
    });
  } catch (error) {
    console.error('[Webhook] Error regenerating secret:', error);
    res.status(500).json({ error: 'Internal Server Error', message: String(error) });
  }
});

export const webhookRouter = router;
