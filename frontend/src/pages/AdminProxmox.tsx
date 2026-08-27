import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  Box,
  Typography,
  Button,
  Switch,
  TextField,
  Alert,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
} from '@mui/material';
import { DiscardConfirmationDialog } from '../components/DiscardConfirmationDialog';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CloudIcon from '@mui/icons-material/Cloud';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { proxmoxApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { useDarkMode } from '../context/DarkModeContext';

interface ProxmoxCredential {
  id: string;
  name: string;
  username: string;
  hasPassword: boolean;
  hasApiToken: boolean;
  isDefault: boolean;
  proxmoxServerCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProxmoxServer {
  id: string;
  name: string;
  host: string;
  port: number;
  nodeId: string | null;
  credentialId: string;
  credentialName?: string;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  vmCount: number;
  createdAt: string;
  updatedAt: string;
}

const syncStatusColors: Record<string, string> = {
  idle: '#9e9e9e',
  pending: '#2196ff',
  running: '#2196ff',
  success: '#4caf50',
  error: '#f44336',
};

export default function AdminProxmox() {
  const { t } = useI18n();
  const { darkMode } = useDarkMode();
  const muiTheme = useMemo(() => createTheme({ palette: { mode: darkMode ? 'dark' : 'light' } }), [darkMode]);

  // Credential state
  interface CredentialFormValues {
    name: string;
    username: string;
    password: string;
    confirmPassword: string;
    apiToken: string;
    useApiToken: boolean;
  }

  const [credentials, setCredentials] = useState<ProxmoxCredential[]>([]);
  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [credDiscardConfirmOpen, setCredDiscardConfirmOpen] = useState(false);
  const credPendingClose = useRef<(() => void) | null>(null);
  const credentialForm = useDirtyForm<CredentialFormValues>({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    apiToken: '',
    useApiToken: false,
  });

  // Proxmox server state
  interface ServerFormValues {
    name: string;
    host: string;
    port: number;
    nodeId: string;
    credentialId: string;
  }

  const [servers, setServers] = useState<ProxmoxServer[]>([]);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverDiscardConfirmOpen, setServerDiscardConfirmOpen] = useState(false);
  const serverPendingClose = useRef<(() => void) | null>(null);
  const serverForm = useDirtyForm<ServerFormValues>({
    name: '',
    host: '',
    port: 8006,
    nodeId: '',
    credentialId: '',
  });

  // Loading and status state
  const [importing, setImporting] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadCredentials();
    loadServers();
  }, []);

  // ---- Credential Functions ----

  const loadCredentials = async () => {
    try {
      const res = await proxmoxApi.getCredentials();
      setCredentials(res.data);
    } catch (e) {
      console.error('Failed to load Proxmox credentials:', e);
    }
  };

  const openCreateCredentialDialog = () => {
    setEditingCredId(null);
    credentialForm.setFormValues({
      name: '',
      username: '',
      password: '',
      confirmPassword: '',
      apiToken: '',
      useApiToken: false,
    });
    setCredDialogOpen(true);
  };

  const openEditCredentialDialog = (cred: ProxmoxCredential) => {
    setEditingCredId(cred.id);
    credentialForm.setFormValues({
      name: cred.name,
      username: cred.username,
      password: '',
      confirmPassword: '',
      apiToken: '',
      useApiToken: cred.hasApiToken && !cred.hasPassword,
    });
    setCredDialogOpen(true);
  };

  const handleSaveCredential = async () => {
    const { name, username, password, confirmPassword, apiToken, useApiToken: useApiTokenForm } = credentialForm.values;
    if (!name.trim() || !username.trim()) {
      setAlert({ type: 'error', message: 'Name and username are required' });
      return;
    }

    if (editingCredId) {
      // Update existing credential
      const data: any = { name, username };
      if (!useApiTokenForm && password) {
        if (password !== confirmPassword) {
          setAlert({ type: 'error', message: 'Passwords do not match' });
          return;
        }
        data.password = password;
      }
      if (useApiTokenForm && apiToken) {
        data.apiToken = apiToken;
      }
      try {
        await proxmoxApi.updateCredential(editingCredId, data);
        setAlert({ type: 'success', message: 'Credential updated successfully' });
        setCredDialogOpen(false);
        loadCredentials();
      } catch (e: any) {
        setAlert({ type: 'error', message: e.response?.data?.error?.message || t('proxmox.updateCredentialError') });
      }
    } else {
      // Create new credential
      if (!useApiTokenForm && !password) {
        setAlert({ type: 'error', message: 'Password is required for new credentials (password auth)' });
        return;
      }
      if (!useApiTokenForm && password !== confirmPassword) {
        setAlert({ type: 'error', message: 'Passwords do not match' });
        return;
      }
      try {
        const payload: any = { name, username };
        if (useApiTokenForm) {
          payload.apiToken = apiToken;
        } else {
          payload.password = password;
        }
        await proxmoxApi.createCredential(payload);
        setAlert({ type: 'success', message: 'Credential created successfully' });
        setCredDialogOpen(false);
        loadCredentials();
      } catch (e: any) {
        setAlert({ type: 'error', message: e.response?.data?.error?.message || t('proxmox.createCredentialError') });
      }
    }
  };

  // ---- Credential Dialog Handlers ----
  const handleCredDiscard = useCallback(() => {
    credentialForm.resetForm();
    setCredDialogOpen(false);
  }, [credentialForm]);

  const handleCredModalClose = useCallback(() => {
    if (credentialForm.isDirty) {
      credPendingClose.current = () => setCredDialogOpen(false);
      setCredDiscardConfirmOpen(true);
    } else {
      setCredDialogOpen(false);
    }
  }, [credentialForm]);

  const handleDeleteCredential = async (id: string) => {
    if (!window.confirm(t('proxmox.deleteCredentialConfirm'))) return;
    try {
      await proxmoxApi.deleteCredential(id);
      setAlert({ type: 'success', message: 'Credential deleted successfully' });
      loadCredentials();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('proxmox.deleteCredentialError') });
    }
  };

  // ---- Proxmox Server Functions ----

  const loadServers = async () => {
    try {
      const res = await proxmoxApi.getServers();
      setServers(res.data);
    } catch (e) {
      console.error('Failed to load Proxmox servers:', e);
    }
  };

  const openCreateServerDialog = () => {
    setEditingServerId(null);
    serverForm.setFormValues({
      name: '',
      host: '',
      port: 8006,
      nodeId: '',
      credentialId: credentials.find((c) => c.isDefault)?.id || credentials[0]?.id || '',
    });
    setServerDialogOpen(true);
  };

  const openEditServerDialog = (server: ProxmoxServer) => {
    setEditingServerId(server.id);
    serverForm.setFormValues({
      name: server.name,
      host: server.host,
      port: server.port,
      nodeId: server.nodeId || '',
      credentialId: server.credentialId,
    });
    setServerDialogOpen(true);
  };

  const handleSaveServer = async () => {
    const { name, host, port, nodeId, credentialId } = serverForm.values;
    if (!name.trim() || !host.trim() || !credentialId) {
      setAlert({ type: 'error', message: 'Name, host, and credential are required' });
      return;
    }

    try {
      const payload: any = {
        name,
        host,
        port,
        credentialId,
      };
      if (nodeId) {
        payload.nodeId = nodeId;
      }

      if (editingServerId) {
        await proxmoxApi.updateServer(editingServerId, payload);
        setAlert({ type: 'success', message: 'Proxmox server updated successfully' });
      } else {
        await proxmoxApi.createServer(payload);
        setAlert({ type: 'success', message: 'Proxmox server created successfully' });
      }
      setServerDialogOpen(false);
      loadServers();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('proxmox.saveServerError') });
    }
  };

  // ---- Server Dialog Handlers ----
  const handleServerDiscard = useCallback(() => {
    serverForm.resetForm();
    setServerDialogOpen(false);
  }, [serverForm]);

  const handleServerModalClose = useCallback(() => {
    if (serverForm.isDirty) {
      serverPendingClose.current = () => setServerDialogOpen(false);
      setServerDiscardConfirmOpen(true);
    } else {
      setServerDialogOpen(false);
    }
  }, [serverForm]);

  const handleDeleteServer = async (id: string) => {
    if (!window.confirm(t('proxmox.deleteServerConfirm'))) return;
    try {
      await proxmoxApi.deleteServer(id);
      setAlert({ type: 'success', message: 'Proxmox server deleted successfully' });
      loadServers();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('proxmox.deleteServerError') });
    }
  };

  const handleToggleEnabled = async (server: ProxmoxServer) => {
    try {
      await proxmoxApi.updateServer(server.id, { enabled: !server.enabled });
      loadServers();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('proxmox.updateServerError') });
    }
  };

  const handleTestConnection = async (id: string) => {
    setTesting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await proxmoxApi.testConnection(id);
      if (res.data.success) {
        setAlert({ type: 'success', message: `Connection to Proxmox successful` });
      } else {
        setAlert({ type: 'error', message: `Connection failed: ${res.data.message}` });
      }
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('proxmox.connectionTestFailed') });
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleImportVMs = async (id: string, dryRun?: boolean) => {
    setImporting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await proxmoxApi.importVMs(id, dryRun);
      const mode = res.data.dryRun ? 'Dry run - ' : '';
      setAlert({
        type: 'success',
        message: `${mode}Imported ${res.data.imported} VMs/containers, updated ${res.data.updated}, errors: ${res.data.errors.length}`,
      });
      if (res.data.errors.length > 0) {
        console.warn('Import errors:', res.data.errors);
      }
      loadServers();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('proxmox.importFailed') });
    } finally {
      setImporting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Proxmox VE Integration
      </Typography>

      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {/* ---- Credentials Section ---- */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper', color: 'text.primary' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              <VpnKeyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Proxmox Credentials
            </Typography>
            <Button variant="contained" onClick={openCreateCredentialDialog}>
              Add Credential
            </Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Auth Type</TableCell>
                  <TableCell>Server Count</TableCell>
                  <TableCell>Default</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {credentials.map((cred) => (
                  <TableRow key={cred.id}>
                    <TableCell>{cred.name}</TableCell>
                    <TableCell>{cred.username}</TableCell>
                    <TableCell>
                      {cred.hasPassword && <Chip label="Password" size="small" color="primary" />}
                      {cred.hasApiToken && <Chip label="API Token" size="small" color="secondary" sx={{ ml: 0.5 }} />}
                    </TableCell>
                    <TableCell>{cred.proxmoxServerCount}</TableCell>
                    <TableCell>
                      {cred.isDefault && <Chip label="Default" size="small" color="primary" />}
                    </TableCell>
                    <TableCell>{formatDate(cred.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditCredentialDialog(cred)}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteCredential(cred.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {credentials.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No credentials configured
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ---- Proxmox Servers Section ---- */}
      <Card sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Proxmox Servers
            </Typography>
            <Button variant="contained" onClick={openCreateServerDialog} disabled={credentials.length === 0}>
              Add Proxmox Server
            </Button>
          </Box>

          {credentials.length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Please add Proxmox credentials first before configuring servers.
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Host</TableCell>
                  <TableCell>Node</TableCell>
                  <TableCell>Credential</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell>VM Count</TableCell>
                  <TableCell>Last Sync</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell>{server.name}</TableCell>
                    <TableCell>
                      {server.host}
                      {server.port !== 8006 && `:${server.port}`}
                    </TableCell>
                    <TableCell>{server.nodeId || 'All Nodes'}</TableCell>
                    <TableCell>{server.credentialName || server.credentialId}</TableCell>
                    <TableCell>
                      <Switch
                        size="small"
                        checked={server.enabled}
                        onChange={() => handleToggleEnabled(server)}
                      />
                    </TableCell>
                    <TableCell>{server.vmCount}</TableCell>
                    <TableCell>{formatDate(server.lastSyncAt)}</TableCell>
                    <TableCell>
                      {server.lastSyncStatus && (
                        <Chip
                          label={server.lastSyncStatus}
                          size="small"
                          sx={{
                            bgcolor: syncStatusColors[server.lastSyncStatus] || '#9e9e9e',
                            color: server.lastSyncStatus === 'success' ? 'white' : '#fff',
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Test Connection">
                        <IconButton
                          size="small"
                          onClick={() => handleTestConnection(server.id)}
                          disabled={testing[server.id]}
                        >
                          {testing[server.id] ? (
                            <CircularProgress size={16} />
                          ) : (
                            <CheckCircleIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Import VMs/Containers">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleImportVMs(server.id)}
                          disabled={!server.enabled || importing[server.id]}
                        >
                          {importing[server.id] ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <SyncIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dry Run Import">
                        <IconButton
                          size="small"
                          onClick={() => handleImportVMs(server.id, true)}
                          disabled={!server.enabled || importing[server.id]}
                        >
                          <WarningIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditServerDialog(server)}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteServer(server.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {servers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No Proxmox servers configured
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {servers.some((s) => s.lastSyncError) && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="error">
                Last sync errors:
              </Typography>
              {servers
                .filter((s) => s.lastSyncError)
                .map((s) => (
                  <Box key={s.id} component="div" sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="error">
                      • {s.name}: {s.lastSyncError}
                    </Typography>
                  </Box>
                ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ---- Credential Dialog ---- */}
      <Dialog open={credDialogOpen} onClose={handleCredModalClose}>
        <DialogTitle>{editingCredId ? t('proxmox.editCredential') : t('proxmox.addCredential')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 350 }}>
            <TextField
              label={t('common.name')}
              value={credentialForm.values.name}
              onChange={(e) => credentialForm.handleChange({ name: e.target.value })}
              fullWidth
              placeholder="e.g. Production PVE"
            />
            <TextField
              label={t('proxmox.username')}
              value={credentialForm.values.username}
              onChange={(e) => credentialForm.handleChange({ username: e.target.value })}
              fullWidth
              placeholder="e.g. admin@pam"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={credentialForm.values.useApiToken}
                  onChange={(e) => credentialForm.handleChange({ useApiToken: e.target.checked })}
                />
              }
              label={t('proxmox.useApiToken')}
            />
            {credentialForm.values.useApiToken ? (
              <TextField
                label={editingCredId ? t('proxmox.newApiTokenKeep') : t('proxmox.apiToken')}
                type="password"
                value={credentialForm.values.apiToken}
                onChange={(e) => credentialForm.handleChange({ apiToken: e.target.value })}
                fullWidth
                placeholder="PVEAPIToken=<user>=<token-id>=<hash>"
              />
            ) : (
              <>
                <TextField
                  label={editingCredId ? t('proxmox.newPasswordKeep') : t('login.password')}
                  type="password"
                  value={credentialForm.values.password}
                  onChange={(e) => credentialForm.handleChange({ password: e.target.value })}
                  fullWidth
                />
                {credentialForm.values.password && (
                  <TextField
                    label={t('proxmox.confirmPassword')}
                    type="password"
                    value={credentialForm.values.confirmPassword}
                    onChange={(e) => credentialForm.handleChange({ confirmPassword: e.target.value })}
                    fullWidth
                    error={!!credentialForm.values.confirmPassword && credentialForm.values.password !== credentialForm.values.confirmPassword}
                    helperText={
                      credentialForm.values.confirmPassword && credentialForm.values.password !== credentialForm.values.confirmPassword ? t('proxmox.passwordsDoNotMatch') : ''
                    }
                  />
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { if (credentialForm.isDirty) { credPendingClose.current = () => setCredDialogOpen(false); setCredDiscardConfirmOpen(true); } else { setCredDialogOpen(false); } }}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSaveCredential}>
            {editingCredId ? t('common.update') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      <DiscardConfirmationDialog
        open={credDiscardConfirmOpen}
        onClose={() => {
          setCredDiscardConfirmOpen(false);
          if (credPendingClose.current) {
            credPendingClose.current();
            credPendingClose.current = null;
          }
        }}
        onDiscard={handleCredDiscard}
        titleKey="Discard Changes"
        messageKey="You have unsaved changes. Are you sure you want to discard them?"
      />

      {/* ---- Proxmox Server Dialog ---- */}
      <Dialog open={serverDialogOpen} onClose={handleServerModalClose}>
        <DialogTitle>{editingServerId ? t('proxmox.editServer') : t('proxmox.addServer')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 350 }}>
            <TextField
              label={t('common.name')}
              value={serverForm.values.name}
              onChange={(e) => serverForm.handleChange({ name: e.target.value })}
              fullWidth
              placeholder="e.g. Production PVE Cluster"
            />
            <TextField
              label={t('proxmox.host')}
              value={serverForm.values.host}
              onChange={(e) => serverForm.handleChange({ host: e.target.value })}
              fullWidth
              placeholder="e.g. pve.example.com"
            />
            <TextField
              label={t('proxmox.port')}
              type="number"
              value={serverForm.values.port}
              onChange={(e) => serverForm.handleChange({ port: Number(e.target.value) })}
              fullWidth
            />
            <TextField
              label={t('proxmox.nodeIdOptional')}
              value={serverForm.values.nodeId}
              onChange={(e) => serverForm.handleChange({ nodeId: e.target.value })}
              fullWidth
              placeholder="e.g. pve1"
            />
            <FormControl fullWidth error={!serverForm.values.credentialId}>
              <InputLabel>{t('proxmox.credential')}</InputLabel>
              <Select
                value={serverForm.values.credentialId}
                label={t('proxmox.credential')}
                onChange={(e) => serverForm.handleChange({ credentialId: e.target.value })}
              >
                {credentials.map((cred) => (
                  <MenuItem key={cred.id} value={cred.id}>
                    {cred.name} ({cred.username})
                    {cred.isDefault && ` - ${t('proxmox.default')}`}
                  </MenuItem>
                ))}
              </Select>
              {!serverForm.values.credentialId && <FormHelperText>{t('proxmox.selectCredential')}</FormHelperText>}
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { if (serverForm.isDirty) { serverPendingClose.current = () => setServerDialogOpen(false); setServerDiscardConfirmOpen(true); } else { setServerDialogOpen(false); } }}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSaveServer}>
            {editingServerId ? t('common.update') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      <DiscardConfirmationDialog
        open={serverDiscardConfirmOpen}
        onClose={() => {
          setServerDiscardConfirmOpen(false);
          if (serverPendingClose.current) {
            serverPendingClose.current();
            serverPendingClose.current = null;
          }
        }}
        onDiscard={handleServerDiscard}
        titleKey="Discard Changes"
        messageKey="You have unsaved changes. Are you sure you want to discard them?"
      />
    </Box>
  </ThemeProvider>
);
}
