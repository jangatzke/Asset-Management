# Compliance Matrix – Asset Management System (ISO 27001)
<!-- NOTE: This file should be saved as docs/compliance-matrix.yml in code mode -->
<!-- YAML content below for reference during implementation -->

```yaml
- id: IAM-001
  title: Administrationsschutz
  priority: P0
  status: partial
  implementation:
    - backend/src/routes/admin.routes.ts
    - backend/src/middleware/auth.ts
  tests: []
  gaps:
    - requireAdminAccess prüft nur Legacy-Rollennamen 'system_admin' (admin.routes.ts:8-17)
    - Keine dynamische Prüfung von role.canAccessAdmin aus DB

- id: IAM-002
  title: Entity-Level Authorization
  priority: P0
  status: missing
  implementation: []
  tests: []
  gaps:
    - Keine Middleware für entityPermissions (Role.entityPermissions existiert in Schema aber wird nicht geprüft)
    - Alle CRUD-Routen haben nur authenticate, keine entity-level Prüfung

- id: IAM-003
  title: Routenreihenfolge und Konfliktfreiheit
  priority: P0
  status: partial
  implementation:
    - backend/src/index.ts
  tests:
    - backend/src/__tests__/auth.routes.test.ts
  gaps:
    - Admin-Sub-Routern (/admin/vmware, /admin/proxmox) werden nach /admin gemountet – Reihenfolge korrekt
    - Kein Integrationstest für Route-Konflikte

- id: SEC-001
  title: JWT-Härtung
  priority: P0
  status: non_compliant
  implementation:
    - backend/src/middleware/auth.ts
    - backend/src/services/auth.service.ts
  tests: []
  gaps:
    - Fallback auf 'secret' in auth.ts:23
    - Fallback auf 'your-super-secret-jwt-key-change-in-production' in auth.service.ts:282
    - Algorithmus nicht explizit auf HS256 beschränkt

- id: SEC-002
  title: OIDC – State, Nonce und PKCE
  priority: P0
  status: non_compliant
  implementation:
    - backend/src/services/oidc.service.ts
    - backend/src/routes/auth.routes.ts
  tests: []
  gaps:
    - Kein PKCE (kein code_challenge/code_verifier)
    - State wird nicht validiert (_state Parameter in handleCallback)
    - Keine Nonce-Generierung oder -Validierung

- id: SEC-003
  title: CORS-Härtung
  priority: P0
  status: non_compliant
  implementation:
    - backend/src/index.ts
  tests: []
  gaps:
    - Wildcard-Fallback '*' wenn CORS_ORIGIN nicht gesetzt (index.ts:38)

- id: SEC-004
  title: Passwort-Policy
  priority: P0
  status: partial
  implementation:
    - backend/src/services/auth.service.ts
  tests: []
  gaps:
    - Keine Validierung der Passwortstärke bei register() und createFirstAdmin()

- id: SEC-005
  title: Zentrales Auditlog
  priority: P0
  status: compliant
  implementation:
    - backend/prisma/schema.prisma (AuditLog-Modell)
    - backend/src/services/audit.service.ts
    - backend/src/routes/auditLog.routes.ts
    - Integration in auth, admin, asset, risk, control, incident Services
  tests:
    - backend/src/__tests__/audit.service.test.ts
  gaps: []

- id: SEC-006
  title: Registrierungsschutz
  priority: P0
  status: partial
  implementation:
    - backend/src/routes/auth.routes.ts
    - backend/src/services/auth.service.ts
    - Admin-Freigabe für neue Benutzer (isApproved-Flag)
    - Selbstregistrierung standardmäßig deaktiviert
  tests: []
  gaps:
    - Kein Rate-Limiting auf Auth-Endpunkte

- id: IAM-004
  title: Display-ID Generierung
  priority: P1
  status: compliant
  implementation:
    - backend/src/services/displayId.service.ts
    - Prisma DisplayIdCounter Modell mit sequenziellen Containern
    - Format: PREFIX-NNNN (z.B. ASSET-0001, RISK-0001)
  tests: []
  gaps: []

- id: AST-001
  title: Asset-Verantwortliche Bestätigung
  priority: P1
  status: partial
  implementation:
    - backend/src/routes/asset.routes.ts (confirm-responsibility Endpoint existiert)
  tests: []
  gaps:
    - Kein Statusfeld responsibilityConfirmed im Schema

- id: AST-002
  title: Vollständige Asset-Felder
  priority: P1
  status: partial
  implementation:
    - backend/prisma/schema.prisma (Asset-Modell)
  tests: []
  gaps: []

- id: RSK-001
  title: Prozessbasierte Risikobewertung
  priority: P1
  status: partial
  implementation:
    - backend/prisma/schema.prisma (BusinessProcess-Modell)
    - backend/src/routes/businessprocess.routes.ts
  tests:
    - backend/src/__tests__/businessprocess.service.test.ts
  gaps:
    - affectedProcessIds im Risk-Modell ist noch String[] (denormalisiert)

- id: RSK-002
  title: Aggregierte Risikoverteilungen
  priority: P1
  status: missing
  implementation: []
  tests:
    - backend/src/__tests__/risk.aggregation.test.ts
  gaps:
    - Kein API-Endpoint für Aggregation

- id: CTL-001
  title: Statement of Applicability
  priority: P1
  status: partial
  implementation:
    - backend/prisma/schema.prisma (StatementOfApplicability-Modell)
    - backend/src/routes/control.routes.ts
  tests: []
  gaps:
    - Keine automatische Control-Auflistung pro Framework

- id: INC-001
  title: Incident-Bewertung und Meldefristen
  priority: P1
  status: partial
  implementation:
    - backend/prisma/schema.prisma (IncidentAssessment, NotificationDeadline)
    - backend/src/routes/incident.routes.ts
  tests: []
  gaps:
    - Keine automatische Fristberechnung

- id: AST-003
  title: Asset-Lebenszyklus-Protokollierung
  priority: P2
  status: partial
  implementation:
    - backend/prisma/schema.prisma (AssetLifecycleLog-Modell)
  tests: []
  gaps:
    - Keine automatische Protokollierung bei Statusänderungen

- id: AST-004
  title: Erweiterte Bewertungsdimensionen
  priority: P2
  status: compliant
  implementation:
    - backend/prisma/schema.prisma (Asset-Modell)
  tests: []
  gaps: []

- id: AST-005
  title: Graphvisualisierung (AST-011)
  priority: P2
  status: partial
  implementation:
    - backend/src/services/asset.graph.ts
    - frontend/src/components/AssetGraph.tsx
  tests:
    - backend/src/__tests__/asset.graph.test.ts
  gaps:
    - Filterung nach Relationship-Typ und Criticality nicht implementiert

- id: AST-006
  title: Impact Analysis (AST-012)
  priority: P2
  status: partial
  implementation:
    - frontend/src/components/AssetImpactAnalysis.tsx
  tests: []
  gaps:
    - Konfigurierbare Traversiertiefe nicht implementiert

- id: RSK-003
  title: Risikobehandlungspläne
  priority: P2
  status: partial
  implementation:
    - backend/src/routes/risktreatment.routes.ts
    - backend/src/services/risktreatment.service.ts
  tests:
    - backend/src/__tests__/risktreatment.service.test.ts
  gaps:
    - Validierung für accept-Option nicht implementiert

- id: UX-001
  title: Internationalisierung (i18n)
  priority: P2
  status: partial
  implementation:
    - frontend/src/context/I18nContext.tsx
    - frontend/src/locales/de.json
    - frontend/src/locales/en.json
  tests: []
  gaps: []

- id: UX-002
  title: Dark Mode
  priority: P2
  status: partial
  implementation:
    - frontend/src/context/DarkModeContext.tsx
  tests: []
  gaps: []

- id: OPS-001
  title: Intune-Integration
  priority: P3
  status: partial
  implementation:
    - backend/src/services/intune.service.ts
    - backend/src/services/intune.scheduler.ts
    - backend/src/routes/intune.routes.ts
  tests: []
  gaps: []

- id: OPS-002
  title: VMware vCenter-Integration
  priority: P3
  status: partial
  implementation:
    - backend/src/services/vcenter.service.ts
    - backend/src/routes/vmware.routes.ts
  tests: []
  gaps: []

- id: OPS-003
  title: Proxmox-Integration
  priority: P3
  status: partial
  implementation:
    - backend/src/services/proxmox.service.ts
    - backend/src/routes/proxmox.routes.ts
  tests: []
  gaps: []

- id: OPS-004
  title: Health Check und Monitoring
  priority: P3
  status: partial
  implementation:
    - backend/src/index.ts (GET /health)
  tests: []
  gaps:
    - Keine DB-Konnektivitätsprüfung
```

## Status-Legende
| Status | Bedeutung |
|--------|-----------|
| `compliant` | Vollständig implementiert und getestet |
| `partial` | Teilweise implementiert, Lücken bekannt |
| `missing` | Nicht implementiert |
| `non_compliant` | Falsch implementiert (sicherheitskritisch) |
