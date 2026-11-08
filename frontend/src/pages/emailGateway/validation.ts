/**
 * Client-side validation for the Ticket E-mail Gateway admin screen.
 *
 * Mirrors the backend `EmailGatewayConfigUpdateSchema`
 * (`shared/src/dtos/index.ts`) so the admin gets inline feedback before submit:
 *
 *  - host shape      (`imapHost`, `smtpHost`)
 *  - email format    (`smtpFromEmail`, `autoAssignToEmail`)
 *  - integer ports   (`imapPort`, `smtpPort` 1..65535)
 *  - poll interval   (`pollIntervalMinutes` 1..1440)
 *  - secret-ref shape (`env:VAR` / relative `file:` path; no absolute/traversal)
 *  - provider-specific requirements
 *  - IMAP OAuth2 only with `inboundProvider === 'exchange'`
 *
 * Messages are i18n keys (resolved by the page with `t()`) so all four locales
 * share the same validation rules. `fieldErrors` returned by this module are
 * keyed by backend field name, matching the structured 400 `details` payload.
 */

import type { GatewayConfig, ImapAuthType, SecretKey } from './types';

export type EmailGatewayField =
  | 'inboundProvider'
  | 'imapHost'
  | 'imapPort'
  | 'imapSecure'
  | 'imapUser'
  | 'imapMailbox'
  | 'imapAuthType'
  | 'imapPassword'
  | 'exchangeTenantId'
  | 'exchangeClientId'
  | 'exchangeClientSecretRef'
  | 'exchangeScopes'
  | 'smtpHost'
  | 'smtpPort'
  | 'smtpSecure'
  | 'smtpAuthType'
  | 'smtpUser'
  | 'smtpPassword'
  | 'smtpFromEmail'
  | 'pollIntervalMinutes'
  | 'subjectPrefix'
  | 'defaultTicketType'
  | 'autoAssignToEmail';

export type ValidationMessage = string;
export type ValidationErrors = Partial<Record<EmailGatewayField, ValidationMessage>>;

/** Default ports for the common providers, used to pre-fill when blank. */
export const HOST_PATTERN = /^[A-Za-z0-9.:-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isBlank = (value: string): boolean => value.trim() === '';

export function validateEmail(value: string): ValidationMessage | undefined {
  if (isBlank(value)) return undefined;
  return EMAIL_PATTERN.test(value.trim()) ? undefined : 'emailGateway.validation.email';
}

export function validateHost(value: string): ValidationMessage | undefined {
  if (isBlank(value)) return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 253) return 'emailGateway.validation.hostLength';
  return HOST_PATTERN.test(trimmed) ? undefined : 'emailGateway.validation.host';
}

export function validatePort(value: number): ValidationMessage | undefined {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return 'emailGateway.validation.port';
  }
  return undefined;
}

export function validatePollInterval(value: number): ValidationMessage | undefined {
  if (!Number.isInteger(value) || value < 1 || value > 1440) {
    return 'emailGateway.validation.pollInterval';
  }
  return undefined;
}

/**
 * Validate an `env:`/`file:` secret reference (the backend `SecretReferenceSchema`
 * shape). Returns an i18n key describing the failure, or `undefined` if valid.
 */
export function validateSecretReference(value: string): ValidationMessage | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'emailGateway.validation.secretRefRequired';
  if (trimmed.length > 500) return 'emailGateway.validation.secretRefLength';

  if (trimmed.startsWith('env:')) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed.slice(4))
      ? undefined
      : 'emailGateway.validation.secretRefEnv';
  }

  if (trimmed.startsWith('file:')) {
    const raw = trimmed.slice(5).replace(/\\/g, '/');
    if (!raw) return 'emailGateway.validation.secretRefFile';
    if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) return 'emailGateway.validation.secretRefAbsolute';
    return raw.split('/').some((segment) => segment === '..')
      ? 'emailGateway.validation.secretRefTraversal'
      : undefined;
  }

  return 'emailGateway.validation.secretRefPrefix';
}

/**
 * Validate only the secret draft values the admin explicitly typed. Empty
 * drafts mean "leave the stored secret untouched" and are never flagged.
 */
export function validateSecretDrafts(
  drafts: Record<SecretKey, string>,
): ValidationErrors {
  const errors: ValidationErrors = {};

  const imap = drafts.imapPassword.trim();
  if (imap.startsWith('env:') || imap.startsWith('file:')) {
    const message = validateSecretReference(imap);
    if (message) errors.imapPassword = message;
  }

  const smtp = drafts.smtpPassword.trim();
  if (smtp.startsWith('env:') || smtp.startsWith('file:')) {
    const message = validateSecretReference(smtp);
    if (message) errors.smtpPassword = message;
  }

  const exchange = drafts.exchangeClientSecretRef.trim();
  if (exchange) {
    const message = validateSecretReference(exchange);
    if (message) errors.exchangeClientSecretRef = message;
  }

  return errors;
}

export interface ValidationOptions {
  /** IMAP settings are only relevant for the `imap` provider. */
  config: GatewayConfig;
  /** Whether a secret already exists for the given key (backend *Configured flag). */
  imapPasswordConfigured: boolean;
  smtpPasswordConfigured: boolean;
  exchangeClientSecretRefConfigured: boolean;
  /** Draft secret values typed by the admin (not the stored secrets). */
  drafts: Record<SecretKey, string>;
}

/**
 * Full client-side validation run for the current form state.
 *
 * Returns labels for both inline feedback and the summarized alert region.
 * Fields that are provider/authentication-independent (poll interval, subject
 * prefix) are validated regardless of provider.
 */
export function validateGatewayConfig(options: ValidationOptions): ValidationErrors {
  const { config, drafts } = options;
  const errors: ValidationErrors = {};

  const pollInterval = validatePollInterval(config.pollIntervalMinutes);
  if (pollInterval) errors.pollIntervalMinutes = pollInterval;

  if (config.inboundProvider === 'imap') {
    const imapHost = validateHost(config.imapHost);
    if (imapHost) errors.imapHost = imapHost;

    const imapPort = validatePort(config.imapPort);
    if (imapPort) errors.imapPort = imapPort;

    const imapUser = config.imapUser.trim();
    if (!imapUser) {
      errors.imapUser = 'emailGateway.validation.required';
    } else if (!EMAIL_PATTERN.test(imapUser)) {
      errors.imapUser = 'emailGateway.validation.email';
    }

    if (isBlank(config.imapMailbox)) errors.imapMailbox = 'emailGateway.validation.required';
    if (!config.imapSecure) errors.imapSecure = 'emailGateway.validation.tlsRequired';

    const imapPassword = drafts.imapPassword.trim();
    if (config.imapAuthType === 'password' && !options.imapPasswordConfigured && !imapPassword) {
      errors.imapPassword = 'emailGateway.validation.required';
    }
    if (config.imapAuthType === 'oauth2') {
      // Inside the IMAP branch the provider is always `imap`, so OAuth2 is
      // always restricted here; keep the guard explicit for clarity.
      errors.imapAuthType = 'emailGateway.validation.imapOauth2Restricted';
    }
  }

  if (config.inboundProvider === 'exchange') {
    if (isBlank(config.exchangeTenantId)) errors.exchangeTenantId = 'emailGateway.validation.required';
    if (isBlank(config.exchangeClientId)) errors.exchangeClientId = 'emailGateway.validation.required';

    const exchangeSecret = drafts.exchangeClientSecretRef.trim();
    if (!options.exchangeClientSecretRefConfigured && !exchangeSecret) {
      errors.exchangeClientSecretRef = 'emailGateway.validation.secretRefRequired';
    } else if (exchangeSecret) {
      const message = validateSecretReference(exchangeSecret);
      if (message) errors.exchangeClientSecretRef = message;
    }

    if (isBlank(config.exchangeScopes)) errors.exchangeScopes = 'emailGateway.validation.required';
  }

  // Outbound SMTP: host/port/from are required when SMTP auth is not `none`.
  const smtpHost = validateHost(config.smtpHost);
  if (smtpHost) errors.smtpHost = smtpHost;

  const smtpPort = validatePort(config.smtpPort);
  if (smtpPort) errors.smtpPort = smtpPort;

  const smtpFromEmail = validateEmail(config.smtpFromEmail);
  if (smtpFromEmail) errors.smtpFromEmail = smtpFromEmail;

  const autoAssign = validateEmail(config.autoAssignToEmail);
  if (autoAssign) errors.autoAssignToEmail = autoAssign;

  if (config.smtpAuthType !== 'none') {
    if (isBlank(config.smtpHost)) errors.smtpHost = 'emailGateway.validation.required';
    if (isBlank(config.smtpUser)) errors.smtpUser = 'emailGateway.validation.required';
    if (config.smtpAuthType === 'basic' && !options.smtpPasswordConfigured && !drafts.smtpPassword.trim()) {
      errors.smtpPassword = 'emailGateway.validation.required';
    }
    if (!config.smtpSecure && config.smtpAuthType === 'basic') {
      errors.smtpSecure = 'emailGateway.validation.tlsRequired';
    }
  }

  return errors;
}

export type GatewayConfigUpdatePayload = Partial<GatewayConfig> &
  Partial<Record<SecretKey, string | null>>;

/**
 * Build the PUT payload. Secret values are only included when the admin typed a
 * replacement; an empty draft is omitted so the backend retains the stored
 * secret (never delete-on-empty).
 *
 * `removeSecrets` is the explicit "remove secret" confirmation path: only then
 * is a secret sent as `null` (which the backend interprets as deletion).
 */
export function buildUpdatePayload(
  config: GatewayConfig,
  drafts: Record<SecretKey, string>,
  removeSecrets: Partial<Record<SecretKey, boolean>> = {},
): GatewayConfigUpdatePayload {
  const payload: GatewayConfigUpdatePayload = {
    enabled: config.enabled,
    inboundProvider: config.inboundProvider,
    imapHost: config.imapHost.trim(),
    imapPort: config.imapPort,
    imapSecure: config.imapSecure,
    imapUser: config.imapUser.trim(),
    imapMailbox: config.imapMailbox.trim(),
    imapAuthType: config.imapAuthType,
    exchangeTenantId: config.exchangeTenantId.trim(),
    exchangeClientId: config.exchangeClientId.trim(),
    exchangeScopes: config.exchangeScopes.trim(),
    smtpHost: config.smtpHost.trim(),
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpSecure,
    smtpUser: config.smtpUser.trim(),
    smtpAuthType: config.smtpAuthType,
    smtpFromEmail: config.smtpFromEmail.trim(),
    smtpRejectUnauthorized: config.smtpRejectUnauthorized,
    pollIntervalMinutes: config.pollIntervalMinutes,
    subjectPrefix: config.subjectPrefix.trim(),
    defaultTicketType: config.defaultTicketType,
    autoAssignToEmail: config.autoAssignToEmail.trim(),
  };

  const imapPassword = drafts.imapPassword.trim();
  if (removeSecrets.imapPassword) payload.imapPassword = null;
  else if (imapPassword) payload.imapPassword = imapPassword;

  const smtpPassword = drafts.smtpPassword.trim();
  if (removeSecrets.smtpPassword) payload.smtpPassword = null;
  else if (smtpPassword) payload.smtpPassword = smtpPassword;

  // Remove is expressed as a null reference (backend deletes the stored ref).
  if (removeSecrets.exchangeClientSecretRef) payload.exchangeClientSecretRef = null;
  else {
    const exchangeSecret = drafts.exchangeClientSecretRef.trim();
    if (exchangeSecret) payload.exchangeClientSecretRef = exchangeSecret;
  }

  return payload;
}

/** Map structured API `fieldErrors` (backend detail paths) onto the form. */
export function mergeServerFieldErrors(
  clientErrors: ValidationErrors,
  serverErrors: Record<string, string> | undefined,
  messageFor: (field: string, serverMessage: string) => ValidationMessage = (_field, message) => message,
): ValidationErrors {
  const merged: ValidationErrors = { ...clientErrors };
  if (!serverErrors) return merged;
  for (const [field, serverMessage] of Object.entries(serverErrors)) {
    merged[field as EmailGatewayField] = messageFor(field, serverMessage);
  }
  return merged;
}

/** Convenience guard used to keep IMAP auth type coherent with the provider. */
export function allowedImapAuthTypes(provider: GatewayConfig['inboundProvider']): ImapAuthType[] {
  return provider === 'exchange' ? ['password', 'oauth2'] : ['password'];
}
