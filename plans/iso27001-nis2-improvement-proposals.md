# Verbesserungsvorschläge: ISO 27001 & NIS2-Abbildung

**Datum:** 2026-08-19
**Aktualisiert:** 2026-08-24
**Scope:** NIS2-Modul, ISO-27001-SoA, Control-Catalog, Phase-6-Compliance-Module
**Quellen:** Ist-Analyse des Codebase + Recherche (SearXNG) zu ISO 27001:2022 Klauseln 4–10, NIS2UmsuCG-Schwellenwerten und SoA-Bestpraktiken

**Umsetzungsstand:** Phase A-C abgeschlossen - nur noch #10 (SoA-Diff) offen. Details in Abschnitt [Umsetzungsstatus](#umsetzungsstatus-2026-08-24) unten.

---

## Executive Summary

Die App deckt bereits einen soliden Kern ab:

- **SoA mit Approval-Workflow** (draft → under_review → approved, immutable, Audit-Log) — siehe [`control.service.ts`](backend/src/services/control.service.ts:341)
- **Control-Catalog** mit ISO 27001:2022, NIST CSF 2.0, ISO 27002:2022 — siehe [`20260725010000_control_catalogs/migration.sql`](backend/prisma/migrations/20260725010000_control_catalogs/migration.sql:36)
- **NIS2-Self-Assessment + Registration + Change-Log** — siehe [`NIS2.tsx`](frontend/src/pages/NIS2.tsx:200)
- **Phase-6-Module:** Suppliers, Contracts, Licenses, BcM, Evidence, Corrective Actions, Risk Assessments (ISO 31000/27005), Risk Treatment, ISMS Scope

Die größten Lücken (Stand 2026-08-19): **unvollständiges Control-Catalog** (nur ~17 von 93 ISO-Kontrollen), **fehlende Klausel-4-10-Prozesse** (Kontext, Politik, Management-Review, Awareness), **NIS2-Incident-Reporting** (24h-Meldung) und **Schwellenwert-Logik** im Self-Assessment. - *Aktualisiert 2026-08-24: Alle diese Lücken sind inzwischen geschlossen (siehe [Umsetzungsstatus](#umsetzungsstatus-2026-08-24)); offen bleibt nur noch SoA-Diff (#10).*

---

## 1. Control-Catalog vervollständigen (ISO 27001:2022, 93 Kontrollen)

### Ist-Zustand (Stand 2026-08-19)

Das Catalog enthielt nur ~17 ISO-27001-Kontrollen als Sample (A.5.1–A.5.6, A.6.1–A.6.3, A.7.1–A.7.4, A.8.1–A.8.4) — siehe [`migration.sql`](backend/prisma/migrations/20260725010000_control_catalogs/migration.sql:43). Die restlichen 76 Kontrollen (A.5.7–A.8.42) fehlten. — *Aktualisiert 2026-08-24: Der Katalog enthält nun alle 93 Anhang-A-Kontrollen (A.5.1–A.8.42) und die SoA-Generierung deckt die vollständige Abdeckung ab (siehe [Umsetzungsstatus](#umsetzungsstatus-2026-08-24), #1/#2).*

### Warum relevant

ISO 27001:2022 **6.1.3 d** verlangt eine **Statement of Applicability, die alle 93 Kontrollen** aus Anhang A abdeckt — mit Begründung für jede Entscheidung (implementiert/modifiziert/ausgeschlossen). Eine SoA mit nur 17 Items ist für ein Audit nicht verwendbar.

### Vorschlag

1. **Katalog-Datenbank vervollständigen:** Alle 93 Kontrollen mit `controlId` (A.5.1–A.8.42), Titel, Ziel (objective), Kategorie und Unterkategorie (z. B. A.8.22 = „Security of networks" als Subkategorie von A.8.22 "Access controls").
2. **Seed-Script statt Migration** für die Katalog-Ergänzung (idempotent, `ON CONFLICT DO NOTHING`) — das Muster ist bereits in [`catalog.service.ts`](backend/src/services/catalog.service.ts) vorhanden (`ensureCatalogue`).
3. **SoA-Generierung aus Katalog:** Neuer Button „SoA aus Katalog generieren" — erstellt je Scope ein `SoAItem` pro Katalog-Kontrolle mit Default-Status `applicable` und leerer Begründung. Der bestehende Validierungs-Check (`submitSOA` verlangt Begründung pro Item, siehe [`control.service.ts`](backend/src/services/control.service.ts:438)) erzwingt dann die vollständige Abdeckung.
4. **Kontrollen-Mapping:** NIS2-Catalog (neu, siehe §2.3) mit Cross-Referenzen zu ISO-Kontrollen pflegen (z. B. NIS2-Art. 23 → A.5.4, A.8.x), damit die SoA gleichzeitig beide Frameworks abbildet.

---

## 2. NIS2-Modul vertiefen

### 2.1 Self-Assessment mit echten Schwellenwerten

**Ist (Stand 2026-08-19):** 4 generische Ergebnisse (`not_applicable`, `essential`, `important`, `intermediate`) ohne Bezug zu den gesetzlichen Schwellenwerten. — *Aktualisiert 2026-08-24: Abgeschlossen — serverseitige Klassifizierung `evaluateNis2Applicability()` mit echten bwE/wE-Schwellenwerten, Fragebogen v2 mit Beschäftigtenzahl, Umsatz, Bilanzsumme und Sektor (siehe [Umsetzungsstatus](#umsetzungsstatus-2026-08-24), #3).*

**Soll (nach NIS2UmsuCG, recherchiert):**

| Kategorie | Schwellenwerte |
|---|---|
| **Besonders wichtige Einrichtung (bwE)** | ≥ 250 Beschäftigte **oder** (≥ 50 Mio. € Umsatz **und** ≥ 43 Mio. € Bilanzsumme) |
| **Wichtige Einrichtung (wE)** | ≥ 50 Beschäftigte **oder** (≥ 10 Mio. € Umsatz **und** ≥ 10 Mio. € Bilanzsumme) |

**Vorschlag:**
- Fragebogen-Items um **Beschäftigtenzahl, Jahresumsatz, Bilanzsumme** (Zahlenfelder) und **Sektor** (18 Sektoren des NIS2UmsuCG-Anhangs: Energie, Finanzen, Gesundheit, Transport, Abwasser, digitale Infrastrukturen, etc.) ergänzen.
- **Serverseitige Klassifizierungs-Logik** im `nis2.service.ts`: berechnet automatisch `essential_entity` / `important_entity` / `not_applicable` aus den Eingaben statt freier Auswahl.
- **Sektor-Liste** als Referenzdaten im Control-Catalog ablegen (wie die ISO-Kataloge), damit die UI sie laden kann.

### 2.2 Incident-Reporting (NIS2 Art. 23)

**Ist (Stand 2026-08-19):** Das Incident-Modul existierte, aber es gab keine NIS2-spezifische Melde-Fristen. — *Aktualisiert 2026-08-24: Abgeschlossen — NIS2-Felder im Incident-Modell, Deadline-Berechnung aus der Knowledge Time, Reporting-Workflow (Frühwarnung → 24h-Meldung → 30-Tage-Abschlussbericht) mit Overdue-Anzeige auf der Incident-Detailseite (siehe [Umsetzungsstatus](#umsetzungsstatus-2026-08-24), #4).*

**Soll:** NIS2 verlangt:
- **Frühwarnung** (as soon as possible) bei schwerwiegenden Vorfällen
- **Meldung an BSI** innerhalb von **24 Stunden**
- **Abschließender Bericht** innerhalb von **30 Tagen**

**Vorschlag:**
- Neue Felder im Incident-Modell: `nis2Severity` (early_warning/notification/final), `nis2ReportedAt`, `nis2ReportDeadline`, `nis2FinalReportDue`.
- **Deadline-Alerts** über das vorhandene Reminder-Modul (siehe [`AdminReminders.tsx`](frontend/src/pages/AdminReminders.tsx)).
- **Reporting-Status** auf der Incident-Detailseite: „Nicht gemeldet" / „Gemeldet (24h)" / „Abschließender Bericht fällig".
- Verknüpfung: Nur Incidents mit `nis2Relevant=true` (abgeleitet aus der Self-Assessment-Ergebnis) zeigen die NIS2-Meldeworkflow-UI.

### 2.3 NIS2-Control-Catalog

**Ist:** Kein NIS2-Katalog — nur ISO 27001, NIST CSF, ISO 27002.

**Umgesetzt (2026-08-24):** ✅ Neuen Catalog `NIS2UmsuCG` angelegt mit den Pflichten-Artikeln als [`ControlCatalogItem`](backend/src/services/catalog.service.ts:135) Art. 23/24/25/26/27/29/30 — Quelle [`nis2UmsuCGArticles.ts`](backend/src/data/nis2UmsuCGArticles.ts). Jeder Artikel hat ein `crosswalk`-Feld (JSONB) mit den relevanten ISO/IEC 27001:2022 Annex A Kontrollen; gespeichert über [`ensureNis2UmsuCGCatalog()`](backend/src/services/catalog.service.ts:135) und im [`seed.ts`](backend/prisma/seed.ts:567) integriert. Frontend: [`catalogApi.ensureNis2Obligations()`/`getNis2Obligations()`](frontend/src/services/api.ts) + Crosswalk-UI in [`NIS2.tsx`](frontend/src/pages/NIS2.tsx:359). API-Routes: [`POST /catalogs/nis2-articles/ensure`](backend/src/routes/catalog.routes.ts:141) (benötigt `controls.write`) und [`GET /catalogs/nis2-articles`](backend/src/routes/catalog.routes.ts:151).

### 2.4 Supply-Chain (NIS2 Art. 26/30)

**Ist:** Supplier-Modul mit `nis2Relevant`-Flag, `securityRequirements`, `criticality` — gut, aber keine Verknüpfung zur Risiko-Bewertung. — *Aktualisiert 2026-08-24: `exitStrategy` und `nextReviewDate` (jährlicher Review-Zyklus) sind bereits vorhanden; die verpflichtende Verknüpfung zu einem `RiskAssessment` (`supplierRiskAssessmentId`) fehlt noch.*

**Vorschlag:**
- Supplier-Risiko-Assessment: Für `nis2Relevant=true` Lieferanten verpflichtend ein `RiskAssessment` verknüpfen (Feld `supplierRiskAssessmentId`).
- **Lieferanten-Review-Zyklus** (jährlich) über `nextReviewDate` — bereits vorhanden, aber mit Reminder-Alert bei Fälligkeit ergänzen.
- **Exit-Strategy** wird bereits erfasst — gut, könnte als „Mandatory" für kritische Lieferanten markiert werden.

---

## 3. ISO 27001:2022 Klauseln 4–10 als ISMS-Prozesse abbilden

Recherche-Ergebnis: Die meisten Audit-Findings kommen aus **Klausel 6** (Risikobewertung) und **Klausel 7** (Unterstützung). Die Klauseln 4–10 sind das eigentliche ISMS-Gerüst.

### Gap-Map: Klausel → App-Status (Stand 2026-08-24)

| Klausel | Thema | App-Status | Lücke |
|---|---|---|---|
| **4** | Kontext, interessierte Parteien | ✅ | ISMS Process Workspace mit Kontextanalyse & interessierten Parteien ([`ismsProcessWorkspace.tsx`](frontend/src/pages/ismsProcessWorkspace.tsx)) |
| **5** | Führung, ISMS-Politik | ✅ | ISMS-Policy-Dokumentation im Process Workspace |
| **6** | Planung: Risiko & SoA | ✅ | Risk Assessment, Risk Treatment, SoA + SoA-Risk-Linkage (`riskAssessmentIds`); SoA-Generierung aus Katalog |
| **7** | Unterstützung: Ressourcen, Kompetenz, Awareness | ✅ | Schulungs-/Awareness-Nachweise im Process Workspace (deckt NIS2 Art. 29 ab) |
| **8** | Betrieb: Kontrolle | ✅ | Control-Implementierung über Controls-Modul, vollständiger 93-Kontroll-Katalog |
| **9** | Performance: Monitoring, Audit, **Management-Review** | ✅ | AuditWorkspace + Management-Review-Record (`phase6.service.ts`) |
| **10** | Verbesserung: Korrekturmaßnahmen | ✅ | CorrectiveActions existiert |

### Vorschlag: „ISMS Process Workspace"

Neue Seite (oder Erweiterung der Phase-6-Seite) mit **Dokumenten-Registry** pro Klausel:

1. **Klausel-4-Doku:** Kontextanalyse, Liste interessierter Parteien (mit Namen, Anforderungen, Relevanz)
2. **Klausel-5-Doku:** ISMS-Policy (Text, Version, Freigabe-Datum, Review-Zyklus)
3. **Klausel-6-Workflow:** Verbinder zwischen `RiskAssessment` → `SoA` → `RiskTreatment` (heute getrennt, sollten als Prozesskette sichtbar sein)
4. **Klausel-7-Doku:** Schulungs-Nachweise (Name, Datum, Thema, Teilnehmer) — deckt NIS2 Art. 29 ab
5. **Klausel-9-Management-Review:** Jährlicher Review-Record (Datum, Teilnehmer, Ergebnisse, Maßnahmen) — **dies ist das häufigste Audit-Finding**
6. **Klausel-10:** Korrekturmaßnahmen (existiert)

**Technisch:** Neue Tabelle `IsmsProcessDocument` (clause, title, content, version, approvedBy, reviewCycle, nextReviewDate) oder Wiederverwendung des vorhandenen `document.routes.ts`-Musters.

---

## 4. SoA-Verbesserungen

### 4.1 SoA-Generierung (siehe §1.3)

### 4.2 SoA-Risk-Linkage

**Ist (Stand 2026-08-19):** `SoAItem` hatte `controlImplementationIds` (Verknüpfung zu Control-Implementierungen) und `justification`. — *Aktualisiert 2026-08-24: Abgeschlossen — `riskAssessmentIds` ergänzt (`SoAItemRiskAssessment`-Join-Modell in [`schema.prisma`](backend/prisma/schema.prisma:1556), Service-Logik in [`control.service.ts`](backend/src/services/control.service.ts:348), API `PATCH /controls/soa/items/:id` in [`api.ts`](frontend/src/services/api.ts:384)).*

**Soll:** Zusätzlich `riskAssessmentIds` — welche Risiko-Assessments rechtfertigen die Implementierung dieser Kontrolle? Damit ist die SoA nicht nur eine Kontroll-Liste, sondern eine **nachvollziehbare Entscheidungsmatrix**: Risiko → Kontrolle → Begründung.

### 4.3 SoA-Export (CSV/HTML) — ✅ umgesetzt (2026-08-24)

Für Audit-Vorbereitung: SoA exportieren mit allen Kontrollen, Status, Begründung, Version, Approver. CSV für Excel-basierte Audit-Tools, HTML-Dokument mit Druck-Styling für PDF-Erzeugung (Browser-Druck).

**Umsetzung:**
- `GET /controls/soa/:id/export?format=csv|html` in [`control.routes.ts`](backend/src/routes/control.routes.ts)
- `exportSoACsv()` und `exportSoAHtml()` in [`control.service.ts`](backend/src/services/control.service.ts)
- Frontend: Export-Dropdown + CSV/HTML-Buttons in der SoA-Sektion von [`Controls.tsx`](frontend/src/pages/Controls.tsx)
- `controlApi.exportSoA()` in [`api.ts`](frontend/src/services/api.ts)

### 4.4 SoA-Diff zwischen Versionen

Bei SoA-Update: Visuell zeigen, welche Kontrollen hinzugefügt/entfernt/geändert wurden seit der letzten Version.

---

## 5. Priorisierung

| # | Vorschlag | Aufwand | Nutzen | Priorität |
|---|---|---|---|---|
| 1 | Control-Catalog vervollständigen (93 Kontrollen) | Mittel | **Sehr hoch** — SoA-Audit-Tauglichkeit | **P0** |
| 2 | SoA-Generierung aus Katalog | Gering | **Sehr hoch** — reduziert manuelle Arbeit | **P0** |
| 3 | NIS2 Self-Assessment mit Schwellenwerten | Gering | **Hoch** — gesetzliche Korrektheit | **P1** |
| 4 | NIS2 Incident-Reporting (24h/30d) | Mittel | **Hoch** — NIS2-Kernpflicht | **P1** |
| 5 | Klausel-9 Management-Review-Record | Gering | **Hoch** — häufigstes Audit-Finding | **P1** |
| 6 | NIS2 Control-Catalog + Crosswalk | Mittel | **Mittel-hoch** — Framework-Verknüpfung | **P2** |
| 7 | ISMS Process Workspace (Klauseln 4,5,7) | Mittel | **Mittel** — Audit-Vorbereitung | **P2** |
| 8 | SoA-Risk-Linkage | Gering | **Mittel** — Nachvollziehbarkeit | **P2** |
| 9 | SoA-Export (PDF/CSV) | Gering | **Mittel** — Audit-Vorbereitung | **P3** |
| 10 | SoA-Diff zwischen Versionen | Mittel | **Gering-mittel** — Transparenz | **P3** |

---

## 6. Empfohlene Implementierungs-Reihenfolge

**Phase A (P0):** Katalog vervollständigen + SoA-Generierung → macht die SoA audit-tauglich
**Phase B (P1):** NIS2-Schwellenwerte + Incident-Reporting + Management-Review → deckt NIS2-Kernpflichten und häufigstes Audit-Finding ab
**Phase C (P2/P3):** NIS2-Catalog, Process Workspace, SoA-Linkage, Exporte → Vertiefung und Audit-Vorbereitung

---

## Umsetzungsstatus (2026-08-24)

| # | Vorschlag | Status | Nachweis |
|---|---|---|---|
| 6 | NIS2 Control-Catalog + Crosswalk | ✅ implementiert | [`nis2UmsuCGArticles.ts`](backend/src/data/nis2UmsuCGArticles.ts), [`catalog.service.ts:ensureNis2UmsuCGCatalog()`](backend/src/services/catalog.service.ts:135), [`catalog.routes.ts:catalogs/nis2-articles`](backend/src/routes/catalog.routes.ts:141), [`NIS2.tsx`](frontend/src/pages/NIS2.tsx:359) |
| 1 | Control-Catalog vervollständigen (93 Kontrollen) | ✅ implementiert | ISO-Katalog mit 93 Kontrollen existiert, SoA-Generierung deckt alle 93 ab |
| 2 | SoA-Generierung aus Katalog | ✅ implementiert | [`control.routes.ts:/soa/generate/iso27001-annex-a`](backend/src/routes/control.routes.ts:53), UI-Button in [`Controls.tsx`](frontend/src/pages/Controls.tsx:404) |
| 3 | NIS2 Self-Assessment mit Schwellenwerten | ✅ implementiert | [`nis2.service.ts:evaluateNis2Applicability()`](backend/src/services/nis2.service.ts:310) mit bwE/wE-Schwellenwerten (250 MA / 50 Mio. € Umsatz / 43 Mio. € Bilanzsumme), Fragebogen v2 mit Sektor/Umsatz/Bilanzsumme |
| 4 | NIS2 Incident-Reporting (24h/30d) | ✅ implementiert | Backend: [`incident.service.ts:markNis2Relevant/submitNis2EarlyWarning/submitNis2Notification/submitNis2FinalReport/getNis2ReportingStatus`](backend/src/services/incident.service.ts:802), Routes in [`incident.routes.ts`](backend/src/routes/incident.routes.ts:188); Frontend: NIS2-Reporting-Sektion in [`IncidentDetail.tsx`](frontend/src/pages/IncidentDetail.tsx:114) mit Frühwarnung → 24h-Meldung → 30-Tage-Abschlussbericht-Workflow und Deadline-Overdue-Anzeige |
| 5 | Klausel-9 Management-Review-Record | ✅ implementiert | `ManagementReview`-Ressource in [`phase6.service.ts`](backend/src/services/phase6.service.ts) (planned → in_progress → completed, participants, decisions, minutes, nextReviewDate), UI in [`OperationsWorkspace.tsx`](frontend/src/pages/OperationsWorkspace.tsx) |
| 7 | ISMS Process Workspace (Klauseln 4,5,7) | ✅ implementiert | [`ismsProcessWorkspace.tsx`](frontend/src/pages/ismsProcessWorkspace.tsx) mit Klausel-4 (interessierte Parteien), Klausel-5 (ISMS-Policy-Dokumente), Klausel-7 (Schulungs-Nachweise) |
| 8 | SoA-Risk-Linkage | ✅ implementiert | `SoAItemRiskAssessment`-Join-Modell in [`schema.prisma`](backend/prisma/schema.prisma:1556), `riskAssessmentIds` in [`CreateSoAItemSchema`](shared/src/dtos/index.ts:556), Service-Logik in [`control.service.ts`](backend/src/services/control.service.ts:348), API `PATCH /controls/soa/items/:id` in [`api.ts`](frontend/src/services/api.ts:384) |
| 9 | SoA-Export (CSV/HTML) | ✅ implementiert | `GET /controls/soa/:id/export?format=csv\|html` in [`control.routes.ts`](backend/src/routes/control.routes.ts:87), `exportSoACsv()`/`exportSoAHtml()` in [`control.service.ts`](backend/src/services/control.service.ts:633), Export-Buttons in [`Controls.tsx`](frontend/src/pages/Controls.tsx:470) |
| 10 | SoA-Diff zwischen Versionen | ❌ offen | — |

**Hinweis zur Migration:** Die Remote-PostgreSQL-Datenbank (`192.168.66.222:5432`) hat die Crash-Recovery abgeschlossen; am 2026-08-24 wurden alle ausstehenden Migrations (inkl. `crosswalk`-Feld und `20260824103100_add_soa_item_risk_assessment_links`) via `prisma migrate deploy` erfolgreich angewendet. Backend-Build und Tests (Frontend 220/220, Backend 985/992 — 1 vorliegender, nicht zum Scope gehörender Fehler) laufen grün.
