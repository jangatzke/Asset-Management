const fs = require('fs');
const p = 'frontend/src/pages/IncidentDetail.tsx';
let s = fs.readFileSync(p, 'utf8');

// Remove module-level reportLabels + asErrorMessage (CRLF-tolerant)
const blockRe = /const reportLabels: Record<IncidentReportType, string> = \{[\s\S]*?\};\r?\n\r?\nconst asErrorMessage = \(error: any\) => [^\r\n]*'The requested action could not be completed\.';\r?\n/;
if (!blockRe.test(s)) { console.error('BLOCK NOT FOUND'); process.exit(1); }
s = s.replace(blockRe, '');

// Insert hook + translated helpers after nis2Form state line
const anchor = "  const [nis2Form, setNis2Form] = useState({ earlyWarningDescription: '', notificationDescription: '', finalReportDescription: '', finalReportContent: '' });";
if (!s.includes(anchor)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
const insertion = anchor + `
  const { t } = useI18n();
  const reportLabels: Record<IncidentReportType, string> = {
    early_warning_24h: t('incidents.detail.reportTypes.earlyWarning'),
    incident_notification_72h: t('incidents.detail.reportTypes.notification72h'),
    interim_report: t('incidents.detail.reportTypes.interimReport'),
    monthly_final_report: t('incidents.detail.reportTypes.finalReport'),
  };
  const asErrorMessage = (error: any) => error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || t('incidents.detail.actionFailed');`;
s = s.replace(anchor, insertion);

fs.writeFileSync(p, s);
console.log('done');
