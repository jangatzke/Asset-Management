import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDirtyForm } from '../hooks/useDirtyForm';
import {
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
  Box,
} from '@mui/material';
import { DiscardConfirmationDialog } from '../components/DiscardConfirmationDialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CloudIcon from '@mui/icons-material/Cloud';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { vmwareApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { useDarkMode } from '../context/DarkModeContext';

interface VMwareCredential {
  id: string;
  name: string;
  username: string;
  isDefault: boolean;
  vCenterCount: number;
  createdAt: string;
  updatedAt: string;
}

interface VCenterServer {
  id: string;
  name: string;
  host: string;
  port: number;
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

export default function AdminVMware() {
  const { t, language } = useI18n();
  const { darkMode } = useDarkMode();
  const muiTheme = useMemo(() => createTheme({ palette: { mode: darkMode ? 'dark' : 'light' } }), [darkMode]);

  // Credential state
  interface CredentialFormValues {
    name: string;
    username: string;
    password?: string;
    confirmPassword?: string;
  }

  const [credentials, setCredentials] = useState<VMwareCredential[]>([]);
  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [credDiscardConfirmOpen, setCredDiscardConfirmOpen] = useState(false);
  const credPendingClose = useRef<(() => void) | null>(null);
  const credentialForm = useDirtyForm<CredentialFormValues>({
    name: '',
    username: '',
  });

  // vCenter server state
  interface ServerFormValues {
    name: string;
    host: string;
    port: number;
    credentialId: string;
  }

  const [servers, setServers] = useState<VCenterServer[]>([]);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverDiscardConfirmOpen, setServerDiscardConfirmOpen] = useState(false);
  const serverPendingClose = useRef<(() => void) | null>(null);
  const serverForm = useDirtyForm<ServerFormValues>({
    name: '',
    host: '',
    port: 443,
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
      const res = await vmwareApi.getCredentials();
      setCredentials(res.data);
    } catch (e) {
      console.error('Failed to load VMware credentials:', e);
    }
  };

  const openCreateCredentialDialog = () => {
    setEditingCredId(null);
    credentialForm.setFormValues({
      name: '',
      username: '',
    });
    setCredDialogOpen(true);
  };

  const openEditCredentialDialog = (cred: VMwareCredential) => {
    setEditingCredId(cred.id);
    credentialForm.setFormValues({
      name: cred.name,
      username: cred.username,
    });
    setCredDialogOpen(true);
  };

  const handleSaveCredential = async () => {
    if (!credentialForm.values.name.trim() || !credentialForm.values.username.trim()) {
      setAlert({ type: 'error', message: t('common.requiredField') });
      return;
    }

    if (editingCredId) {
      // Update existing credential
      const data: any = { name: credentialForm.values.name, username: credentialForm.values.username };
      if (credentialForm.values.password) {
        if (credentialForm.values.password !== credentialForm.values.confirmPassword) {
          setAlert({ type: 'error', message: t('vmware.passwordsDoNotMatch') });
          return;
        }
        data.password = credentialForm.values.password;
      }
      try {
        await vmwareApi.updateCredential(editingCredId, data);
        setAlert({ type: 'success', message: t('common.saveSuccess') });
        setCredDialogOpen(false);
        loadCredentials();
      } catch (e: any) {
        setAlert({ type: 'error', message: e.response?.data?.error?.message || t('vmware.saveCredentialError') });
      }
    } else {
      // Create new credential
      if (!credentialForm.values.password) {
        setAlert({ type: 'error', message: t('common.requiredField') });
        return;
      }
      if (credentialForm.values.password !== credentialForm.values.confirmPassword) {
        setAlert({ type: 'error', message: t('vmware.passwordsDoNotMatch') });
        return;
      }
      try {
        await vmwareApi.createCredential({
          name: credentialForm.values.name,
          username: credentialForm.values.username,
          password: credentialForm.values.password
        });
        setAlert({ type: 'success', message: t('common.saveSuccess') });
        setCredDialogOpen(false);
        loadCredentials();
      } catch (e: any) {
        setAlert({ type: 'error', message: e.response?.data?.error?.message || t('vmware.saveCredentialError') });
      }
    }
  };

  const handleDeleteCredential = async (id: string) => {
    if (!window.confirm(t('vmware.deleteCredentialConfirm'))) return;
    try {
      await vmwareApi.deleteCredential(id);
      setAlert({ type: 'success', message: t('common.deleteSuccess') });
      loadCredentials();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('common.deleteError') });
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

  // ---- vCenter Server Functions ----

  const loadServers = async () => {
    try {
      const res = await vmwareApi.getServers();
      setServers(res.data);
    } catch (e) {
      console.error('Failed to load vCenter servers:', e);
    }
  };

  const openCreateServerDialog = () => {
    setEditingServerId(null);
    serverForm.setFormValues({
      name: '',
      host: '',
      port: 443,
      credentialId: credentials.find((c) => c.isDefault)?.id || credentials[0]?.id || '',
    });
    setServerDialogOpen(true);
  };

  const openEditServerDialog = (server: VCenterServer) => {
    setEditingServerId(server.id);
    serverForm.setFormValues({
      name: server.name,
      host: server.host,
      port: server.port,
      credentialId: server.credentialId,
    });
    setServerDialogOpen(true);
  };

  const handleSaveServer = async () => {
    if (!serverForm.values.name.trim() || !serverForm.values.host.trim() || !serverForm.values.credentialId) {
      setAlert({ type: 'error', message: t('common.requiredField') });
      return;
    }

    try {
      if (editingServerId) {
        await vmwareApi.updateServer(editingServerId, serverForm.values);
        setAlert({ type: 'success', message: t('common.saveSuccess') });
      } else {
        await vmwareApi.createServer(serverForm.values);
        setAlert({ type: 'success', message: t('common.saveSuccess') });
      }
      setServerDialogOpen(false);
      loadServers();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('vmware.saveServerError') });
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (!window.confirm(t('vmware.deleteServerConfirm'))) return;
    try {
      await vmwareApi.deleteServer(id);
      setAlert({ type: 'success', message: t('common.deleteSuccess') });
      loadServers();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || 'Failed to delete vCenter server' });
    }
  };

  const handleToggleEnabled = async (server: VCenterServer) => {
    try {
      await vmwareApi.updateServer(server.id, { enabled: !server.enabled });
      loadServers();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('vmware.saveServerError') });
    }
  };

  const handleTestConnection = async (id: string) => {
    setTesting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await vmwareApi.testConnection(id);
      if (res.data.success) {
        setAlert({ type: 'success', message: t('vmware.connectionSuccess') });
      } else {
        setAlert({ type: 'error', message: `${t('vmware.connectionFailed')}: ${res.data.message}` });
      }
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('vmware.connectionTestFailed') });
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleImportVMs = async (id: string, dryRun?: boolean) => {
    setImporting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await vmwareApi.importVMs(id, dryRun);
      const mode = res.data.dryRun ? `${t('vmware.dryRun')} - ` : '';
      setAlert({
        type: 'success',
        message: `${mode}${t('vmware.importSuccess')}: ${res.data.imported}/${res.data.updated}/${res.data.errors.length}`,
      });
      if (res.data.errors.length > 0) {
        console.warn('Import errors:', res.data.errors);
      }
      loadServers();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.response?.data?.error?.message || t('vmware.importSuccess') });
    } finally {
      setImporting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(language);
  };

  return (
    <ThemeProvider theme={muiTheme}>
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('vmware.title')}
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
              {t('vmware.credentials')}
            </Typography>
            <Button variant="contained" onClick={openCreateCredentialDialog}>
              {t('vmware.addCredential')}
            </Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.name')}</TableCell>
                  <TableCell>{t('vmware.username')}</TableCell>
                  <TableCell>{t('vmware.vcenterServers')}</TableCell>
                  <TableCell>{t('vmware.default')}</TableCell>
                  <TableCell>{t('common.created')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {credentials.map((cred) => (
                  <TableRow key={cred.id}>
                    <TableCell>{cred.name}</TableCell>
                    <TableCell>{cred.username}</TableCell>
                    <TableCell>{cred.vCenterCount}</TableCell>
                    <TableCell>
                       {cred.isDefault && <Chip label={t('vmware.default')} size="small" color="primary" />}
                    </TableCell>
                    <TableCell>{formatDate(cred.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => openEditCredentialDialog(cred)}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')}>
                        <IconButton size="small" color="error" onClick={() => handleDeleteCredential(cred.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {credentials.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      {t('vmware.noCredentialsConfigured')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ---- vCenter Servers Section ---- */}
      <Card sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
               {t('vmware.vcenterServers')}
            </Typography>
            <Button variant="contained" onClick={openCreateServerDialog} disabled={credentials.length === 0}>
               {t('vmware.addVcenterServer')}
            </Button>
          </Box>

          {credentials.length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
               {t('vmware.noCredentialsWarning')}
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.name')}</TableCell>
                  <TableCell>{t('vmware.host')}</TableCell>
                  <TableCell>{t('vmware.credential')}</TableCell>
                  <TableCell>{t('vmware.enabled')}</TableCell>
                  <TableCell>{t('vmware.vmCount')}</TableCell>
                  <TableCell>{t('vmware.lastSync')}</TableCell>
                  <TableCell>{t('vmware.status')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell>{server.name}</TableCell>
                    <TableCell>
                      {server.host}
                      {server.port !== 443 && `:${server.port}`}
                    </TableCell>
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
                      <Tooltip title={t('vmware.testConnection')}>
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
                      <Tooltip title={t('vmware.importVMs')}>
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
                      <Tooltip title={t('vmware.dryRun')}>
                        <IconButton
                          size="small"
                          onClick={() => handleImportVMs(server.id, true)}
                          disabled={!server.enabled || importing[server.id]}
                        >
                          <WarningIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => openEditServerDialog(server)}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')}>
                        <IconButton size="small" color="error" onClick={() => handleDeleteServer(server.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {servers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      {t('vmware.noServersConfigured')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {servers.some((s) => s.lastSyncError) && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="error">
                {t('intune.lastError')}:
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
       <Dialog
         open={credDialogOpen}
         onClose={handleCredModalClose}
       >
         <DialogTitle>{editingCredId ? t('vmware.editCredential') : t('vmware.addCredential')}</DialogTitle>
         <DialogContent>
           <Stack spacing={2} sx={{ pt: 1, minWidth: 350 }}>
             <TextField
               label={t('common.name')}
               value={credentialForm.values.name}
               onChange={(e) => credentialForm.handleChange({ name: e.target.value })}
               fullWidth
               placeholder={t('vmware.serverName')}
             />
             <TextField
               label={t('vmware.username')}
               value={credentialForm.values.username}
               onChange={(e) => credentialForm.handleChange({ username: e.target.value })}
               fullWidth
               placeholder={t('vmware.username')}
             />
             <TextField
               label={editingCredId ? t('vmware.newPasswordKeep') : t('login.password')}
               type="password"
               value={credentialForm.values.password || ''}
               onChange={(e) => credentialForm.handleChange({ password: e.target.value })}
               fullWidth
             />
             {credentialForm.values.password && (
               <TextField
                 label={t('vmware.confirmPassword')}
                 type="password"
                 value={credentialForm.values.confirmPassword || ''}
                 onChange={(e) => credentialForm.handleChange({ confirmPassword: e.target.value })}
                 fullWidth
                 error={!!credentialForm.values.confirmPassword && credentialForm.values.password !== credentialForm.values.confirmPassword}
                 helperText={
                   credentialForm.values.confirmPassword && credentialForm.values.password !== credentialForm.values.confirmPassword ? t('vmware.passwordsDoNotMatch') : ''
                 }
               />
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

       {/* ---- vCenter Server Dialog ---- */}
       <Dialog
         open={serverDialogOpen}
         onClose={handleServerModalClose}
       >
         <DialogTitle>{editingServerId ? t('vmware.editVcenterServer') : t('vmware.addVcenterServer')}</DialogTitle>
         <DialogContent>
           <Stack spacing={2} sx={{ pt: 1, minWidth: 350 }}>
             <TextField
               label={t('common.name')}
               value={serverForm.values.name}
               onChange={(e) => serverForm.handleChange({ name: e.target.value })}
               fullWidth
               placeholder={t('vmware.serverName')}
             />
             <TextField
               label={t('vmware.host')}
               value={serverForm.values.host}
               onChange={(e) => serverForm.handleChange({ host: e.target.value })}
               fullWidth
               placeholder={t('vmware.host')}
             />
             <TextField
               label={t('vmware.port')}
               type="number"
               value={serverForm.values.port}
               onChange={(e) => serverForm.handleChange({ port: Number(e.target.value) })}
               fullWidth
             />
             <FormControl fullWidth error={!serverForm.values.credentialId}>
               <InputLabel>{t('vmware.credential')}</InputLabel>
               <Select
                 value={serverForm.values.credentialId}
                 label={t('vmware.credential')}
                 onChange={(e) => serverForm.handleChange({ credentialId: e.target.value })}
               >
                 {credentials.map((cred) => (
                   <MenuItem key={cred.id} value={cred.id}>
                     {cred.name} ({cred.username})
                     {cred.isDefault && ` - ${t('vmware.default')}`}
                   </MenuItem>
                 ))}
               </Select>
               {!serverForm.values.credentialId && <FormHelperText>{t('vmware.selectCredential')}</FormHelperText>}
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
