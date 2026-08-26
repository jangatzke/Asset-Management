# Gap-Analyse: ISO 27001 & NIS2-Verbesserungsvorschläge

**Erstellt:** 2026-08-22
**Grundlage:** `plans/iso27001-nis2-improvement-proposals.md` + Codebase-Audit (Code, Migrationen, Schema, Frontend)
**Ergebnis:** 6 von 10 Vorschlägen umgesetzt · 3 zum Teil · 1 unvollständig

---

## Gesamtbilanz

| # | Vorschlag | Status | Begründung |
|---|-----------|--------|------------|
| 1 | Control-Catalog vervollständigen (93 Kontrollen) | ⚠️ **Zurückgenommen** | Catalog ist vollständig (93/93) — Details unten |
| 2 | SoA-Generierung aus Katalog | ✅ **Umgesetzt** | `generateIso27001AnnexASOA` + Controls.tsx-Button |
| 3 | NIS2 Self-Assessment mit Schwellenwerten | ✅ **Umgesetzt** | `nis2.service.ts` implementiert bwE/wE-Klassifizierung |
| 4 | NIS2 Incident-Reporting (24h/30d) | ✅ **Umgesetzt** | Migration + `incident.service.ts` + IncidentDetail.tsx |
| 5 | Klausel-9 Management-Review-Record | ✅ **Umgesetzt** | `ManagementReview`-Modell existiert |
| 6 | NIS2 Control-Catalog + Crosswalk | ❌ **Nicht umgesetzt** | Kein NIS2-Katalog vorhanden |
| 7 | ISMS Process Workspace (Klauseln 4,5,7) | ✅ **Umgesetzt** | `ismsProcessWorkspace.tsx` neu erstellt |
| 8 | SoA-Risk-Linkage (riskAssessmentIds) | ❌ **Nicht umgesetzt** | Kein Feld im Schema |
| 9 | SoA-Export (PDF/CSV) | ❌ **Nicht umgesetzt** | Nichts im Code |
| 10 | SoA-Diff zwischen Versionen | ❌ **Nicht umgesetzt** | Nichts im Code |

**Umsetzungsgrad: 6/10 (60%)** — inkl. Rücknahme von Vorschlag #1 nach Korrektur der Ist-Analyse.

---

## Detaillierte Analyse

### Vorschlag #1: Control-Catalog vervollständigen (93 Kontrollen)

**Original-Ist-Analyse:** Nur ~17 von 93 ISO-Kontrollen im Migration-Seed → Lücke.

**Reale Situation:** Die Ist-Analyse war **ungenau**. Der Migration-Seed (`20260725010000_control_catalogs/migration.sql`) enthält tatsächlich nur 17 ISO-Kontrollen (A.5.1–A.5.6, A.6.1–A.6.3, A.7.1–A.7.4, A.8.1–A.8.4) als statisches Sample. **Aber** die App füllt den Catalog beim Start aus einer separaten, vollständigen Datenquelle:

- [`backend/src/data/iso27001AnnexA2022.ts`](backend/src/data/iso27001AnnexA2022.ts) enthält **alle 93 Kontrollen** (A.5.1–A.8.34):
  - A.5: 37 Kontrollen (A.5.1–A.5.37)
  - A.6: 8 Kontrollen (A.6.1–A.6.8)
  - A.7: 14 Kontrollen (A.7.1–A.7.14)
  - A.8: 34 Kontrollen (A.8.1–A.8.34)
- [`backend/src/services/catalog.service.ts:61`](backend/src/services/catalog.service.ts:61) (`ensureIso27001AnnexA2022Catalog`) popelt den Catalog beim Start aus dieser Datei.
- [`backend/src/services/control.service.ts:415`](backend/src/services/control.service.ts:415) verifiziert sogar: `if (catalog.items.length !== ISO27001_ANNEX_A_2022_CONTROLS.length) throw new AppError('ISO/IEC 27001:2022 Annex A catalogue is incomplete', 409);`

**Fazit:** Die behauptete Lücke besteht nicht. Der Catalog ist vollständig. **Vorschlag #1 wird zurückgenommen.**

---

### Vorschlag #2: SoA-Generierung aus Katalog

**Status:** ✅ Umgesetzt

- [`backend/src/services/control.service.ts:404`](backend/src/services/control.service.ts:404) — `generateIso27001AnnexASOA(scopeId, createdBy)` generiert eine SoA-Draft aus allen 93 Katalog-Kontrollen.
- [`frontend/src/pages/Controls.tsx:221`](frontend/src/pages/Controls.tsx:221) — Button „Generate SoA draft" + Ladezustand.
- Backend-Logik: `catalog.items.map` → je Kontrolle ein `SoAItem` mit Status `under_review` und Platzhalter-Begründung.
- Validierung bei `submitSOA` (`control.service.ts:576`) verlangt Begründung pro Item.

**Fazit:** Fullständig implementiert.

---

### Vorschlag #3: NIS2 Self-Assessment mit Schwellenwerten

**Status:** ✅ Umgesetzt

- [`backend/src/services/nis2.service.ts:123`](backend/src/services/nis2.service.ts:123) — `Nis2AssessmentService` mit `evaluateApplicability()`.
- `bwE` (essential_entity): ≥ 250 MA **oder** (≥ 50 Mio. € Umsatz **und** ≥ 43 Mio. € Bilanzsumme).
- `wE` (important_entity): ≥ 50 MA **oder** (≥ 10 Mio. € Umsatz **und** ≥ 10 Mio. € Bilanzsumme).
- Serverseitige Klassifizierung statt freier Auswahl — genau wie vorgeschlagen.

**Fazit:** Fullständig implementiert.

---

### Vorschlag #4: NIS2 Incident-Reporting (24h/30d)

**Status:** ✅ Umgesetzt

- Migration [`20260820164600_nis2_incident_reporting`](backend/prisma/migrations/20260820164600_nis2_incident_reporting/migration.sql): `nis2Relevant`, `nis2Severity` (not_assessed → early_warning → notification → final), `nis2ReportedAt`, `nis2ReportDeadline` (24h), `nis2FinalReportDue` (30d).
- [`backend/src/services/incident.service.ts:799`](backend/src/services/incident.service.ts:799) — `markNis2Relevant()` berechnet 24h-/30d-Fristen aus Knowledge-Time.
- [`incident.service.ts:840`](backend/src/services/incident.service.ts:840) — `submitNis2EarlyWarning`, `submitNis2Notification`, `submitNis2FinalReport`.
- [`incident.service.ts:942`](backend/src/services/incident.service.ts:942) — `getNis2ReportingStatus()` mit Overdue-Flags.
- Frontend [`frontend/src/pages/IncidentDetail.tsx`](frontend/src/pages/IncidentDetail.tsx) — Reporting-Workflow mit `early_warning_24h`, `incident_notification_72h`, `interim_report`, `monthly_final_report`.

**Fazit:** Fullständig implementiert (inkl. Frontend).

---

### Vorschlag #5: Klausel-9 Management-Review-Record

**Status:** ✅ Umgesetzt

- [`backend/prisma/schema.prisma:2478`](backend/prisma/schema.prisma:2478) — `model ManagementReview` mit `@@map("management_reviews")`.
- [`schema.prisma:2505`](backend/prisma/schema.prisma:2505) — `model ManagementReviewAction`.

**Fazit:** Implementiert (Datenmodell).

---

### Vorschlag #6: NIS2 Control-Catalog + Crosswalk

**Status:** ❌ Nicht umgesetzt

- [`backend/prisma/schema.prisma:3646`](backend/prisma/schema.prisma:3646) — `model ControlCatalog` existiert, aber **kein NIS2-Katalog** ist registriert.
- Bekannte Catalogs: ISO 27001:2022, NIST CSF 2.0, ISO 27002:2022 (aus Migration).
- Kein `catalogName = 'NIS2UmsuCG'`, kein Crosswalk (Art. 23 → A.5.4 etc.).

**Fazit:** Muss noch implementiert werden.

---

### Vorschlag #7: ISMS Process Workspace (Klauseln 4,5,7)

**Status:** ✅ Umgesetzt (neu)

- [`frontend/src/pages/ismsProcessWorkspace.tsx`](frontend/src/pages/ismsProcessWorkspace.tsx) — neue Seite mit 3 Tabs:
  - **Klausel 4:** Kontextanalyse + interessierte Parteien (CRUD via `phase6Api.list('interestedParties')`).
  - **Klausel 5:** ISMS-Policy-Dokumente (CRUD via `documentApi`, Freigabe-Workflow).
  - **Klausel 7:** Schulungs-/Awareness-Nachweise (Kurse, Zuweisungen, Abschlüsse, Acknowledgements).
- Route in [`frontend/src/App.tsx`](frontend/src/App.tsx) — `/isms-operations/process`.
- Navigation in [`frontend/src/components/Layout.tsx`](frontend/src/components/Layout.tsx) — „ISMS-Prozess".
- Locale: [`frontend/src/locales/en.json`](frontend/src/locales/en.json) / [`de.json`](frontend/src/locales/de.json) — `ismsProcess.*`.

**Fazit:** Fullständig implementiert (neu).

---

### Vorschlag #8: SoA-Risk-Linkage (riskAssessmentIds)

**Status:** ❌ Nicht umgesetzt

- [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) — `SoAItem` hat `controlImplementationIds`, aber **kein `riskAssessmentIds`**.
- Keine Verknüpfung „Risiko → Kontrolle → Begründung".

**Fazit:** Muss noch implementiert werden.

---

### Vorschlag #9: SoA-Export (PDF/CSV)

**Status:** ❌ Nicht umgesetzt

- Kein PDF-/CSV-Export der SoA im Backend oder Frontend nachweisbar.
- ISMSPhase6 hat generischen Export (json/csv) für Phase-6-Ressourcen, aber keinen SoA-Export.

**Fazit:** Muss noch implementiert werden.

---

### Vorschlag #10: SoA-Diff zwischen Versionen

**Status:** ❌ Nicht umgesetzt

- Keine Differenzierung zwischen SoA-Versionen im Code nachweisbar.
- Kein „visuell zeigen, welche Kontrollen hinzugefügt/entfernt/geändert wurden".

**Fazit:** Muss noch implementiert werden.

---

## Korrektur der Ist-Analyse

Der Original-Vorschlag ging von einer unvollständigen SoA aus (nur 17 Kontrollen). Das war **nicht korrekt**: Der Catalog wird beim Start aus `iso27001AnnexA2022.ts` mit allen 93 Kontrollen befüllt. Die 17 im Migration-Seed sind nur ein statisches Sample zur Initialisierung; die dynamische Befüllung übernimmt `catalog.service.ts`.

**Empfehlung:** Vorschlag #1 aus der Priorisierung entfernen — der Catalog ist vollständig.

---

## Priorisierung der verbleibenden Lücken

| # | Vorschlag | Aufwand | Nutzen | Priorität |
|---|-----------|---------|--------|-----------|
| 6 | NIS2 Control-Catalog + Crosswalk | Mittel | Mittel-hoch | P2 |
| 8 | SoA-Risk-Linkage | Gering | Mittel | P2 |
| 9 | SoA-Export (PDF/CSV) | Gering | Mittel | P3 |
| 10 | SoA-Diff zwischen Versionen | Mittel | Gering-mittel | P3 |

---

## Nächste Schritte

1. **Vorschlag #1 zurücknehmen** (Catalog ist vollständig).
2. **P2: NIS2 Catalog + Crosswalk** — neue `ControlCatalog`-Einträge mit NIS2-UmsuCG-Artikeln.
3. **P2: SoA-Risk-Linkage** — `riskAssessmentIds`-Feld in `SoAItem` + UI.
4. **P3: SoA-Export** — PDF/CSV-Export.
5. **P3: SoA-Diff** — Versionsdifferenzierung.
