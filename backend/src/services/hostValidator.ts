/**
 * Host/Port Validator — SSRF hygiene for stored integration endpoints
 *
 * Validates management-API hosts (Proxmox, vCenter, ...) before they are
 * persisted, following the same philosophy as services/urlValidator.ts:
 * reject malformed hosts, link-local (169.254.0.0/16) and cloud-metadata-style
 * bare IPs, which are classic SSRF pivot points. Unlike webhooks, these
 * integrations legitimately live on private networks (10/8, 172.16/12,
 * 192.168/16), so private RFC-1918 addresses remain allowed.
 */

import net from 'net';

// Cloud metadata endpoints — same list as urlValidator.ts.
const CLOUD_METADATA_IPS = new Set([
  '169.254.169.254', // AWS
  '100.100.100.200', // Alibaba
  '168.63.129.16',   // Azure
  '100.125.1.10',    // GCP
  '100.0.0.2',       // GCP (older)
]);

const CLOUD_METADATA_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.azure.com',
  'metadata.aws.internal',
]);

/**
 * Validate a host string: must be a syntactically valid hostname or IP and must
 * not be link-local / cloud-metadata. Returns { valid, reason }.
 */
export function validateHost(host: unknown): { valid: boolean; reason?: string } {
  if (typeof host !== 'string' || host.trim().length === 0) {
    return { valid: false, reason: 'Host is required' };
  }
  const normalized = host.trim().toLowerCase();

  if (net.isIP(normalized) !== 0) {
    // Link-local (169.254.0.0/16) and IPv6 link-local (fe80::/10) are the
    // usual cloud-metadata / instance-identity pivots — reject them.
    if (/^169\.254\./.test(normalized)) {
      return { valid: false, reason: 'Link-local addresses (169.254.0.0/16) are not allowed as hosts' };
    }
    if (/^fe80/i.test(normalized)) {
      return { valid: false, reason: 'IPv6 link-local addresses are not allowed as hosts' };
    }
    if (CLOUD_METADATA_IPS.has(normalized)) {
      return { valid: false, reason: `Cloud metadata endpoint (${normalized}) is not allowed as a host` };
    }
    return { valid: true };
  }

  // Hostname form: strip an optional bracketed IPv6 literal and validate labels.
  const hostname = normalized.replace(/^\[/, '').replace(/\]$/, '');
  if (CLOUD_METADATA_HOSTNAMES.has(hostname)) {
    return { valid: false, reason: `Cloud metadata hostname (${hostname}) is not allowed` };
  }
  const labelPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  const labels = hostname.split('.');
  if (labels.length === 0 || labels.some((label) => !labelPattern.test(label)) || hostname.length > 253) {
    return { valid: false, reason: 'Host must be a valid hostname or IP address' };
  }
  return { valid: true };
}

/**
 * Validate a TCP port number (1-65535). Returns { valid, reason }.
 */
export function validatePort(port: unknown): { valid: boolean; reason?: string } {
  const value = Number(port);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return { valid: false, reason: 'Port must be an integer between 1 and 65535' };
  }
  return { valid: true };
}
