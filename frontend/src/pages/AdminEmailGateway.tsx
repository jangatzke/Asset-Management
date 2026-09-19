import { useEffect, useState, useMemo } from 'react';
import { emailGatewayAdminApi } from '../services/api';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { useI18n } from '../context/I18nContext';

interface GatewayConfig {
  enabled: boolean;
  inboundProvider: 'imap' | 'exchange';
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword?: string;
  imapMailbox: string;
  imapAuthType: 'password' | 'oauth2';
  exchangeTenantId: string;
  exchangeClientId: string;
  exchangeClientSecretRef: string;
  exchangeScopes: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword?: string;
  smtpAuthType: 'none' | 'basic' | 'oauth2';
  smtpFromEmail: string;
  smtpRejectUnauthorized: boolean;
  pollIntervalMinutes: number;
  subjectPrefix: string;
  defaultTicketType: string;
  autoAssignToEmail: string;
}

const initialConfig: GatewayConfig = {
  enabled: false, inboundProvider: 'imap', imapHost: '', imapPort: 993, imapSecure: true,
  imapUser: '', imapMailbox: 'INBOX', imapAuthType: 'password', exchangeTenantId: '',
  exchangeClientId: '', exchangeClientSecretRef: '', exchangeScopes: 'https://outlook.office365.com/.default',
  smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpAuthType: 'none',
  smtpFromEmail: '', smtpRejectUnauthorized: true, pollIntervalMinutes: 5, subjectPrefix: '[ITSM]',
  defaultTicketType: 'incident', autoAssignToEmail: '',
};

const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

export default function AdminEmailGateway() {
  const { t } = useI18n();
  const [config, setConfig] = useState<GatewayConfig>(initialConfig);
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [cfg, log, currentStatus] = await Promise.all([
        emailGatewayAdminApi.getConfig(), emailGatewayAdminApi.messages(), emailGatewayAdminApi.status(),
      ]);
      setConfig({ ...initialConfig, ...cfg.data });
      setMessages(log.data);
      setStatus(currentStatus.data);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Unable to load e-mail gateway configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const { sort, toggleSort } = useLocalSort({ routeKey: 'admin-email-gateway', defaultSort: { column: 'received', direction: 'desc' } });

  const sortedMessages = useMemo(() => {
    if (!sort.column) return messages;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (message: any) => {
      if (sort.column === 'received') return message.receivedAt ? new Date(message.receivedAt).getTime() : 0;
      if (sort.column === 'from') return (message.fromEmail ?? '').toLowerCase();
      if (sort.column === 'subject') return (message.subject ?? '').toLowerCase();
      if (sort.column === 'status') return (message.status ?? '').toLowerCase();
      if (sort.column === 'ticket') return (message.ticket?.displayId ?? '').toLowerCase();
      return '';
    };
    return [...messages].sort((a, b) => { const av = get(a); const bv = get(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0; });
  }, [messages, sort]);

  const update = (key: keyof GatewayConfig, value: string | number | boolean) => setConfig((current) => ({ ...current, [key]: value }));
  const run = async (label: string, action: () => Promise<any>) => {
    setError(null); setNotice(null);
    try {
      const result = await action();
      setNotice(`${label}: ${typeof result.data === 'object' ? JSON.stringify(result.data) : 'completed'}`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? `${label} failed.`);
    }
  };

  const save = async () => {
    setSaving(true); setError(null); setNotice(null);
    try {
      const payload = { ...config } as any;
      if (!payload.imapPassword) delete payload.imapPassword;
      if (!payload.smtpPassword) delete payload.smtpPassword;
      if (!payload.exchangeClientSecretRef) delete payload.exchangeClientSecretRef;
      const result = await emailGatewayAdminApi.updateConfig(payload);
      setConfig({ ...initialConfig, ...result.data });
      setNotice(t('emailGateway.configSaved'));
    } catch (e: any) {
      setError(e.response?.data?.message ?? t('emailGateway.unableToSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">{t('emailGateway.loading')}</div>;

  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('emailGateway.title')}</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('emailGateway.subtitle')}</p>
    </div>
    {notice && <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">{notice}</div>}
    {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">{error}</div>}

    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="font-semibold text-gray-900 dark:text-white">{t('emailGateway.inbound')}</h2><p className="text-sm text-gray-500">{t('emailGateway.adminOnly')}</p></div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={config.enabled} onChange={(e) => update('enabled', e.target.checked)} /> {t('emailGateway.enableGateway')}</label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className={labelClass}>{t('emailGateway.provider')}<select className={inputClass} value={config.inboundProvider} onChange={(e) => update('inboundProvider', e.target.value as 'imap' | 'exchange')}><option value="imap">IMAP</option><option value="exchange">{t('emailGateway.exchangeOnline')}</option></select></label>
        <label className={labelClass}>{t('emailGateway.pollInterval')}<input className={inputClass} type="number" min="1" max="1440" value={config.pollIntervalMinutes} onChange={(e) => update('pollIntervalMinutes', Number(e.target.value))} /></label>
        <label className={labelClass}>{t('emailGateway.imapHost')}<input className={inputClass} value={config.imapHost} onChange={(e) => update('imapHost', e.target.value)} placeholder="outlook.office365.com" /></label>
        <label className={labelClass}>{t('emailGateway.imapPort')}<input className={inputClass} type="number" value={config.imapPort} onChange={(e) => update('imapPort', Number(e.target.value))} /></label>
        <label className={labelClass}>{t('emailGateway.mailbox')}<input className={inputClass} value={config.imapMailbox} onChange={(e) => update('imapMailbox', e.target.value)} /></label>
        <label className={labelClass}>{t('emailGateway.mailboxUser')}<input className={inputClass} type="email" value={config.imapUser} onChange={(e) => update('imapUser', e.target.value)} /></label>
        {config.inboundProvider === 'imap' && <label className={labelClass}>{t('emailGateway.imapPassword')}<select className={inputClass} value={config.imapAuthType} onChange={(e) => update('imapAuthType', e.target.value as 'password' | 'oauth2')}><option value="password">{t('emailGateway.password')}</option><option value="oauth2">{t('emailGateway.oauth2')}</option></select></label>}
        {config.inboundProvider === 'imap' && <label className={labelClass}>{t('emailGateway.imapPasswordToken')}<input className={inputClass} type="password" value={config.imapPassword ?? ''} onChange={(e) => update('imapPassword', e.target.value)} placeholder={t('emailGateway.leaveEmpty')} /></label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.imapSecure} onChange={(e) => update('imapSecure', e.target.checked)} /> {t('emailGateway.useTLS')}</label>
      </div>
      {config.inboundProvider === 'exchange' && <div className="mt-5 grid gap-4 border-t border-gray-200 pt-4 md:grid-cols-2 dark:border-gray-700">
        <label className={labelClass}>{t('emailGateway.entraTenantId')}<input className={inputClass} value={config.exchangeTenantId} onChange={(e) => update('exchangeTenantId', e.target.value)} /></label>
        <label className={labelClass}>{t('emailGateway.clientId')}<input className={inputClass} value={config.exchangeClientId} onChange={(e) => update('exchangeClientId', e.target.value)} /></label>
        <label className={labelClass}>{t('emailGateway.clientSecretRef')}<input className={inputClass} value={config.exchangeClientSecretRef} onChange={(e) => update('exchangeClientSecretRef', e.target.value)} placeholder={t('emailGateway.envSecret')} /></label>
        <label className={labelClass}>{t('emailGateway.oauthScope')}<input className={inputClass} value={config.exchangeScopes} onChange={(e) => update('exchangeScopes', e.target.value)} /></label>
      </div>}
    </section>

    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h2 className="font-semibold text-gray-900 dark:text-white">{t('emailGateway.ticketMapping')}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className={labelClass}>{t('emailGateway.defaultTicketType')}<select className={inputClass} value={config.defaultTicketType} onChange={(e) => update('defaultTicketType', e.target.value)}><option value="incident">{t('emailGateway.incident')}</option><option value="service_request">{t('emailGateway.serviceRequest')}</option><option value="problem">{t('emailGateway.problem')}</option><option value="change">{t('emailGateway.change')}</option></select></label>
        <label className={labelClass}>{t('emailGateway.autoAssignEmail')}<input className={inputClass} type="email" value={config.autoAssignToEmail} onChange={(e) => update('autoAssignToEmail', e.target.value)} placeholder="handler@example.com" /></label>
        <label className={labelClass}>{t('emailGateway.subjectPrefix')}<input className={inputClass} value={config.subjectPrefix} onChange={(e) => update('subjectPrefix', e.target.value)} /></label>
        <label className={labelClass}>{t('emailGateway.smtpAuth')}<select className={inputClass} value={config.smtpAuthType} onChange={(e) => update('smtpAuthType', e.target.value as GatewayConfig['smtpAuthType'])}><option value="none">{t('emailGateway.none')}</option><option value="basic">{t('emailGateway.basic')}</option><option value="oauth2">{t('emailGateway.oauth2Exchange')}</option></select></label>
        <label className={labelClass}>{t('emailGateway.smtpHost')}<input className={inputClass} value={config.smtpHost} onChange={(e) => update('smtpHost', e.target.value)} /></label>
        <label className={labelClass}>{t('emailGateway.smtpPort')}<input className={inputClass} type="number" value={config.smtpPort} onChange={(e) => update('smtpPort', Number(e.target.value))} /></label>
        <label className={labelClass}>{t('emailGateway.smtpUser')}<input className={inputClass} value={config.smtpUser} onChange={(e) => update('smtpUser', e.target.value)} /></label>
        <label className={labelClass}>{t('emailGateway.smtpPassword')}<input className={inputClass} type="password" value={config.smtpPassword ?? ''} onChange={(e) => update('smtpPassword', e.target.value)} placeholder={t('emailGateway.leaveEmpty')} /></label>
        <label className={labelClass}>{t('emailGateway.smtpFromEmail')}<input className={inputClass} type="email" value={config.smtpFromEmail} onChange={(e) => update('smtpFromEmail', e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.smtpSecure} onChange={(e) => update('smtpSecure', e.target.checked)} /> {t('emailGateway.smtpImplicitTLS')}</label>
      </div>
    </section>

    <div className="flex flex-wrap gap-3"><button onClick={save} disabled={saving} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{saving ? t('emailGateway.saving') : t('emailGateway.saveConfig')}</button><button onClick={() => void run(t('emailGateway.testInbound'), emailGatewayAdminApi.testInbound)} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">{t('emailGateway.testInbound')}</button><button onClick={() => void run(t('emailGateway.testSmtp'), emailGatewayAdminApi.testSmtp)} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">{t('emailGateway.testSmtp')}</button><button onClick={() => void run(t('emailGateway.pollNow'), emailGatewayAdminApi.pollNow)} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">{t('emailGateway.pollNow')}</button></div>

    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"><h2 className="font-semibold text-gray-900 dark:text-white">{t('emailGateway.auditTrail')}</h2><p className="mt-1 text-sm text-gray-500">{t('emailGateway.lastPoll')}: {status?.lastPollAt ? new Date(status.lastPollAt).toLocaleString() : t('emailGateway.never')} — {status?.lastPollMessage ?? t('emailGateway.noStatus')}</p><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-gray-500"><tr><SortableTh column="received" label={t('emailGateway.received')} activeColumn={sort.column} direction={sort.column === 'received' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="from" label={t('emailGateway.from')} activeColumn={sort.column} direction={sort.column === 'from' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="subject" label={t('emailGateway.subject')} activeColumn={sort.column} direction={sort.column === 'subject' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="status" label={t('common.status')} activeColumn={sort.column} direction={sort.column === 'status' ? sort.direction : ''} onSort={toggleSort} /><SortableTh column="ticket" label={t('emailGateway.ticket')} activeColumn={sort.column} direction={sort.column === 'ticket' ? sort.direction : ''} onSort={toggleSort} /></tr></thead><tbody>{sortedMessages.map((message) => <tr key={message.id} className="border-b border-gray-100 dark:border-gray-800"><td className="p-2">{message.receivedAt ? new Date(message.receivedAt).toLocaleString() : '—'}</td><td className="p-2">{message.fromEmail}</td><td className="p-2">{message.subject}</td><td className="p-2">{message.status}</td><td className="p-2">{message.ticket?.displayId ?? '—'}</td></tr>)}{sortedMessages.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">{t('emailGateway.noMessages')}</td></tr>}</tbody></table></div></section>
  </div>;
}
