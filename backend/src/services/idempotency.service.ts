import crypto from 'crypto';

export interface IdempotencyOptions {
  key: string;
  principal?: string;
  httpMethod: string;
  routePattern: string;
  requestBodyHash?: string;
  ttlMs?: number; // Default 24 hours
}

export interface IdempotencyResult<T> {
  isDuplicate: boolean;
  response: {
    status: number;
    headers: Record<string, string>;
    body: T;
  };
}

/**
 * Internal store entry structure.
 * data.response holds the actual HTTP response (status, headers, body).
 * data.keyOptions stores the original idempotency options including requestBodyHash.
 * data.createdAt tracks when the entry was created.
 */
export interface IdempotencyEntry {
  data: {
    response: {
      status: number;
      headers: Record<string, string>;
      body: unknown;
    };
    keyOptions: Omit<IdempotencyOptions, 'key'>;
    createdAt: number;
  };
  expiresAt: number;
}

/**
 * Generate a unique idempotency key from principal + HTTP method + route + idempotency-key.
 * This ensures that the same idempotency key sent to different endpoints or by different
 * principals is treated separately.
 */
export function generateIdempotencyKey(
  principal: string | undefined,
  httpMethod: string,
  routePattern: string,
  idempotencyKey: string
): string {
  const safePrincipal = principal || 'anonymous';
  const hash = crypto.createHash('sha256');
  hash.update(`${safePrincipal}:${httpMethod}:${routePattern}:${idempotencyKey}`);
  return hash.digest('hex');
}

/**
 * Generate a SHA-256 hash from a request body string or object.
 */
export function generateRequestBodyHash(body: unknown): string {
  const normalized = typeof body === 'string' ? body : JSON.stringify(body, Object.keys(body as object).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Check if a response status code should be cached.
 * Only 2xx (success) and 3xx (redirect) responses are cached.
 * 4xx (client errors) and 5xx (server errors) are NOT cached.
 */
export function shouldCacheResponse(status: number): boolean {
  return status >= 200 && status < 400;
}

/**
 * In-memory idempotency store (for production, use Redis).
 */
class IdempotencyStore {
  private store = new Map<string, IdempotencyEntry>();

  /**
   * Store a response for an idempotency key.
   * Returns true if the key was newly set, false if it already existed.
   * This enables atomic reservation semantics.
   */
  set(key: string, entry: IdempotencyEntry): boolean {
    if (this.store.has(key)) {
      return false; // Already exists
    }
    this.store.set(key, entry);
    return true; // Newly set
  }

  /**
   * Get a stored response by idempotency key.
   */
  get(key: string): IdempotencyEntry | undefined {
    const entry = this.store.get(key);
    
    if (!entry) return undefined;
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    
    return entry;
  }

  /**
   * Check if a key exists without modifying it.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clean up expired entries.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get store size (for testing).
   */
  getSize(): number {
    return this.store.size;
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.store.clear();
  }
}

// Export for testing
export const idempotencyStore = new IdempotencyStore();

/**
 * Validate an idempotency request.
 * Returns true if the key is valid and not expired.
 */
export function validateIdempotencyKey(key: string): boolean {
  return idempotencyStore.has(key);
}

/**
 * Store an idempotency response.
 * Returns true if the entry was newly created, false if it already existed.
 */
export function storeIdempotencyResponse(options: IdempotencyOptions, response: unknown): boolean {
  const typedResponse = response as { status: number; headers: Record<string, string>; body: unknown };
  const entry: IdempotencyEntry = {
    data: {
      response: typedResponse,
      keyOptions: {
        principal: options.principal,
        httpMethod: options.httpMethod,
        routePattern: options.routePattern,
        requestBodyHash: options.requestBodyHash,
      },
      createdAt: Date.now(),
    },
    expiresAt: Date.now() + (options.ttlMs || 24 * 60 * 60 * 1000),
  };

  return idempotencyStore.set(options.key, entry);
}

/**
 * Get a stored idempotency response.
 * Returns only entry.data.response as specified.
 */
export function getIdempotencyResponse<T>(key: string): T | undefined {
  const entry = idempotencyStore.get(key);
  return entry?.data.response as T | undefined;
}

/**
 * Get the full idempotency entry (for internal use and testing).
 * Returns entry.data for backward compatibility.
 */
export function getIdempotencyEntry<T>(key: string): T | undefined {
  const entry = idempotencyStore.get(key);
  return entry?.data as T | undefined;
}

/**
 * Compare the request body hash of a new request with the stored entry.
 * Returns true if the hashes match (same request body).
 */
export function requestBodyMatches(newHash: string, storedHash: string): boolean {
  return newHash === storedHash;
}

/**
 * Periodic cleanup interval (set by caller).
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic cleanup of expired idempotency keys.
 */
export function startIdempotencyCleanup(intervalMs: number = 60000): void {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    idempotencyStore.cleanup();
  }, intervalMs);
}

/**
 * Stop periodic cleanup.
 */
export function stopIdempotencyCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
