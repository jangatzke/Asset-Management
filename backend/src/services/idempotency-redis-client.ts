/**
 * Redis client wrapper for idempotency store.
 * 
 * This module attempts to create a Redis client using available libraries
 * (ioredis or redis) and falls back gracefully if neither is installed.
 * 
 * Environment variables:
 * - REDIS_HOST: Redis hostname (default: 'localhost')
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database number (default: 0)
 */

import { IdempotencyEntry } from './idempotency.service';

export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number; NX: boolean }): Promise<string | null>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  quit?(): Promise<void>;
  ping?(): Promise<string>;
}

export interface RedisIdempotencyClientOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttlSeconds?: number;
  enabled?: boolean;
}

/**
 * RedisIdempotencyClient - A unified interface for Redis-based idempotency storage.
 * 
 * This client wraps either ioredis or the redis package, with graceful fallback
 * when neither is available. It provides atomic SET NX operations for distributed
 * idempotency key reservation (first-write-wins).
 */
export class RedisIdempotencyClient {
  private client: RedisClientInterface | null = null;
  private keyPrefix: string;
  private connected = false;
  private initializationError: string | null = null;

  constructor(options: RedisIdempotencyClientOptions = {}) {
    this.keyPrefix = options.keyPrefix || 'idempotency:';
  }

  /**
   * Try to initialize a Redis client using available libraries.
   * Returns true if a client was successfully created and connected.
   */
  async initialize(): Promise<boolean> {
    // If explicitly disabled, skip initialization
    if (this.initializationError === 'disabled') {
      return false;
    }

    // Try ioredis first (most common)
    const ioredisLoaded = await this.tryLoadIoredis();
    if (ioredisLoaded) {
      console.log('[Idempotency] Redis client initialized via ioredis');
      this.connected = true;
      return true;
    }

    // Try the 'redis' package
    const redisLoaded = await this.tryLoadRedisPackage();
    if (redisLoaded) {
      console.log('[Idempotency] Redis client initialized via redis package');
      this.connected = true;
      return true;
    }

    // No Redis client available - this is not an error, just a fallback
    this.initializationError = 'No Redis client library available (neither ioredis nor redis package installed)';
    console.log('[Idempotency] Redis not available - using in-memory store only. Install ioredis or redis for distributed idempotency.');
    return false;
  }

  /**
   * Try loading ioredis and creating a client.
   */
  private async tryLoadIoredis(): Promise<boolean> {
    try {
      // Dynamic import to avoid build-time dependency requirement
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ioredis = require('ioredis');
      if (!ioredis) return false;

      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT || 6379);
      const password = process.env.REDIS_PASSWORD;
      const db = Number(process.env.REDIS_DB || 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = new ioredis.default({
        host,
        port,
        password,
        db,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.warn('[Idempotency] Redis connection failed after 3 retries, falling back to in-memory store');
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000); // Exponential backoff
        },
      });

      // Test connection
      await client.ping();

      this.client = {
        get: (key: string) => client.get(key),
        set: (key: string, value: string, options: { EX: number; NX: boolean }) => 
          client.set(key, value, options.EX ? ['EX', options.EX] : [], options.NX ? ['NX'] : []),
        del: (key: string) => client.del(key),
        expire: (key: string, seconds: number) => client.expire(key, seconds),
        keys: (pattern: string) => client.keys(pattern),
        quit: () => client.quit(),
        ping: () => client.ping(),
      };

      return true;
    } catch (error) {
      // ioredis not available or connection failed
      return false;
    }
  }

  /**
   * Try loading the 'redis' package and creating a client.
   */
  private async tryLoadRedisPackage(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const redis = require('redis');
      if (!redis || !redis.createClient) return false;

      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT || 6379);
      const password = process.env.REDIS_PASSWORD;

      const client = redis.createClient({
        socket: {
          host,
          port,
          reconnectStrategy: (retries: number) => {
            if (retries > 3) {
              console.warn('[Idempotency] Redis connection failed after 3 retries, falling back to in-memory store');
              return null;
            }
            return Math.min(retries * 200, 2000);
          },
        },
        password,
      });

      await client.connect();

      this.client = {
        get: (key: string) => client.get(key),
        set: async (key: string, value: string, options: { EX: number; NX: boolean }) => {
          const args: string[] = [key, value];
          if (options.NX) args.push('NX');
          if (options.EX) args.push('EX', String(options.EX));
          // redis v4+ set returns 'OK' or null
          return (await client.set(...args)) as string;
        },
        del: (key: string) => client.del(key),
        expire: (key: string, seconds: number) => client.expire(key, seconds),
        keys: (pattern: string) => client.keys(pattern),
        quit: () => client.quit(),
        ping: () => client.ping(),
      };

      return true;
    } catch (error) {
      // redis package not available or connection failed
      return false;
    }
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
   * If Redis is not available, throws an error (caller should handle fallback).
   */
  async set(key: string, entry: IdempotencyEntry): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis client not initialized - falling back to in-memory store');
    }

    if (!this.connected) {
      throw new Error('Redis client not connected');
    }

    const redisKey = this.makeKey(key);
    const serialized = JSON.stringify(entry);
    const ttlMs = entry.expiresAt - Date.now();
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

    try {
      // SET NX is atomic - only sets if key doesn't exist
      // Using raw command for maximum compatibility across redis client versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await (this.client as any).rawCommand?.('SET', redisKey, serialized, 'NX', 'EX', ttlSeconds)
        ?? await (this.client as any).set(redisKey, serialized, ['NX', 'EX', ttlSeconds]);
      
      // result is 'OK' if set, null if key already exists
      return result === 'OK' || result === '1' || result === true;
    } catch (error) {
      console.error('[Idempotency] Redis SET failed:', error);
      this.connected = false;
      throw new Error('Redis SET failed - falling back to in-memory store');
    }
  }

  /**
   * Get a stored response by idempotency key.
   */
  async get(key: string): Promise<IdempotencyEntry | undefined> {
    if (!this.client || !this.connected) {
      return undefined;
    }

    const redisKey = this.makeKey(key);

    try {
      const serialized = await this.client.get(redisKey);

      if (serialized === null) {
        return undefined;
      }

      return JSON.parse(serialized);
    } catch (error) {
      console.error('[Idempotency] Redis GET failed:', error);
      this.connected = false;
      return undefined;
    }
  }

  /**
   * Check if a key exists.
   */
  async has(key: string): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    const redisKey = this.makeKey(key);

    try {
      const result = await this.client.get(redisKey);
      return result !== null;
    } catch (error) {
      console.error('[Idempotency] Redis HAS failed:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Delete a key (for manual cleanup).
   */
  async delete(key: string): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    const redisKey = this.makeKey(key);

    try {
      return await this.client.del(redisKey);
    } catch (error) {
      console.error('[Idempotency] Redis DELETE failed:', error);
      return 0;
    }
  }

  /**
   * Clean up all entries with the idempotency prefix.
   */
  async cleanup(): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    const pattern = `${this.keyPrefix}*`;

    try {
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      // Delete all keys
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await (this.client as any).del(...keys);
      return typeof result === 'number' ? result : Object.keys(result).length;
    } catch (error) {
      console.error('[Idempotency] Redis CLEANUP failed:', error);
      return 0;
    }
  }

  /**
   * Get store size (number of entries).
   */
  async getSize(): Promise<number> {
    if (!this.client || !this.connected) {
      return 0;
    }

    const pattern = `${this.keyPrefix}*`;

    try {
      const keys = await this.client.keys(pattern);
      return keys.length;
    } catch (error) {
      console.error('[Idempotency] Redis getSize failed:', error);
      return 0;
    }
  }

  /**
   * Check if Redis is available.
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Get initialization status info.
   */
  getStatus(): { connected: boolean; error: string | null; usingFallback: boolean } {
    return {
      connected: this.connected,
      error: this.initializationError,
      usingFallback: !this.connected,
    };
  }

  /**
   * Close the Redis connection.
   */
  async close(): Promise<void> {
    if (this.client && this.client.quit) {
      try {
        await this.client.quit();
      } catch (error) {
        console.error('[Idempotency] Redis close failed:', error);
      }
    }
    this.client = null;
    this.connected = false;
  }
}

/**
 * Create a RedisIdempotencyClient from environment configuration.
 * Returns a client that will auto-initialize when first used.
 */
export function createRedisIdempotencyClient(options: RedisIdempotencyClientOptions = {}): RedisIdempotencyClient {
  return new RedisIdempotencyClient(options);
}

/**
 * Check if Redis is configured via environment variables.
 */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_HOST);
}

/**
 * Get Redis configuration from environment variables.
 */
export function getRedisConfig(): { host: string; port: number; password?: string; db: number; enabled: boolean } {
  const host = process.env.REDIS_HOST;
  
  // If no REDIS_HOST is set, Redis is disabled
  if (!host) {
    return {
      host: 'localhost',
      port: 6379,
      db: 0,
      password: undefined,
      enabled: false,
    };
  }

  return {
    host,
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB || 0),
    enabled: true,
  };
}
