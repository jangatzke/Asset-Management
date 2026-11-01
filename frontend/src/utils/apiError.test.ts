/// <reference types="vitest" />
import { extractApiError, formatToastMessage } from './apiError';

declare const test: typeof import('vitest').test;
declare const expect: typeof import('vitest').expect;

const envelopeError = (headers?: Record<string, unknown>) => ({
  response: {
    status: 500,
    headers: headers ?? {},
    data: {
      success: false,
      error: {
        message: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        details: [{ field: 'name', message: 'Name is required' }],
      },
    },
  },
});

test('reads the correlation ID from the lowercase axios header', () => {
  const info = extractApiError(envelopeError({ 'x-correlation-id': 'abc-123' }), 'fallback');
  expect(info.referenceId).toBe('abc-123');
});

test('reads the correlation ID from the canonical X-Correlation-Id spelling', () => {
  const info = extractApiError(envelopeError({ 'X-Correlation-Id': 'canonical-456' }), 'fallback');
  expect(info.referenceId).toBe('canonical-456');
});

test('reads the correlation ID through AxiosHeaders.get()', () => {
  const headers = { get: (name: string) => (name.toLowerCase() === 'x-correlation-id' ? 'get-789' : undefined) };
  const info = extractApiError(envelopeError(headers), 'fallback');
  expect(info.referenceId).toBe('get-789');
});

test('referenceId is undefined when the header is missing', () => {
  const info = extractApiError(envelopeError(), 'fallback');
  expect(info.referenceId).toBeUndefined();
});

test('referenceId is undefined for a non-axios error object', () => {
  const info = extractApiError(new Error('network down'), 'fallback');
  expect(info.referenceId).toBeUndefined();
  expect(info.message).toBe('network down');
});

test('envelope parsing (message, code, fieldErrors) stays unchanged', () => {
  const info = extractApiError(envelopeError({ 'x-correlation-id': 'abc-123' }), 'fallback');
  expect(info.message).toBe('Internal Server Error');
  expect(info.code).toBe('INTERNAL_ERROR');
  expect(info.fieldErrors).toEqual({ name: 'Name is required' });
});

test('formatToastMessage appends the localized reference template', () => {
  const info = extractApiError(envelopeError({ 'x-correlation-id': 'abc-123' }), 'fallback');
  expect(formatToastMessage(info, 'Ref: {id}')).toBe('Internal Server Error (Ref: abc-123)');
});

test('formatToastMessage leaves the message untouched without a reference', () => {
  const info = extractApiError(envelopeError(), 'fallback');
  expect(formatToastMessage(info, 'Ref: {id}')).toBe('Internal Server Error');
});
