/**
 * Inbound mailbox settings.
 *
 * Renders provider-appropriate fields only:
 *  - IMAP settings (host, port, mailbox, user, TLS) for `inboundProvider=imap`
 *  - Exchange Online settings (tenant, client id, secret ref, scopes) for
 *    `inboundProvider=exchange`
 *
 * Secret values are never reflected: `SecretField` handles the configured /
 * replace / remove pattern.
 */
import { useI18n } from '../../context/I18nContext';
import { CheckboxField, FieldGroup, TextField } from './fields';
import SecretField from './SecretField';
import type { GatewayConfig, SecretConfigured, SecretDrafts, SecretKey } from './types';
import type { ValidationErrors } from './validation';

const sectionClass =
  'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900';

export interface MailboxSectionProps {
  config: GatewayConfig;
  errors: ValidationErrors;
  configured: SecretConfigured;
  drafts: SecretDrafts;
  onUpdate: (key: keyof GatewayConfig, value: string | number | boolean) => void;
  onChangeSecret: (key: SecretKey, value: string) => void;
  onRequestRemoveSecret: (key: SecretKey) => void;
  disabled?: boolean;
}

export function MailboxSection({
  config,
  errors,
  configured,
  drafts,
  onUpdate,
  onChangeSecret,
  onRequestRemoveSecret,
  disabled,
}: MailboxSectionProps) {
  const { t } = useI18n();
  const isImap = config.inboundProvider === 'imap';

  return (
    <section className={sectionClass} aria-labelledby="mailbox-section-heading">
      <h2 id="mailbox-section-heading" className="font-semibold text-gray-900 dark:text-white">
        {isImap ? t('emailGateway.imapSettings') : t('emailGateway.exchangeSettings')}
      </h2>

      {isImap ? (
        <FieldGroup legendKey="emailGateway.imapSettings" className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField
            id="imap-host"
            name="imapHost"
            labelKey="emailGateway.imapHost"
            helpKey="emailGateway.help.imapHost"
            errorKey={errors.imapHost ?? null}
            value={config.imapHost}
            onChange={(value) => onUpdate('imapHost', value)}
            placeholder="outlook.office365.com"
            autoComplete="off"
            disabled={disabled}
          />
          <TextField
            id="imap-port"
            name="imapPort"
            labelKey="emailGateway.imapPort"
            helpKey="emailGateway.help.imapPort"
            errorKey={errors.imapPort ?? null}
            type="number"
            min={1}
            max={65535}
            value={config.imapPort}
            onChange={(value) => onUpdate('imapPort', Number(value))}
            inputMode="numeric"
            disabled={disabled}
          />
          <TextField
            id="imap-mailbox"
            name="imapMailbox"
            labelKey="emailGateway.mailbox"
            helpKey="emailGateway.help.mailbox"
            errorKey={errors.imapMailbox ?? null}
            value={config.imapMailbox}
            onChange={(value) => onUpdate('imapMailbox', value)}
            autoComplete="off"
            disabled={disabled}
          />
          <TextField
            id="imap-user"
            name="imapUser"
            labelKey="emailGateway.mailboxUser"
            helpKey="emailGateway.help.mailboxUser"
            errorKey={errors.imapUser ?? null}
            type="email"
            value={config.imapUser}
            onChange={(value) => onUpdate('imapUser', value)}
            inputMode="email"
            autoComplete="off"
            disabled={disabled}
          />

          <div className="md:col-span-2">
            <SecretField
              id="imap-password"
              name="imapPassword"
              labelKey={config.imapAuthType === 'oauth2' ? 'emailGateway.imapAccessToken' : 'emailGateway.imapPassword'}
              helpKey="emailGateway.help.imapPassword"
              configured={configured.imapPassword}
              value={drafts.imapPassword}
              onChange={(value) => onChangeSecret('imapPassword', value)}
              errorKey={errors.imapPassword ?? null}
              onRequestRemove={() => onRequestRemoveSecret('imapPassword')}
              disabled={disabled}
            />
          </div>

          <CheckboxField
            id="imap-secure"
            name="imapSecure"
            labelKey="emailGateway.useTLS"
            helpKey="emailGateway.help.useTLS"
            errorKey={errors.imapSecure ?? null}
            checked={config.imapSecure}
            onChange={(checked) => onUpdate('imapSecure', checked)}
            disabled={disabled}
          />
        </FieldGroup>
      ) : (
        <FieldGroup legendKey="emailGateway.exchangeSettings" className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField
            id="exchange-tenant-id"
            name="exchangeTenantId"
            labelKey="emailGateway.entraTenantId"
            helpKey="emailGateway.help.exchangeTenantId"
            errorKey={errors.exchangeTenantId ?? null}
            value={config.exchangeTenantId}
            onChange={(value) => onUpdate('exchangeTenantId', value)}
            autoComplete="off"
            disabled={disabled}
          />
          <TextField
            id="exchange-client-id"
            name="exchangeClientId"
            labelKey="emailGateway.clientId"
            helpKey="emailGateway.help.exchangeClientId"
            errorKey={errors.exchangeClientId ?? null}
            value={config.exchangeClientId}
            onChange={(value) => onUpdate('exchangeClientId', value)}
            autoComplete="off"
            disabled={disabled}
          />
          <div className="md:col-span-2">
            <SecretField
              id="exchange-secret-ref"
              name="exchangeClientSecretRef"
              labelKey="emailGateway.exchangeSecretRef"
              helpKey="emailGateway.help.exchangeSecretRef"
              configured={configured.exchangeClientSecretRef}
              value={drafts.exchangeClientSecretRef}
              onChange={(value) => onChangeSecret('exchangeClientSecretRef', value)}
              errorKey={errors.exchangeClientSecretRef ?? null}
              onRequestRemove={() => onRequestRemoveSecret('exchangeClientSecretRef')}
              referenceOnly
              autoComplete="off"
              disabled={disabled}
            />
          </div>
          <div className="md:col-span-2">
            <TextField
              id="exchange-scopes"
              name="exchangeScopes"
              labelKey="emailGateway.oauthScope"
              helpKey="emailGateway.help.exchangeScopes"
              errorKey={errors.exchangeScopes ?? null}
              value={config.exchangeScopes}
              onChange={(value) => onUpdate('exchangeScopes', value)}
              autoComplete="off"
              disabled={disabled}
            />
          </div>
          <CheckboxField
            id="exchange-imap-secure"
            name="imapSecure"
            labelKey="emailGateway.useTLS"
            helpKey="emailGateway.help.useTLS"
            errorKey={errors.imapSecure ?? null}
            checked={config.imapSecure}
            onChange={(checked) => onUpdate('imapSecure', checked)}
            disabled={disabled}
          />
        </FieldGroup>
      )}
    </section>
  );
}

export default MailboxSection;
