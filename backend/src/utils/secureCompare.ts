/**
 * Secure string comparison helpers.
 *
 * `secureCompare` performs a constant-time comparison of two strings using
 * `crypto.timingSafeEqual`, mitigating timing side-channel attacks when
 * comparing secrets, hashes, or tokens (e.g. service-account token hashes,
 * webhook shared secrets).
 *
 * Usage notes:
 * - Both values are UTF-8 encoded before comparison.
 * - Inputs of different lengths are **rejected immediately** — the length
 *   check itself is not secret (hashes are fixed-length anyway).
 * - When lengths match, `timingSafeEqual` compares both buffers in constant
 *   time.  No spurious operations are performed.
 * - Always use `secureCompare` for any comparison of secret material.
 */

import crypto from 'crypto';

export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  // Length mismatch → reject immediately.  Constant-time comparison is only
  // meaningful when both buffers are the same length.
  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}
