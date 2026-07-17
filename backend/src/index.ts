import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config();

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authRouter } from './routes/auth.routes';
import { userRouter } from './routes/user.routes';
import { assetRouter } from './routes/asset.routes';
import { riskRouter } from './routes/risk.routes';
import { controlRouter } from './routes/control.routes';
import { orgRouter } from './routes/organization.routes';
import { incidentRouter } from './routes/incident.routes';
import { auditLogRouter } from './routes/auditLog.routes';
import { adminRouter } from './routes/admin.routes';
import { intuneRouter } from './routes/intune.routes';
import { initializeScheduler } from './services/intune.scheduler';
import { vmwareRouter } from './routes/vmware.routes';
import { proxmoxRouter } from './routes/proxmox.routes';
// ISO 27001 Phase 2 routes
import { contractRouter } from './routes/contract.routes';
import { licenseRouter } from './routes/license.routes';
import { businessProcessRouter } from './routes/businessprocess.routes';
import { riskTreatmentRouter } from './routes/risktreatment.routes';
import { riskMethodRouter } from './routes/riskmethod.routes';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/assets', assetRouter);
app.use('/api/v1/risks', riskRouter);
app.use('/api/v1/controls', controlRouter);
app.use('/api/v1/organization', orgRouter);
app.use('/api/v1/incidents', incidentRouter);
app.use('/api/v1/audit-logs', auditLogRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/intune', intuneRouter);
app.use('/api/v1/admin/vmware', vmwareRouter);
app.use('/api/v1/admin/proxmox', proxmoxRouter);

// ISO 27001 Phase 2 Routes
app.use('/api/v1/contracts', contractRouter);
app.use('/api/v1/licenses', licenseRouter);
app.use('/api/v1/processes', businessProcessRouter);
app.use('/api/v1/treatments', riskTreatmentRouter);
app.use('/api/v1/methods', riskMethodRouter);

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);

  // Start background services
  try {
    const scheduler = initializeScheduler();
    await scheduler.start();
    console.log('Background services initialized');
  } catch (error) {
    console.error('Failed to initialize background services:', error);
  }
});

export { app };
