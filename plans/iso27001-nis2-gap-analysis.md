# Gap-Analyse: ISO 27001 & NIS2-Verbesserungsvorschläge

**Datum:** 2026-08-22
**Basis:** `plans/iso27001-nis2-improvement-proposals.md` (2026-08-19)
**Methode:** Codebase-Ist-Analyse (Backend-Service/Routen/Schema, Frontend-Seiten/API, DTOs, Seed)
**Ergebnis:** Ein großer Teil der Kernfunktionalität ist **bereits umgesetzt** — teils sogar weiterentwickelt als im Plan von 2026-08-19 angenommen. Die verbleibenden Lücken sind konkreter und kleiner als im ursprünglichen Gap-Report angenommen.

---

## Kurzfassung (Status-Ballung)

| Proposal | Status |
|---|---|
| §1 Control-Catalog vervollständigen (93) | ✅ Referenzkatalog fertig — ⚠️ `controls`-Tabelle lückenhaft |
| §2.1 NIS2 Self-Assessment mit Schwellenwerten | ✅ Backend fertig — ⚠️ Frontend an v1-Fragebogen gekoppelt |
| §2.2 Incident-Reporting (24h/30d) | ✅ **Vollständig umgesetzt** |
| §2.3 NIS2-Control-Catalog | ⚠️ NIS2-Themen existieren — ❌ kein Art.-Catalog + Crosswalk |
| §2.4 Supply-Chain (Art. 26/30) | ⚠️ Felder da — ❌ keine Verknüpfung zur Risiko-Bewertung |
| §3 Klauseln 4–10 (ISMS-Prozesse) | ⚠️ Teilweise — ✅ Management-Review da — ❌ ISMS-Policy fehlt |
| §4.1 SoA-Generierung | ✅ **Vollständig umgesetzt** |
| §4.2 SoA-Risk-Linkage | ❌ Fehlt |
| §4.3 SoA-Export (PDF/CSV) | ❌ Fehlt |
| §4.4 SoA-Diff zwischen Versionen | ❌ Fehlt |

**Fazit:** Die Prioritäten P0 (SoA-Generierung) und ein Teil von P1 (NIS2-Incident) sind bereits realisiert. Der ursprüngliche Report unterschätzte den Umsetzungsgrad deutlich.

---

## Detaillierte Prüfung

### §1 Control-Catalog vervollständigen (93 Kontrollen)

**Ist-Zustand (korrigiert gegenüber dem Plan von 2026quirent 2026-08-19):**
- Der **Referenzkatalog ist vollständig**: [`iso27001AnnexA2022.ts`](backend/src/data/iso27001AnnexA2022.ts) enthält exakt **93 Kontrollen** (A.5.1 → A.8.34), validiert. [`catalog.service.ts:ensureIso27001AnnexA2022Catalog()`](backend/src/services/catalog.service.ts:61) upsertet alle 93 in [`control_catalog_items`](backend/prisma/schema.prisma:3661).
- Der Plan verwechselt hier zwei Dinge: den **Referenzkatalog** (`control_catalog_items`, ✅ komplett) und die **`controls`-Tabelle** (Management-Entitäten, ❌ lückenhaft — enthält nur die Demo-/Seed-Kontrollen).

**Lücke:** Die `controls`-Tabelle (die die Controls-UI listet) ist nicht aus dem Katalog befüllt. Sie wird erst bei der SoA-Generierung angelegt (siehe §4.1). Für eine reine Catalog-Betrachtung ist die Referenzdaten ✅.

**Empfehlung:** Kein Katalog-Support mehr. Stattdessen eine „Controls aus Katalog synchronisieren"-Funktion, die die 93 `Control`-Entitäten anlegt (idempotent), damit die Controls-UI vollständig ist.

---

### §2.1 NIS2 Self-Assessment mit echten Schwellenwerten

**Ist-Zustand:**
- Backend ist **vollständig**: [`NIS2_APPLICABILITY_QUESTIONNAIRE`](backend/src/services/nis2.service.ts:126) (v2.0.0) mit 18 Sektoren (NIS2_SECTORS), employeeCount, annualRevenue, balanceSheetTotal; [`evaluateApplicability()`](backend/src/services/nis2.service.ts:314) berechnet `essential_entity`/`important_entity`/`not_in_scope` nach den NIS2UmsuCG-Schwellenwerten (≥250 MA oder ≥50M/43M → bwE; ≥50 MA oder ≥10M/10M → wE).
- Backend-Endpunkte existieren: `/nis2/questionnaire/v2`, `/nis2/questionnaire/v2/ensure`, `/nis2/sectors` (siehe [nis2.routes.ts](backend/src/routes/nis2.routes.ts:105)).

**Lücke (Frontend):** Die Seite [`NIS2.tsx`](frontend/src/pages/NIS2.tsx) ist an der **alten v1.0-Fragebogen-Variante** gekoppelt (via `ensureDefaultQuestionnaire`, `criticalService`-Boolean, freier Sektor-Text). Das v2.0-Fragebogen-UI (Sektor-Auswahl mit 18 Sektoren, Umsatz/Bilanzsumme) ist **nicht ins Frontend eingebunden**. [`nis2Api`](frontend/src/services/api.ts:460) bietet die v2-Endpunkte nicht an.

**Empfehlung:** Frontend an v2.0-Qfragebogen binden (Endpunkt-Wrapper in api.ts + Sektor-Auswahl + Zahlenfelder). Backend ist fertig.

---

### §2.2 Incident-Reporting (NIS2 Art. 23) — ✅ Vollständig

**Ist-Zustand (deutlich weiter als im Plan angenommen):**
- Migration [`20260820164600_nis2_incident_reporting`](backend/prisma/migrations/20260820164600_nis2_incident_reporting/migration.sql): Felder `nis2Relevant`, `nis2Severity` (not_assessed/early_warning/notification/final), `nis2ReportedAt`, `nis2ReportDeadline`, `nis2FinalReportDue` + Indizes.
- [`incident.service.ts`](backend/src/services/incident.service.ts:794): `markRelevant` (24h/30d-Deadlines), `earlyWarning`, `notification`, `finalReport`, `getReportingStatus`.
- [`incident.routes.ts`](backend/src/routes/incident.routes.ts:188): alle NIS2-Endpunkte inkl. `/reporting-status`.
- [`IncidentDetail.tsx`](frontend/src/pages/IncidentDetail.tsx): Abschnitt „NIS2 significance and reportability", Notification-Deadlines mit Status-Farben, Reports (early_warning_24h / incident_notification_72h / interim_report / monthly_final_report) mit Export.

**Ergebnis:** Vorschlag §2.2 ist **komplett umgesetzt**. Kein Handlungsbedarf.

---

### §2.3 NIS2-Control-Catalog + Crosswalk

**Ist-Zustand:**
- Es gibt **keinen** dedizierten `NIS2UmsuCG`-Catalog mit Pflichten-Artikeln (Art. 23/24/25/26/27/29/30).
- Stattdessen existiert der **„Measures Catalogue"**: [`ensureMeasuresCatalogue()`](backend/src/services/nis2.service.ts:427) legt Framework `NIS2` v2024-phase5 mit 10 Themen (Art. 21-Maßnahmen) als `Control` + `requirement` an; [`NIS2_TOPICS`](backend/src/services/nis2.service.ts:180). Cross-Referenzen zu ISO-Kontrollen existieren **nicht**.

**Lücke:** Art.-basierter Catalog (Art. 23 Risiko-Minimierung, Art. 25 Incident-Reporting, Art. 26/30 Supply-Chain, Art. 27 Registrierung, Art. 29 Schulungen, Art. 24 Accountability) **fehlt**, ebenso der Crosswalk Art → ISO-Kontrolle.

**Empfehlung:** Kleiner neuer Catalog `NIS2UmsuCG` mit Art.-Items + `controlRequirementMapping`-Links zu ISO-Kontrollen (das Junction-Modell existiert bereits).

---

### §2.4 Supply-Chain (NIS2 Art. 26/30)

**Ist-Zustand:**
- [`Supplier`](backend/prisma/schema.prisma:2119) hat `nis2Relevant`, `securityRequirements`, `criticality`, `exitStrategy`, `nextReviewDate` (jährlicher Review) — gut.
- [`SupplierAssessment`](backend/prisma/schema.prisma:2152) existiert (eigenes Modell, getrennt von `RiskAssessment`).

**Lücke:** Kein `supplierRiskAssessmentId`/Verknüpfung zum `RiskAssessment`-Modell; kein erzwungenes Risk-Assessment für `nis2Relevant=true`; kein Reminder-Alert bei Fälligkeit von `nextReviewDate` (nur das generelle Reminder-Modul ist vorhanden).

**Empfehlung:** Junction `SupplierRiskRelation` bereits existiert (sieht `riskId` vor) — für `nis2Relevant`-Supplier verknüpfen + Reminder bei `nextReviewDate`.

---

### §3 ISO 27001 Klauseln 4–10 als ISMS-Prozesse

**Gap-Map aktualisiert (Ist-Analyse):**

| Klausel | Thema | Plan-Status (2026-08-19) | Tatsächlicher Status | Lücke |
|---|---|---|---|---|
| **4** | Kontext, interessierte Parteien | ❌ Fehlt | ⚠️ `InterestedParty`-Modell da, aber kein Kontextanalyse-/Relevanz-Registry | Teilweise |
| **5** | Führung, ISMS-Politik | ❌ Fehlt | ❌ Fehlt | ISMS-Policy-Doku komplett fehlend |
| **6** | Planung: Risiko & SoA | ✅ Teilweise | ✅ Teilweise | Keine verbindende Assessment→SoA→Treatment-Prozesskette |
| **7** | Unterstützung: Kompetenz, Awareness | ❌ Fehlt | ⚠️ `trainingAssignments`/`trainingAcknowledgement` in Phase-6 vorhanden, aber keine dedizierten Awareness-Nachweise | Teilweise |
| **8** | Betrieb: Kontrolle | ✅ Teilweise | ✅ | Controls-Modul |
| **9** | Performance, **Management-Review** | ⚠️ Teilweise | ✅ **ManagementReview-Modell existiert** | Management-Review ist umgesetzt (siehe unten) |
| **10** | Verbesserung: Korrekturmaßnahmen | ✅ | ✅ | CorrectiveActions |

**Wichtige Korrektur zum Plan:** Management-Review war im Plan als „fehlend" markiert, ist aber **vollständig vorhanden**: [`ManagementReview`](backend/prisma/schema.prisma:2478) mit `reviewDate`, `participants` (Json), `agenda`, `inputs`, `decisions`, `minutes`, `approvalStatus`, `nextReviewDate`, plus [`ManagementReviewAction`](backend/prisma/schema.prisma:2505) und Routing in [`ISMSPhase6.tsx`](frontend/src/pages/ISMSPhase6.tsx:240) / [`OperationsWorkspace.tsx`](frontend/src/pages/OperationsWorkspace.tsx:51).

**Verbleibende Lücken:**
- **Klausel 5 (ISMS-Policy):** kein Policy-Dokument (Version, Freigabe, Review-Zyklus).
- **Klausel 4:** kein strukturiertes Registry interessierter Parteien mit Anforderungen/Relevanz.
- **Klausel 6:** keine visuelle Prozesskette Assessment→SoA→Treatment.

**Empfehlung:** Kleines `IsmsProcessDocument`-Modell für Klausel 5 (Policy) + Klausel-4-Registry; Klausel 9/10 sind abgedeckt.

---

### §4.1 SoA-Generierung — ✅ Vollständig

**Ist-Zustand:**
- [`generateIso27001AnnexASOA()`](backend/src/services/control.service.ts:404): legt je Scope einen SoA-Draft mit allen 93 Kontrollen an, Status `under_review`, Platzhalter-Begründung (`ISO27001_SOA_PENDING_JUSTIFICATION`).
- [`submitSOA()`](backend/src/services/control.service.ts:571): erzwingt pro Item eine spezifische Applicability-Entscheidung + Begründung (lehnt `under_review`/Platzhalter ab).
- Frontend-UI in [`Controls.tsx`](frontend/src/pages/Controls.tsx:404): „Generate ISO/IEC 27001:2022 Annex A SoA"-Sektion mit Scope-Auswahl und Button.

**Ergebnis:** Vorschlag §4.1 ist **komplett umgesetzt** (inkl. Validierung). Kein Handlungsbedarf.

---

### §4.2 SoA-Risk-Linkage

**Ist-Zustand:** [`SoAItem`](backend/prisma/schema.prisma:1538) hat `controlId`, `requirementId`, `controlImplementationIds` (via `SoAItemControlImplementation`). **Kein** `riskAssessmentIds`/Verknüpfung zu Risk-Assessments.

**Lücke:** Risikobegründung der SoA fehlt.

**Empfehlung:** Optionales Feld/`SoAItemRiskLink`-Junction für `riskAssessmentIds`. Klein.

---

### §4.3 SoA-Export (PDF/CSV)

**Ist-Zustand:** Kein SoA-Export-Endpunkt oder -Frontend gefunden.

**Lücke:** Export (CSV/PDF) für Audit-Vorbereitung fehlt.

**Empfehlung:** CSV-Export (einfach) + optional PDF. Geringer Aufwand.

---

### §4.4 SoA-Diff zwischen Versionen

**Ist-Zustand:** Kein SoA-Diff gefunden. Versions-History existiert über `version`-Feld + Entity-History-Modul, aber keine visuelle Differenz (hinzugefügt/entfernt/geändert).

**Lücke:** Visuelle Differenzierung zwischen SoA-Versionen fehlt.

**Empfehlung:** Backend-Vergleich zweiter Versionen (Diff-Endpunkt), Frontend-Darstellung. Mittel.

---

## Priorisierter Restplan (auf Basis der Ist-Analyse)

Da P0 (SoA-Generierung) und ein Teil von P1 (NIS2-Incident) bereits fertig sind, verschiebt sich der Fokus:

| # | Restmaßnahme | Aufwand | Nutzen | Priorität |
|---|---|---|---|---|
| 1 | **NIS2 Self-Assessment: Frontend an v2.0 binden** | Gering | **Hoch** — gesetzliche Korrektheit im UI | **P0** |
| 2 | **Controls aus Katalog synchronisieren** (93 `Control`-Entitäten) | Gering | **Hoch** — vollständige Controls-UI | **P1** |
| 3 | **ISMS-Policy-Doku (Klausel 5)** + Klausel-4-Registry | Gering | **Hoch** — häufiges Audit-Finding | **P1** |
| 4 | NIS2-Art.-Catalog + Crosswalk zu ISO | Mittel | Mittel-hoch | **P2** |
| 5 | Supply-Chain: Risk-Linkage + Reminder bei Review-Fälligkeit | Gering | Mittel-hoch | **P2** |
| 6 | SoA-Risk-Linkage | Gering | Mittel | **P2** |
| 7 | SoA-Export (CSV/PDF) | Gering | Mittel | **P3** |
| 8 | SoA-Diff zwischen Versionen | Mittel | Gering-mittel | **P3** |

---

## Hinweis zur Datenbasis

Der ursprüngliche Report (2026-08-19) ging von „nur ~17 ISO-Kontrollen im Catalog" aus. Tatsächlich ist der **Referenzkatalog (`control_catalog_items`) mit 93 Einträgen vollständig**; die Lexiste liegt in der separaten `controls`-Managementtabelle. Diese Unterscheidung ist für die Planung relevant: §1 ist kein Katalog-, sondern ein Entitäten-Synchronisations-Thema.
