# Analyse: Umsetzung der Verbesserungs-vorschläge aus plans/iso27001-nis2-improvement-proposals.md

**Datum:** 2026-08-22
**Prüfumfang:** Alle 10 Verbesserungsvorschläge aus `plans/iso27001-nis2-improvement-proposals.md`
**Methode:** Ist-Analyse des Codebase (Prisma-Schema, Services, Routes, Frontend)

---

## 1. Zusammenfassung der Ergebnisse

| # | Vorschlag | Status | Belege im Codebase |
|---|----------|---------|-----------|
| 1 | Control-Catalog vervollständigen (93 ISO-Kontrollen) | ✅ **Implementiert** | [`iso27001AnnexA2022.ts`](backend/src/data/iso27001AnnexA2022.ts) (93 Controls), [`catalog.service.ts`](backend/src/services/catalog.service.ts) (`ensureIso27001AnnexA2022Catalog`) |
| 2 | SoA-Generierung aus Katalog | ✅ **Implementiert** | [`control.service.ts:404`](backend/src/services/control.service.ts:404) (`generateIso27001AnnexASOA`), Route [`control.routes.ts:54`](backend/src/routes/control.routes.ts:54) |
| 3 | NIS2 Self-Assessment mit Schwellenwerten | ✅ **Implementiert** | [`nis2.service.ts`](backend/src/services/nis2.service.ts) (`NIS2_SECTORS`, `NIS2_SCORING_RULES`, `evaluateApplicability`) |
| 4 | NIS2 Incident-Reporting (24h/30d) | ✅ **Implementiert** | [`incident.service.ts:802`](backend/src/services/incident.service.ts:802) (`markNis2Relevant`, `submitNis2EarlyWarning`, `submitNis2Notification`, `submitNis2FinalReport`, `getNis2ReportingStatus`) |
| 5 | Klausel-9 Management-Review-Record | ✅ **Implementiert** | [`ManagementReview`](backend/prisma/schema.prisma:2478)-Modell, Routes [`phase6.routes.ts:359`](backend/src/routes/phase6.routes.ts:359) |
| 6 | NIS2 Control-Catalog + Crosswalk | ✅ **Implementiert** | [`nis2.service.ts`](backend/src/services/nis2.service.ts) (`NIS2`-Framework, `NIS2_TOPICS`, `controlRequirementMapping`) |
| 7 | ISMS Process Workspace (Klauseln 4,5,7) | ⚠️ **Teilweise** | Modelle existieren (`InterestedParty`, `PolicyDocument`, `Training*`), aber kein einheitlicher „ISMS Process Workspace"-Übergang |
| 8 | SoA-Risk-Linkage | ❌ **Nicht implementiert** | `SoAItem` ohne `riskAssessmentIds` |
| 9 | SoA-Export (PDF/CSV) | ❌ **Nicht implementiert** | Keine `exportSoa`-Methode, keine Export-Routes |
| 10 | SoA-Diff zwischen Versionen | ❌ **Nicht implementiert** | Keine Diff-Logik |

**Fazit:** 6 von 10 Vorschlägen sind vollständig implementiert, 1 (ISMS Process Workspace) teilweise, 3 (SoA-Risk-Linkage, SoA-Export, SoA-Diff) fehlen. Der Stand entspricht damit der in [`plans/iso27001-nis2-improvement-proposals.md:159`](plans/iso27001-nis2-improvement-proposals.md:159) empfohlenen Phasenabfolge (Phase A/B vollständig, Phase C teilweise).

---

## 2. Detaillierte Analyse

### 2.1 Vorschlag #1 — Control-Catalog vervollständigen (93 ISO-Kontrollen) ✅ IMPLEMENTIERT

Der Katalog ist vollständig. Die Datei [`iso27001AnnexA2022.ts`](backend/src/data/iso27001AnnexA2022.ts) enthält exakt **93 Controls** (A.5.1–A.5.37, A.6.1–A.6.8, A.7.1–A.7.14, A.8.1–A.8.34), je mit `controlId`, `title`, `category` und `objective`.

Die `catalogService.ensureIso27001AnnexA2022Catalog()`-Methode sichert die Katalog-Einträge idempotent ab (Seed-Muster). Der SoA-Generator wirft einen Fehler, wenn der Katalog unvollständig ist (`catalog.items.length !== ISO27001_ANNEX_A_2022_CONTROLS.length`).

**Empfehlung:** Keine Änderungen erforderlich.

### 2.2 Vorschlag #2 — SoA-Generierung aus Katalog ✅ IMPLEMENTIERT

Die Methode [`generateIso27001AnnexASOA(scopeId, createdBy)`](backend/src/services/control.service.ts:404) erstellt je Scope ein vollständiges SoA-Draft:
- Alle 93 Kontrollen als `SoAItem` mit Status `under_review` und Platzhalter-Begründung (`ISO27001_SOA_PENDING_JUSTIFICATION`)
- Erhöht die Versionsnummer automatisch
- Verbindet Controls mit dem ISO/IEC 27001:2022-Framework
- Route: [`control.routes.ts:54`](backend/src/routes/control.routes.ts:54)

**Empfehlung:** Keine Änderungen erforderlich.

### 2.3 Vorschlag #3 — NIS2 Self-Assessment mit Schwellenwerten ✅ IMPLEMENTIERT

[`nis2.service.ts`](backend/src/services/nis2.service.ts) enthält:
- `NIS2_SECTORS`: alle Sektoren des NIS2-Umsetzungsgesetzes
- `NIS2_APPLICABILITY_QUESTIONNAIRE`: Fragebogen mit Sektor, Beschäftigtenzahl, Jahresumsatz, Bilanzsumme
- `NIS2_SCORING_RULES`: bwE (≥250 MA ODER (≥50 Mio. € UND ≥43 Mio. €)) und wE (≥50 MA ODER (≥10 Mio. € UND ≥10 Mio. €))
- `evaluateApplicability()`: serverseitige Klassifizierung in `essential_entity` / `important_entity` / `not_applicable`

**Empfehlung:** Keine Änderungen erforderlich.

### 2.4 Vorschlag #4 — NIS2 Incident-Reporting (24h-Meldung) ✅ IMPLEMENTIERT

[`incident.service.ts`](backend/src/services/incident.service.ts) implementiert den vollständigen NIS2-Meldeworkflow:
- `markNis2Relevant()`: setzt `nis2Relevant=true`, berechnet `nis2ReportDeadline` (24h) und `nis2FinalReportDue` (30 Tage)
- `submitNis2EarlyWarning()`: Frühwarnung
- `submitNis2Notification()`: formelle Meldung (24h)
- `submitNis2FinalReport()`: abschließender Bericht (30 Tage)
- `getNis2ReportingStatus()`: Statusberechnung mit Überfälligkeits-Flag

Das Incident-Modell enthält die Felder `nis2Relevant`, `nis2Severity`, `nis2ReportDeadline`, `nis2FinalReportDue`, `nis2ReportedAt`.

**Empfehlung:** Keine Änderungen erforderlich.

### 2.5 Vorschlag #5 — Klausel-9 Management-Review-Record ✅ IMPLEMENTIERT

Das [`ManagementReview`](backend/prisma/schema.prisma:2478)-Modell existiert mit `reviewDate`, `chairId`, `participants`, `agenda`, `inputs`, `decisions`, `minutes`, `approvalStatus`, `nextReviewDate`. Die Routes sind in [`phase6.routes.ts:359-371`](backend/src/routes/phase6.routes.ts:359) hinterlegt (create, update, approval).

**Empfehlung:** Keine Änderungen erforderlich.

### 2.6 Vorschlag #6 — NIS2 Control-Catalog + Crosswalk ✅ IMPLEMENTIERT

Das NIS2-Framework (`catalogId: 'NIS2'`, Version `2024-phase5`) ist implementiert. `NIS2_TOPICS` definieren die Pflicht-Artikel als Anforderungen, und `controlRequirementMapping` verknüpft Controls mit den Anforderungen (Crosswalk).

**Empfehlung:** Prüfen, ob die Crosswalk-Referenzen (NIS2-Artikel → ISO-Kontrollen) vollständig befüllt sind.

### 2.7 Vorschlag #7 — ISMS Process Workspace (Klauseln 4,5,7) ⚠️ TEILWEISE IMPLEMENTIERT

Die einzelnen Bausteine existieren als Datenbankenmodelle, aber es fehlt ein zusammenhängender „ISMS Process Workspace":

| Klausel | Thema | Modell | Status |
|---|---|---|---|
| 4 | Kontext, interessierte Parteien | [`InterestedParty`](backend/prisma/schema.prisma:413) | ⚠️ Parteien erfasst, keine Kontextanalyse-Doku |
| 5 | Führung, ISMS-Policy | [`PolicyDocument`](backend/prisma/schema.prisma:2030) (mit Versionen, Freigabe, Review) | ✅ Implementiert |
| 7 | Unterstützung: Kompetenz/Awareness | [`TrainingCourse`](backend/prisma/schema.prisma:2405), [`TrainingAssignment`](backend/prisma/schema.prisma:2426), [`TrainingCompletion`](backend/prisma/schema.prisma:2448), [`TrainingAcknowledgement`](backend/prisma/schema.prisma:2466) | ✅ Implementiert |

**Empfehlung:** Einheitliches Frontend/Übergang schaffen, das Klausel 4–10 als Prozesskette darstellt. Klausel 6 (Assessment → SoA → Treatment) und Klausel 10 (CorrectiveActions) sind ebenfalls vorhanden.

### 2.8 Vorschlag #8 — SoA-Risk-Linkage ❌ NICHT IMPLEMENTIERT

Das [`SoAItem`](backend/prisma/schema.prisma:1538)-Modell enthält `requirementId`, `controlId`, `justification`, `implementationStatus` und `implementationLinks` (über `SoAItemControlImplementation`), aber **keine** `riskAssessmentIds`. Die im Plan vorgeschene Verbindung „Risiko → Kontrolle → Begründung" fehlt.

**Empfehlung:** Neues Feld `riskAssessmentIds` (oder Junction-Tabelle) zu `SoAItem` hinzufügen.

### 2.9 Vorschlag #9 — SoA-Export (PDF/CSV) ❌ NICHT IMPLEMENTIERT

Es gibt keine `exportSoa`-Methode und keine Export-Routes in [`control.routes.ts`](backend/src/routes/control.routes.ts). Auch im Frontend existiert kein Export-Button.

**Empfehlung:** `exportSoa()`-Methode in `control.service.ts` implementieren (CSV + HTML-Export, der zu PDF druckbar ist) sowie Export-Routes.

### 2.10 Vorschlag #10 — SoA-Diff zwischen Versionen ❌ NICHT IMPLEMENTIERT

Keine Diff-Logik zwischen SoA-Versionen vorhanden.

**Empfehlung:** Diff-Methode hinzufügen, die Kontrollen zwischen Versionen vergleicht (hinzugefügt/entfernt/geändert).

---

## 3. Vergleich zur alten Analyse

Die frühere Analyse (`analysis/iso27001-nis2-improvement-analysis.md`, Version 2026-08-21) war veraltet:
- Sie behauptete „77 Kontrollen fehlen" — der Katalog enthält heute alle 93.
- Sie listete SoA-Generierung und NIS2-Incident-Reporting als nicht implementiert — beide sind implementiert.

Diese Analyse korrigiert diese Punkte.

---

## 4. Offene Restlücken (Priorisierung)

| # | Vorschlag | Aufwand | Nutzen | Priorität |
|---|-----------|---------|--------|-----------|
| 9 | SoA-Export (PDF/CSV) | Gering | Hoch — Audit-Vorbereitung | **P1** |
| 8 | SoA-Risk-Linkage | Gering | Mittel — Nachvollziehbarkeit | **P2** |
| 10 | SoA-Diff zwischen Versionen | Mittel | Mittel — Transparenz | **P2** |
| 7 | ISMS Process Workspace (einheitlicher Übergang) | Mittel | Mittel | **P2** |
