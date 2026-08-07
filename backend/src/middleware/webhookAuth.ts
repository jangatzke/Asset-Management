/**
 * Webhook Authentication Middleware
 *
 * Authenticates incoming webhook requests using a dedicated webhook service account.
 * This ensures that:
 * - Only authorized webhook providers can trigger events
 * - The webhook service account has a dedicated idempotency namespace
 * - Webhook deliveries use proper Bearer token authentication
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export interface WebhookRequest extends Request {
  webhookPrincipal?: {
    type: 'webhook';
    source: string; // Identifies the webhook provider (e.g., 'github', 'entra_id')
  };
}

/**
 * Authenticate webhook requests.
 *
 * Supports two authentication modes:
 * 1. Bearer token: Uses a dedicated webhook service account token
 * 2. X-Webhook-Secret header: Uses a shared secret for simple integrations
 *
 * The principal is set to a string like 'webhook:<source>' for idempotency isolation.
 */
export async function authenticateWebhook(
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Mode 1: Bearer token (recommended for production)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // Validate against webhook service accounts
    const { prisma } = await import('../config/database');
    const account = await prisma.serviceAccount.findFirst({
      where: {
        accessTokenHash: hashWebhookToken(token),
        isActive: true,
        isArchived: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { id: true, name: true },
    });

    if (account) {
      req.webhookPrincipal = {
        type: 'webhook',
        source: `sa:${account.id}`,
      };
      next();
      return;
    }
  }

  // Mode 2: X-Webhook-Secret header (for simple integrations)
  const webhookSecret = req.headers['x-webhook-secret'] as string | undefined;
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (webhookSecret && expectedSecret && webhookSecret === expectedSecret) {
    req.webhookPrincipal = {
      type: 'webhook',
      source: 'secret-header',
    };
    next();
    return;
  }

  res.status(401).json({
    success: false,
    error: {
      message: 'Webhook authentication required',
      code: 'MISSING_WEBHOOK_AUTH',
      hint: 'Send a Bearer token (recommended) or X-Webhook-Secret header',
    },
  });
}

/**
 * Hash a webhook token for database lookup.
 * Uses the same hashing method as service accounts.
 */
function hashWebhookToken(token: string): string {
  const salt = process.env.SERVICE_ACCOUNT_TOKEN_SALT || '';
  return crypto.createHash('sha256').update(`${token}${salt}`).digest('hex');
}
