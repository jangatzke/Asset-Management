/**
 * Webhook DTOs - Zod validation schemas for webhook endpoints
 */

import { z } from 'zod';

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(200).describe('Webhook name (required)'),
  description: z.string().max(1000).optional().describe('Optional description'),
  url: z.string().url().describe('Webhook callback URL (must be HTTPS)'),
  events: z.array(z.string()).max(50).optional().default([]).describe('List of event types to subscribe to'),
  maxRetries: z.number().int().min(0).max(10).optional().default(5).describe('Maximum retry attempts (0-10, default: 5)'),
  timeoutMs: z.number().int().min(1000).max(30000).optional().default(10000).describe('Request timeout in ms (1000-30000, default: 10000)'),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).max(50).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
});

export const broadcastSchema = z.object({
  eventType: z.string().min(1).describe('Event type to broadcast'),
  data: z.record(z.unknown()).describe('Event payload data'),
});

export const testWebhookSchema = z.object({
  // No body needed; test is sent with default test payload
}).strict();

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type BroadcastInput = z.infer<typeof broadcastSchema>;
