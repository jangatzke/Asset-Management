import { generateEtag, getResourceVersion } from '../middleware/etag';

describe('ETag Middleware', () => {
  describe('generateEtag', () => {
    test('should generate consistent etags for the same value', () => {
      const data = { id: '123', name: 'test' };
      const etag1 = generateEtag(data);
      const etag2 = generateEtag(data);
      
      expect(etag1).toBe(etag2);
      expect(etag1).toMatch(/^"[a-f0-9]{32}"$/);
    });

    test('should generate different etags for different values', () => {
      const data1 = { id: '123' };
      const data2 = { id: '456' };
      
      expect(generateEtag(data1)).not.toBe(generateEtag(data2));
    });

    test('should handle null value', () => {
      // JSON.stringify(null) returns "null" which is a valid string
      const etag = generateEtag(null);
      expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
    });

    test('should handle arrays', () => {
      const arr = [1, 2, 3];
      expect(generateEtag(arr)).toMatch(/^"[a-f0-9]{32}"$/);
    });

    test('should handle strings', () => {
      const str = 'hello world';
      const etag = generateEtag(str);
      expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
    });

    test('should handle numbers', () => {
      const num = 42;
      const etag = generateEtag(num);
      expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
    });
  });

  describe('getResourceVersion', () => {
    test('should return version from header', () => {
      const req = { headers: { 'x-resource-version': '42' } };
      expect(getResourceVersion(req as any)).toBe(42);
    });

    test('should return undefined for missing header', () => {
      const req = { headers: {} };
      expect(getResourceVersion(req as any)).toBeUndefined();
    });

    test('should return undefined for invalid version string', () => {
      const req = { headers: { 'x-resource-version': 'not-a-number' } };
      expect(getResourceVersion(req as any)).toBeUndefined();
    });

    test('should handle array header value', () => {
      const req = { headers: { 'x-resource-version': ['1'] } };
      expect(getResourceVersion(req as any)).toBeUndefined();
    });
  });
});
