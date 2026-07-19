export interface IdempotencyOptions {
  key: string;
  serviceAccountId?: string;
  userId?: string;
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

// Hash utility used inline to avoid unused function warnings

/**
 * In-memory idempotency store (for production, use Redis).
 */
class IdempotencyStore {
  private store = new Map<string, { data: unknown; expiresAt: number }>();

  /**
   * Store a response for an idempotency key.
   */
  set(options: IdempotencyOptions, response: unknown): void {
    const key = options.key;
    const ttlMs = options.ttlMs || 24 * 60 * 60 * 1000; // Default 24 hours
    const expiresAt = Date.now() + ttlMs;

    this.store.set(key, {
      data: {
        response,
        keyOptions: {
          serviceAccountId: options.serviceAccountId,
          userId: options.userId,
          httpMethod: options.httpMethod,
          routePattern: options.routePattern,
        },
        createdAt: Date.now(),
      },
      expiresAt,
    });
  }

  /**
   * Get a stored response by idempotency key.
   */
  get(key: string): { data: unknown; expiresAt: number } | undefined {
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
  return idempotencyStore.get(key) !== undefined;
}

/**
 * Store an idempotency response.
 */
export function storeIdempotencyResponse(options: IdempotencyOptions, response: unknown): void {
  idempotencyStore.set(options, response);
}

/**
 * Get a stored idempotency response.
 */
export function getIdempotencyResponse<T>(key: string): T | undefined {
  const entry = idempotencyStore.get(key);
  return entry?.data as T | undefined;
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
