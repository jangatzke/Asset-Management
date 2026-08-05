import { Express } from 'express';
import prisma from '../config/database';
import { stopIdempotencyCleanup } from '../services/idempotency.service';
import { stopWebhookQueueWorker } from '../services/webhookQueue.service';

export interface GracefulShutdownOptions {
  signalTimeout?: number; // Maximum time to wait for connections to close (ms)
  dbTimeout?: number;   // Maximum time to wait for DB disconnect (ms)
}

const DEFAULT_OPTIONS: GracefulShutdownOptions = {
  signalTimeout: 30000,
  dbTimeout: 10000,
};

/**
 * Set up graceful shutdown handler.
 */
export function setupGracefulShutdown(
  server: ReturnType<Express['listen']>,
  options: GracefulShutdownOptions = DEFAULT_OPTIONS
): void {
  const { signalTimeout, dbTimeout } = { ...DEFAULT_OPTIONS, ...options };

  const shutdownHandlers = ['SIGTERM', 'SIGINT'];

  for (const signal of shutdownHandlers) {
    process.on(signal, async () => {
      await gracefulShutdown(server, signalTimeout!, dbTimeout!);
    });
  }

  // Also handle uncaught exceptions/unhandled rejections gracefully
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await gracefulShutdown(server, signalTimeout!, dbTimeout!);
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled Rejection:', reason);
    await gracefulShutdown(server, signalTimeout!, dbTimeout!);
    process.exit(1);
  });
}

/**
 * Perform graceful shutdown.
 */
async function gracefulShutdown(
  server: ReturnType<Express['listen']>,
  signalTimeout: number,
  dbTimeout: number
): Promise<void> {
  console.log('Starting graceful shutdown...');

  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed. All existing connections drained.');
    
    // Clean up idempotency cleanup interval
    stopIdempotencyCleanup();

    // Stop webhook queue worker
    stopWebhookQueueWorker();

    // Disconnect from database
    try {
      await Promise.race([
        prisma.$disconnect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database disconnect timeout')), dbTimeout)
        ),
      ]);
      console.log('Database connection closed successfully.');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }

    console.log('Graceful shutdown completed.');
    process.exit(0);
  });

  // Force exit after timeout if graceful shutdown takes too long
  setTimeout(() => {
    console.error(`Graceful shutdown timed out after ${signalTimeout}ms. Forcing exit.`);
    
    // Try to disconnect DB one more time
    prisma.$disconnect().catch(() => {
      // Ignore errors during forced shutdown
    });

    process.exit(1);
  }, signalTimeout).unref();

  // Log active connections draining
  console.log('Draining existing connections...');
}

/**
 * Health check for graceful shutdown readiness.
 */
export function isShuttingDown(): boolean {
  return process.env.SHUTTING_DOWN === 'true';
}
