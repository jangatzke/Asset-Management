# Sicherheitskonzept – Asset Management System (ISO 27001)

**Version:** 1.0  
**Datum:** 2026-07-17  

---

## 1. Sicherheitsziele

Das System schützt vertrauliche ISMS-Daten gemäß ISO/IEC 27001:2022 und erfüllt die Anforderungen der DSGVO sowie NIS2-Richtlinie. Die drei Säulen:

| Ziel | Maßnahme |
|------|----------|
| **Vertraulichkeit** | JWT-basierte Auth, RBAC, Entity-Level Permissions, TLS |
| **Integrität** | Auditlog (schreibgeschützt), Input-Validierung, Referentielle Integrität in DB |
| **Verfügbarkeit** | Health Checks, Rate Limiting, Fehlerbehandlung |

---

## 2. Authentifizierung

### 2.1 Lokale Authentifizierung

| Parameter | Wert |
|-----------|------|
| Passwort-Hashing | bcrypt, Rounds ≥ 10 (konfigurierbar via `BCRYPT_ROUNDS`) |
| Mindestlänge | 12 Zeichen |
| Komplexität | Großbuchstaben, Kleinbuchstaben, Ziffern, Sonderzeichen |
| Token-Typ | JWT (HS256) |
| Access-Token Lifetime | 1 Stunde |
| Refresh-Token | Separate Tabelle (`RefreshToken`), Rotation bei Verwendung |

### 2.2 OIDC / Entra ID

| Parameter | Wert |
|-----------|------|
| Flow | Authorization Code + PKCE (S256) |
| Scope | `openid profile email` |
| State | Serverseitig gespeichert, TTL 10 Minuten, beim Callback validiert |
| Nonce | Pro Session generiert, gegen ID-Token `nonce` Claim geprüft |
| PKCE | `code_challenge_method=S256`, `code_verifier` im Token-Exchange |
| E-Mail-Domain-Filter | Konfigurierbar via `OidcConfig.allowedEmailDomains` |

Phase 4 consolidates OIDC protocol validation in `openid-client`. The backend generates `state`, `nonce`, and PKCE verifier values, stores only a SHA-256 `stateHash` in `OidcLoginState`, and enforces a ten-minute TTL plus single callback use through `usedAt`. `openid-client.authorizationCodeGrant` validates the callback with expected `state`, expected `nonce`, and the server-side PKCE verifier; ID-token signature, issuer, audience, and expiry checks are handled by the library. Tenant validation is enforced in `backend/src/services/oidc.service.ts` after library validation: for Entra tenant IDs, the ID-token `tid` claim must equal `OidcConfig.tenantId`.

Existing local accounts are never linked by email alone. `OidcAccountLink` binds provider/config subject to `userId`; an existing matching email without that link is rejected and audited as `OIDC_EMAIL_LINK_REJECTED`. OIDC client secrets should be configured via `OidcConfig.clientSecretRef` such as `env:OIDC_CLIENT_SECRET`; legacy `clientSecret` remains deprecated compatibility data and is not required for the secure flow.

### 2.3 JWT-Spezifikation (Ziel)

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "uuid-v4",
    "email": "user@example.com",
    "roles": ["system_admin"],
    "iat": 1700000000,
    "exp": 1700003600,
    "jti": "uuid-v4"
  }
}
```

**Änderungen gegenüber Ist:**
- Algorithmus explizit `HS256` (kein Default)
- `jti` Claim für Token-Revocation
- Kein Fallback auf Hardcoded Secrets – Application startet nicht ohne `JWT_SECRET`

---

## 3. Autorisierung

### 3.1 Rollenmodell (RBAC)

```mermaid
graph TD
    A[User] -->|1:n| B[UserRole]
    B -->|n:1| C[Role]
    A -->|1:n| D[UserGroup]
    D -->|n:1| E[Group]
    E -->|1:n| F[GroupRole]
    F -->|n:1| C

    C --> G{administration.access}
    C --> H[RolePermission]
    H --> I[Permission]
    B --> J[LegalEntity/OrganizationUnit/IsmsScope/Site scope]
    F --> J
```

**Standardrollen:**

| Rolle | Granulare Permissions | Beschreibung |
|-------|-----------------------|-------------|
| `system_admin` | alle Permissions inklusive `administration.access` | Vollzugriff auf System und Admin-Bereich |
| `ism_manager` | alle Permissions inklusive `administration.access` | ISMS-Verantwortlicher, Admin-Zugriff |
| `auditor` | Leserechte auf ISMS-/Kernmodule | Externer Auditor – Leserecht auf relevante Objekte |
| `employee` | Basis-Leserechte auf Assets, Risiken, Controls, Incidents, Training und Dokumente | Standard-Mitarbeiter |

Phase 1 ersetzt das grobe `entityPermissions`-Modell durch `Permission` und `RolePermission`. Bestehende JSON-Felder bleiben nur als Kompatibilitätspfad für Altrollen erhalten. Der Mindestkatalog umfasst `assets.read`, `assets.write`, `assets.archive`, granulare Risiko-/Control-/Incident-Aktionsrechte, ISMS-Modulrechte und `administration.access`.

Rollen können direkt über `UserRole` oder indirekt über `GroupRole` zugewiesen werden. Jede Zuweisung darf optional auf `LegalEntity`, `OrganizationUnit`, `IsmsScope` und/oder `Site` begrenzt sein. Benutzer erhalten den Vereinigungsbereich aller aktiven direkten und gruppenbasierten Zuweisungen; abgelaufene Zuweisungen sind unwirksam.

### 3.2 Entity-Level Authorization Middleware

Jede relevante Operation prüft explizite Permissions über den zentralen `AuthorizationService`:

```typescript
// Pseudocode für AuthorizationService
async function canForEntity(userId, permission, entityType, entityId): Promise<boolean> {
  const assignments = await getActiveDirectAndGroupAssignments(userId, permission);
  const entityScope = await resolveScopeViaDomainRelations(entityType, entityId);
  return assignments.some((assignment) => assignment.isUnrestricted || assignment.matches(entityScope));
}
```

List-/Suchendpunkte müssen `buildReadFilter(userId, entityType)` in dieselbe Prisma-Where-Klausel einbetten, die auch für `count` und Pagination verwendet wird. Detailendpunkte außerhalb des erlaubten Scopes geben konsistent `403` zurück. ISMS-Scope-Prüfungen vergleichen niemals Objekt-IDs direkt mit Scope-IDs, sondern lösen den Fachpfad auf, z.B. Risiko → Organisationseinheit → Legal Entity → ISMS-Scope-Mitgliedschaft.

### 3.3 Admin-Bereichsschutz

Alle Routen unter `/api/v1/admin/*` erfordern `administration.access`. Die Middleware:

1. Lädt alle UserRole-Zuordnungen des Benutzers
2. Folgt zur RolePermission-/Permission-Tabelle und prüft `administration.access`
3. Berücksichtigt auch GroupRole-Zuordnungen und Ablaufdaten

---

## 4. Auditlog

### 4.1 Protokollierte Ereignisse

| Kategorie | Aktionen | Anforderung |
|-----------|----------|-------------|
| Authentifizierung | Login, Logout, Token Refresh, Failed Login | P0 |
| Admin-Operationen | CRUD auf Users, Roles, Groups, OIDC Config | P0 |
| Asset-Management | Create, Update, Delete Assets | P1 |
| Risiko-Management | Create, Update, Accept Risk | P1 |
| Konfiguration | Alle Änderungen an Systemkonfigurationen | P0 |

### 4.2 AuditLog-Schema

```prisma
model AuditLog {
  id            String   @id @default(uuid())
  actorId       String                      // User-ID des Ausführenden
  actorType     String                      // 'user', 'system', 'oidc'
  timestamp     DateTime @default(now())
  action        String                      // 'create', 'update', 'delete', 'login', etc.
  objectId      String                      // ID der betroffenen Entität
  objectType    String                      // 'User', 'Asset', 'Risk', etc.
  previousValue Json?                       // Zustand vor Änderung
  newValue      Json?                       // Zustand nach Änderung
  origin        String?                     // 'api', 'scheduler', 'migration'
  correlationId String?                     // Request-Trace-ID
  justification String?                     // Begründung (z.B. bei Risk Acceptance)

  @@index([timestamp])
  @@index([objectId, objectType])
  @@map("audit_logs")
}
```

### 4.3 Hash-Kette (Phase 9)

Ab Phase 9 enthält jede AuditLog-Zeile drei zusätzliche Felder für eine kryptografisch gesicherte Hash-Kette:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `sequence` | `Int` | Monoton steigende globale Sequenznummer (startend bei 1) |
| `previousHash` | `String?` | SHA-256 Hex-Digest des `entryHash` der vorherigen Entry (`null` oder leer für ersten Eintrag) |
| `entryHash` | `String` | SHA-256 Hex-Digest über kanonisierte Felder: `sequence|timestampISO|userId|userName|action|entityType|entityId|details|canonicalize(oldValue)|canonicalize(newValue)|previousHash` |

**Integritätsprüfung:**
- `AuditIntegrityService.verify()` lädt alle Einträge sortiert nach `sequence`, geht die Kette sequentiell durch und vergleicht jeden gespeicherten `entryHash` mit dem neu berechneten Wert.
- Bei Hash-Mismatch, vorherigem `previousHash`-Mismatch oder fehlender Sequenzlücke wird `{ valid: false, brokenAtSequence: N, details }` zurückgegeben.
- Periodische Checkpoints (`AuditCheckpoint` Modell) speichern einen Ankerpunkt für effiziente partielle Verifikation.

**Admin API:** `GET /admin/audit-integrity?fromSequence=0` gibt den Integritätsstatus ohne Exposition sensibler Daten zurück.

### 4.4 Schutzmaßnahmen

- **Kein DELETE:** Audit-Einträge sind unveränderlich (keine Update/Delete-API)
- **Soft-Delete nur auf Anwendungsebene:** Datenbank-Einträge bleiben erhalten
- **Export-Funktion:** Für Compliance-Berichte und Audits
- **Hash-Kette Tamper-Detection:** Jeder Versuch, einen Eintrag nachträglich zu modifizieren, führt zu einem Hash-Mismatch und wird von `verify()` erkannt.

---

## 5. Netzwerksicherheit

### 5.1 CORS-Konfiguration

| Umgebung | Origin | Credentials |
|----------|--------|-------------|
| Development | `http://localhost:*` | true |
| Staging | Konfigurierbar via `CORS_ORIGIN` | true |
| Production | Konfigurierbar via `CORS_ORIGIN` – **kein Wildcard** | true |

### 5.2 HTTP-Sicherheitsheader (Helmet.js)

```typescript
app.use(helmet({
  contentSecurityPolicy: { /* konfigurieren */ },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

### 5.3 Rate Limiting

| Endpoint | Limit | Fenster |
|----------|-------|---------|
| `/auth/login`, `/auth/register`, `/auth/login/mfa`, `/auth/preauth/*`, `/auth/oidc/*`, `/auth/me/*` | `AUTH_RATE_LIMIT_MAX` (Default 20) | `AUTH_RATE_LIMIT_WINDOW_MS` (Default 15 Min) pro IP |
| `/auth/refresh` | `REFRESH_RATE_LIMIT_MAX` (Default 120) | `AUTH_RATE_LIMIT_WINDOW_MS` (Default 15 Min) pro IP |
| `/service-accounts/auth` (Token-Verifizierung) | Globaler API-Limiter | `RATE_LIMIT_WINDOW_MS` (Default 15 Min) pro IP |
| Alle anderen API-Endpunkte | `RATE_LIMIT_MAX_REQUESTS` (Default 100) | `RATE_LIMIT_WINDOW_MS` (Default 15 Min) pro IP |

Hinweis: Die Rate-Limiter werten `req.ip` aus; hinter Reverse-Proxy/Load-Balancer
muss `TRUST_PROXY` korrekt gesetzt sein (Default: 1 Hop), sonst greift die
Limitierung pro Proxy-IP statt pro Endnutzer-IP.

---

## 6. Datensicherheit

### 6.1 Sensible Daten

| Datentyp | Schutzmaßnahme |
|----------|---------------|
| Passwörter | bcrypt Hashing – nie im Klartext speichern oder loggen |
| JWT Secrets | Umgebungsvariable – nie im Code |
| OIDC Client Secret | Verschlüsselt in DB (zukünftig) |
| vCenter Credentials | `passwordEncrypted` – AES-256-**GCM** (authentifizierte Verschlüsselung), Key aus `VMWARE_ENCRYPTION_KEY` (fail-closed, exakt 32 Zeichen) |
| Proxmox Credentials | `passwordEncrypted`/`apiToken` – AES-256-**GCM**, Key aus `PROXMOX_ENCRYPTION_KEY` (fail-closed, exakt 32 Zeichen) |
| MFA (TOTP) Secrets | `mfaSecret` – AES-256-GCM, Key aus `MFA_ENCRYPTION_KEY` (Fallback: abgeleitet aus `JWT_SECRET`) |
| PII (Namen, E-Mails) | Zugriffsbeschränkung via RBAC |

**Kompatibilität:** Bestehende AES-256-CBC-Werte (2-segmentiges
`iv:ciphertext`-Format) bleiben lesbar; neu gespeicherte Werte nutzen das
3-segmentige `iv:authTag:ciphertext`-Format (AES-256-GCM). Die
Neuverschlüsselung eines Legacy-Wertes erfolgt nur, wenn bei einem Update
des Credentials `password` bzw. `apiToken` tatsächlich mitgegeben wird –
ein reines Umbenennen (Name/Username/IsDefault) verändert den gespeicherten
Wert nicht und verschlüsselt ihn nicht neu. Um Legacy-Werte zu
migrieren, muss also einmalig das Passwort/der API-Token des jeweiligen
Credentials neu gespeichert werden.

## Phase 3 Pre-Authentication MFA and Password Gates

Local authentication now uses an explicit pre-authentication state machine for MFA and expired-password gates. `POST /api/v1/auth/login` can return `password_required`, `mfa_required`, `mfa_enrollment_required`, `password_change_required`, `authenticated`, or `disabled`. Disabled users receive no pre-auth token and no refresh cookie.

After successful email/password verification, MFA and password gates use short-lived pre-auth JWTs with `typ: pre_auth`, `userId`, and purpose `mfa_required`, `mfa_enrollment`, or `password_change`. The default lifetime is five minutes and can be configured with `PREAUTH_TOKEN_EXPIRES_SECONDS`. Pre-auth tokens are accepted only by matching `/api/v1/auth/preauth/*` endpoints or `/api/v1/auth/login/mfa`, and normal authenticated middleware rejects `typ: pre_auth`, so they cannot access application APIs.

Expired or administrator-required password changes use a password-change pre-auth token and then re-evaluate MFA. MFA enrollment pre-auth allows TOTP setup and confirmation without granting normal API access; successful TOTP confirmation issues the standard Phase 2 access token plus rotated HttpOnly refresh cookie. Admin MFA reset clears stored and pending TOTP secrets, writes an `MFA_RESET` audit event, and causes re-enrollment on next login when MFA is forced.

### 6.2 Datenbank-Sicherheit

- **Verbindung:** SSL/TLS für DB-Verbindung (`?ssl=require` in DATABASE_URL)
- **Benutzer:** Dedizierter DB-Benutzer mit minimalen Rechten (kein SUPERUSER)
- **Migrationen:** Nur via Prisma Migrate – keine manuellen SQL-Änderungen

### 6.3 Umgebungsvariablen

| Variable | Erforderlich | Default | Beschreibung |
|----------|-------------|---------|-------------|
| `DATABASE_URL` | Ja | – | PostgreSQL/SQL-Server Verbindungsstring |
| `JWT_SECRET` | Ja | **Kein Default** | JWT Signatur-Secret (≥ 32 Zeichen) |
| `VMWARE_ENCRYPTION_KEY` | Bei Nutzung vCenter | **Kein Default (fail-closed)** | AES-256-GCM Key, exakt 32 Zeichen |
| `PROXMOX_ENCRYPTION_KEY` | Bei Nutzung Proxmox | **Kein Default (fail-closed)** | AES-256-GCM Key, exakt 32 Zeichen |
| `MFA_ENCRYPTION_KEY` | Empfehlung | abgeleitet aus `JWT_SECRET` | AES-256-GCM Key für TOTP-Secrets |
| `WEBHOOK_SIGNATURE_SECRET` | Bei X-Webhook-Secret | – | Inbound Shared Secret (`WEBHOOK_SECRET` als Legacy-Fallback) |
| `TRUST_PROXY` | Bei Proxy | `1` (1 Hop) | Proxy-Hops für korrekte IP-Bestimmung (Rate-Limiting, Audit); `true` wird explizit in die Zahl `1` übersetzt – boolean `true` würde den linksten, von Clients fälschbaren `X-Forwarded-For`-Eintrag vertrauen |
| `HOST` | Nein | `127.0.0.1` | Bind-Adresse; `0.0.0.0` nur bei externer Erreichbarkeit |
| `CORS_ORIGINS` | Production | `http://localhost:3000` | Erlaubte CORS-Origin(en), kommagetrennt |
| `REFRESH_RATE_LIMIT_MAX` | Nein | `120` | Rate-Limit für `/auth/refresh` |
| `BACKUP_MAX_FILE_SIZE_MB` | Nein | `50` | Maximale Backup-Upload-Größe (Disk-Storage) |
| `NODE_ENV` | Nein | `development` | Umgebungsmodus |

---

## 7. Sicherheitsrichtlinien

### 7.1 Passwort-Richtlinie

- Mindestlänge: 12 Zeichen
- Erfordert: Großbuchstaben, Kleinbuchstaben, Ziffern, Sonderzeichen
- Keine der letzten 5 Passwörter wiederholen
- Sperrung nach 5 fehlgeschlagenen Versuchen (30 Minuten)

### 7.2 Session-Management

- Access-Token: 20 Minuten TTL (`JWT_ACCESS_TOKEN_EXPIRES_IN`)
- Refresh-Token: 7 Tage TTL mit Rotation + Reuse-Detection (Familien-Revocation)
- Automatische Invalidierung bei Passwortänderung
- Logout invalidiert alle aktiven Sessions des Benutzers

### 7.3 Prinzip der minimalen Berechtigung

- Neue Benutzer erhalten Standardrolle `employee` (readonly auf alles)
- Admin-Zugriff muss explizit gewährt werden
- Group-basierte Rollenvergabe bevorzugt über individuelle Zuweisungen

---

## 8. Compliance-Mapping

| Anforderung | ISO 27001:2022 Control | Implementation |
|-------------|----------------------|---------------|
| IAM-001 (Admin Schutz) | A.5.15 Access control | Admin Guard Middleware |
| IAM-002 (Entity Auth) | A.5.15 Access control | Entity Authorization Middleware |
| SEC-001 (JWT Härtung) | A.8.2 Authentication | HS256 + Secret Management |
| SEC-002 (OIDC PKCE) | A.8.2 Authentication | PKCE + State/Nonce Validation |
| SEC-003 (CORS) | A.8.22 Network security | Origin Validation |
| SEC-004 (Passwort-Policy) | A.5.17 Identity management | Password Validator |
| SEC-005 (Auditlog) | A.8.15 Logging | Audit Logger Middleware |
| SEC-006 (Registrierungsschutz) | A.5.17 Identity management | Rate Limiting + Config Toggle |

---

## 9. Incident Response

### 9.1 Sicherheitsrelevante Ereignisse

| Ereignis | Reaktion |
|----------|---------|
| Mehrfache fehlgeschlagene Logins | Account-Sperre nach 5 Versuchen, Audit-Eintrag |
| JWT-Manipulationsversuch | 401 Antwort, Audit-Eintrag mit IP |
| OIDC State Mismatch | 400 Antwort, Audit-Eintrag (möglicher CSRF-Angriff) |
| Admin-Zugriff ohne Berechtigung | 403 Antwort, Audit-Eintrag mit Detail |

### 9.2 Eskalationspfad

```mermaid
flowchart LR
    A[Sicherheitsereignis] --> B{Automatische Reaktion}
    B -->|Account Lock| C[Audit Log]
    B -->|Rate Limit| C
    C --> D[ISMS Manager Benachrichtigung]
    D --> E[Incident Assessment]
    E --> F[Meldung an Aufsichtsbehörde wenn erforderlich]
```
## Phase 2 Authentication and Session Management

Phase 2 implements a database-backed refresh-token session flow without starting Phase 3+ work. Access tokens are short-lived HS256 JWTs with configurable `JWT_ACCESS_TOKEN_EXPIRES_IN` defaulting to 20 minutes. The JWT payload contains only `userId` and `email`; roles are not embedded in newly issued access tokens. Critical authorization remains database-backed through `authorizationService` and scoped permission checks.

Refresh tokens are generated with 256 bits of random entropy, stored only as SHA-256 `tokenHash` values in the `RefreshToken` model, and delivered in an HttpOnly cookie with Secure and SameSite attributes. `POST /auth/refresh` authenticates only with this cookie and does not require access-token middleware. Refresh rotates tokens by marking token A used, creating token B in the same family, and returning a new access token plus replacement cookie. Reuse of an already used or revoked refresh token revokes the full family and creates an audit event. `POST /auth/logout` revokes the current refresh token and clears the cookie.

Frontend session handling now stores the access token only in memory. Durable `localStorage` access-token use was removed. Axios retries an original request exactly once after a successful refresh, and concurrent 401 responses share one in-flight refresh request.

Phase 1 historical context: the Phase 1 integration commit included pre-existing unrelated risk-control workflow changes according to `git show --stat`. Phase 2 did not expand or refactor those unrelated changes.

---

## 10. Offene Punkte (bekannt, nicht kritisch)

Die folgenden Punkte wurden im Sicherheits-/Code-Review identifiziert, sind
aber nicht als kritisch/hoch eingestuft und sind mit Planungs- oder
Abwägungsbedarf verbunden. Stand: 2026-08-16.

### 10.1 Authentifizierung & Sessions

| # | Punkt | Priorität | Hinweis / nächste Aktion |
|---|-------|-----------|--------------------------|
| 1 | MFA-Key fällt auf abgeleiteten `JWT_SECRET` zurück | Mittel | `MFA_ENCRYPTION_KEY` dediziert setzen (siehe `.env.example`). Langfristig: fail-closed wie bei Credential-Keys. |
| 2 | Service-Account `/auth`-Endpoint nicht separat rate-limitiert | Mittel | Profitiert vom globalen Limiter; bei hohem Volumen eigenen Limiter ergänzen. |
| 3 | `POST /auth/logout` ohne eigenen Limiter | Niedrig | Logout ist idempotent; Risiko gering, aber Limiter ergänzbar. |

### 10.2 Performance / Skalierung

| # | Punkt | Priorität | Hinweis / nächste Aktion |
|---|-------|-----------|--------------------------|
| 4 | `webhookAuth.ts` nutzt pro Request `await import('../config/database.js')` | Mittel | Statisch importieren (modul-Loader-Overhead vermeiden). |
| 5 | In-Memory-Idempotency-Store wächst ohne Redis | Mittel | Redis aktivieren (`.env.example`) oder TTL-Budget prüfen; Cleanup-Interval bereits vorhanden. |
| 6 | Webhook-Queue-Polling (5 s) statt Push | Niedrig | Akzeptabel; bei höherem Volumen Worker-Count/Redis-Queues prüfen. |

### 10.3 Architektur / Wartbarkeit

| # | Punkt | Priorität | Hinweis / nächste Aktion |
|---|-------|-----------|--------------------------|
| 7 | Fragiles Regex-Parsing der Prisma-Schema-JSON-Felder (`config/database.ts`) | Mittel | Robuster Parser oder Metadaten-Datei statt Schema-Text-Parsing. |
| 8 | `displayId`-Erstellung bei Service Accounts: Race bei paralleler Anlage | Niedrig | DB-Constraint (unique) + Retry statt Anwendungsfeststellung. |
| 9 | Duplizierte Token-Validierungslogik in `serviceAccountAuth.ts` und `serviceAccount.routes.ts` | Niedrig | Gemeinsame Funktion in `utils/` extrahieren. |

### 10.4 Abhängigkeiten

| # | Punkt | Priorität | Hinweis / nächste Aktion |
|---|-------|-----------|--------------------------|
| 10 | `multer` ^1.4.5-lts.1 (ältere Major-Version) | Mittel | Upgrade auf multer 2.x (API-kompatibel für diskStorage) im nächsten Wartungsfenster. |
| 11 | `express` ^4.18.2 (v5 verfügbar) | Niedrig | Migration bewusst planen (Router/Body-Parser-Änderungen). |
| 12 | `bcryptjs` (pure JS) statt nativen `bcrypt`/`argon2` | Niedrig | Funktionell OK; native Variante schneller bei hoher Last. Argon2id wäre die krypto-bestpractice-Option. |
