import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireScopes } from '../middleware/apiScopes';

const router = Router();

// In-memory store for service accounts (replace with DB in production)
interface ServiceAccountRecord {
  id: string;
  displayId: string;
  name: string;
  description?: string;
  userId?: string;
  accessTokenHash: string;
  accessTokenSalt: string;
  scopes: string[];
  expiresAt?: Date;
  isActive: boolean;
  isArchived: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const serviceAccounts = new Map<string, ServiceAccountRecord>();
let displayCounter = 1;

/**
 * Generate display ID for service account.
 */
function generateDisplayId(): string {
  const id = `SVC-${String(displayCounter).padStart(4, '0')}`;
  displayCounter++;
  return id;
}

/**
 * Validate a plain text access token against stored hash.
 */
function validateAccessToken(token: string, salt: string, hash: string): boolean {
  const combined = `${token}${salt}`;
  const computedHash = crypto.createHash('sha256').update(combined).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(hash)
  );
}

/**
 * Generate a new access token for a service account.
 */
function generateAccessToken(salt: string): { token: string; hash: string } {
  const token = `${process.env.SERVICE_ACCOUNT_PREFIX || 'svc'}_${crypto.randomUUID()}_${Date.now()}`;
  const combined = `${token}${salt}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return { token, hash };
}

// ==================== Service Account Routes ====================

/**
 * GET /api/v1/service-accounts - List service accounts
 */
router.get('/', requireScopes('serviceaccounts:read'), (_req: Request, res: Response) => {
  const accounts = Array.from(serviceAccounts.values())
    .filter(a => !a.isArchived)
    .map(({ accessTokenHash, accessTokenSalt, ...safe }) => safe);

  res.json({ data: accounts });
});

/**
 * POST /api/v1/service-accounts - Create service account
 */
router.post('/', requireScopes('serviceaccounts:write'), (req: Request, res: Response) => {
  const { name, description, userId, scopes = [], expiresAt } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Validation Error', message: 'name is required' });
    return;
  }

  const salt = crypto.randomBytes(32).toString('hex');
  const id = crypto.randomUUID();
  
  const account: ServiceAccountRecord = {
    id,
    displayId: generateDisplayId(),
    name,
    description,
    userId,
    accessTokenHash: '', // Will be set after token generation
    accessTokenSalt: salt,
    scopes: scopes as string[],
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    isActive: true,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Generate initial access token
  const { token, hash } = generateAccessToken(salt);
  account.accessTokenHash = hash;

  serviceAccounts.set(id, account);

  // Return without sensitive data, but include the token ONCE
  const { accessTokenHash: _, accessTokenSalt: __, ...safeAccount } = account;
  res.status(201).json({ 
    data: safeAccount,
    accessToken: token, // WARNING: Only returned once!
  });
});

/**
 * GET /api/v1/service-accounts/:id - Get service account
 */
router.get('/:id', requireScopes('serviceaccounts:read'), (req: Request, res: Response) => {
  const account = serviceAccounts.get(req.params.id);

  if (!account || account.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Service account not found' });
    return;
  }

  const { accessTokenHash, accessTokenSalt, ...safeAccount } = account;
  res.json({ data: safeAccount });
});

/**
 * PATCH /api/v1/service-accounts/:id - Update service account
 */
router.patch('/:id', requireScopes('serviceaccounts:write'), (req: Request, res: Response) => {
  const account = serviceAccounts.get(req.params.id);

  if (!account || account.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Service account not found' });
    return;
  }

  const { name, description, userId, scopes, expiresAt, isActive } = req.body;

  if (name !== undefined) account.name = name;
  if (description !== undefined) account.description = description;
  if (userId !== undefined) account.userId = userId;
  if (scopes !== undefined) account.scopes = scopes as string[];
  if (expiresAt !== undefined) account.expiresAt = new Date(expiresAt);
  if (isActive !== undefined) account.isActive = isActive;

  account.updatedAt = new Date();

  const { accessTokenHash, accessTokenSalt, ...safeAccount } = account;
  res.json({ data: safeAccount });
});

/**
 * DELETE /api/v1/service-accounts/:id - Delete service account (soft delete)
 */
router.delete('/:id', requireScopes('serviceaccounts:write'), (req: Request, res: Response) => {
  const account = serviceAccounts.get(req.params.id);

  if (!account || account.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Service account not found' });
    return;
  }

  account.isArchived = true;
  account.updatedAt = new Date();

  res.json({ data: { id: account.id, deleted: true } });
});

/**
 * POST /api/v1/service-accounts/:id/regenerate-token - Regenerate access token
 */
router.post('/:id/regenerate-token', requireScopes('serviceaccounts:write'), (req: Request, res: Response) => {
  const account = serviceAccounts.get(req.params.id);

  if (!account || account.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Service account not found' });
    return;
  }

  // Generate new token with same salt (or new salt for better security)
  const newSalt = crypto.randomBytes(32).toString('hex');
  const { token, hash } = generateAccessToken(newSalt);

  account.accessTokenHash = hash;
  account.accessTokenSalt = newSalt;
  account.updatedAt = new Date();

  res.json({ 
    data: { id: account.id },
    accessToken: token, // WARNING: Only returned once!
  });
});

/**
 * GET /api/v1/service-accounts/:id/tokens - Get service account tokens (masked)
 */
router.get('/:id/tokens', requireScopes('serviceaccounts:read'), (req: Request, res: Response) => {
  const account = serviceAccounts.get(req.params.id);

  if (!account || account.isArchived) {
    res.status(404).json({ error: 'Not Found', message: 'Service account not found' });
    return;
  }

  res.json({ 
    data: {
      id: account.id,
      displayId: account.displayId,
      isActive: account.isActive,
      expiresAt: account.expiresAt,
      lastUsedAt: account.lastUsedAt,
      scopes: account.scopes,
    }
  });
});

/**
 * POST /api/v1/service-accounts/auth - Authenticate service account (for testing)
 */
router.post('/auth', (req: Request, res: Response) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    res.status(400).json({ error: 'Validation Error', message: 'accessToken is required' });
    return;
  }

  // Find matching service account
  for (const account of serviceAccounts.values()) {
    if (!account.isActive || account.isArchived) continue;

    // Check expiration
    if (account.expiresAt && new Date() > account.expiresAt) {
      continue;
    }

    if (validateAccessToken(accessToken, account.accessTokenSalt, account.accessTokenHash)) {
      account.lastUsedAt = new Date();
      
      res.json({ 
        success: true,
        data: {
          id: account.id,
          displayId: account.displayId,
          name: account.name,
          scopes: account.scopes,
        }
      });
      return;
    }
  }

  res.status(401).json({ error: 'Authentication Failed', message: 'Invalid access token' });
});

export const serviceAccountRouter = router;
