/**
 * Secret input with "configured / replace / remove" semantics.
 *
 * The backend never returns stored secrets, so an empty password control cannot
 * be interpreted as "clear the secret". Instead:
 *
 *  - When a secret exists, a status chip ("configured") is shown and the input
 *    stays empty until the admin explicitly presses "Replace secret".
 *  - Typing a value only affects the PUT payload when the admin submits; the
 *    stored secret is never deleted by leaving the input empty.
 *  - "Remove secret" is an explicit, confirmed action (`onRequestRemove`) that
 *    issues a `null` value for the field.
 *
 * `autocomplete` is set explicitly: never reflect stored secrets, and use
 * `new-password` for replaceable credential fields.
 */

import { useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import HelpTooltip from '../../components/HelpTooltip';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

const chipClass =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';

const chipNotConfiguredClass =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';

const secondaryBtnClass =
  'rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700';

const dangerBtnClass =
  'rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/30';

export interface SecretFieldProps {
  id: string;
  name: string;
  labelKey: string;
  helpKey: string;
  /** True when the backend reports a stored secret for this field. */
  configured: boolean;
  /** The secret draft typed by the admin (never the stored secret). */
  value: string;
  onChange: (value: string) => void;
  /** i18n key for the inline validation message, or null when valid. */
  errorKey?: string | null;
  /** Opens the confirmation flow for removing the stored secret. */
  onRequestRemove?: () => void;
  /**
   * Whether the field accepts `env:`/`file:` references. Password fields accept
   * both a plaintext secret and a reference; secret-ref-only fields accept only
   * references (the backend rejects inline values for Exchange).
   */
  referenceOnly?: boolean;
  disabled?: boolean;
  /** `autocomplete` token; defaults to `new-password` for credentials. */
  autoComplete?: string;
}

function SecretStatusChip({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={configured ? chipClass : chipNotConfiguredClass}
      role="status"
      aria-live="polite"
      data-testid="secret-status"
    >
      {configured ? t('emailGateway.secret.configured') : t('emailGateway.secret.notConfigured')}
    </span>
  );
}

export function SecretField({
  id,
  name,
  labelKey,
  helpKey,
  configured,
  value,
  onChange,
  errorKey,
  onRequestRemove,
  referenceOnly = false,
  disabled,
  autoComplete = 'new-password',
}: SecretFieldProps) {
  const { t } = useI18n();
  const [replacing, setReplacing] = useState(false);

  // For reference-only fields the input is always editable (there is no stored
  // secret value to display, only a reference that is safe to re-type).
  const editable = referenceOnly || !configured || replacing || value.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <label htmlFor={id}>{t(labelKey)}</label>
          <HelpTooltip bodyKey={helpKey} />
        </span>
        <SecretStatusChip configured={configured} />
      </div>

      <input
        id={id}
        name={name}
        type={referenceOnly ? 'text' : 'password'}
        className={inputClass}
        value={value}
        disabled={disabled || !editable}
        placeholder={
          referenceOnly
            ? t('emailGateway.secret.refPlaceholder')
            : configured
              ? t('emailGateway.secret.replacePlaceholder')
              : t('emailGateway.secret.enterPlaceholder')
        }
        autoComplete={autoComplete}
        aria-invalid={errorKey ? true : undefined}
        aria-describedby={`${id}-help${errorKey ? ` ${id}-error` : ''}`}
        onChange={(e) => onChange(e.target.value)}
      />

      <p id={`${id}-help`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {t(helpKey)}
      </p>
      {errorKey ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
          {t(errorKey)}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {configured && !replacing && !referenceOnly ? (
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => setReplacing(true)}
            aria-label={t('emailGateway.secret.replace')}
          >
            {t('emailGateway.secret.replace')}
          </button>
        ) : null}
        {configured && onRequestRemove ? (
          <button
            type="button"
            className={dangerBtnClass}
            onClick={onRequestRemove}
            aria-label={t('emailGateway.secret.remove')}
          >
            {t('emailGateway.secret.remove')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default SecretField;
