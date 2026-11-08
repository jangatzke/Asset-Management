/**
 * Shared types and safe default-state helpers for the Ticket E-mail Gateway
 * admin screen.
 *
 * SECURITY: secret values (IMAP password, SMTP password, Exchange client secret
 * reference) are never stored in `GatewayConfig`. The backend strips them from
 * every config response; the UI keeps them in separate "draft" state and only
 * sends a value when the admin explicitly enters or replaces a secret.
 */

export type InboundProvider = 'imap' | 'exchange';
export type ImapAuthType = 'password' | 'oauth2';
export type SmtpAuthType = 'none' | 'basic' | 'oauth2';
export type SecretKey = 'imapPassword' | 'smtpPassword' | 'exchangeClientSecretRef';

export interface GatewayConfig {
  enabled: boolean;
  inboundProvider: InboundProvider;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapMailbox: string;
  imapAuthType: ImapAuthType;
  exchangeTenantId: string;
  exchangeClientId: string;
  exchangeScopes: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpAuthType: SmtpAuthType;
  smtpFromEmail: string;
  smtpRejectUnauthorized: boolean;
  pollIntervalMinutes: number;
  subjectPrefix: string;
  defaultTicketType: string;
  autoAssignToEmail: string;
}

/** Flags derived from the sanitized backend config (secret values are absent). */
export interface SecretConfigured {
  imapPassword: boolean;
  smtpPassword: boolean;
  exchangeClientSecretRef: boolean;
}

/** Draft values typed by the admin; empty means "do not send". */
export type SecretDrafts = Record<SecretKey, string>;

export interface GatewayEmailMessage {
  id: string;
  receivedAt?: string | null;
  fromEmail?: string | null;
  subject?: string | null;
  status?: string | null;
  ticket?: { displayId?: string | null } | null;
}

export interface GatewayStatus {
  lastPollAt?: string | null;
  lastPollMessage?: string | null;
}

export const initialConfig: GatewayConfig = {
  enabled: false,
  inboundProvider: 'imap',
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  imapUser: '',
  imapMailbox: 'INBOX',
  imapAuthType: 'password',
  exchangeTenantId: '',
  exchangeClientId: '',
  exchangeScopes: 'https://outlook.office365.com/.default',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpAuthType: 'none',
  smtpFromEmail: '',
  smtpRejectUnauthorized: true,
  pollIntervalMinutes: 5,
  subjectPrefix: '[ITSM]',
  defaultTicketType: 'incident',
  autoAssignToEmail: '',
};

export const emptySecretConfigured: SecretConfigured = {
  imapPassword: false,
  smtpPassword: false,
  exchangeClientSecretRef: false,
};

export const emptySecretDrafts: SecretDrafts = {
  imapPassword: '',
  smtpPassword: '',
  exchangeClientSecretRef: '',
};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Map a sanitized config response onto the typed form state. */
export function toGatewayConfig(raw: unknown): GatewayConfig {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: asBoolean(data.enabled, initialConfig.enabled),
    inboundProvider: data.inboundProvider === 'exchange' ? 'exchange' : 'imap',
    imapHost: asString(data.imapHost),
    imapPort: asNumber(data.imapPort, initialConfig.imapPort),
    imapSecure: asBoolean(data.imapSecure, initialConfig.imapSecure),
    imapUser: asString(data.imapUser),
    imapMailbox: asString(data.imapMailbox, initialConfig.imapMailbox),
    imapAuthType: data.imapAuthType === 'oauth2' ? 'oauth2' : 'password',
    exchangeTenantId: asString(data.exchangeTenantId),
    exchangeClientId: asString(data.exchangeClientId),
    exchangeScopes: asString(data.exchangeScopes, initialConfig.exchangeScopes),
    smtpHost: asString(data.smtpHost),
    smtpPort: asNumber(data.smtpPort, initialConfig.smtpPort),
    smtpSecure: asBoolean(data.smtpSecure, initialConfig.smtpSecure),
    smtpUser: asString(data.smtpUser),
    smtpAuthType:
      data.smtpAuthType === 'basic' || data.smtpAuthType === 'oauth2' ? data.smtpAuthType : 'none',
    smtpFromEmail: asString(data.smtpFromEmail),
    smtpRejectUnauthorized: asBoolean(data.smtpRejectUnauthorized, initialConfig.smtpRejectUnauthorized),
    pollIntervalMinutes: asNumber(data.pollIntervalMinutes, initialConfig.pollIntervalMinutes),
    subjectPrefix: asString(data.subjectPrefix, initialConfig.subjectPrefix),
    defaultTicketType: asString(data.defaultTicketType, initialConfig.defaultTicketType),
    autoAssignToEmail: asString(data.autoAssignToEmail),
  };
}

/** Read the `*Configured` flags emitted by the backend sanitizer. */
export function toSecretConfigured(raw: unknown): SecretConfigured {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    imapPassword: Boolean(data.imapPasswordConfigured),
    smtpPassword: Boolean(data.smtpPasswordConfigured),
    exchangeClientSecretRef: Boolean(data.exchangeClientSecretRefConfigured),
  };
}
