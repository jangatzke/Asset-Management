/**
 * URL Validator - SSRF Protection
 *
 * Validates webhook URLs to prevent Server-Side Request Forgery attacks.
 * Blocks localhost, private IPv4/IPv6, link-local, and cloud metadata endpoints.
 * Enforces HTTPS-only for all webhook deliveries.
 */

import dns from 'dns';
import https from 'https';
import net from 'net';

// SSRF-blocked IP ranges (CIDR notation)
const PRIVATE_RANGES: { start: number[]; end: number[]; isV6: boolean }[] = [
  // IPv4 loopback
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255], isV6: false },
  // IPv4 private A (10.0.0.0/8)
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255], isV6: false },
  // IPv4 private B (172.16.0.0/12)
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255], isV6: false },
  // IPv4 private C (192.168.0.0/16)
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255], isV6: false },
  // IPv4 link-local (169.254.0.0/16)
  { start: [169, 254, 0, 0], end: [169, 254, 255, 255], isV6: false },
  // IPv4 any (0.0.0.0/8)
  { start: [0, 0, 0, 0], end: [0, 255, 255, 255], isV6: false },
  // IPv4 shared address space / CGNAT (100.64.0.0/10)
  { start: [100, 64, 0, 0], end: [100, 127, 255, 255], isV6: false },
  // IPv4 protocol assignments and special-use space (192.0.0.0/24)
  { start: [192, 0, 0, 0], end: [192, 0, 0, 255], isV6: false },
  // IPv4 broadcast (255.255.255.255)
  { start: [255, 255, 255, 255], end: [255, 255, 255, 255], isV6: false },
  // IPv6 loopback ::1
  { start: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], end: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], isV6: true },
  // IPv6 unique local fc00::/7
  { start: [0xfc, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], end: [0xfd, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], isV6: true },
  // IPv6 link-local fe80::/10
  { start: [0xfe, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], end: [0xfe, 0xbf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], isV6: true },
  // IPv6 site-local fec0::/10 (deprecated but still non-public)
  { start: [0xfe, 0xc0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], end: [0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], isV6: true },
  // IPv6 unspecified ::
  { start: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], end: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], isV6: true },
  // IPv6 multicast ff00::/8
  { start: [0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], end: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], isV6: true },
];

// Cloud metadata endpoints - known IPs
const CLOUD_METADATA_IPS = new Set([
  '169.254.169.254', // AWS
  '100.100.100.200', // Alibaba
  '168.63.129.16',   // Azure
  '100.125.1.10',    // GCP
  '100.0.0.2',       // GCP (older)
]);

// Cloud metadata hostnames
const CLOUD_METADATA_HOSTNAMES = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.azure.com',
  'metadata.aws.internal',
  '100.100.100.200',
  '168.63.129.16',
]);

/**
 * Convert IPv4 address to numeric array for comparison
 */
function ipv4ToBytes(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return parts.map(p => {
    if (!/^\d+$/.test(p)) return -1;
    const n = parseInt(p, 10);
    return isNaN(n) ? -1 : n;
  });
}

/**
 * Expand an IPv6 address to its full 8-group form (no :: shorthand).
 */
function expandIPv6(ip: string): string | null {
  let normalized = ip.toLowerCase().trim();
  
  // Remove brackets if present (e.g., [::1] -> ::1)
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }

  // Handle :: expansion
  if (normalized.includes('::')) {
    const [left, right] = normalized.split('::');
    const leftParts = left ? left.split(':') : [];
    const rightParts = right ? right.split(':') : [];
    const missing = 8 - leftParts.length - rightParts.length;
    if (missing < 0) return null; // Invalid: too many groups
    const parts = [...leftParts, ...Array(missing).fill('0'), ...rightParts];
    return parts.join(':');
  }

  const parts = normalized.split(':');
  if (parts.length !== 8) return null;
  return normalized;
}

/**
 * Convert IPv6 address to 16-byte array for comparison.
 * Each byte is a separate element in the returned array.
 */
function ipv6ToBytes(ip: string): number[] | null {
  // Convert the dotted-decimal tail accepted by Node (for example
  // ::ffff:127.0.0.1) into its two hexadecimal groups before expansion.
  const dottedTail = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedTail) {
    const ipv4 = ipv4ToBytes(dottedTail[2]);
    if (!ipv4 || ipv4.some(byte => byte < 0 || byte > 255)) return null;
    ip = `${dottedTail[1]}${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }

  const expanded = expandIPv6(ip);
  if (!expanded) return null;

  const groups = expanded.split(':');
  const bytes: number[] = [];

  for (const group of groups) {
    // Pad group to 4 characters to handle abbreviated IPv6 (e.g., '0' -> '0000', '1' -> '0001')
    const paddedGroup = group.padStart(4, '0');
    const hi = parseInt(paddedGroup.substring(0, 2), 16);
    const lo = parseInt(paddedGroup.substring(2, 4), 16);
    if (isNaN(hi) || isNaN(lo)) return null;
    bytes.push(hi, lo);
  }

  return bytes;
}

/**
 * Check if an IPv4 address falls within any blocked range
 */
function isPrivateIPv4(ip: string): boolean {
  const bytes = ipv4ToBytes(ip);
  if (!bytes || bytes.some(b => b < 0 || b > 255)) return false;

  for (const range of PRIVATE_RANGES) {
    if (range.isV6) continue;
    if (bytes.every((b, i) => b >= range.start[i] && b <= range.end[i])) {
      return true;
    }
  }

  // Benchmarking, documentation, multicast, and reserved space must not be
  // reachable through a generic webhook destination.
  return (bytes[0] === 198 && bytes[1] >= 18 && bytes[1] <= 19)
    || (bytes[0] === 192 && bytes[1] === 0 && bytes[2] === 2)
    || (bytes[0] === 198 && bytes[1] === 51 && bytes[2] === 100)
    || (bytes[0] === 203 && bytes[1] === 0 && bytes[2] === 113)
    || bytes[0] >= 224
    || (bytes[0] === 192 && bytes[1] === 88 && bytes[2] === 99);
}

/**
 * Check if an IPv6 address falls within any blocked range.
 * Compares 16-byte arrays directly against PRIVATE_RANGES entries.
 */
function isPrivateIPv6(ip: string): boolean {
  const bytes = ipv6ToBytes(ip);
  if (!bytes || bytes.length !== 16) return false;

  // IPv4-compatible and IPv4-mapped IPv6 addresses can be represented with
  // either dotted-decimal or hexadecimal final groups. Inspect their bytes so
  // that forms such as ::ffff:7f00:1 cannot bypass IPv4 policy.
  const isIpv4Compatible = bytes.slice(0, 12).every(byte => byte === 0);
  const isIpv4Mapped = bytes.slice(0, 10).every(byte => byte === 0)
    && bytes[10] === 0xff && bytes[11] === 0xff;
  if (isIpv4Compatible || isIpv4Mapped) {
    return isPrivateIPv4(bytes.slice(12).join('.'));
  }

  for (const range of PRIVATE_RANGES) {
    if (!range.isV6) continue;
    if (range.start.length !== 16 || range.end.length !== 16) continue;
    if (bytes.every((b, i) => b >= range.start[i] && b <= range.end[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an IP is a cloud metadata endpoint
 */
function isCloudMetadataIP(ip: string): boolean {
  return CLOUD_METADATA_IPS.has(ip);
}

/**
 * Check if a hostname is a cloud metadata endpoint
 */
function isCloudMetadataHostname(hostname: string): boolean {
  return CLOUD_METADATA_HOSTNAMES.has(hostname.toLowerCase());
}

/**
 * Validate URL protocol
 */
function validateProtocol(url: URL): { valid: boolean; reason?: string } {
  const protocol = url.protocol.toLowerCase();
  
  if (protocol !== 'https:') {
    return { valid: false, reason: `Only HTTPS URLs are allowed. Received: ${protocol}` };
  }
  
  return { valid: true };
}

/** Validate URL authority fields that are unsafe or unsupported for delivery. */
function validateAuthority(url: URL): { valid: boolean; reason?: string } {
  if (url.username || url.password) {
    return { valid: false, reason: 'Webhook URLs must not include credentials' };
  }

  if (url.port && url.port !== '443') {
    return { valid: false, reason: 'Webhook URLs must use the default HTTPS port (443)' };
  }

  return { valid: true };
}

/**
 * Validate hostname format
 */
function validateHostname(hostname: string): { valid: boolean; reason?: string } {
  if (!hostname || hostname.length === 0) {
    return { valid: false, reason: 'Hostname cannot be empty' };
  }

  if (hostname.startsWith('.') || hostname.endsWith('.')) {
    // Trailing dot is OK for DNS, but leading dot is suspicious
    if (hostname.startsWith('.')) {
      return { valid: false, reason: 'Invalid hostname format' };
    }
  }

  // Reject bare IP addresses as URLs (should use hostname)
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return { valid: false, reason: 'Bare IP addresses are not allowed as webhook URLs. Use a hostname instead.' };
  }
  
  // IPv6
  if (/^\[[0-9a-fA-F:]+\]$/.test(hostname)) {
    return { valid: false, reason: 'Bare IPv6 addresses are not allowed as webhook URLs. Use a hostname instead.' };
  }

  // Reject non-ASCII characters (potential IDN homograph attacks)
  if (/[^a-zA-Z0-9.\-]/.test(hostname.toLowerCase())) {
    return { valid: false, reason: 'Hostname contains invalid characters' };
  }

  // Check for suspicious patterns
  if (hostname.includes('..')) {
    return { valid: false, reason: 'Hostname contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Check if an IP address is blocked
 */
function isBlockedIP(ip: string): { blocked: boolean; reason?: string } {
  if (isPrivateIPv4(ip)) {
    return { blocked: true, reason: `Blocked: ${ip} is a private/internal IP address` };
  }
  
  if (isPrivateIPv6(ip)) {
    return { blocked: true, reason: `Blocked: ${ip} is a private/internal IPv6 address` };
  }
  
  if (isCloudMetadataIP(ip)) {
    return { blocked: true, reason: `Blocked: ${ip} is a cloud metadata endpoint` };
  }
  
  return { blocked: false };
}

/**
 * Resolve hostname to IP addresses (both A and AAAA records) and check if any are blocked.
 * Uses dns.resolve4() for IPv4 (A) records and dns.resolve6() for IPv6 (AAAA) records separately,
 * then merges all resolved IPs and checks each one against the blocked list.
 *
 * Returns:
 * - blocked: true if hostname couldn't resolve or any resolved IP is private/cloud-metadata
 * - blocked: false if all IPs are public
 * - resolvedIps: list of all resolved IP addresses (both IPv4 and IPv6)
 */
export async function resolveAndCheckHostname(hostname: string): Promise<{ blocked: boolean; reason?: string; resolvedIps?: string[] }> {
  const ipv4Records: string[] = [];
  const ipv6Records: string[] = [];

  // Resolve A records (IPv4)
  try {
    const aRecords = await dns.promises.resolve4(hostname);
    ipv4Records.push(...aRecords);
  } catch {
    // Hostname may not have A records — continue to AAAA resolution
  }

  // Resolve AAAA records (IPv6)
  try {
    const aaaaRecords = await dns.promises.resolve6(hostname);
    ipv6Records.push(...aaaaRecords);
  } catch {
    // Hostname may not have AAAA records — this is fine if we have A records
  }

  // If neither resolution succeeded, the hostname couldn't be resolved
  if (ipv4Records.length === 0 && ipv6Records.length === 0) {
    return { blocked: true, reason: `Could not resolve hostname: ${hostname}` };
  }

  const allResolvedIps: string[] = [...ipv4Records, ...ipv6Records];

  // Check IPv4 addresses
  for (const ip of ipv4Records) {
    const check = isBlockedIP(ip);
    if (check.blocked) {
      return check;
    }
  }

  // Check IPv6 addresses natively (no ::ffff: prefix wrapping)
  for (const ip of ipv6Records) {
    const check = isBlockedIP(ip);
    if (check.blocked) {
      return check;
    }
  }

  return { blocked: false, resolvedIps: allResolvedIps.length > 0 ? allResolvedIps : undefined };
}

/**
 * Validate a webhook URL for SSRF protection.
 * 
 * Checks performed:
 * 1. Protocol must be HTTPS
 * 2. Hostname must be a valid domain name (not bare IP)
 * 3. Hostname must not be a cloud metadata endpoint
 * 4. Hostname must resolve to a non-private, non-cloud-metadata IP
 * 
 * @param urlString - The URL to validate
 * @returns Object with validation result and optional reason for failure
 */
export function validateWebhookUrl(urlString: string): { valid: boolean; reason?: string } {
  let url: URL;
  
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Check protocol
  const protocolCheck = validateProtocol(url);
  if (!protocolCheck.valid) {
    return protocolCheck;
  }

  const authorityCheck = validateAuthority(url);
  if (!authorityCheck.valid) {
    return authorityCheck;
  }

  // Check hostname format
  const hostname = url.hostname.replace(/\.$/, ''); // Remove trailing dot
  if (!hostname || hostname.length === 0) {
    return { valid: false, reason: 'Hostname cannot be empty' };
  }
  const hostnameCheck = validateHostname(hostname);
  if (!hostnameCheck.valid) {
    return hostnameCheck;
  }

  // Check cloud metadata hostnames
  if (isCloudMetadataHostname(url.hostname.replace(/\.$/, ''))) {
    return { valid: false, reason: 'Cloud metadata endpoints are not allowed' };
  }

  return { valid: true };
}

/**
 * Full SSRF check including DNS resolution.
 * Use this for create/update operations.
 *
 * @param urlString - The URL to validate
 * @returns Object with validation result and optional reason for failure
 */
export async function checkWebhookUrlSSRF(urlString: string): Promise<{ valid: boolean; reason?: string; resolvedIps?: string[] }> {
  const validation = validateWebhookUrl(urlString);
  if (!validation.valid) {
    return { valid: false, reason: validation.reason };
  }

  const url = new URL(urlString);
  const hostname = url.hostname.replace(/\.$/, '');

  // Resolve and check IPs
  const result = await resolveAndCheckHostname(hostname);
  return { valid: !result.blocked, reason: result.reason, resolvedIps: result.resolvedIps };
}

/**
 * Check if a URL is safe to redirect to.
 * Validates the redirect target URL.
 * 
 * @param redirectUrl - The redirect target URL
 * @returns Object with validation result and optional reason for failure
 */
export function validateRedirectUrl(redirectUrl: string): { valid: boolean; reason?: string } {
  // Redirects must also be HTTPS
  const validation = validateWebhookUrl(redirectUrl);
  if (!validation.valid) {
    return validation;
  }

  // Reject redirects to different hosts (could be SSRF via redirect)
  // Actually, we DO allow cross-host redirects as long as the target passes SSRF checks
  // The important thing is that the final destination is validated

  return { valid: true };
}

/**
 * Check if a resolved IP is safe (not private/cloud metadata).
 * Use this at delivery time for DNS rebinding protection.
 * 
 * @param ip - The IP address to check
 * @returns Object with check result and optional reason
 */
export function checkResolvedIp(ip: string): { safe: boolean; reason?: string } {
  if (net.isIP(ip) === 0) {
    return { safe: false, reason: `Blocked: ${ip} is not a valid IP address` };
  }

  const check = isBlockedIP(ip);
  if (check.blocked) {
    return { safe: false, reason: check.reason };
  }
  return { safe: true };
}

/**
 * Resolve an outbound webhook hostname at the exact moment Node opens a new
 * socket. The returned address, rather than the hostname, is passed to the
 * connection layer, closing the validation-to-connect DNS rebinding window.
 */
export async function resolveSafeWebhookAddress(
  hostname: string,
  family?: number
): Promise<{ address: string; family: 4 | 6 }> {
  const result = await resolveAndCheckHostname(hostname);
  if (result.blocked || !result.resolvedIps?.length) {
    throw new Error(result.reason || `Could not resolve hostname: ${hostname}`);
  }

  const candidates = result.resolvedIps.filter(address => {
    const addressFamily = net.isIP(address);
    return (family === 4 || family === 6) ? addressFamily === family : addressFamily === 4 || addressFamily === 6;
  });
  const address = candidates[0];
  const addressFamily = address ? net.isIP(address) : 0;
  if (!address || (addressFamily !== 4 && addressFamily !== 6)) {
    throw new Error(`No usable IPv${family || '4/6'} address resolved for hostname: ${hostname}`);
  }

  console.debug(`[Webhook] Point-of-connection DNS check passed for ${hostname}: ${address}`);
  return { address, family: addressFamily };
}

/**
 * Creates the HTTPS transport used only for webhooks. Its custom lookup pins
 * each connection to a just-validated public IP and preserves the original
 * hostname for TLS SNI/certificate validation.
 */
export function createWebhookHttpsAgent(): https.Agent {
  const lookup = (
    hostname: string,
    options: number | { family?: number },
    callback: (error: NodeJS.ErrnoException | null, address: string, family: 0 | 4 | 6) => void
  ) => {
    const family = typeof options === 'object' ? options.family : undefined;
    resolveSafeWebhookAddress(hostname, family)
      .then(({ address, family: resolvedFamily }) => callback(null, address, resolvedFamily))
      .catch(error => callback(error as NodeJS.ErrnoException, '', 0));
  };

  return new https.Agent({ lookup: lookup as never });
}
