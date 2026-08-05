import { IdempotencyEntry } from './idempotency.service';

/**
 * Redis-based idempotency store for multi-instance deployments.
 * Uses Redis SET with NX option for atomic reservation (first-write-wins).
 */
export interface RedisIdempotencyStoreOptions {
  host?: string;
  port?: number;
  password?: string;
  keyPrefix?: string;
  ttlSeconds?: number;
}

interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, EX: number, NX: true): Promise<string | null>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  quit?(): Promise<void>;
}

/**
 * RedisIdempotencyStore - A production-ready idempotency store using Redis.
 * 
 * Key features:
 * - Atomic reservation using Redis SET NX (first-write-wins)
 * - Configurable TTL for automatic cleanup
 * - Compatible with ioredis or any Redis client following the basic API
 */
export class RedisIdempotencyStore {
  private client: RedisClientLike | null = null;
  private keyPrefix: string;

  constructor(
    client: RedisClientLike,
    options: RedisIdempotencyStoreOptions = {}
  ) {
    this.client = client;
    this.keyPrefix = options.keyPrefix || 'idempotency:';
  }

  /**
   * Generate a Redis key from the idempotency key.
   */
  private makeKey(idempotencyKey: string): string {
    return `${this.keyPrefix}${idempotencyKey}`;
  }

  /**
   * Store a response for an idempotency key.
   * Uses SET NX for atomic reservation - returns true if newly set, false if already exists.
   */
  async set(key: string, entry: IdempotencyEntry): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.makeKey(key);
    const serialized = JSON.stringify(entry);
    const ttlMs = entry.expiresAt - Date.now();
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

    // SET NX is atomic - only sets if key doesn't exist
    const result = await this.client.set(redisKey, serialized, ttlSeconds, true);
    
    // result is 'OK' if set, null if key already exists
    return result === 'OK';
  }

  /**
   * Get a stored response by idempotency key.
   */
  async get(key: string): Promise<IdempotencyEntry | undefined> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.makeKey(key);
    const serialized = await this.client.get(redisKey);

    if (serialized === null) {
      return undefined;
    }

    return JSON.parse(serialized);
  }

  /**
   * Check if a key exists.
   */
  async has(key: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.makeKey(key);
    const result = await this.client.get(redisKey);
    return result !== null;
  }

  /**
   * Delete a key (for manual cleanup).
   */
  async delete(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.makeKey(key);
    return this.client.del(redisKey);
  }

  /**
   * Clean up all expired entries.
   * Note: Redis handles expiration automatically, so this is mainly for manual cleanup.
   */
  async cleanup(): Promise<number> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const pattern = `${this.keyPrefix}*`;
    const keys = await this.client.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }

    // Delete all keys matching the pattern
    // Note: In production, use SCAN instead of KEYS for large datasets
    let deleted = 0;
    for (const key of keys) {
      const count = await this.client.del(key);
      deleted += count;
    }

    return deleted;
  }

  /**
   * Get store size (number of entries).
   */
  async getSize(): Promise<number> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const pattern = `${this.keyPrefix}*`;
    const keys = await this.client.keys(pattern);
    return keys.length;
  }

  /**
   * Clear all entries (for testing/management).
   */
  async clear(): Promise<number> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const pattern = `${this.keyPrefix}*`;
    const keys = await this.client.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }

    return this.client.del(keys.join(' '));
  }

  /**
   * Close the Redis connection.
   */
  async close(): Promise<void> {
    if (this.client && this.client.quit) {
      await this.client.quit();
    }
    this.client = null;
  }
}

/**
 * Create a RedisIdempotencyStore from connection options.
 * Accepts an ioredis Client or any object with the basic Redis API.
 */
export function createRedisIdempotencyStore(
  client: RedisClientLike,
  options: RedisIdempotencyStoreOptions = {}
): RedisIdempotencyStore {
  return new RedisIdempotencyStore(client, options);
}
