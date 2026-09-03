/**
 * Ticket Email Gateway
 *
 * ITIL "e-mail to ticket" integration:
 *  - Inbound: polls a mailbox (IMAP with password, or Exchange Online via
 *    OAuth2 client-credentials + IMAP XOAUTH2) and converts new messages into
 *    tickets. The sender is mapped to a known user by e-mail address.
 *  - Outbound: sends confirmation / notification e-mails via SMTP
 *    (none / basic / oauth2).
 *
 * Security notes (ISO 27001 / NIS 2):
 *  - Mailbox & SMTP credentials are stored in the DB and never returned to
 *    clients (sanitized config).
 *  - Every inbound message is persisted (dedup by RFC 822 Message-ID) and the
 *    resulting ticket is audited.
 *  - Exchange OAuth2 tokens are acquired via MSAL client-credentials and
 *    cached in memory only (short-lived, never logged).
 */

import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { ticketService } from './ticket.service';
import { encrypt, decrypt } from './credentialEncryption.service';

type AnyObject = Record<string, any>;

export interface EmailGatewayConfigUpdate {
  enabled?: boolean;
  inboundProvider?: 'imap' | 'exchange';
  imapHost?: string | null;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string | null;
  imapPassword?: string | null;
  imapMailbox?: string | null;
  imapAuthType?: 'password' | 'oauth2';
  exchangeTenantId?: string | null;
  exchangeClientId?: string | null;
  exchangeClientSecretRef?: string | null;
  exchangeScopes?: string | null;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpAuthType?: 'none' | 'basic' | 'oauth2';
  smtpFromEmail?: string | null;
  smtpRejectUnauthorized?: boolean;
  pollIntervalMinutes?: number;
  subjectPrefix?: string | null;
  defaultTicketType?: string | null;
  autoAssignToEmail?: string | null;
}

const PASSWORD_PLACEHOLDERS = new Set(['', '********', '••••••••', '__KEEP_EXISTING__']);
const MAX_MESSAGES_PER_POLL = 100;

// In-memory Exchange OAuth2 token cache (short-lived, never persisted in clear
// beyond the config's cached access token which is rotated every poll).
const msalTokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

/**
 * Resolve a `env:VAR` or `file:PATH` secret reference without echoing the value.
 *
 * SECURITY FIX (Problems 6 & 7):
 * - Problem 6: Added explicit try/catch for file system errors.
 * - Problem 7: Replaced synchronous `fs.readFileSync` with async `fs.promises.readFile`
 *   to prevent blocking the Node.js event loop.
 */
async function resolveSecretRef(ref: string): Promise<string> {
  if (!ref) throw new AppError('Secret reference is required', 400);
  if (ref.startsWith('env:')) {
    const key = ref.slice(4);
    const value = process.env[key];
    if (!value) throw new AppError(`Secret environment variable ${key} is not configured`, 400);
    return value;
  }
  if (ref.startsWith('file:')) {
    const rawPath = ref.slice(5);
    if (!rawPath) throw new AppError('Secret file path is required', 400);
    // SECURITY FIX (Problem 3): Canonicalize path to prevent directory traversal attacks.
    // Use path.normalize() to resolve '..' and '.' segments, then verify the resolved
    // path starts with the intended base directory (current working directory).
    const path = await import('path');
    const basePath = path.resolve(process.cwd());
    const resolvedPath = path.resolve(basePath, rawPath);
    // Ensure the resolved path is within the base directory (prevent traversal outside)
    if (!resolvedPath.startsWith(basePath)) {
      throw new AppError('Invalid secret file path: access outside allowed directory', 400);
    }
    try {
      const fsPromises = await import('fs/promises');
      const value = await fsPromises.readFile(resolvedPath, 'utf8');
      return value.trim();
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new AppError(`Secret file not found: ${resolvedPath}`, 400);
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EACCES') {
        throw new AppError(`Permission denied reading secret file: ${resolvedPath}`, 400);
      }
      throw new AppError(`Failed to read secret file: ${resolvedPath}`, 500);
    }
  }
  throw new AppError('Secret reference must use env: or file: provider', 400);
}

/** Acquire an Exchange Online (Microsoft) OAuth2 access token via MSAL. */
async function acquireExchangeToken(config: AnyObject): Promise<string> {
  const clientId = config.exchangeClientId;
  const tenantId = config.exchangeTenantId;
  const scopes = config.exchangeScopes || 'https://outlook.office365.com/.default';
  if (!clientId || !tenantId || !config.exchangeClientSecretRef) {
    throw new AppError('Exchange tenant, client id and client secret reference are required', 400);
  }
  const cached = msalTokenCache.get(clientId);
  if (cached && cached.expiresAt - Date.now() > 300_000) return cached.accessToken;

  const clientSecret = await resolveSecretRef(config.exchangeClientSecretRef);
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
    system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => undefined } },
  });
  const result = await cca.acquireTokenByClientCredential({ scopes: [scopes] });
  if (!result?.accessToken) throw new AppError('MSAL did not return an access token', 502);
  msalTokenCache.set(clientId, {
    accessToken: result.accessToken,
    expiresAt: (result.expiresOn ?? new Date(Date.now() + 3600_000)).getTime(),
  });
  return result.accessToken;
}

/** Map a mailbox address (e-mail) to a known user, case-insensitively. */
async function resolveUserByEmail(email: string | null | undefined): Promise<AnyObject | null> {
  if (!email) return null;
  // SECURITY FIX (Problem 5): Use Prisma $queryRaw with LOWER() for portable
  // case-insensitive email lookup. Prisma's `mode: 'insensitive'` relies on
  // database collation which may be case-sensitive on some configurations,
  // causing lookups to fail silently.
  const users = await prisma.$queryRaw`
    SELECT id, email, "firstName", "lastName", "isActive"
    FROM "User"
    WHERE LOWER(email) = LOWER(${email})
    AND "isActive" = true
    LIMIT 1
  `;
  const user = Array.isArray(users) ? (users[0] as AnyObject) ?? null : null;
  return user;
}
export class EmailGatewayService {
  private sanitizeConfig(config: AnyObject | null) {
    if (!config) return null;
    const { imapPassword: _ip, smtpPassword: _sp, exchangeClientSecretRef: _ecsr, ...safe } = config;
    return {
      ...safe,
      imapPasswordConfigured: Boolean(config.imapPassword),
      smtpPasswordConfigured: Boolean(config.smtpPassword),
      exchangeClientSecretRefConfigured: Boolean(config.exchangeClientSecretRef),
    };
  }

  private async ensureConfig(): Promise<AnyObject> {
    const existing = await (prisma as any).emailGatewayConfig.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    return (prisma as any).emailGatewayConfig.create({ data: { enabled: false } });
  }

  async getConfig(): Promise<AnyObject | null> {
    return this.sanitizeConfig(await this.ensureConfig());
  }

  // ---- Credential encryption helpers -------------------------------------

  /**
   * Encrypt sensitive credentials before storing them in the database.
   * Skips encryption if the value is already encrypted (valid base64 format) or a placeholder.
   */
  private encryptIfNeeded(value: string): string {
    if (value === '' || PASSWORD_PLACEHOLDERS.has(value)) return value;
    // Check if already encrypted by testing format (base64, sufficient length)
    try {
      const buffer = Buffer.from(value, 'base64');
      if (buffer.length >= 50) {
        // Likely encrypted — return as-is to avoid double-encryption
        return value;
      }
    } catch {
      // Not base64, definitely plaintext
    }
    return encrypt(value);
  }

  /**
   * Decrypt a credential stored in the database for runtime use.
   * Returns the value as-is if decryption fails (backward compatibility with
   * plaintext values during migration).
   */
  private decryptIfNeeded(value: string | undefined | null): string | null {
    if (value === undefined || value === null) return null;
    if (value === '' || PASSWORD_PLACEHOLDERS.has(value)) return value;
    try {
      return decrypt(value);
    } catch {
      // Decryption failed — value is likely plaintext (pre-encryption storage).
      // Return as-is for backward compatibility during migration.
      return value;
    }
  }

  async updateConfig(data: EmailGatewayConfigUpdate, userId = 'system'): Promise<AnyObject> {
    const existing = await this.ensureConfig();
    const updateData: AnyObject = {};
    const str = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    if (data.enabled !== undefined) updateData.enabled = Boolean(data.enabled);
    if (data.inboundProvider !== undefined) {
      if (!['imap', 'exchange'].includes(data.inboundProvider)) throw new AppError('inboundProvider must be imap or exchange', 400);
      updateData.inboundProvider = data.inboundProvider;
    }
    if (data.imapHost !== undefined) updateData.imapHost = str(data.imapHost);
    if (data.imapPort !== undefined) {
      const port = Number(data.imapPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new AppError('imapPort must be between 1 and 65535', 400);
      updateData.imapPort = port;
    }
    if (data.imapSecure !== undefined) updateData.imapSecure = Boolean(data.imapSecure);
    if (data.imapUser !== undefined) updateData.imapUser = str(data.imapUser);
    if (data.imapPassword !== undefined && data.imapPassword !== null && !PASSWORD_PLACEHOLDERS.has(String(data.imapPassword))) {
      updateData.imapPassword = this.encryptIfNeeded(data.imapPassword);
    }
    if (data.imapMailbox !== undefined) updateData.imapMailbox = str(data.imapMailbox);
    if (data.imapAuthType !== undefined) {
      if (!['password', 'oauth2'].includes(data.imapAuthType)) throw new AppError('imapAuthType must be password or oauth2', 400);
      updateData.imapAuthType = data.imapAuthType;
    }
    if (data.exchangeTenantId !== undefined) updateData.exchangeTenantId = str(data.exchangeTenantId);
    if (data.exchangeClientId !== undefined) updateData.exchangeClientId = str(data.exchangeClientId);
    if (data.exchangeClientSecretRef !== undefined) updateData.exchangeClientSecretRef = str(data.exchangeClientSecretRef);
    if (data.exchangeScopes !== undefined) updateData.exchangeScopes = str(data.exchangeScopes);
    if (data.smtpHost !== undefined) updateData.smtpHost = str(data.smtpHost);
    if (data.smtpPort !== undefined) {
      const port = Number(data.smtpPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new AppError('smtpPort must be between 1 and 65535', 400);
      updateData.smtpPort = port;
    }
    if (data.smtpSecure !== undefined) updateData.smtpSecure = Boolean(data.smtpSecure);
    if (data.smtpUser !== undefined) updateData.smtpUser = str(data.smtpUser);
    if (data.smtpPassword !== undefined && data.smtpPassword !== null && !PASSWORD_PLACEHOLDERS.has(String(data.smtpPassword))) {
      updateData.smtpPassword = this.encryptIfNeeded(data.smtpPassword);
    }
    if (data.smtpAuthType !== undefined) {
      if (!['none', 'basic', 'oauth2'].includes(data.smtpAuthType)) throw new AppError('smtpAuthType must be none, basic or oauth2', 400);
      updateData.smtpAuthType = data.smtpAuthType;
    }
    if (data.smtpFromEmail !== undefined) updateData.smtpFromEmail = str(data.smtpFromEmail);
    if (data.smtpRejectUnauthorized !== undefined) updateData.smtpRejectUnauthorized = Boolean(data.smtpRejectUnauthorized);
    if (data.pollIntervalMinutes !== undefined) {
      const interval = Number(data.pollIntervalMinutes);
      if (!Number.isInteger(interval) || interval < 1 || interval > 1440) throw new AppError('pollIntervalMinutes must be between 1 and 1440', 400);
      updateData.pollIntervalMinutes = interval;
    }
    if (data.subjectPrefix !== undefined) updateData.subjectPrefix = str(data.subjectPrefix);
    if (data.defaultTicketType !== undefined) {
      if (!data.defaultTicketType || !['incident', 'service_request', 'problem', 'change'].includes(data.defaultTicketType)) throw new AppError('defaultTicketType is not a supported ticket type', 400);
      updateData.defaultTicketType = data.defaultTicketType;
    }
    if (data.autoAssignToEmail !== undefined) updateData.autoAssignToEmail = str(data.autoAssignToEmail);
    updateData.updatedBy = userId;

    const updated = await (prisma as any).emailGatewayConfig.update({ where: { id: existing.id }, data: updateData });
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'EmailGatewayConfig',
      entityId: updated.id,
      details: 'Updated e-mail gateway (IMAP/Exchange/SMTP) settings',
      oldValue: this.sanitizeConfig(existing) as any,
      newValue: this.sanitizeConfig(updated) as any,
    });
    return this.sanitizeConfig(updated) as AnyObject;
  }

  // ---- Inbound mailbox (IMAP / Exchange OAuth2) ---------------------------

  private buildImapClient(config: AnyObject, accessToken?: string): ImapFlow {
    // Decrypt password for runtime use (backward compatible with plaintext)
    const decryptedPassword = this.decryptIfNeeded(config.imapPassword);
    const auth: any =
      accessToken || config.imapAuthType === 'oauth2'
        ? { user: config.imapUser ?? '', accessToken: accessToken ?? '' }
        : { user: config.imapUser ?? '', pass: decryptedPassword ?? '' };
    return new ImapFlow({
      host: config.imapHost,
      port: config.imapPort ?? 993,
      secure: config.imapSecure !== false,
      auth,
      logger: false,
      // SECURITY FIX (Problem 6): Use a separate tlsRejectUnauthorized config option
      // instead of tying certificate validation to TLS enablement (imapSecure).
      // TLS can be enabled (STARTTLS) while still rejecting invalid certificates.
      tls: { rejectUnauthorized: config.tlsRejectUnauthorized !== false },
    });
  }

  /** Connect to the configured mailbox and report the unread count. */
  async testInbound(): Promise<AnyObject> {
    const config = await this.ensureConfig();
    if (!config.enabled && !config.imapHost && !config.exchangeClientId) {
      throw new AppError('Mailbox is not configured', 400);
    }
    let accessToken: string | undefined;
    if (config.inboundProvider === 'exchange') {
      accessToken = await acquireExchangeToken(config);
    }
    const client = this.buildImapClient(config, accessToken);
    try {
      await client.connect();
      const mailbox = await client.mailboxOpen(config.imapMailbox || 'INBOX', { readOnly: true });
      const total = await client.search({ all: true }, { uid: false });
      const count = Array.isArray(total) ? total.length : 0;
      return { ok: true, provider: config.inboundProvider, mailbox: mailbox.path, messages: count, unseen: mailbox.unseen ?? 0 };
    } finally {
      try { await client.logout(); } catch { /* already disconnected */ }
    }
  }

  /**
   * Poll the mailbox for new messages and convert each into a ticket.
   * Returns a summary of processed / skipped / failed messages.
   */
  async pollInbound(actorId = 'email-gateway'): Promise<AnyObject> {
    const config = await this.ensureConfig();
    if (!config.enabled) return { ok: false, skipped: true, reason: 'gateway disabled' };

    let accessToken: string | undefined;
    if (config.inboundProvider === 'exchange') {
      accessToken = await acquireExchangeToken(config);
    }
    const client = this.buildImapClient(config, accessToken);
    const summary = { ok: true, provider: config.inboundProvider, processed: 0, skipped: 0, failed: 0, tickets: [] as string[] };
    try {
      await client.connect();
      const mailboxName = config.imapMailbox || 'INBOX';
      const lock = await client.getMailboxLock(mailboxName);
      try {
        // Lightweight envelope pass to collect candidate Message-IDs.
        const envelopes: AnyObject[] = [];
        for await (const msg of client.fetch('1:*', { uid: true, envelope: true })) {
          envelopes.push({ uid: msg.uid, envelope: msg.envelope });
        }
        // Only consider the most recent messages to bound work per poll.
        const candidates = envelopes.slice(-MAX_MESSAGES_PER_POLL);
        // SECURITY FIX (Problem 4): Scope deduplication query to recent messages only
        // (last 24 hours) instead of loading ALL email messages into memory. This prevents
        // unbounded memory growth as the email message table grows over time.
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        const recentMessages = await (prisma as any).emailMessage.findMany({
          where: {
            messageId: { not: null },
            receivedAt: { gte: cutoffTime },
          },
          select: { id: true, messageId: true, status: true },
        });
        const existingMessages = new Map<string, AnyObject>(
          recentMessages.map((message: AnyObject): [string, AnyObject] => [message.messageId, message]),
        );

        for (const { uid, envelope } of candidates) {
          const messageId = envelope?.messageId ?? null;
          const existingMessage = messageId ? existingMessages.get(messageId) : null;
          if (existingMessage?.status === 'processed') {
            summary.skipped += 1;
            continue;
          }
          let message: AnyObject | null = existingMessage ?? null;
          try {
            const fetched = await client.fetchOne(String(uid), { source: true }, { uid: true });
            if (!fetched) throw new AppError('Unable to fetch inbound message source', 502);
            const parsed = await simpleParser(fetched.source as Buffer);
            const from = parsed.from?.value?.[0];
            const fromEmail = from?.address ?? '';
            const subject = (parsed.subject || '(no subject)').trim();
            const bodyText = (parsed.text || '').trim();
            const inReplyTo = (parsed.inReplyTo || '').trim() || null;
            const receivedAt = parsed.date ? new Date(parsed.date) : new Date();

            // Persist the message before processing. Failed records are reused on retry.
            const messageData = {
              inReplyTo,
              fromEmail,
              fromName: from?.name ?? null,
              toEmail: (Array.isArray(parsed.to) ? parsed.to[0] : parsed.to)?.value?.[0]?.address ?? null,
              subject,
              bodyText: bodyText.slice(0, 20000),
              bodyHtml: parsed.html ? String(parsed.html).slice(0, 20000) : null,
              receivedAt,
              direction: 'inbound',
              status: 'received',
              error: null,
            };
            message = message
              ? await (prisma as any).emailMessage.update({ where: { id: message.id }, data: messageData })
              : await (prisma as any).emailMessage.create({ data: { messageId: messageId || undefined, ...messageData } });
            if (!message) throw new AppError('Unable to persist inbound message', 500);

            // Reply to an existing ticket? (In-Reply-To points at our ticket id.)
            const replyTicketId = this.extractTicketIdFromReply(inReplyTo, subject);
            if (replyTicketId) {
              const existing = await (prisma as any).ticket.findUnique({ where: { displayId: replyTicketId } });
              if (existing) {
                await ticketService.comment(existing.id, { body: this.formatIncomingReply(from, subject, bodyText), isInternal: true }, actorId);
                await (prisma as any).emailMessage.update({ where: { id: message.id }, data: { status: 'processed', ticketId: existing.id, error: null } });
                summary.processed += 1;
                continue;
              }
            }

            // Convert to a new ticket.
            const user = await resolveUserByEmail(fromEmail);
            const ticketType = config.defaultTicketType || 'incident';
            const prefix = config.subjectPrefix || '';
            const title = subject.replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*`, 'i'), '').trim() || subject;

            const assigneeId = await this.resolveAutoAssign(config);
            const ticket = await ticketService.create(
              {
                type: ticketType,
                title,
                description: this.buildTicketDescription(from, subject, bodyText, inReplyTo),
                requesterId: user?.id ?? null,
                assigneeId,
                urgency: 'medium',
                impact: 'medium',
              },
              user?.id ?? actorId,
            );

            await (prisma as any).emailMessage.update({
              where: { id: message.id },
              data: { status: 'processed', ticketId: ticket.id, userId: user?.id ?? null },
            });
            await auditService.logEventStandalone(prisma, {
              userId: actorId,
              action: 'EMAIL_TO_TICKET',
              entityType: 'Ticket',
              entityId: ticket.id,
              details: `Created ${ticket.displayId} from e-mail from ${fromEmail || 'unknown'}`,
            });
            summary.processed += 1;
            summary.tickets.push(ticket.displayId);

            // Best-effort confirmation to the sender (does not block the poll).
            await this.sendConfirmation(ticket, fromEmail).catch((e) => {
              console.error('[EmailGateway] confirmation failed:', e.message);
            });
          } catch (error) {
            summary.failed += 1;
            const messageText = error instanceof Error ? error.message : 'Unknown inbound message processing error';
            if (message) {
              await (prisma as any).emailMessage.update({
                where: { id: message.id },
                data: { status: 'failed', error: messageText.slice(0, 2000) },
              }).catch(() => undefined);
            }
            console.error('[EmailGateway] failed to process message', error);
          }
        }
      } finally {
        try { lock.release(); } catch { /* lock already released */ }
      }
    } finally {
      try { await client.logout(); } catch { /* already disconnected */ }
    }

    await (prisma as any).emailGatewayConfig.update({
      where: { id: config.id },
      data: { lastPollAt: new Date(), lastPollStatus: 'ok', lastPollMessage: `processed=${summary.processed} skipped=${summary.skipped} failed=${summary.failed}` },
    });
    return summary;
  }

  private extractTicketIdFromReply(inReplyTo: string | null, subject: string): string | null {
    // Our confirmation e-mails embed the ticket id in the subject, e.g.
    // "[ITSM] TCKT-0001: <original subject>".
    const m = subject.match(/\b(TCKT-\d+)\b/i);
    if (m) return m[1];
    if (inReplyTo) {
      const r = inReplyTo.match(/\b(TCKT-\d+)\b/i);
      if (r) return r[1];
    }
    return null;
  }

  private async resolveAutoAssign(config: AnyObject): Promise<string | null> {
    if (!config.autoAssignToEmail) return null;
    const user = await resolveUserByEmail(config.autoAssignToEmail);
    return user?.id ?? null;
  }

  private formatIncomingReply(from: AnyObject | undefined, subject: string, bodyText: string): string {
    const sender = from ? `${from.name ? from.name + ' ' : ''}<${from.address}>` : 'unknown';
    return `Incoming e-mail reply from ${sender}\nSubject: ${subject}\n\n${bodyText}`;
  }

  private buildTicketDescription(from: AnyObject | undefined, subject: string, bodyText: string, inReplyTo: string | null): string {
    const sender = from ? `${from.name ? from.name + ' ' : ''}<${from.address}>` : 'unknown sender';
    const lines = [
      `Reported by e-mail from: ${sender}`,
      `Original subject: ${subject}`,
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
      '',
      '--- Message body ---',
      bodyText || '(no body text)',
    ];
    return lines.filter((l) => l !== null).join('\n');
  }

  // ---- Outbound SMTP ------------------------------------------------------

  private buildSmtpTransport(config: AnyObject, accessToken?: string): nodemailer.Transporter {
    // Decrypt password for runtime use (backward compatible with plaintext)
    const decryptedPassword = this.decryptIfNeeded(config.smtpPassword);
    const options: AnyObject = {
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: Boolean(config.smtpSecure),
      tls: { rejectUnauthorized: config.smtpRejectUnauthorized !== false, minVersion: 'TLSv1.2' },
    };
    const authType = config.smtpAuthType || 'none';
    if (authType === 'basic' && (config.smtpUser || decryptedPassword)) {
      options.auth = { user: config.smtpUser ?? '', pass: decryptedPassword ?? '' };
    } else if (authType === 'oauth2' && accessToken) {
      options.auth = { type: 'OAUTH2', accessToken };
    }
    return nodemailer.createTransport(options);
  }

  async testSmtp(): Promise<AnyObject> {
    const config = await this.ensureConfig();
    if (!config.smtpHost) throw new AppError('SMTP host is not configured', 400);
    let accessToken: string | undefined;
    if (config.smtpAuthType === 'oauth2') {
      if (!config.exchangeClientId || !config.exchangeTenantId) throw new AppError('SMTP OAuth2 requires Exchange tenant and client id', 400);
      accessToken = await acquireExchangeToken(config);
    }
    const transport = this.buildSmtpTransport(config, accessToken);
    try {
      await transport.verify();
      return { ok: true, host: config.smtpHost, port: config.smtpPort };
    } catch (error) {
      throw new AppError(`SMTP verification failed: ${(error as Error).message}`, 502);
    }
  }

  /** Send a ticket confirmation e-mail to the requester (best-effort). */
  async sendConfirmation(ticket: AnyObject, toEmail: string | null): Promise<boolean> {
    const config = await this.ensureConfig();
    if (!config.smtpHost || !toEmail) return false;
    let accessToken: string | undefined;
    if (config.smtpAuthType === 'oauth2') {
      if (!config.exchangeClientId || !config.exchangeTenantId) return false;
      accessToken = await acquireExchangeToken(config);
    }
    const transport = this.buildSmtpTransport(config, accessToken);
    const prefix = config.subjectPrefix || '';
    await transport.sendMail({
      from: config.smtpFromEmail ? `"ITSM" <${config.smtpFromEmail}>` : undefined,
      to: toEmail,
      subject: `${prefix} ${ticket.displayId}: ${ticket.title}`,
      text: `Your ticket ${ticket.displayId} has been created.\n\nTitle: ${ticket.title}\nStatus: ${ticket.status}\nPriority: ${ticket.priority}\n\nYou can reply to this e-mail to add a comment to the ticket.`,
    });
    await (prisma as any).emailMessage.create({
      data: {
        fromEmail: config.smtpFromEmail ?? 'itsm',
        toEmail,
        subject: `${prefix} ${ticket.displayId}: ${ticket.title}`,
        bodyText: `Confirmation for ${ticket.displayId}`,
        direction: 'outbound',
        status: 'processed',
        ticketId: ticket.id,
      },
    });
    return true;
  }

  // ---- Audit trail --------------------------------------------------------

  async listMessages(limit = 50): Promise<AnyObject[]> {
    return (prisma as any).emailMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: { ticket: { select: { id: true, displayId: true, title: true, status: true } } },
    });
  }

  async lastPollStatus(): Promise<AnyObject | null> {
    const config = await this.ensureConfig();
    return {
      lastPollAt: config.lastPollAt,
      lastPollStatus: config.lastPollStatus,
      lastPollMessage: config.lastPollMessage,
      enabled: config.enabled,
      provider: config.inboundProvider,
    };
  }
}

export const emailGatewayService = new EmailGatewayService();
