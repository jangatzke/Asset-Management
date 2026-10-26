const fs = require('fs');
const p = 'frontend/src/pages/BcmDetail.tsx';
let s = fs.readFileSync(p, 'utf8');

function rep(find, replace) {
  if (!s.includes(find)) { console.error('NOT FOUND: ' + find.slice(0, 90)); process.exitCode = 1; return; }
  s = s.split(find).join(replace);
}

// Add useI18n hook to subcomponents that render literal strings
const sigs = [
  "function AssetEditor({ assets, links, setAssets, setLinks }: any) {",
  "function StrategyEditor({ strategies, setStrategies, communications, setCommunications }: any) {",
  "function ExerciseEditor({ users, setUsers, participants, setParticipants, results, setResults, findings, setFindings, onCapa }: any) {",
];
for (const sig of sigs) rep(sig, sig + ' const { t } = useI18n();');

// Main component strings
rep("setError('The linked BCP must have an owner before creating a CAPA.');", "setError(t('bcm.detail.capaNeedsOwner'));");
rep('<Input label="Title" value={record.title}', "<Input label={t('common.title')} value={record.title}");
rep('<Picker label="Owner" entityType="user"', "<Picker label={t('bcm.detail.owner')} entityType=\"user\"");
rep('<Picker label="Business process" entityType="businessProcess"', "<Picker label={t('bcm.detail.businessProcess')} entityType=\"businessProcess\"");
rep('<Input label="MTPD minutes"', "<Input label={t('bcm.detail.mtpdMinutes')}");
rep('<Input label="RTO minutes"', "<Input label={t('bcm.detail.rtoMinutes')}");
rep('<Input label="RPO minutes"', "<Input label={t('bcm.detail.rpoMinutes')}");
rep('<Input label="Next review"', "<Input label={t('bcm.detail.nextReview')}");
rep('<Picker label="Derived from BIA"', "<Picker label={t('bcm.detail.derivedFromBia')}");
rep('<Input label="Scope"', "<Input label={t('bcm.detail.scope')}");
rep('<Input label="Next test"', "<Input label={t('bcm.nextTest')}");
rep('<Picker label="BCP" entityType="bcp"', "<Picker label={t('bcm.detail.bcpLabel')} entityType=\"bcp\"");
rep('<Input label="Exercise type"', "<Input label={t('bcm.detail.exerciseType')}");
rep('<Input label="Planned date"', "<Input label={t('bcm.detail.plannedDate')}");
rep('<Input label="Executed date"', "<Input label={t('bcm.detail.executedDate')}");

// AssetEditor
rep('<h2 className="font-semibold">Linked assets</h2>', "<h2 className=\"font-semibold\">{t('bcm.detail.linkedAssets')}</h2>");
rep('<EntityPicker label="Assets" labelKey="Assets"', '<EntityPicker labelKey="entities.assets"');
rep('<option value="dependency">Dependency</option>', "<option value=\"dependency\">{t('bcm.detail.roleDependency')}</option>");
rep('<option value="primary">Primary</option>', "<option value=\"primary\">{t('bcm.detail.rolePrimary')}</option>");
rep('<option value="supporting">Supporting</option>', "<option value=\"supporting\">{t('bcm.detail.roleSupporting')}</option>");

// StrategyEditor
rep('<h2 className="font-semibold">Recovery strategies</h2>', "<h2 className=\"font-semibold\">{t('bcm.detail.recoveryStrategies')}</h2>");
rep('<Input label="Strategy name"', "<Input label={t('bcm.detail.strategyName')}");
rep('<Input label="Steps (one per line)"', "<Input label={t('bcm.detail.stepsOnePerLine')}");
rep('>Add strategy</button>', ">{t('bcm.detail.addStrategy')}</button>");
rep('<h2 className="font-semibold">Communication plan</h2>', "<h2 className=\"font-semibold\">{t('bcm.detail.communicationPlan')}</h2>");
rep('<Input label="Audience"', "<Input label={t('bcm.detail.audience')}");
rep('<Input label="Channel"', "<Input label={t('bcm.detail.channel')}");
rep('<Input label="Message"', "<Input label={t('bcm.detail.message')}");
rep('>Add communication</button>', ">{t('bcm.detail.addCommunication')}</button>");

// ExerciseEditor
rep('<h2 className="font-semibold">Participants</h2>', "<h2 className=\"font-semibold\">{t('bcm.detail.participants')}</h2>");
rep('<EntityPicker label="Participants" labelKey="Participants"', '<EntityPicker labelKey="bcm.detail.participants"');
rep('<h2 className="font-semibold">Results</h2>', "<h2 className=\"font-semibold\">{t('bcm.detail.results')}</h2>");
rep('<Input label="Objective"', "<Input label={t('bcm.detail.objective')}");
rep('<option value="met">Met</option>', "<option value=\"met\">{t('bcm.detail.outcomeMet')}</option>");
rep('<option value="partially_met">Partially met</option>', "<option value=\"partially_met\">{t('bcm.detail.outcomePartiallyMet')}</option>");
rep('<option value="not_met">Not met</option>', "<option value=\"not_met\">{t('bcm.detail.outcomeNotMet')}</option>");
rep('>Add result</button>', ">{t('bcm.detail.addResult')}</button>");
rep('<h2 className="font-semibold">Findings and CAPA</h2>', "<h2 className=\"font-semibold\">{t('bcm.detail.findingsAndCapa')}</h2>");
rep('<Input label="Finding"', "<Input label={t('bcm.detail.finding')}");
rep('<Input label="Description"', "<Input label={t('common.description')}");
rep('>Create CAPA</button>', ">{t('bcm.detail.createCapa')}</button>");
rep('>Add finding</button>', ">{t('bcm.detail.addFinding')}</button>");

fs.writeFileSync(p, s);
console.log('done');
