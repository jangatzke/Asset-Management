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
import { secureCompare } from '../utils/secureCompare';

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
    // Use lookup-by-UUID approach to handle per-account random salts
    const { prisma } = await import('../config/database.js');
    // Extract UUID from token format: svc_<uuid>_<random> — the UUID is the DB id
    const parts = token.split('_');
    const accountUuid = parts.length >= 3 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[1])
      ? parts[1]
      : null;

    let account: { id: string; name: string; accessTokenSalt: string; accessTokenHash: string } | null = null;
    
    if (accountUuid) {
      // Look up by id (the UUID embedded in the token is the DB id)
      account = await prisma.serviceAccount.findFirst({
        where: {
          id: accountUuid,
          isActive: true,
          isArchived: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        select: { id: true, name: true, accessTokenSalt: true, accessTokenHash: true },
      });
       if (account) {
         // Verify using stored salt (constant-time comparison to avoid timing side channels)
         const computedHash = crypto.createHash('sha256').update(`${token}${account.accessTokenSalt}`).digest('hex');
         if (!secureCompare(computedHash, account.accessTokenHash)) {
           account = null;
         }
       }
     }

    if (account) {
      await prisma.serviceAccount.update({
        where: { id: account.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {
        // Best-effort bookkeeping: a failed lastUsedAt update must not break the request
      });

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
  const expectedSecret = process.env.WEBHOOK_SIGNATURE_SECRET || process.env.WEBHOOK_SECRET;

  if (webhookSecret && expectedSecret && secureCompare(webhookSecret, expectedSecret)) {
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

