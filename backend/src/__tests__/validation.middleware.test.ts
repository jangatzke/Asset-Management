/**
 * Tests for Request Validation Middleware (P0-04)
 *
 * Verifies Zod-based validation middleware rejects invalid input
 * and passes valid input through correctly.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';

import { validateBody, validateQuery, validateParams } from '../middleware/validation';

describe('Validation Middleware', () => {
  describe('validateBody', () => {
    const testSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email'),
      age: z.number().int().min(0).optional(),
    });

    const app = express();
    app.use(express.json());
    app.post('/test', validateBody(testSchema), (req, res) => {
      res.json({ received: req.body });
    });

    it('should pass valid request body through', async () => {
      const response = await request(app)
        .post('/test')
        .send({ name: 'Test User', email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/test')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toHaveLength(1);
      expect(response.body.details[0].field).toBe('name');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/test')
        .send({ name: 'Test User', email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0].field).toBe('email');
    });

    it('should return detailed error messages', async () => {
      const response = await request(app)
        .post('/test')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.details.length).toBeGreaterThanOrEqual(1);
      expect(response.body.details[0]).toHaveProperty('field');
      expect(response.body.details[0]).toHaveProperty('message');
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });

    const app = express();
    app.get('/test', validateQuery(querySchema), (req, res) => {
      res.json({ received: req.query });
    });

    it('should pass valid query parameters through', async () => {
      const response = await request(app).get('/test?page=2&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.received.page).toBe(2);
      expect(response.body.received.limit).toBe(10);
    });

    it('should apply defaults for missing query params', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.received.page).toBe(1);
      expect(response.body.received.limit).toBe(20);
    });

    it('should reject invalid query parameter values', async () => {
      const response = await request(app).get('/test?page=abc');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('validateParams', () => {
    const paramSchema = z.object({
      id: z.string().uuid('Invalid UUID format'),
    });

    const app = express();
    app.get('/test/:id', validateParams(paramSchema), (req, res) => {
      res.json({ received: req.params });
    });

    it('should pass valid UUID parameter through', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app).get(`/test/${uuid}`);

      expect(response.status).toBe(200);
      expect(response.body.received.id).toBe(uuid);
    });

    it('should reject invalid UUID format', async () => {
      const response = await request(app).get('/test/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0].message).toBe('Invalid UUID format');
    });
  });
});
