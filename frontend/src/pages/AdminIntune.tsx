import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDirtyForm } from '../hooks/useDirtyForm';
import {
  Box,
  Typography,
  Paper,
  Button,
  Switch,
  TextField,
  Grid,
  Alert,
  Card,
  CardContent,
  Divider,
  Stack,
  Chip,
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
} from '@mui/material';
import { DiscardConfirmationDialog } from '../components/DiscardConfirmationDialog';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { ChipProps } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import HealthIcon from '@mui/icons-material/Favorite';
import api from '../services/api';
import { useI18n } from '../context/I18nContext';
import { useDarkMode } from '../context/DarkModeContext';

interface IntuneConfig {
  id: string;
  enabled: boolean;
  fullSyncIntervalHours: number;
  incrementalSyncIntervalMinutes: number;
  gracePeriodHours: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  batchSize: number;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  nextFullSyncAt: string | null;
  nextIncrementalSyncAt: string | null;
}

interface SyncStatus {
  id: string;
  syncType: string;
  status: string;
  deviceCount: number;
  deviceSynced: number;
  deviceErrors: number;
  appCount: number;
  appSynced: number;
  appErrors: number;
  staleCount: number;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  lastSyncDurationMs: number | null;
  lastError: string | null;
  totalSyncs: number;
  totalDevicesSynced: number;
  totalDevicesErrors: number;
  healthStatus: string;
}

interface DeviceSync {
  id: string;
  intuneId: string;
  name: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  osName: string | null;
  osVersion: string | null;
  syncStatus: string;
  syncErrorMessage?: string | null;
  lastSyncAt: string | null;
  isArchived: boolean;
}

const healthStatusColors: Record<string, ChipProps['color']> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

const syncStatusColors: Record<string, ChipProps['color']> = {
  idle: 'default',
  running: 'info',
  success: 'success',
  error: 'error',
  partial_success: 'warning',
};

const configTextFieldSx = {
  '& .MuiInputLabel-root': {
    backgroundColor: 'background.paper',
    px: 0.5,
  },
  '& .MuiInputLabel-shrink': {
    transform: 'translate(14px, -9px) scale(0.75)',
  },
};

export default function IntuneAdmin() {
  const { t, language } = useI18n();
  const { darkMode } = useDarkMode();
  const muiTheme = useMemo(() => createTheme({ palette: { mode: darkMode ? 'dark' : 'light' } }), [darkMode]);
  const [config, setConfig] = useState<IntuneConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [devices, setDevices] = useState<DeviceSync[]>([]);
  const [loading, setLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'unhealthy' | null>(null);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [devicePage, setDevicePage] = useState(1);
  const [deviceTotalPages, setDeviceTotalPages] = useState(1);
  const [deviceTotal, setDeviceTotal] = useState(0);
  // Credentials state
  interface CredentialFormValues {
    name: string;
    tenantId: string;
    appId: string;
    clientSecret: string;
    clientSecretExpiresAt: string;
    certificateThumbprint: string;
    isConfigured: boolean;
  }

  const [credentials, setCredentials] = useState<any | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const pendingClose = useRef<(() => void) | null>(null);
  const credentialForm = useDirtyForm<CredentialFormValues>({
    name: '',
    tenantId: '',
    appId: '',
    clientSecret: '',
    clientSecretExpiresAt: '',
    certificateThumbprint: '',
    isConfigured: false,
  });

  const loadConfig = async () => {
    try {
      const res = await api.get('/intune/config');
      setConfig(res.data);
    } catch (e) {
      console.error('Failed to load Intune config:', e);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const res = await api.get('/intune/status');
      setSyncStatus(res.data);
    } catch (e) {
      console.error('Failed to load sync status:', e);
    }
  };

  const loadHealth = async () => {
    try {
      const res = await api.get('/intune/health');
      setHealthStatus(res.data?.intune?.healthy ? 'healthy' : 'unhealthy');
      setHealthMessage(res.data?.intune?.error || res.data?.intune?.permissions?.message || null);
    } catch (e) {
      setHealthStatus('unhealthy');
      setHealthMessage(t('intune.syncFailed'));
    }
  };

  const loadCredentials = async () => {
    try {
      const res = await api.get('/intune/credentials');
      if (res.data) {
        setCredentials(res.data);
        credentialForm.setFormValues({
          name: res.data.name || '',
          tenantId: res.data.tenantId || '',
          appId: res.data.appId || '',
          clientSecret: '',
          clientSecretExpiresAt: res.data.clientSecretExpiresAt || '',
          certificateThumbprint: res.data.certificateThumbprint || '',
          isConfigured: res.data.isConfigured || false,
        });
      } else {
        setCredentials(null);
      }
    } catch (e) {
      console.error('Failed to load credentials:', e);
      setCredentials(null);
    }
  };

  useEffect(() => {
    loadConfig();
    loadSyncStatus();
    loadHealth();
    loadCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap; loaders are stable across renders
  }, []);

  const handleSaveCredentials = async () => {
    try {
      if (credentials) {
        await api.put('/intune/credentials', {
          name: credentialForm.values.name,
          tenantId: credentialForm.values.tenantId || undefined,
          appId: credentialForm.values.appId || undefined,
          clientSecret: credentialForm.values.clientSecret || undefined,
          clientSecretExpiresAt: credentialForm.values.clientSecretExpiresAt || undefined,
          certificateThumbprint: credentialForm.values.certificateThumbprint || undefined,
          isConfigured: credentialForm.values.isConfigured,
        });
      } else {
        await api.post('/intune/credentials', {
          name: credentialForm.values.name || t('intune.credentialsTitle'),
          tenantId: credentialForm.values.tenantId || undefined,
          appId: credentialForm.values.appId || undefined,
          clientSecret: credentialForm.values.clientSecret || undefined,
          clientSecretExpiresAt: credentialForm.values.clientSecretExpiresAt || undefined,
          certificateThumbprint: credentialForm.values.certificateThumbprint || undefined,
        });
      }
      setCredentialsOpen(false);
      loadCredentials();
    } catch (e) {
      console.error('Failed to save credentials:', e);
    }
  };

  const handleDeleteCredentials = async () => {
    if (!window.confirm(t('intune.deleteCredentialsConfirm'))) return;
    try {
      await api.delete('/intune/credentials');
      setCredentials(null);
      setCredentialsOpen(false);
    } catch (e) {
      console.error('Failed to delete credentials:', e);
    }
  };

  const openCredentialsDialog = () => {
    if (credentials) {
      credentialForm.setFormValues({
        name: credentials.name || '',
        tenantId: credentials.tenantId || '',
        appId: credentials.appId || '',
        clientSecret: credentials.clientSecret || '',
        clientSecretExpiresAt: credentials.clientSecretExpiresAt || '',
        certificateThumbprint: credentials.certificateThumbprint || '',
        isConfigured: credentials.isConfigured,
      });
    } else {
      credentialForm.setFormValues({
        name: '',
        tenantId: '',
        appId: '',
        clientSecret: '',
        clientSecretExpiresAt: '',
        certificateThumbprint: '',
        isConfigured: false,
      });
    }
    setCredentialsOpen(true);
  };

  const handleCredentialsDiscard = useCallback(() => {
    credentialForm.resetForm();
    setCredentialsOpen(false);
  }, [credentialForm]);

  const handleCredentialsModalClose = useCallback(() => {
    if (credentialForm.isDirty) {
      pendingClose.current = () => setCredentialsOpen(false);
      setDiscardConfirmOpen(true);
    } else {
      setCredentialsOpen(false);
    }
  }, [credentialForm]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/intune/devices', {
        params: { page: devicePage, limit: 20 },
      });
      setDevices(res.data.data);
      setDeviceTotalPages(res.data.pagination.totalPages);
      setDeviceTotal(res.data.pagination.total);
    } catch (e) {
      console.error('Failed to load devices:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigUpdate = async (field: string, value: any) => {
    if (!config) return;
    try {
      const res = await api.put('/intune/config', { [field]: value });
      setConfig(res.data);
    } catch (e) {
      console.error('Failed to update config:', e);
    }
  };

  const handleFullSync = async () => {
    try {
      await api.post('/intune/sync/full');
      loadSyncStatus();
    } catch (e) {
      console.error('Failed to trigger full sync:', e);
    }
  };

  const handleIncrementalSync = async () => {
    try {
      await api.post('/intune/sync/incremental');
      loadSyncStatus();
    } catch (e) {
      console.error('Failed to trigger incremental sync:', e);
    }
  };

  const handleStartScheduler = async () => {
    try {
      await api.post('/intune/scheduler/start');
    } catch (e) {
      console.error('Failed to start scheduler:', e);
    }
  };

  const handleStopScheduler = async () => {
    try {
      await api.post('/intune/scheduler/stop');
    } catch (e) {
      console.error('Failed to stop scheduler:', e);
    }
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleString(language);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <ThemeProvider theme={muiTheme}>
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('intune.title')}
      </Typography>

      {/* Health Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Chip
              icon={<HealthIcon />}
              label={t('intune.healthStatus')}
              color={healthStatus === 'healthy' ? 'success' : healthStatus === 'unhealthy' ? 'error' : 'warning'}
              size="small"
            />
            <Typography variant="body2">
              {healthStatus === 'healthy' && t('intune.healthy')}
              {healthStatus === 'unhealthy' && (healthMessage || t('intune.unhealthy'))}
              {healthStatus === null && t('common.loading')}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.paper', color: 'text.primary' }}>
        <Typography variant="h6" gutterBottom>
          {t('intune.configuration')}
        </Typography>

        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography>{t('intune.syncNow')}</Typography>
            <Switch
              checked={config?.enabled || false}
              onChange={(e) => handleConfigUpdate('enabled', e.target.checked)}
            />
          </Box>

          <Divider />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t('intune.fullSync')}
                type="number"
                value={config?.fullSyncIntervalHours || 24}
                onChange={(e) => handleConfigUpdate('fullSyncIntervalHours', parseInt(e.target.value, 10) || 24)}
                fullWidth
                size="small"
                sx={configTextFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t('intune.incrementalSync')}
                type="number"
                value={config?.incrementalSyncIntervalMinutes || 120}
                onChange={(e) => handleConfigUpdate('incrementalSyncIntervalMinutes', parseInt(e.target.value, 10) || 120)}
                fullWidth
                size="small"
                sx={configTextFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t('common.dates')}
                type="number"
                value={config?.gracePeriodHours || 168}
                onChange={(e) => handleConfigUpdate('gracePeriodHours', parseInt(e.target.value, 10) || 168)}
                fullWidth
                size="small"
                sx={configTextFieldSx}
              />
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      {/* Sync Status */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.paper', color: 'text.primary' }}>
        <Typography variant="h6" gutterBottom>
          {t('intune.syncStatus')}
        </Typography>

        {syncStatus && (
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                icon={<SyncIcon />}
                label={`${t('common.status')}: ${syncStatus.status}`}
                color={syncStatusColors[syncStatus.status] || 'default'}
                size="small"
              />
              <Chip
                label={`${t('intune.healthStatus')}: ${syncStatus.healthStatus}`}
                color={healthStatusColors[syncStatus.healthStatus] || 'default'}
                size="small"
              />
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('intune.syncCount')}
                </Typography>
                <Typography variant="h5">
                  {syncStatus.deviceSynced}/{syncStatus.deviceCount}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('intune.lastError')}
                </Typography>
                <Typography variant="h5" color={syncStatus.deviceErrors > 0 ? 'error' : 'success'}>
                  {syncStatus.deviceErrors}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('intune.syncCount')}
                </Typography>
                <Typography variant="h5">
                  {syncStatus.appSynced}/{syncStatus.appCount}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('intune.lastSync')}
                </Typography>
                <Typography variant="h5">
                  {formatDuration(syncStatus.lastSyncDurationMs)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('intune.syncStatus')}
                </Typography>
                <Typography variant="h5" color={(syncStatus.staleCount || 0) > 0 ? 'warning.main' : 'success.main'}>
                  {syncStatus.staleCount || 0}
                </Typography>
              </Grid>
            </Grid>

            {syncStatus.status === 'partial_success' && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {t('intune.syncFailed')}
              </Alert>
            )}

            {syncStatus.lastSyncCompletedAt && (
              <Typography variant="body2" color="text.secondary">
                {t('intune.lastSync')}: {formatDateTime(syncStatus.lastSyncCompletedAt)}
              </Typography>
            )}

            {syncStatus.lastError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {syncStatus.lastError}
              </Alert>
            )}
          </Stack>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleFullSync}
            disabled={loading}
          >
            {t('intune.fullSync')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={handleIncrementalSync}
            disabled={loading}
          >
            {t('intune.incrementalSync')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              loadSyncStatus();
              loadHealth();
            }}
            disabled={loading}
          >
            {t('common.update')}
          </Button>
        </Stack>
      </Paper>

      {/* Scheduler Control */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.paper', color: 'text.primary' }}>
        <Typography variant="h6" gutterBottom>
          {t('intune.scheduler')}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={handleStartScheduler}>
            {t('intune.startScheduler')}
          </Button>
          <Button variant="outlined" onClick={handleStopScheduler}>
            {t('intune.stopScheduler')}
          </Button>
        </Stack>
      </Paper>

      {/* App Credentials */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.paper', color: 'text.primary' }}>
        <Typography variant="h6" gutterBottom>
          {t('intune.credentials')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('intune.credentialsDescription')}
        </Typography>
        {credentials ? (
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2">{t('intune.name')}: {credentials.name}</Typography>
              <Typography variant="body2">{t('intune.tenantId')}: {credentials.tenantId || '—'}</Typography>
              <Typography variant="body2">{t('intune.appId')}: {credentials.appId || '—'}</Typography>
              <Typography variant="body2">
                {t('intune.isConfigured')}: <Chip label={credentials.isConfigured ? t('common.yes') : t('common.no')} size="small" color={credentials.isConfigured ? 'success' : 'default'} />
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" onClick={openCredentialsDialog}>
                {t('intune.updateCredentials')}
              </Button>
              <Button variant="outlined" color="error" onClick={handleDeleteCredentials}>
                {t('intune.deleteCredentials')}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Button variant="contained" onClick={openCredentialsDialog}>
            {t('intune.configureCredentials')}
          </Button>
        )}
      </Paper>

      {/* Credentials Dialog */}
      <Dialog
        open={credentialsOpen}
        onClose={handleCredentialsModalClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{credentials ? t('intune.updateCredentials') : t('intune.createCredentials')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('intune.name')} value={credentialForm.values.name} onChange={(e) => credentialForm.handleChange({ name: e.target.value })} fullWidth size="small" />
            <TextField label={t('intune.tenantId')} value={credentialForm.values.tenantId} onChange={(e) => credentialForm.handleChange({ tenantId: e.target.value })} fullWidth size="small" />
            <TextField label={t('intune.appId')} value={credentialForm.values.appId} onChange={(e) => credentialForm.handleChange({ appId: e.target.value })} fullWidth size="small" />
            <TextField label={t('intune.clientSecret')} type="password" value={credentialForm.values.clientSecret} onChange={(e) => credentialForm.handleChange({ clientSecret: e.target.value })} fullWidth size="small" />
            <TextField label={t('intune.clientSecretExpiresAt')} type="datetime-local" value={credentialForm.values.clientSecretExpiresAt} onChange={(e) => credentialForm.handleChange({ clientSecretExpiresAt: e.target.value })} fullWidth size="small" />
            <TextField label={t('intune.certificateThumbprint')} value={credentialForm.values.certificateThumbprint} onChange={(e) => credentialForm.handleChange({ certificateThumbprint: e.target.value })} fullWidth size="small" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch checked={credentialForm.values.isConfigured} onChange={(e) => credentialForm.handleChange({ isConfigured: e.target.checked })} />
              <Typography>{t('intune.isConfigured')}</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { if (credentialForm.isDirty) { pendingClose.current = () => setCredentialsOpen(false); setDiscardConfirmOpen(true); } else { setCredentialsOpen(false); } }}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSaveCredentials}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <DiscardConfirmationDialog
        open={discardConfirmOpen}
        onClose={() => {
          setDiscardConfirmOpen(false);
          if (pendingClose.current) {
            pendingClose.current();
            pendingClose.current = null;
          }
        }}
        onDiscard={handleCredentialsDiscard}
        titleKey="Discard Changes"
        messageKey="You have unsaved changes. Are you sure you want to discard them?"
      />

      {/* Devices */}
      <Paper sx={{ p: 3, bgcolor: 'background.paper', color: 'text.primary' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
             {t('intune.syncCount')} ({deviceTotal})
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadDevices();
              loadSyncStatus();
            }}
            disabled={loading}
          >
            {t('common.update')}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.name')}</TableCell>
                  <TableCell>{t('common.type')}</TableCell>
                  <TableCell>{t('common.vendor')}</TableCell>
                  <TableCell>{t('intune.syncStatus')}</TableCell>
                  <TableCell>{t('intune.lastError')}</TableCell>
                  <TableCell>{t('intune.lastSync')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>{device.name || '—'}</TableCell>
                    <TableCell>{device.osName || '—'}</TableCell>
                    <TableCell>{device.manufacturer || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={device.syncStatus}
                        size="small"
                        color={
                          device.syncStatus === 'synced'
                            ? 'success'
                            : device.syncStatus === 'error'
                            ? 'error'
                            : device.syncStatus === 'stale' || device.syncStatus === 'missing'
                            ? 'warning'
                            : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{device.syncErrorMessage || '—'}</TableCell>
                    <TableCell>{formatDateTime(device.lastSyncAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {deviceTotalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            {[...Array(deviceTotalPages)].map((_, i) => (
              <Chip
                key={i + 1}
                label={i + 1}
                size="small"
                color={devicePage === i + 1 ? 'primary' : 'default'}
                onClick={() => setDevicePage(i + 1)}
                sx={{ mx: 0.5, cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
      </Paper>
    </Box>
    </ThemeProvider>
  );
}
