/**
 * Save / test / poll actions and the operational status line.
 *
 * All actions are real `<button>` elements with accessible names, expose
 * `aria-busy` and `disabled` while a request is in flight, and are disabled as a
 * group when any action is running so double-submit is impossible.
 */
import { useI18n } from '../../context/I18nContext';

export type GatewayActionId = 'save' | 'testInbound' | 'testSmtp' | 'pollNow';

const primaryBtnClass =
  'inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-normal ease-standard hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-focus-ring-offset disabled:opacity-50 disabled:cursor-not-allowed';

const secondaryBtnClass =
  'inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-normal ease-standard hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-focus-ring-offset disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

export interface ActionsSectionProps {
  saving: boolean;
  busy: boolean;
  /** Which single action is currently running. */
  activeAction: GatewayActionId | null;
  onSave: () => void;
  onTestInbound: () => void;
  onTestSmtp: () => void;
  onPollNow: () => void;
  lastPollAt?: string | null;
  lastPollMessage?: string | null;
}

export function ActionsSection({
  saving,
  busy,
  activeAction,
  onSave,
  onTestInbound,
  onTestSmtp,
  onPollNow,
  lastPollAt,
  lastPollMessage,
}: ActionsSectionProps) {
  const { t } = useI18n();

  const actions: Array<{
    id: GatewayActionId;
    labelKey: string;
    onClick: () => void;
    primary?: boolean;
  }> = [
    { id: 'save', labelKey: saving ? 'emailGateway.saving' : 'emailGateway.saveConfig', onClick: onSave, primary: true },
    { id: 'testInbound', labelKey: 'emailGateway.testInbound', onClick: onTestInbound },
    { id: 'testSmtp', labelKey: 'emailGateway.testSmtp', onClick: onTestSmtp },
    { id: 'pollNow', labelKey: 'emailGateway.pollNow', onClick: onPollNow },
  ];

  return (
    <section className="space-y-4" aria-labelledby="gateway-actions-heading">
      <h2 id="gateway-actions-heading" className="sr-only">
        {t('emailGateway.actions')}
      </h2>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => {
          const running = activeAction === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={busy}
              aria-busy={running}
              aria-label={t(action.labelKey)}
              data-action={action.id}
              className={action.primary ? primaryBtnClass : secondaryBtnClass}
            >
              {t(action.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <p>
          <span className="font-medium">{t('emailGateway.lastPoll')}</span>{': '}
          {lastPollAt ? new Date(lastPollAt).toLocaleString() : t('emailGateway.never')}
          {' — '}
          {lastPollMessage ?? t('emailGateway.noStatus')}
        </p>
      </div>
    </section>
  );
}

export default ActionsSection;
