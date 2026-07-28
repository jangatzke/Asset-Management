import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { riskApi } from '../services/api';
import { useI18n } from '../context/I18nContext';

interface RiskAssessmentVersion {
  id: string;
  assessmentType: 'inherent' | 'current' | 'target';
  likelihood: number;
  impact: number;
  inherentRisk: string;
  residualRisk: string;
  targetRisk: string;
  isCurrent: boolean;
  status?: string;
}

interface RiskControlLink {
  id: string;
  controlImplementationId: string;
  role: string;
  mitigationDimension: string;
  isKeyControl: boolean;
  status: string;
  controlImplementation?: { id: string; implementationStatus?: string; control?: { title: string } };
}

interface Risk {
  id: string;
  displayId: string;
  title: string;
  description: string;
  status: string;
  likelihood: number;
  impact: number;
  targetRisk?: string;
  riskOwnerId?: string;
  assessorId?: string;
  organizationUnitId?: string;
  processId?: string;
  nextReviewDate?: string;
  RiskAssessment?: RiskAssessmentVersion[];
  riskControls?: RiskControlLink[];
}

type TabKey = 'overview' | 'assessment' | 'controls' | 'treatment' | 'evidence' | 'history' | 'audit';

const tabs: { key: TabKey; labelKey: string }[] = [
  { key: 'overview', labelKey: 'riskDetail.tabs.overview' },
  { key: 'assessment', labelKey: 'riskDetail.tabs.assessment' },
  { key: 'controls', labelKey: 'riskDetail.tabs.controls' },
  { key: 'treatment', labelKey: 'riskDetail.tabs.treatment' },
  { key: 'evidence', labelKey: 'riskDetail.tabs.evidence' },
  { key: 'history', labelKey: 'riskDetail.tabs.history' },
  { key: 'audit', labelKey: 'riskDetail.tabs.audit' },
];

const RiskDetail = () => {
  const { t } = useI18n();
  const { riskId } = useParams<{ riskId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!riskId) return;
    loadRisk();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Risk detail reload is intentionally keyed to route riskId.
  }, [riskId]);

  const loadRisk = async () => {
    try {
      setLoading(true);
      const response = await riskApi.getById(riskId!);
      setRisk(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || t('risks.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 15) return 'text-red-600 dark:text-red-400';
    if (score >= 8) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const renderOverview = () => {
    if (!risk) return null;
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('common.title')}</h3>
          <p className="text-gray-700 dark:text-gray-300">{risk.title}</p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('common.description')}</h3>
          <p className="text-gray-700 dark:text-gray-300">{risk.description || '-'}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('risks.likelihood')}</h3>
            <p className={`text-xl font-bold ${getScoreColor(risk.likelihood)}`}>{risk.likelihood}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('risks.impact')}</h3>
            <p className={`text-xl font-bold ${getScoreColor(risk.impact)}`}>{risk.impact}</p>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</h3>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            risk.status === 'open' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
            risk.status === 'mitigated' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
            'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
          }`}>
            {risk.status}
          </span>
        </div>
      </div>
    );
  };

  const renderAssessment = () => {
    if (!risk) return null;
    const assessments = risk.RiskAssessment || [];
    if (assessments.length === 0) {
      return <p className="text-gray-500 dark:text-gray-400">{t('risks.noAssessments')}</p>;
    }
    return (
      <div className="space-y-4">
        {assessments.map(a => (
          <div key={a.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {t(`risks.assessmentType.${a.assessmentType}`)}
              </h4>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                a.isCurrent ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {a.isCurrent ? t('risks.current') : ''}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('risks.likelihood')}</p>
                <p className="font-medium">{a.likelihood}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('risks.impact')}</p>
                <p className="font-medium">{a.impact}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t(`risks.riskLevel.${a.assessmentType}`)}</p>
                <p className={`font-bold ${getScoreColor(a.assessmentType === 'inherent' ? a.likelihood * a.impact : a.assessmentType === 'current' ? (a.likelihood + a.impact) / 2 : parseInt(a.targetRisk || '0'))}`}>
                  {a.inherentRisk}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderControls = () => {
    if (!risk) return null;
    const controls = risk.riskControls || [];
    if (controls.length === 0) {
      return <p className="text-gray-500 dark:text-gray-400">{t('risks.noControls')}</p>;
    }
    return (
      <div className="space-y-3">
        {controls.map(c => (
          <div key={c.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {c.controlImplementation?.control?.title || c.controlImplementationId}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{c.role}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                c.isKeyControl ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {c.isKeyControl ? t('risks.keyControl') : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTreatment = () => {
    return (
      <div className="space-y-4">
        <p className="text-gray-500 dark:text-gray-400">{t('risks.treatmentDescription')}</p>
        <button
          type="button"
          onClick={() => navigate(`/risks/${riskId}/treatment/new`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {t('common.create')}
        </button>
      </div>
    );
  };

  const renderEvidence = () => {
    return (
      <div className="space-y-4">
        <p className="text-gray-500 dark:text-gray-400">{t('risks.evidenceDescription')}</p>
      </div>
    );
  };

  const renderHistory = () => {
    if (!risk) return null;
    const assessments = risk.RiskAssessment || [];
    if (assessments.length === 0) {
      return <p className="text-gray-500 dark:text-gray-400">{t('risks.noHistory')}</p>;
    }
    return (
      <div className="space-y-3">
        {assessments.map((a, idx) => (
          <div key={a.id} className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 pb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">v{idx + 1}</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{t(`risks.assessmentType.${a.assessmentType}`)}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              a.status === 'closed' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
            }`}>
              {a.status || 'active'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderAudit = () => {
    return (
      <div className="space-y-4">
        <p className="text-gray-500 dark:text-gray-400">{t('risks.auditTrailDescription')}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('risks.auditTrailComingSoon')}</p>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'assessment': return renderAssessment();
      case 'controls': return renderControls();
      case 'treatment': return renderTreatment();
      case 'evidence': return renderEvidence();
      case 'history': return renderHistory();
      case 'audit': return renderAudit();
      default: return null;
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  if (error) {
    return <div className="text-red-600 dark:text-red-400 p-4">{error}</div>;
  }

  if (!risk) {
    return <div className="text-gray-500 dark:text-gray-400 p-4">{t('risks.notFound')}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/risks')}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
        >
          {t('common.back')}
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{risk.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{risk.displayId}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default RiskDetail;
