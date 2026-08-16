/**
 * Secure string comparison helpers.
 *
 * `secureCompare` performs a constant-time comparison of two strings using
 * `crypto.timingSafeEqual`, mitigating timing side-channel attacks when
 * comparing secrets, hashes, or tokens (e.g. service-account token hashes,
 * webhook shared secrets).
 *
 * Usage notes:
 * - Both values are UTF-8 encoded before comparison; inputs of different
 *   lengths are still compared in constant time relative to the shorter
 *   buffer and then rejected (length is intentionally not secret in most
 *   of our use cases — hashes are fixed-length anyway).
 * - Always use `secureCompare` for any comparison of secret material.
 */

import crypto from 'crypto';

export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    // Still perform a constant-time comparison against bufferA so that the
    // branch does not short-circuit on the length check alone.
    crypto.timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}
