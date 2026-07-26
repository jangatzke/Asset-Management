import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Risks from './pages/Risks';
import Controls from './pages/Controls';
import Incidents from './pages/Incidents';
import Login from './pages/Login';
import Settings from './pages/Settings';
import AdminUsers from './pages/AdminUsers';
import AdminRoles from './pages/AdminRoles';
import AdminGroups from './pages/AdminGroups';
import AdminAssetTypes from './pages/AdminAssetTypes';
import AdminOIDC from './pages/AdminOIDC';
import AdminIntune from './pages/AdminIntune';
import AdminVMware from './pages/AdminVMware';
import AdminProxmox from './pages/AdminProxmox';
import AdminReminders from './pages/AdminReminders';
import AdminFiscalYear from './pages/AdminFiscalYear';
import AdminAuthSettings from './pages/AdminAuthSettings';
import Contracts from './pages/Contracts';
import Licenses from './pages/Licenses';
import Processes from './pages/Processes';
import RiskAggregation from './pages/RiskAggregation';
import ISMSPhase6 from './pages/ISMSPhase6';
import CostPlanning from './pages/CostPlanning';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="assets" element={<Assets />} />
        <Route path="risks" element={<Risks />} />
        <Route path="controls" element={<Controls />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="licenses" element={<Licenses />} />
        <Route path="processes" element={<Processes />} />
        <Route path="cost-planning" element={<CostPlanning />} />
        <Route path="risk-aggregation" element={<RiskAggregation />} />
        <Route path="isms-operations" element={<ISMSPhase6 />} />
        <Route path="isms-phase6" element={<Navigate to="/isms-operations" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/roles" element={<AdminRoles />} />
        <Route path="admin/groups" element={<AdminGroups />} />
        <Route path="admin/asset-types" element={<AdminAssetTypes />} />
        <Route path="admin/oidc" element={<AdminOIDC />} />
        <Route path="admin/intune" element={<AdminIntune />} />
        <Route path="admin/vmware" element={<AdminVMware />} />
        <Route path="admin/proxmox" element={<AdminProxmox />} />
        <Route path="admin/reminders" element={<AdminReminders />} />
        <Route path="admin/fiscal-year" element={<AdminFiscalYear />} />
        <Route path="admin/auth-settings" element={<AdminAuthSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
