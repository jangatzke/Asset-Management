import express, { Application } from 'express';
import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// Phase 8 imports
import { correlationId } from './middleware/correlationId';
import { jsonLogger } from './middleware/jsonLogger';
import { metricsMiddleware, metricsEndpoint } from './middleware/metrics';
import { idempotency } from './middleware/idempotency';
import { etag } from './middleware/etag';
import { scopeAudit } from './middleware/apiScopes';
import { 
  healthBasic, 
  healthLive, 
  healthReady, 
  setReady, 
} from './middleware/health';
import { setupGracefulShutdown } from './middleware/gracefulShutdown';
import { initializeIdempotency } from './middleware/idempotency';

// Existing imports
import { errorHandler } from './middleware/errorHandler';
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
import { initializeReminderScheduler } from './services/reminder.scheduler';
import { vmwareRouter } from './routes/vmware.routes';
import { proxmoxRouter } from './routes/proxmox.routes';
// ISO 27001 Phase 2 routes
import { contractRouter } from './routes/contract.routes';
import { licenseRouter } from './routes/license.routes';
import { businessProcessRouter } from './routes/businessprocess.routes';
import { riskTreatmentRouter } from './routes/risktreatment.routes';
import { riskMethodRouter } from './routes/riskmethod.routes';
import { importRouter } from './routes/import.routes';
import { frameworkRouter } from './routes/framework.routes';
import { evidenceRouter } from './routes/evidence.routes';
import { documentRouter } from './routes/document.routes';
import { nis2Router } from './routes/nis2.routes';
import { phase6Router } from './routes/phase6.routes';
import { catalogRouter } from './routes/catalog.routes';
import { costPlanningRouter } from './routes/costPlanning.routes';
// Phase 8 routes
import { webhookRouter } from './routes/webhook.routes';
import { serviceAccountRouter } from './routes/serviceAccount.routes';
import { prisma } from './config/database';
import { ensureStandardAssetTypes } from './services/bootstrap.service';

const app: Application = express();
const DEFAULT_BACKEND_PORT = 3001;
const FRONTEND_DEV_PORT = 3000;
const HOST = process.env.HOST || '0.0.0.0';

function resolveBackendPort(): number {
  const configuredPort = Number(process.env.PORT || DEFAULT_BACKEND_PORT);

  if (!Number.isInteger(configuredPort) || configuredPort <= 0 || configuredPort > 65535) {
    console.error(
      `Invalid backend PORT value "${process.env.PORT}". Use a TCP port between 1 and 65535; ` +
      `the development default is ${DEFAULT_BACKEND_PORT}.`,
    );
    process.exit(1);
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    configuredPort === FRONTEND_DEV_PORT &&
    process.env.ALLOW_BACKEND_FRONTEND_PORT_CONFLICT !== 'true'
  ) {
    console.warn(
      `Backend PORT=${FRONTEND_DEV_PORT} conflicts with the Vite frontend dev port. ` +
      `Using backend port ${DEFAULT_BACKEND_PORT} instead. ` +
      'Update backend/.env to PORT=3001 or set ALLOW_BACKEND_FRONTEND_PORT_CONFLICT=true to override.',
    );
    return DEFAULT_BACKEND_PORT;
  }

  return configuredPort;
}

const PORT = resolveBackendPort();

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
}

// ==================== Global Middleware (Phase 8) ====================

// 1. Correlation-ID (must be first for tracing)
app.use(correlationId);

// 2. Security headers
app.use(helmet());

// 3. Compression
app.use(compression());

// 4. CORS configuration - explicit origins only, no wildcard default (SEC-003)
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:3000'],
  credentials: true,
}));

// 5. Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 6. Structured JSON logging (Phase 8)
app.use(jsonLogger);

// 7. Metrics collection (Phase 8)
app.use(metricsMiddleware);

// 8. Scope audit for all authenticated requests
app.use(scopeAudit);

// ==================== Health & System Endpoints (Phase 8) ====================

// Basic health check (legacy compatibility)
app.get('/health', healthBasic);

// Liveness probe - simple server alive check
app.get('/health/live', healthLive);

// Readiness probe - checks database and configured health checks
app.get('/health/ready', healthReady);

// Prometheus-compatible metrics endpoint
app.get('/metrics', metricsEndpoint);

// ==================== API Routes ====================

// Auth & Users
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);

// Core entities with ETag support (Phase 8)
app.use('/api/v1/assets', etag(), assetRouter);
app.use('/api/v1/risks', etag(), riskRouter);
app.use('/api/v1/controls', etag(), controlRouter);
app.use('/api/v1/incidents', etag(), incidentRouter);

// Organization & Admin
app.use('/api/v1/organization', orgRouter);
app.use('/api/v1/admin', adminRouter);

// Audit & Monitoring
app.use('/api/v1/audit-logs', auditLogRouter);

// Integrations
app.use('/api/v1/intune', intuneRouter);
app.use('/api/v1/admin/vmware', vmwareRouter);
app.use('/api/v1/admin/proxmox', proxmoxRouter);

// ISO 27001 Phase 2 Routes
app.use('/api/v1/contracts', contractRouter);
app.use('/api/v1/licenses', licenseRouter);
app.use('/api/v1/processes', businessProcessRouter);
app.use('/api/v1/treatments', riskTreatmentRouter);
app.use('/api/v1/methods', riskMethodRouter);
app.use('/api/v1/imports', importRouter);
app.use('/api/v1/frameworks', frameworkRouter);
app.use('/api/v1/evidence', evidenceRouter);
app.use('/api/v1/documents', documentRouter);
app.use('/api/v1/nis2', nis2Router);
app.use('/api/v1/phase6', phase6Router);
app.use('/api/v1/isms-operations', phase6Router);
app.use('/api/v1/catalog', catalogRouter);
app.use('/api/v1/cost-planning', costPlanningRouter);

// Phase 8 Routes - Webhooks & Service Accounts (with idempotency)
app.use('/api/v1/webhooks', idempotency(), webhookRouter);
app.use('/api/v1/service-accounts', idempotency(), serviceAccountRouter);

// ==================== Error Handling ====================
app.use(errorHandler);

// ==================== Server Startup ====================

let server: Server | undefined;

async function startServer(): Promise<void> {
  server = app.listen(PORT, HOST, async () => {
    const address = server?.address();
    const actualPort = typeof address === 'object' && address !== null
      ? (address as AddressInfo).port
      : PORT;
    const actualHost = typeof address === 'object' && address !== null
      ? (address as AddressInfo).address
      : HOST;

    console.log(`Server running on http://${actualHost}:${actualPort}`);
    console.log(`Backend health endpoint: http://127.0.0.1:${actualPort}/health`);
    console.log(`Expected Vite proxy target: http://127.0.0.1:${actualPort}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('Phase 8 features enabled: correlation-id, json-logging, metrics, health-checks');

    // Initialize idempotency cleanup
    initializeIdempotency();

    try {
      await ensureStandardAssetTypes(prisma);
      console.log('Standard ISO27001 asset types ensured');
    } catch (error) {
      console.error('Failed to ensure standard ISO27001 asset types:', error);
    }

    // Start background services
    try {
      const scheduler = initializeScheduler();
      await scheduler.start();
      const reminderScheduler = initializeReminderScheduler();
      await reminderScheduler.start();
      console.log('Background services initialized');
    } catch (error) {
      console.error('Failed to initialize background services:', error);
    }

    // Mark server as ready after a short delay
    setTimeout(() => {
      setReady(true);
      console.log('Server is READY');
    }, 2000);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Backend bind failed: ${HOST}:${PORT} is already in use. ` +
        `Frontend dev uses ${FRONTEND_DEV_PORT}; backend dev should use ${DEFAULT_BACKEND_PORT}. ` +
        'Set PORT=3001 in backend/.env or stop the process currently using that port before starting the backend.',
      );
      process.exit(1);
    }

    if (error.code === 'EACCES') {
      console.error(
        `Backend bind failed: insufficient permissions for ${HOST}:${PORT}. ` +
        `Use PORT=${DEFAULT_BACKEND_PORT} for local development.`,
      );
      process.exit(1);
    }

    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Setup graceful shutdown
  setupGracefulShutdown(server!);
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

if (!isTestRuntime()) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { app };
