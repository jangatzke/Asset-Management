/**
 * Tests for Placeholder Endpoints (P0-04)
 *
 * Verifies that unimplemented endpoints return HTTP 501 Not Implemented
 * instead of ambiguous responses or placeholder messages.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock auth middleware for all route tests
jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    (req as any).userId = 'user-123';
    next();
  }),
  authorize: jest.fn(() => jest.fn((req: any, _res: any, next: any) => next())),
  AuthRequest: {},
}));

import { userRouter } from '../routes/user.routes';
import { auditLogRouter } from '../routes/auditLog.routes';
import { orgRouter } from '../routes/organization.routes';

const app = express();
app.use(express.json());
app.use('/users', userRouter);
app.use('/audit-logs', auditLogRouter);
app.use('/organization', orgRouter);

describe('Placeholder Endpoints Return 501 (P0-04)', () => {
  describe('User Routes', () => {
    it('GET /users returns 501 Not Implemented', async () => {
      const response = await request(app).get('/users');

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });

    it('GET /users/:id returns 501 Not Implemented', async () => {
      const response = await request(app).get('/users/some-id');

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });

    it('PUT /users/:id returns 501 Not Implemented', async () => {
      const response = await request(app)
        .put('/users/some-id')
        .send({ name: 'Updated' });

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });

    it('DELETE /users/:id returns 501 Not Implemented', async () => {
      const response = await request(app).delete('/users/some-id');

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });
  });

  describe('Organization Routes', () => {
    it('GET /organization/units returns 501 Not Implemented', async () => {
      const response = await request(app).get('/organization/units');

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });

    it('POST /organization/units returns 501 Not Implemented', async () => {
      const response = await request(app)
        .post('/organization/units')
        .send({ name: 'New Unit' });

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });

    it('GET /organization/scopes returns 501 Not Implemented', async () => {
      const response = await request(app).get('/organization/scopes');

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });

    it('POST /organization/scopes returns 501 Not Implemented', async () => {
      const response = await request(app)
        .post('/organization/scopes')
        .send({ name: 'New Scope' });

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });

    it('GET /organization/parties returns 501 Not Implemented', async () => {
      const response = await request(app).get('/organization/parties');

      expect(response.status).toBe(501);
      expect(response.body.error).toBe('Not Implemented');
    });
  });
});
