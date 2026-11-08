/// <reference types="vitest" />
import { extractApiError, formatApiError, formatToastMessage } from './apiError';

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

test('extractApiError falls back to the legacy flat response.data.message shape', () => {
  const legacyError = {
    response: { status: 500, headers: {}, data: { message: 'backend failed' } },
  };
  const info = extractApiError(legacyError, 'fallback');
  expect(info.message).toBe('backend failed');
  expect(info.referenceId).toBeUndefined();
  expect(info.fieldErrors).toEqual({});
  expect(formatApiError(legacyError, 'fallback', 'Ref: {id}')).toBe('backend failed');
});

test('canonical envelope message wins over the legacy flat message when both exist', () => {
  const mixedError = {
    response: {
      status: 500,
      headers: {},
      data: { message: 'legacy flat message', error: { message: 'envelope message' } },
    },
  };
  expect(extractApiError(mixedError, 'fallback').message).toBe('envelope message');
});

test('formatApiError extracts the envelope and appends the reference label in one call', () => {
  expect(formatApiError(envelopeError({ 'x-correlation-id': 'abc-123' }), 'fallback', 'Ref: {id}'))
    .toBe('Internal Server Error (Ref: abc-123)');
});

test('formatApiError falls back to the message text when no correlation ID is present', () => {
  expect(formatApiError(envelopeError(), 'fallback', 'Ref: {id}')).toBe('Internal Server Error');
});

test('formatApiError uses the provided fallback for plain errors without an envelope', () => {
  expect(formatApiError(new Error('network down'), 'Could not load', 'Ref: {id}')).toBe('network down');
  expect(formatApiError(undefined, 'Could not load', 'Ref: {id}')).toBe('Could not load');
});

test('formatApiError keeps the template literal when it has no {id} placeholder', () => {
  expect(formatApiError(envelopeError({ 'x-correlation-id': 'abc-123' }), 'fallback', 'Ref'))
    .toBe('Internal Server Error (Ref: abc-123)');
});
