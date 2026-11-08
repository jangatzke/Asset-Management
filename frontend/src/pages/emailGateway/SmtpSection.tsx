/**
 * Ticket mapping + outbound SMTP settings.
 *
 * Secret handling mirrors the inbound mailbox section: the SMTP password uses
 * the configured/replace/remove pattern and is never reflected in the form.
 */
import { useI18n } from '../../context/I18nContext';
import { CheckboxField, FieldGroup, SelectField, TextField } from './fields';
import SecretField from './SecretField';
import type { GatewayConfig, SecretConfigured, SecretDrafts, SecretKey } from './types';
import type { ValidationErrors } from './validation';

const sectionClass =
  'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900';

export interface SmtpSectionProps {
  config: GatewayConfig;
  errors: ValidationErrors;
  configured: SecretConfigured;
  drafts: SecretDrafts;
  onUpdate: (key: keyof GatewayConfig, value: string | number | boolean) => void;
  onChangeSecret: (key: SecretKey, value: string) => void;
  onRequestRemoveSecret: (key: SecretKey) => void;
  disabled?: boolean;
}

export function SmtpSection({
  config,
  errors,
  configured,
  drafts,
  onUpdate,
  onChangeSecret,
  onRequestRemoveSecret,
  disabled,
}: SmtpSectionProps) {
  const { t } = useI18n();
  return (
    <section className={sectionClass} aria-labelledby="smtp-section-heading">
      <h2 id="smtp-section-heading" className="font-semibold text-gray-900 dark:text-white">
        {t('emailGateway.ticketMapping')}
      </h2>

      <FieldGroup legendKey="emailGateway.ticketMappingFields" className="mt-4 grid gap-4 md:grid-cols-2">
        <SelectField
          id="default-ticket-type"
          name="defaultTicketType"
          labelKey="emailGateway.defaultTicketType"
          helpKey="emailGateway.help.defaultTicketType"
          errorKey={errors.defaultTicketType ?? null}
          value={config.defaultTicketType}
          onChange={(value) => onUpdate('defaultTicketType', value)}
          options={[
            { value: 'incident', labelKey: 'emailGateway.incident' },
            { value: 'service_request', labelKey: 'emailGateway.serviceRequest' },
            { value: 'problem', labelKey: 'emailGateway.problem' },
            { value: 'change', labelKey: 'emailGateway.change' },
          ]}
          disabled={disabled}
        />
        <TextField
          id="auto-assign-email"
          name="autoAssignToEmail"
          labelKey="emailGateway.autoAssignEmail"
          helpKey="emailGateway.help.autoAssignEmail"
          errorKey={errors.autoAssignToEmail ?? null}
          type="email"
          value={config.autoAssignToEmail}
          onChange={(value) => onUpdate('autoAssignToEmail', value)}
          placeholder="handler@example.com"
          inputMode="email"
          autoComplete="off"
          disabled={disabled}
        />
        <TextField
          id="subject-prefix"
          name="subjectPrefix"
          labelKey="emailGateway.subjectPrefix"
          helpKey="emailGateway.help.subjectPrefix"
          errorKey={errors.subjectPrefix ?? null}
          value={config.subjectPrefix}
          onChange={(value) => onUpdate('subjectPrefix', value)}
          autoComplete="off"
          disabled={disabled}
        />
        <SelectField
          id="smtp-auth-type"
          name="smtpAuthType"
          labelKey="emailGateway.smtpAuth"
          helpKey="emailGateway.help.smtpAuth"
          errorKey={errors.smtpAuthType ?? null}
          value={config.smtpAuthType}
          onChange={(value) => onUpdate('smtpAuthType', value)}
          options={[
            { value: 'none', labelKey: 'emailGateway.none' },
            { value: 'basic', labelKey: 'emailGateway.basic' },
            { value: 'oauth2', labelKey: 'emailGateway.oauth2Exchange' },
          ]}
          disabled={disabled}
        />
        <TextField
          id="smtp-host"
          name="smtpHost"
          labelKey="emailGateway.smtpHost"
          helpKey="emailGateway.help.smtpHost"
          errorKey={errors.smtpHost ?? null}
          value={config.smtpHost}
          onChange={(value) => onUpdate('smtpHost', value)}
          autoComplete="off"
          disabled={disabled}
        />
        <TextField
          id="smtp-port"
          name="smtpPort"
          labelKey="emailGateway.smtpPort"
          helpKey="emailGateway.help.smtpPort"
          errorKey={errors.smtpPort ?? null}
          type="number"
          min={1}
          max={65535}
          value={config.smtpPort}
          onChange={(value) => onUpdate('smtpPort', Number(value))}
          inputMode="numeric"
          disabled={disabled}
        />
        <TextField
          id="smtp-user"
          name="smtpUser"
          labelKey="emailGateway.smtpUser"
          helpKey="emailGateway.help.smtpUser"
          errorKey={errors.smtpUser ?? null}
          value={config.smtpUser}
          onChange={(value) => onUpdate('smtpUser', value)}
          autoComplete="off"
          disabled={disabled}
        />
        <div className="md:col-span-1">
          <SecretField
            id="smtp-password"
            name="smtpPassword"
            labelKey="emailGateway.smtpPassword"
            helpKey="emailGateway.help.smtpPassword"
            configured={configured.smtpPassword}
            value={drafts.smtpPassword}
            onChange={(value) => onChangeSecret('smtpPassword', value)}
            errorKey={errors.smtpPassword ?? null}
            onRequestRemove={() => onRequestRemoveSecret('smtpPassword')}
            disabled={disabled}
          />
        </div>
        <TextField
          id="smtp-from-email"
          name="smtpFromEmail"
          labelKey="emailGateway.smtpFromEmail"
          helpKey="emailGateway.help.smtpFromEmail"
          errorKey={errors.smtpFromEmail ?? null}
          type="email"
          value={config.smtpFromEmail}
          onChange={(value) => onUpdate('smtpFromEmail', value)}
          inputMode="email"
          autoComplete="off"
          disabled={disabled}
        />
        <CheckboxField
          id="smtp-secure"
          name="smtpSecure"
          labelKey="emailGateway.smtpImplicitTLS"
          helpKey="emailGateway.help.smtpSecure"
          errorKey={errors.smtpSecure ?? null}
          checked={config.smtpSecure}
          onChange={(checked) => onUpdate('smtpSecure', checked)}
          disabled={disabled}
        />
        <CheckboxField
          id="smtp-reject-unauthorized"
          name="smtpRejectUnauthorized"
          labelKey="emailGateway.validateTLS"
          helpKey="emailGateway.help.smtpRejectUnauthorized"
          checked={config.smtpRejectUnauthorized}
          onChange={(checked) => onUpdate('smtpRejectUnauthorized', checked)}
          disabled={disabled}
        />
      </FieldGroup>
    </section>
  );
}

export default SmtpSection;
