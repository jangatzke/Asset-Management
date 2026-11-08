/**
 * Accessible field primitives for the Ticket E-mail Gateway admin screen.
 *
 * Every control has:
 *  - a stable `id` and `name`,
 *  - a `<label>` associated either via `htmlFor` (single control) or `legend`,
 *  - `aria-describedby` pointing at persistent help text (`<id>-help`) and, when
 *    present, the field error (`<id>-error`, `role="alert"`).
 *
 * Focus rings follow the app theme (primary-500) and are visible on both the
 * light and dark surfaces.
 */

import type { ChangeEvent, ReactNode } from 'react';
import HelpTooltip from '../../components/HelpTooltip';
import { useI18n } from '../../context/I18nContext';

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';
const inputErrorClass = 'border-red-500 dark:border-red-400';
const helpClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400';
const errorClass = 'mt-1 text-xs font-medium text-red-700 dark:text-red-300';

const describedBy = (id: string, helpKey?: string, errorKey?: string | null): string | undefined => {
  const ids: string[] = [];
  if (helpKey) ids.push(`${id}-help`);
  if (errorKey) ids.push(`${id}-error`);
  return ids.length > 0 ? ids.join(' ') : undefined;
};

interface FieldChromeProps {
  id: string;
  labelKey: string;
  helpKey?: string;
  errorKey?: string | null;
  helpTextKey?: string;
}

/**
 * Persistent help paragraph. Always rendered when `helpKey` is supplied so
 * `aria-describedby` never dangles. The label also offers a `HelpTooltip`
 * affordance for the same copy.
 */
function FieldHelp({ id, helpKey }: { id: string; helpKey?: string }) {
  const { t } = useI18n();
  if (!helpKey) return null;
  return (
    <p id={`${id}-help`} className={helpClass}>
      {t(helpKey)}
    </p>
  );
}

function FieldError({ id, errorKey }: { id: string; errorKey?: string | null }) {
  const { t } = useI18n();
  if (!errorKey) return null;
  return (
    <p id={`${id}-error`} role="alert" className={errorClass}>
      {t(errorKey)}
    </p>
  );
}

function FieldLabel({ id, labelKey, helpKey }: FieldChromeProps) {
  const { t } = useI18n();
  return (
    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      <label htmlFor={id}>{t(labelKey)}</label>
      {helpKey ? <HelpTooltip bodyKey={helpKey} /> : null}
    </span>
  );
}

export interface TextFieldProps extends FieldChromeProps {
  name: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'number' | 'password' | 'url';
  placeholder?: string;
  autoComplete?: string;
  min?: number;
  max?: number;
  required?: boolean;
  inputMode?: 'text' | 'numeric' | 'email';
  inputClassName?: string;
  disabled?: boolean;
}

export function TextField({
  id,
  name,
  labelKey,
  helpKey,
  errorKey,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  min,
  max,
  required,
  inputMode,
  inputClassName,
  disabled,
}: TextFieldProps) {
  return (
    <div>
      <FieldLabel id={id} labelKey={labelKey} helpKey={helpKey} helpTextKey={helpKey} />
      <input
        id={id}
        name={name}
        type={type}
        className={`${inputClass} ${errorKey ? inputErrorClass : ''} ${inputClassName ?? ''}`.trim()}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete ?? 'off'}
        min={min}
        max={max}
        required={required}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={errorKey ? true : undefined}
        aria-describedby={describedBy(id, helpKey, errorKey)}
      />
      <FieldHelp id={id} helpKey={helpKey} />
      <FieldError id={id} errorKey={errorKey} />
    </div>
  );
}

export interface CheckboxFieldProps extends FieldChromeProps {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function CheckboxField({
  id,
  name,
  labelKey,
  helpKey,
  errorKey,
  checked,
  onChange,
  disabled,
}: CheckboxFieldProps) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={name}
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
          checked={checked}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
          aria-invalid={errorKey ? true : undefined}
          aria-describedby={describedBy(id, helpKey, errorKey)}
        />
        <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t(labelKey)}
        </label>
        {helpKey ? <HelpTooltip bodyKey={helpKey} /> : null}
      </div>
      <FieldHelp id={id} helpKey={helpKey} />
      <FieldError id={id} errorKey={errorKey} />
    </div>
  );
}

export interface SelectOption {
  value: string;
  labelKey: string;
  disabled?: boolean;
}

export interface SelectFieldProps extends FieldChromeProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export function SelectField({
  id,
  name,
  labelKey,
  helpKey,
  errorKey,
  value,
  onChange,
  options,
  disabled,
}: SelectFieldProps) {
  const { t } = useI18n();
  return (
    <div>
      <FieldLabel id={id} labelKey={labelKey} helpKey={helpKey} helpTextKey={helpKey} />
      <select
        id={id}
        name={name}
        className={`${inputClass} ${errorKey ? inputErrorClass : ''}`.trim()}
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        aria-invalid={errorKey ? true : undefined}
        aria-describedby={describedBy(id, helpKey, errorKey)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
      <FieldHelp id={id} helpKey={helpKey} />
      <FieldError id={id} errorKey={errorKey} />
    </div>
  );
}

/** Fieldset + legend wrapper for grouped controls. */
function FieldGroup({
  legendKey,
  children,
  className = '',
}: {
  legendKey: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <fieldset className={`space-y-4 ${className}`.trim()}>
      <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t(legendKey)}</legend>
      {children}
    </fieldset>
  );
}

export { FieldError, FieldHelp, FieldGroup };
