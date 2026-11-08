/**
 * Ticket E-mail Gateway admin screen.
 *
 * Structural split (see `./emailGateway/*`):
 *  - `ProviderSection`  – gateway enablement + provider/authentication
 *  - `MailboxSection`   – inbound IMAP / Exchange settings + secret field
 *  - `SmtpSection`      – ticket mapping + outbound SMTP
 *  - `ActionsSection`   – save / test inbound / test SMTP / poll + status
 *  - `MessagesTable`    – operational audit trail
 *
 * Safety/UX behaviour:
 *  - Enabling the gateway and switching `inboundProvider` require a
 *    `ConfirmDialog` confirmation before the local state changes.
 *  - Secret fields use the configured / replace / remove pattern and are never
 *    deleted because they are empty. Removal is an explicit, confirmed action.
 *  - Client-side validation mirrors the backend schema; structured 400
 *    `details` are merged into the same inline error map and announced once in
 *    an accessible summary region.
 *  - All actions are disabled while a request is in flight, preventing
 *    double-submit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emailGatewayAdminApi } from '../services/api';
import { useLocalSort } from '../hooks/useLocalSort';
import { useI18n } from '../context/I18nContext';
import { extractApiError, formatToastMessage } from '../utils/apiError';
import { ConfirmDialog } from '../components/ConfirmDialog';
import ProviderSection from './emailGateway/ProviderSection';
import MailboxSection from './emailGateway/MailboxSection';
import SmtpSection from './emailGateway/SmtpSection';
import ActionsSection, { type GatewayActionId } from './emailGateway/ActionsSection';
import MessagesTable from './emailGateway/MessagesTable';
import {
  emptySecretConfigured,
  emptySecretDrafts,
  initialConfig,
  toGatewayConfig,
  toSecretConfigured,
} from './emailGateway/types';
import type {
  GatewayConfig,
  GatewayEmailMessage,
  GatewayStatus,
  InboundProvider,
  SecretConfigured,
  SecretDrafts,
  SecretKey,
} from './emailGateway/types';
import {
  buildUpdatePayload,
  mergeServerFieldErrors,
  validateSecretDrafts,
  validateGatewayConfig,
  type ValidationErrors,
} from './emailGateway/validation';

type PendingConfirmation =
  | { kind: 'enable'; nextValue: boolean }
  | { kind: 'provider'; nextValue: InboundProvider }
  | { kind: 'removeSecret'; secret: SecretKey };

const SECRET_FIELD_LABEL: Record<SecretKey, string> = {
  imapPassword: 'emailGateway.imapPassword',
  smtpPassword: 'emailGateway.smtpPassword',
  exchangeClientSecretRef: 'emailGateway.exchangeSecretRef',
};

export default function AdminEmailGateway() {
  const { t } = useI18n();

  const [config, setConfig] = useState<GatewayConfig>(initialConfig);
  const [messages, setMessages] = useState<GatewayEmailMessage[]>([]);
  const [status, setStatus] = useState<GatewayStatus>({});
  const [configured, setConfigured] = useState<SecretConfigured>(emptySecretConfigured);
  const [drafts, setDrafts] = useState<SecretDrafts>(emptySecretDrafts);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeAction, setActiveAction] = useState<GatewayActionId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  // Guards against double-submit before React re-renders the disabled state.
  const inFlightRef = useRef(false);

  const busy = saving || activeAction !== null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, log, currentStatus] = await Promise.all([
        emailGatewayAdminApi.getConfig(),
        emailGatewayAdminApi.messages(),
        emailGatewayAdminApi.status(),
      ]);
      setConfig(toGatewayConfig(cfg.data));
      setConfigured(toSecretConfigured(cfg.data));
      setMessages(Array.isArray(log.data) ? log.data : (log.data?.data ?? []));
      setStatus(currentStatus.data ?? {});
    } catch (caught) {
      const info = extractApiError(caught, t('emailGateway.unableToLoad'));
      setError(formatToastMessage(info, t('common.referenceId')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const { sort, toggleSort } = useLocalSort({
    routeKey: 'admin-email-gateway',
    defaultSort: { column: 'received', direction: 'desc' },
  });

  const sortedMessages = useMemo(() => {
    if (!sort.column) return messages;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (message: GatewayEmailMessage) => {
      if (sort.column === 'received') return message.receivedAt ? new Date(message.receivedAt).getTime() : 0;
      if (sort.column === 'from') return (message.fromEmail ?? '').toLowerCase();
      if (sort.column === 'subject') return (message.subject ?? '').toLowerCase();
      if (sort.column === 'status') return (message.status ?? '').toLowerCase();
      if (sort.column === 'ticket') return (message.ticket?.displayId ?? '').toLowerCase();
      return '';
    };
    return [...messages].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [messages, sort]);

  const update = useCallback((key: keyof GatewayConfig, value: string | number | boolean) => {
    setConfig((current) => ({ ...current, [key]: value }));
  }, []);

  const changeSecret = useCallback((key: SecretKey, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  }, []);

  const computeErrors = useCallback(
    (): ValidationErrors => ({
      ...validateGatewayConfig({
        config,
        drafts,
        imapPasswordConfigured: configured.imapPassword,
        smtpPasswordConfigured: configured.smtpPassword,
        exchangeClientSecretRefConfigured: configured.exchangeClientSecretRef,
      }),
      ...validateSecretDrafts(drafts),
    }),
    [config, drafts, configured],
  );

  const save = useCallback(async () => {
    if (inFlightRef.current) return;
    const clientErrors = computeErrors();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError(t('emailGateway.validation.summary'));
      setNotice(null);
      return;
    }

    inFlightRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    try {
      const result = await emailGatewayAdminApi.updateConfig(buildUpdatePayload(config, drafts));
      setConfig(toGatewayConfig(result.data));
      setConfigured(toSecretConfigured(result.data));
      setDrafts(emptySecretDrafts);
      setNotice(t('emailGateway.configSaved'));
    } catch (caught) {
      const info = extractApiError(caught, t('emailGateway.unableToSave'));
      setFieldErrors(mergeServerFieldErrors({}, info.fieldErrors));
      setError(formatToastMessage(info, t('common.referenceId')));
    } finally {
      setSaving(false);
      inFlightRef.current = false;
    }
  }, [config, drafts, computeErrors, t]);

  const runAction = useCallback(
    async (id: GatewayActionId, labelKey: string, action: () => Promise<unknown>) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setActiveAction(id);
      setError(null);
      setNotice(null);
      setFieldErrors({});
      try {
        const result = await action();
        const data = (result as { data?: unknown })?.data;
        const suffix = typeof data === 'object' && data !== null ? JSON.stringify(data) : t('emailGateway.completed');
        setNotice(`${t(labelKey)}: ${suffix}`);
        await load();
      } catch (caught) {
        const info = extractApiError(caught, t('emailGateway.actionFailed'));
        setFieldErrors(mergeServerFieldErrors({}, info.fieldErrors));
        setError(formatToastMessage(info, t('common.referenceId')));
      } finally {
        setActiveAction(null);
        inFlightRef.current = false;
      }
    },
    [load, t],
  );

  const requestEnable = useCallback((nextValue: boolean) => {
    setPendingConfirmation({ kind: 'enable', nextValue });
  }, []);

  const requestProviderChange = useCallback((nextValue: InboundProvider) => {
    if (nextValue === config.inboundProvider) return;
    setPendingConfirmation({ kind: 'provider', nextValue });
  }, [config.inboundProvider]);

  const requestRemoveSecret = useCallback((secret: SecretKey) => {
    setPendingConfirmation({ kind: 'removeSecret', secret });
  }, []);

  const closeConfirmation = useCallback(() => setPendingConfirmation(null), []);

  const confirmPending = useCallback(async () => {
    const pending = pendingConfirmation;
    setPendingConfirmation(null);
    if (!pending) return;

    if (pending.kind === 'enable') {
      setConfig((current) => ({ ...current, enabled: pending.nextValue }));
      return;
    }

    if (pending.kind === 'provider') {
      setConfig((current) => ({
        ...current,
        inboundProvider: pending.nextValue,
        // Keep auth coherent with the backend rule: IMAP OAuth2 is only valid
        // with Exchange, so fall back to password auth when leaving Exchange.
        imapAuthType: pending.nextValue === 'exchange' ? current.imapAuthType : 'password',
      }));
      return;
    }

    // Explicit secret removal: issue `null` for that field (backend deletes it).
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = { [pending.secret]: null } as Partial<Record<SecretKey, null>>;
      const result = await emailGatewayAdminApi.updateConfig(payload);
      setConfig(toGatewayConfig(result.data));
      setConfigured(toSecretConfigured(result.data));
      setNotice(t('emailGateway.secret.removed'));
    } catch (caught) {
      const info = extractApiError(caught, t('emailGateway.unableToSave'));
      setError(formatToastMessage(info, t('common.referenceId')));
    } finally {
      setSaving(false);
      inFlightRef.current = false;
    }
  }, [pendingConfirmation, t]);

  const confirmationCopy = (pending: PendingConfirmation) => {
    if (pending.kind === 'enable') {
      return {
        titleKey: pending.nextValue ? 'emailGateway.confirm.enableTitle' : 'emailGateway.confirm.disableTitle',
        messageKey: pending.nextValue ? 'emailGateway.confirm.enableMessage' : 'emailGateway.confirm.disableMessage',
        danger: !pending.nextValue,
        fieldLabelKey: undefined as string | undefined,
      };
    }
    if (pending.kind === 'provider') {
      return {
        titleKey: 'emailGateway.confirm.providerTitle',
        messageKey: 'emailGateway.confirm.providerMessage',
        danger: true,
        fieldLabelKey: undefined as string | undefined,
      };
    }
    return {
      titleKey: 'emailGateway.confirm.removeSecretTitle',
      messageKey: 'emailGateway.confirm.removeSecretMessage',
      danger: true,
      fieldLabelKey: SECRET_FIELD_LABEL[pending.secret] as string | undefined,
    };
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-700 dark:text-gray-200" role="status" aria-live="polite">
        {t('emailGateway.loading')}
      </div>
    );
  }

  const dialogCopy = pendingConfirmation ? confirmationCopy(pendingConfirmation) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('emailGateway.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('emailGateway.subtitle')}</p>
      </div>

      {/* Success notice: polite live region. */}
      <div aria-live="polite" aria-atomic="true">
        {notice ? (
          <div
            className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200"
            role="status"
          >
            {notice}
          </div>
        ) : null}
      </div>

      {/* Errors: assertive alert region. */}
      <div aria-live="assertive" aria-atomic="true">
        {error ? (
          <div
            className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200"
            role="alert"
            data-testid="gateway-error"
          >
            <p>{error}</p>
            {summarizedFieldErrors(fieldErrors, t).length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {summarizedFieldErrors(fieldErrors, t).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <ProviderSection
        config={config}
        errors={fieldErrors}
        onRequestEnable={requestEnable}
        onChangeProvider={requestProviderChange}
        onUpdate={update}
        disabled={busy}
      />

      <MailboxSection
        config={config}
        errors={fieldErrors}
        configured={configured}
        drafts={drafts}
        onUpdate={update}
        onChangeSecret={changeSecret}
        onRequestRemoveSecret={requestRemoveSecret}
        disabled={busy}
      />

      <SmtpSection
        config={config}
        errors={fieldErrors}
        configured={configured}
        drafts={drafts}
        onUpdate={update}
        onChangeSecret={changeSecret}
        onRequestRemoveSecret={requestRemoveSecret}
        disabled={busy}
      />

      <ActionsSection
        saving={saving}
        busy={busy}
        activeAction={activeAction}
        onSave={() => void save()}
        onTestInbound={() => void runAction('testInbound', 'emailGateway.testInbound', () => emailGatewayAdminApi.testInbound())}
        onTestSmtp={() => void runAction('testSmtp', 'emailGateway.testSmtp', () => emailGatewayAdminApi.testSmtp())}
        onPollNow={() => void runAction('pollNow', 'emailGateway.pollNow', () => emailGatewayAdminApi.pollNow())}
        lastPollAt={status.lastPollAt}
        lastPollMessage={status.lastPollMessage}
      />

      <MessagesTable
        messages={sortedMessages}
        sortColumn={sort.column}
        sortDirection={sort.direction}
        onSort={toggleSort}
      />

      {dialogCopy ? (
        <ConfirmDialog
          isOpen={true}
          onClose={closeConfirmation}
          onConfirm={() => void confirmPending()}
          titleKey={dialogCopy.titleKey}
          message={
            dialogCopy.fieldLabelKey
              ? `${t(dialogCopy.messageKey)} (${t(dialogCopy.fieldLabelKey)})`
              : t(dialogCopy.messageKey)
          }
          danger={dialogCopy.danger}
        />
      ) : null}
    </div>
  );
}

/** Format field errors as readable lines for the accessible summary region. */
function summarizedFieldErrors(fieldErrors: ValidationErrors, t: (key: string) => string): string[] {
  return Object.entries(fieldErrors).map(([field, message]) => `${t(`emailGateway.fields.${field}`)}: ${t(message)}`);
}
