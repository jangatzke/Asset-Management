import { useEffect, useState } from 'react';
import { emailGatewayAdminApi } from '../services/api';

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

const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

export default function AdminEmailGateway() {
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
      setNotice('E-mail gateway configuration saved. Secrets are not returned by the API.');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Unable to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading e-mail gateway configuration…</div>;

  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Ticket E-mail Gateway</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Convert inbound IMAP or Exchange Online e-mails to auditable tickets. Send confirmations through SMTP.</p>
    </div>
    {notice && <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">{notice}</div>}
    {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">{error}</div>}

    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="font-semibold text-gray-900 dark:text-white">Inbound mailbox</h2><p className="text-sm text-gray-500">Only administrators can manage these settings.</p></div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={config.enabled} onChange={(e) => update('enabled', e.target.checked)} /> Enable gateway</label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Provider<select className={inputClass} value={config.inboundProvider} onChange={(e) => update('inboundProvider', e.target.value as 'imap' | 'exchange')}><option value="imap">IMAP</option><option value="exchange">Exchange Online (OAuth2)</option></select></label>
        <label className={labelClass}>Poll interval (minutes)<input className={inputClass} type="number" min="1" max="1440" value={config.pollIntervalMinutes} onChange={(e) => update('pollIntervalMinutes', Number(e.target.value))} /></label>
        <label className={labelClass}>IMAP host<input className={inputClass} value={config.imapHost} onChange={(e) => update('imapHost', e.target.value)} placeholder="outlook.office365.com" /></label>
        <label className={labelClass}>IMAP port<input className={inputClass} type="number" value={config.imapPort} onChange={(e) => update('imapPort', Number(e.target.value))} /></label>
        <label className={labelClass}>Mailbox<input className={inputClass} value={config.imapMailbox} onChange={(e) => update('imapMailbox', e.target.value)} /></label>
        <label className={labelClass}>Mailbox user<input className={inputClass} type="email" value={config.imapUser} onChange={(e) => update('imapUser', e.target.value)} /></label>
        {config.inboundProvider === 'imap' && <label className={labelClass}>IMAP password<select className={inputClass} value={config.imapAuthType} onChange={(e) => update('imapAuthType', e.target.value as 'password' | 'oauth2')}><option value="password">Password</option><option value="oauth2">OAuth2 access token</option></select></label>}
        {config.inboundProvider === 'imap' && <label className={labelClass}>IMAP password / token<input className={inputClass} type="password" value={config.imapPassword ?? ''} onChange={(e) => update('imapPassword', e.target.value)} placeholder="Leave empty to retain existing secret" /></label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.imapSecure} onChange={(e) => update('imapSecure', e.target.checked)} /> Use TLS / validate certificate</label>
      </div>
      {config.inboundProvider === 'exchange' && <div className="mt-5 grid gap-4 border-t border-gray-200 pt-4 md:grid-cols-2 dark:border-gray-700">
        <label className={labelClass}>Entra tenant ID<input className={inputClass} value={config.exchangeTenantId} onChange={(e) => update('exchangeTenantId', e.target.value)} /></label>
        <label className={labelClass}>Application (client) ID<input className={inputClass} value={config.exchangeClientId} onChange={(e) => update('exchangeClientId', e.target.value)} /></label>
        <label className={labelClass}>Client secret reference<input className={inputClass} value={config.exchangeClientSecretRef} onChange={(e) => update('exchangeClientSecretRef', e.target.value)} placeholder="env:EXCHANGE_CLIENT_SECRET" /></label>
        <label className={labelClass}>OAuth scope<input className={inputClass} value={config.exchangeScopes} onChange={(e) => update('exchangeScopes', e.target.value)} /></label>
      </div>}
    </section>

    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h2 className="font-semibold text-gray-900 dark:text-white">Ticket mapping and outbound SMTP</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Default ticket type<select className={inputClass} value={config.defaultTicketType} onChange={(e) => update('defaultTicketType', e.target.value)}><option value="incident">Incident</option><option value="service_request">Service request</option><option value="problem">Problem</option><option value="change">Change</option></select></label>
        <label className={labelClass}>Auto-assign handler e-mail<input className={inputClass} type="email" value={config.autoAssignToEmail} onChange={(e) => update('autoAssignToEmail', e.target.value)} placeholder="handler@example.com" /></label>
        <label className={labelClass}>Subject prefix<input className={inputClass} value={config.subjectPrefix} onChange={(e) => update('subjectPrefix', e.target.value)} /></label>
        <label className={labelClass}>SMTP authentication<select className={inputClass} value={config.smtpAuthType} onChange={(e) => update('smtpAuthType', e.target.value as GatewayConfig['smtpAuthType'])}><option value="none">None</option><option value="basic">Basic</option><option value="oauth2">OAuth2 (Exchange)</option></select></label>
        <label className={labelClass}>SMTP host<input className={inputClass} value={config.smtpHost} onChange={(e) => update('smtpHost', e.target.value)} /></label>
        <label className={labelClass}>SMTP port<input className={inputClass} type="number" value={config.smtpPort} onChange={(e) => update('smtpPort', Number(e.target.value))} /></label>
        <label className={labelClass}>SMTP user<input className={inputClass} value={config.smtpUser} onChange={(e) => update('smtpUser', e.target.value)} /></label>
        <label className={labelClass}>SMTP password<input className={inputClass} type="password" value={config.smtpPassword ?? ''} onChange={(e) => update('smtpPassword', e.target.value)} placeholder="Leave empty to retain existing secret" /></label>
        <label className={labelClass}>Sender e-mail<input className={inputClass} type="email" value={config.smtpFromEmail} onChange={(e) => update('smtpFromEmail', e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.smtpSecure} onChange={(e) => update('smtpSecure', e.target.checked)} /> SMTP uses implicit TLS</label>
      </div>
    </section>

    <div className="flex flex-wrap gap-3"><button onClick={save} disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save configuration'}</button><button onClick={() => void run('Inbound connection test', emailGatewayAdminApi.testInbound)} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Test inbound mailbox</button><button onClick={() => void run('SMTP connection test', emailGatewayAdminApi.testSmtp)} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Test SMTP</button><button onClick={() => void run('Mailbox polling', emailGatewayAdminApi.pollNow)} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Poll mailbox now</button></div>

    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"><h2 className="font-semibold text-gray-900 dark:text-white">Operational audit trail</h2><p className="mt-1 text-sm text-gray-500">Last poll: {status?.lastPollAt ? new Date(status.lastPollAt).toLocaleString() : 'never'} — {status?.lastPollMessage ?? 'no status'}</p><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-gray-500"><tr><th className="p-2">Received</th><th className="p-2">From</th><th className="p-2">Subject</th><th className="p-2">Status</th><th className="p-2">Ticket</th></tr></thead><tbody>{messages.map((message) => <tr key={message.id} className="border-b border-gray-100 dark:border-gray-800"><td className="p-2">{message.receivedAt ? new Date(message.receivedAt).toLocaleString() : '—'}</td><td className="p-2">{message.fromEmail}</td><td className="p-2">{message.subject}</td><td className="p-2">{message.status}</td><td className="p-2">{message.ticket?.displayId ?? '—'}</td></tr>)}{messages.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No e-mail messages recorded.</td></tr>}</tbody></table></div></section>
  </div>;
}
