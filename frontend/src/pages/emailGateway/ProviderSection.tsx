/**
 * Gateway enablement + inbound provider/authentication section.
 *
 * Enabling the gateway and changing the provider are safety-relevant actions:
 * `onRequestEnable`/`onChangeProvider` are requests the orchestrator resolves
 * through `ConfirmDialog`; this section never mutates state directly.
 *
 * IMAP OAuth2 is disabled unless `inboundProvider === 'exchange'`, matching the
 * backend `EmailGatewayConfigUpdateSchema.superRefine` restriction.
 */
import { useI18n } from '../../context/I18nContext';
import HelpTooltip from '../../components/HelpTooltip';
import { FieldGroup, SelectField, TextField } from './fields';
import type { GatewayConfig, InboundProvider } from './types';
import type { ValidationErrors } from './validation';

const sectionClass =
  'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900';

export interface ProviderSectionProps {
  config: GatewayConfig;
  errors: ValidationErrors;
  onRequestEnable: (next: boolean) => void;
  onChangeProvider: (next: InboundProvider) => void;
  onUpdate: (key: keyof GatewayConfig, value: string | number | boolean) => void;
  disabled?: boolean;
}

export function ProviderSection({
  config,
  errors,
  onRequestEnable,
  onChangeProvider,
  onUpdate,
  disabled,
}: ProviderSectionProps) {
  const { t } = useI18n();

  return (
    <section className={sectionClass} aria-labelledby="gateway-section-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="gateway-section-heading" className="font-semibold text-gray-900 dark:text-white">
            {t('emailGateway.inbound')}
          </h2>
          <p className="text-sm text-gray-500">{t('emailGateway.adminOnly')}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input
              id="gateway-enabled"
              name="enabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
              checked={config.enabled}
              disabled={disabled}
              onChange={(e) => onRequestEnable(e.target.checked)}
              aria-describedby="gateway-enabled-help"
              aria-busy={disabled ?? undefined}
            />
            <label htmlFor="gateway-enabled">{t('emailGateway.enableGateway')}</label>
            <HelpTooltip bodyKey="emailGateway.help.enableGateway" />
          </div>
          <p id="gateway-enabled-help" className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400">
            {t('emailGateway.help.enableGateway')}
          </p>
        </div>
      </div>

      <FieldGroup legendKey="emailGateway.providerAuth" className="mt-4 grid gap-4 md:grid-cols-2">
        <SelectField
          id="inbound-provider"
          name="inboundProvider"
          labelKey="emailGateway.provider"
          helpKey="emailGateway.help.provider"
          errorKey={errors.inboundProvider ?? null}
          value={config.inboundProvider}
          onChange={(value) => onChangeProvider(value === 'exchange' ? 'exchange' : 'imap')}
          options={[
            { value: 'imap', labelKey: 'emailGateway.providerImap' },
            { value: 'exchange', labelKey: 'emailGateway.exchangeOnline' },
          ]}
          disabled={disabled}
        />
        <SelectField
          id="imap-auth-type"
          name="imapAuthType"
          labelKey="emailGateway.imapAuth"
          helpKey="emailGateway.help.imapAuth"
          errorKey={errors.imapAuthType ?? null}
          value={config.imapAuthType}
          onChange={(value) => onUpdate('imapAuthType', value)}
          options={[
            { value: 'password', labelKey: 'emailGateway.imapAuthPassword' },
            {
              value: 'oauth2',
              labelKey: 'emailGateway.imapAuthOauth2',
              // Mirrors the backend restriction: IMAP OAuth2 is only valid with
              // inboundProvider=exchange (XOAUTH2 acquisition is not implemented).
              disabled: config.inboundProvider !== 'exchange',
            },
          ]}
          disabled={disabled || config.inboundProvider !== 'exchange'}
        />
        {config.inboundProvider !== 'exchange' ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 md:col-span-2" role="note">
            {t('emailGateway.imapOauth2Unavailable')}
          </p>
        ) : null}
        <div className="md:col-span-2">
          <TextField
            id="poll-interval-minutes"
            name="pollIntervalMinutes"
            labelKey="emailGateway.pollInterval"
            helpKey="emailGateway.help.pollInterval"
            errorKey={errors.pollIntervalMinutes ?? null}
            type="number"
            min={1}
            max={1440}
            value={config.pollIntervalMinutes}
            onChange={(value) => onUpdate('pollIntervalMinutes', Number(value))}
            inputMode="numeric"
          />
        </div>
      </FieldGroup>
    </section>
  );
}

export default ProviderSection;
