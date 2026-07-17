import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import HealthIcon from '@mui/icons-material/Favorite';
import api from '../services/api';

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
  lastSyncAt: string | null;
  isArchived: boolean;
}

const healthStatusColors: Record<string, string> = {
  healthy: '#4caf50',
  degraded: '#ffb732',
  unhealthy: '#f44336',
};

const syncStatusColors: Record<string, string> = {
  idle: '#9e9e9e',
  running: '#2196ff',
  success: '#4caf50',
  error: '#f44336',
};

export default function IntuneAdmin() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<IntuneConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [devices, setDevices] = useState<DeviceSync[]>([]);
  const [loading, setLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'unhealthy' | null>(null);
  const [showDevices, setShowDevices] = useState(false);
  const [devicePage, setDevicePage] = useState(1);
  const [deviceTotalPages, setDeviceTotalPages] = useState(1);
  const [deviceTotal, setDeviceTotal] = useState(0);
  // Credentials state
  const [credentials, setCredentials] = useState<any | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [credName, setCredName] = useState('');
  const [credTenantId, setCredTenantId] = useState('');
  const [credAppId, setCredAppId] = useState('');
  const [credClientSecret, setCredClientSecret] = useState('');
  const [credClientSecretExpiresAt, setCredClientSecretExpiresAt] = useState('');
  const [credCertificateThumbprint, setCredCertificateThumbprint] = useState('');
  const [credIsConfigured, setCredIsConfigured] = useState(false);

  useEffect(() => {
    loadConfig();
    loadSyncStatus();
    loadHealth();
    loadCredentials();
  }, []);

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
    } catch (e) {
      setHealthStatus('unhealthy');
    }
  };

  const loadCredentials = async () => {
    try {
      const res = await api.get('/intune/credentials');
      if (res.data) {
        setCredentials(res.data);
        setCredName(res.data.name || '');
        setCredTenantId(res.data.tenantId || '');
        setCredAppId(res.data.appId || '');
        setCredIsConfigured(res.data.isConfigured);
      } else {
        setCredentials(null);
      }
    } catch (e) {
      console.error('Failed to load credentials:', e);
      setCredentials(null);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      if (credentials) {
        await api.put('/intune/credentials', {
          name: credName,
          tenantId: credTenantId || undefined,
          appId: credAppId || undefined,
          clientSecret: credClientSecret || undefined,
          clientSecretExpiresAt: credClientSecretExpiresAt || undefined,
          certificateThumbprint: credCertificateThumbprint || undefined,
          isConfigured: credIsConfigured,
        });
      } else {
        await api.post('/intune/credentials', {
          name: credName || 'Intune API Credentials',
          tenantId: credTenantId || undefined,
          appId: credAppId || undefined,
          clientSecret: credClientSecret || undefined,
          clientSecretExpiresAt: credClientSecretExpiresAt || undefined,
          certificateThumbprint: credCertificateThumbprint || undefined,
        });
      }
      setCredentialsOpen(false);
      loadCredentials();
    } catch (e) {
      console.error('Failed to save credentials:', e);
    }
  };

  const handleDeleteCredentials = async () => {
    if (!confirm('Are you sure you want to delete these credentials?')) return;
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
      setCredName(credentials.name || '');
      setCredTenantId(credentials.tenantId || '');
      setCredAppId(credentials.appId || '');
      setCredIsConfigured(credentials.isConfigured);
    }
    setCredentialsOpen(true);
  };

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
    return new Date(date).toLocaleString();
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
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('intune.title')}
      </Typography>

      {/* Health Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              icon={<HealthIcon />}
              label={t('intune.healthStatus')}
              color={healthStatus === 'healthy' ? 'success' : healthStatus === 'unhealthy' ? 'error' : 'warning'}
              size="small"
            />
            <Typography variant="body2">
              {healthStatus === 'healthy' && 'All systems operational'}
              {healthStatus === 'unhealthy' && 'Connection issues detected'}
              {healthStatus === null && 'Checking...'}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('intune.configuration')}
        </Typography>

        <Stack spacing={2}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography>Enable Intune Sync</Typography>
            <Switch
              checked={config?.enabled || false}
              onChange={(e) => handleConfigUpdate('enabled', e.target.checked)}
            />
          </Box>

          <Divider />

          <Grid container spacing={2}>
            <Grid item={{ xs: 12, sm: 4 }}>
              <TextField
                label="Full Sync Interval (hours)"
                type="number"
                value={config?.fullSyncIntervalHours || 24}
                onChange={(e) => handleConfigUpdate('fullSyncIntervalHours', parseInt(e.target.value) || 24)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item={{ xs: 12, sm: 4 }}>
              <TextField
                label="Incremental Sync Interval (minutes)"
                type="number"
                value={config?.incrementalSyncIntervalMinutes || 120}
                onChange={(e) => handleConfigUpdate('incrementalSyncIntervalMinutes', parseInt(e.target.value) || 120)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item={{ xs: 12, sm: 4 }}>
              <TextField
                label="Grace Period (hours)"
                type="number"
                value={config?.gracePeriodHours || 168}
                onChange={(e) => handleConfigUpdate('gracePeriodHours', parseInt(e.target.value) || 168)}
                fullWidth
                size="small"
              />
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      {/* Sync Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('intune.syncStatus')}
        </Typography>

        {syncStatus && (
          <Stack spacing={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Chip
                icon={<SyncIcon />}
                label={`Status: ${syncStatus.status}`}
                color={syncStatusColors[syncStatus.status] || 'default'}
                size="small"
              />
              <Chip
                label={`Health: ${syncStatus.healthStatus}`}
                color={healthStatusColors[syncStatus.healthStatus] || 'default'}
                size="small"
              />
            </Box>

            <Grid container spacing={2}>
              <Grid item={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Devices
                </Typography>
                <Typography variant="h5">
                  {syncStatus.deviceSynced}/{syncStatus.deviceCount}
                </Typography>
              </Grid>
              <Grid item={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Device Errors
                </Typography>
                <Typography variant="h5" color={syncStatus.deviceErrors > 0 ? 'error' : 'success'}>
                  {syncStatus.deviceErrors}
                </Typography>
              </Grid>
              <Grid item={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Apps Synced
                </Typography>
                <Typography variant="h5">
                  {syncStatus.appSynced}/{syncStatus.appCount}
                </Typography>
              </Grid>
              <Grid item={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Last Sync Duration
                </Typography>
                <Typography variant="h5">
                  {formatDuration(syncStatus.lastSyncDurationMs)}
                </Typography>
              </Grid>
            </Grid>

            {syncStatus.lastSyncCompletedAt && (
              <Typography variant="body2" color="text.secondary">
                Last completed: {formatDateTime(syncStatus.lastSyncCompletedAt)}
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
            Full Sync
          </Button>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={handleIncrementalSync}
            disabled={loading}
          >
            Incremental Sync
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              loadSyncStatus();
              loadHealth();
            }}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Paper>

      {/* Scheduler Control */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Scheduler
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={handleStartScheduler}>
            Start Scheduler
          </Button>
          <Button variant="outlined" onClick={handleStopScheduler}>
            Stop Scheduler
          </Button>
        </Stack>
      </Paper>

      {/* App Credentials */}
      <Paper sx={{ p: 3, mb: 3 }}>
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
                {t('intune.isConfigured')}: <Chip label={credentials.isConfigured ? 'Yes' : 'No'} size="small" color={credentials.isConfigured ? 'success' : 'default'} />
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
      <Dialog open={credentialsOpen} onClose={() => setCredentialsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{credentials ? t('intune.updateCredentials') : t('intune.createCredentials')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('intune.name')} value={credName} onChange={(e) => setCredName(e.target.value)} fullWidth size="small" />
            <TextField label={t('intune.tenantId')} value={credTenantId} onChange={(e) => setCredTenantId(e.target.value)} fullWidth size="small" />
            <TextField label={t('intune.appId')} value={credAppId} onChange={(e) => setCredAppId(e.target.value)} fullWidth size="small" />
            <TextField label={t('intune.clientSecret')} type="password" value={credClientSecret} onChange={(e) => setCredClientSecret(e.target.value)} fullWidth size="small" />
            <TextField label={t('intune.clientSecretExpiresAt')} type="datetime-local" value={credClientSecretExpiresAt} onChange={(e) => setCredClientSecretExpiresAt(e.target.value)} fullWidth size="small" />
            <TextField label={t('intune.certificateThumbprint')} value={credCertificateThumbprint} onChange={(e) => setCredCertificateThumbprint(e.target.value)} fullWidth size="small" />
            <Box display="flex" alignItems="center" gap={1}>
              <Switch checked={credIsConfigured} onChange={(e) => setCredIsConfigured(e.target.checked)} />
              <Typography>{t('intune.isConfigured')}</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCredentialsOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSaveCredentials}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Devices */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Synced Devices ({deviceTotal})
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadDevices();
              loadSyncStatus();
            }}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>OS</TableCell>
                  <TableCell>Manufacturer</TableCell>
                  <TableCell>Sync Status</TableCell>
                  <TableCell>Last Sync</TableCell>
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
                            : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(device.lastSyncAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {deviceTotalPages > 1 && (
          <Box display="flex" justifyContent="center" p={2}>
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
  );
}
