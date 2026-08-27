import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Assets = lazy(() => import('./pages/Assets'));
const Risks = lazy(() => import('./pages/Risks'));
const Controls = lazy(() => import('./pages/Controls'));
const Incidents = lazy(() => import('./pages/Incidents'));
const IncidentDetail = lazy(() => import('./pages/IncidentDetail'));
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminRoles = lazy(() => import('./pages/AdminRoles'));
const AdminGroups = lazy(() => import('./pages/AdminGroups'));
const AdminAssetTypes = lazy(() => import('./pages/AdminAssetTypes'));
const AdminOrganizationUnits = lazy(() => import('./pages/AdminOrganizationUnits'));
const AdminOIDC = lazy(() => import('./pages/AdminOIDC'));
const AdminIntune = lazy(() => import('./pages/AdminIntune'));
const AdminVMware = lazy(() => import('./pages/AdminVMware'));
const AdminProxmox = lazy(() => import('./pages/AdminProxmox'));
const AdminReminders = lazy(() => import('./pages/AdminReminders'));
const AdminFiscalYear = lazy(() => import('./pages/AdminFiscalYear'));
const AdminAuthSettings = lazy(() => import('./pages/AdminAuthSettings'));
const AdminDatabase = lazy(() => import('./pages/AdminDatabase'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Licenses = lazy(() => import('./pages/Licenses'));
const Processes = lazy(() => import('./pages/Processes'));
const RiskAggregation = lazy(() => import('./pages/RiskAggregation'));
const ISMSPhase6 = lazy(() => import('./pages/ISMSPhase6'));
const AuditWorkspace = lazy(() => import('./pages/AuditWorkspace'));
const BcmDetail = lazy(() => import('./pages/BcmDetail'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'));
const RiskDetail = lazy(() => import('./pages/RiskDetail'));
const CostPlanning = lazy(() => import('./pages/CostPlanning'));
const ActionCenter = lazy(() => import('./pages/ActionCenter'));
const NIS2 = lazy(() => import('./pages/NIS2'));
const OperationsWorkspace = lazy(() => import('./pages/OperationsWorkspace'));
const ISMSProcessWorkspace = lazy(() => import('./pages/ismsProcessWorkspace'));

const LoadingSpinner = (
  <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" aria-hidden="true" />
      <span className="text-sm text-gray-600 dark:text-gray-400">Loading…</span>
    </div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={LoadingSpinner}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="assets" element={<Assets />} />
            <Route path="risks" element={<Risks />} />
            <Route path="risks/:riskId" element={<RiskDetail />} />
            <Route path="controls" element={<Controls />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="incidents/:incidentId" element={<IncidentDetail />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="licenses" element={<Licenses />} />
            <Route path="processes" element={<Processes />} />
            <Route path="cost-planning" element={<CostPlanning />} />
            <Route path="action-center" element={<ActionCenter />} />
            <Route path="nis2" element={<NIS2 />} />
            <Route path="risk-aggregation" element={<RiskAggregation />} />
            <Route path="isms-operations" element={<ISMSPhase6 />} />
            <Route path="isms-operations/workspace" element={<OperationsWorkspace />} />
            <Route path="isms-operations/process" element={<ISMSProcessWorkspace />} />
            <Route path="isms-operations/audits" element={<AuditWorkspace />} />
            <Route path="isms-operations/bcm/:kind/:id" element={<BcmDetail />} />
            <Route path="isms-operations/suppliers/:supplierId" element={<SupplierDetail />} />
            <Route path="isms-phase6" element={<Navigate to="/isms-operations" replace />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/roles" element={<AdminRoles />} />
            <Route path="admin/groups" element={<AdminGroups />} />
            <Route path="admin/asset-types" element={<AdminAssetTypes />} />
            <Route path="admin/organization-units" element={<AdminOrganizationUnits />} />
            <Route path="admin/oidc" element={<AdminOIDC />} />
            <Route path="admin/intune" element={<AdminIntune />} />
            <Route path="admin/vmware" element={<AdminVMware />} />
            <Route path="admin/proxmox" element={<AdminProxmox />} />
            <Route path="admin/reminders" element={<AdminReminders />} />
            <Route path="admin/fiscal-year" element={<AdminFiscalYear />} />
            <Route path="admin/auth-settings" element={<AdminAuthSettings />} />
            <Route path="admin/database" element={<AdminDatabase />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
