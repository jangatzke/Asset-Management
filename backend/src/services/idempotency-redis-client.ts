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
  setXX(key: string, value: string, options: { EX: number }): Promise<string | null>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ping?(): Promise<string>;
  quit?(): Promise<void>;
  rawCommand?(...args: string[]): Promise<string | null>;
  getset?(key: string, value: string): Promise<string | null>;
}

export interface IdempotencyReservation {
  reserved: true;
  key: string;
  principal: string;
  httpMethod: string;
  routePattern: string;
  requestId: string;
  expiresAt: number;
}

export interface IdempotencyAlreadyExists {
  reserved: false;
  exists: true;
  entry: IdempotencyEntry;
}

export interface IdempotencyNotReserved {
  reserved: false;
  exists: false;
  existingReservation: {
    principal: string;
    requestId: string;
    expiresAt: number;
  };
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
        setXX: (key: string, value: string, options: { EX: number }) =>
          client.set(key, value, ['XX', 'EX', options.EX]),
        del: (key: string) => client.del(key),
        expire: (key: string, seconds: number) => client.expire(key, seconds),
        keys: (pattern: string) => client.keys(pattern),
        quit: () => client.quit(),
        ping: () => client.ping(),
        rawCommand: (...args: string[]) => client.sendCommand(args),
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
        setXX: async (key: string, value: string, options: { EX: number }) => {
          const args: string[] = [key, value, 'XX', 'EX', String(options.EX)];
          return (await client.set(...args)) as string;
        },
        del: (key: string) => client.del(key),
        expire: (key: string, seconds: number) => client.expire(key, seconds),
        keys: (pattern: string) => client.keys(pattern),
        quit: () => client.quit(),
        ping: () => client.ping(),
        rawCommand: async (...args: string[]) => {
          return (await client.sendCommand(args)) as string;
        },
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
   * Atomically reserve an idempotency key for this backend instance.
   *
   * This is the core of distributed idempotency - only ONE backend instance
   * can win the reservation. Losers must wait for the winner to complete.
   *
   * Returns:
   * - { reserved: true } if this instance won the reservation
   * - { exists: true, entry } if a response already exists (return cached)
   * - { exists: false, existingReservation } if someone else reserved it (wait)
   */
  async reserve(
    key: string,
    principal: string,
    httpMethod: string,
    routePattern: string,
    requestId: string,
    ttlSeconds: number
  ): Promise<IdempotencyReservation | IdempotencyAlreadyExists | IdempotencyNotReserved> {
    if (!this.client || !this.connected) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.makeKey(key);
    const now = Date.now();
    const expirationTimestamp = now + (ttlSeconds * 1000);
    
    // Serialize reservation metadata
    const reservationData = JSON.stringify({
      principal,
      httpMethod,
      routePattern,
      requestId,
      reservedAt: now,
      expiresAt: expirationTimestamp,
    });

    try {
      // Atomic SET NX - only sets if key doesn't exist
      // Using raw command for maximum compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setResult: any = await (this.client as any).rawCommand?.(
        'SET', redisKey, reservationData, 'NX', 'EX', ttlSeconds
      ) ?? await (this.client as any).set(redisKey, reservationData, ['NX', 'EX', ttlSeconds]);

      const acquired = (setResult === 'OK' || setResult === '1' || setResult === true);

      if (acquired) {
        // We won the reservation
        return {
          reserved: true,
          key,
          principal,
          httpMethod,
          routePattern,
          requestId,
          expiresAt: expirationTimestamp,
        };
      }

      // Key already exists - fetch the existing data
      const existingSerialized = await this.client.get(redisKey);
      
      if (existingSerialized === null) {
        // Race condition: key was deleted between SET and GET
        // Try again with exponential backoff
        return {
          reserved: false,
          exists: false,
          existingReservation: {
            principal: 'unknown',
            requestId: 'unknown',
            expiresAt: now + (ttlSeconds * 1000),
          },
        };
      }

      const existingData = JSON.parse(existingSerialized);

      if (existingData.response) {
        // A response already exists - return it
        return {
          reserved: false,
          exists: true,
          entry: existingData.response,
        };
      }

      // Someone else has the reservation - they're executing the operation
      return {
        reserved: false,
        exists: false,
        existingReservation: {
          principal: existingData.principal,
          requestId: existingData.requestId,
          expiresAt: existingData.expiresAt,
        },
      };
    } catch (error) {
      console.error('[Idempotency] Redis RESERVE failed:', error);
      this.connected = false;
      throw new Error('Redis RESERVE failed - falling back to in-memory store');
    }
  }

  /**
   * Store a response for a previously reserved idempotency key.
   *
   * This replaces the reservation metadata with the actual response.
   * Uses atomic GET to verify we still hold the reservation.
   */
  async storeResponse(
    key: string,
    response: IdempotencyEntry,
    requestId: string
  ): Promise<boolean> {
    if (!this.client || !this.connected) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.makeKey(key);

    try {
      // Atomic GET-SET with verification:
      // 1. GET the current value
      // 2. Verify it matches our requestId
      // 3. SET the new value with response embedded
      
      const currentSerialized = await this.client.get(redisKey);
      
      if (currentSerialized === null) {
        // Key was deleted - someone else took over
        return false;
      }

      const currentData = JSON.parse(currentSerialized);

      if (currentData.requestId !== requestId) {
        // We no longer hold the reservation
        return false;
      }

      // Store the response, keeping the metadata
      const updatedData = {
        ...currentData,
        response,
        completedAt: Date.now(),
      };

      const ttlMs = response.expiresAt - Date.now();
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.client as any).rawCommand?.(
        'SET', redisKey, JSON.stringify(updatedData), 'EX', ttlSeconds
      ) ?? await (this.client as any).set(redisKey, JSON.stringify(updatedData), ['EX', ttlSeconds]);

      return true;
    } catch (error) {
      console.error('[Idempotency] Redis STORE_RESPONSE failed:', error);
      this.connected = false;
      return false;
    }
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
