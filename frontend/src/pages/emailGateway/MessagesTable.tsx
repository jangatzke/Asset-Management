/**
 * Operational audit trail table for recorded inbound e-mail messages.
 */
import { useI18n } from '../../context/I18nContext';
import { SortableTh } from '../../components/SortableTh';
import type { GatewayEmailMessage } from './types';

const sectionClass =
  'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900';

export interface MessagesTableProps {
  messages: GatewayEmailMessage[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc' | '';
  onSort: (column: string) => void;
}

export function MessagesTable({ messages, sortColumn, sortDirection, onSort }: MessagesTableProps) {
  const { t } = useI18n();
  return (
    <section className={sectionClass} aria-labelledby="gateway-audit-heading">
      <h2 id="gateway-audit-heading" className="font-semibold text-gray-900 dark:text-white">
        {t('emailGateway.auditTrail')}
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <SortableTh column="received" label={t('emailGateway.received')} activeColumn={sortColumn} direction={sortColumn === 'received' ? sortDirection : ''} onSort={onSort} />
              <SortableTh column="from" label={t('emailGateway.from')} activeColumn={sortColumn} direction={sortColumn === 'from' ? sortDirection : ''} onSort={onSort} />
              <SortableTh column="subject" label={t('emailGateway.subject')} activeColumn={sortColumn} direction={sortColumn === 'subject' ? sortDirection : ''} onSort={onSort} />
              <SortableTh column="status" label={t('common.status')} activeColumn={sortColumn} direction={sortColumn === 'status' ? sortDirection : ''} onSort={onSort} />
              <SortableTh column="ticket" label={t('emailGateway.ticket')} activeColumn={sortColumn} direction={sortColumn === 'ticket' ? sortDirection : ''} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr key={message.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2">{message.receivedAt ? new Date(message.receivedAt).toLocaleString() : '—'}</td>
                <td className="p-2">{message.fromEmail}</td>
                <td className="p-2">{message.subject}</td>
                <td className="p-2">{message.status}</td>
                <td className="p-2">{message.ticket?.displayId ?? '—'}</td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">{t('emailGateway.noMessages')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default MessagesTable;
