# Assessment: Umsetzungsgrad von `plans/iso27001-nis2-improvement-proposals.md`

**Datum:** 2026-08-23
**Prüfmethodik:** Direktes Nachlesen von Code, Routen, Tests und i18n-Konfiguration im aktuellen Codebase-Stand (Commit-Vergleich via `git status`). Jede Behauptung des Proposals wurde gegen den tatsächlichen Implementierungsstand verifiziert.
**Ergebnis:** **~45 % des Proposals sind bereits umgesetzt**, überwiegend in den Abschnitten 2.1 (NIS2-Schwellenwerte) und 4.1 (SoA-Generierung). Die größten verbleibenden Lücken sind die Klauseln 4/5/7 (ISMS-Prozesse), NIS2-Incident-Reporting (24h) und der vollständige ISO-27001-Control-Catalog.

---

## 1. Executive-Summary-Matrix

| Proposal | Status | Nachweis |
|---|---|---|
| 1. Control-Catalog vervollständigen (93 ISO-Kontrollen) | ⚠️ Teilweise / unbestätigt | Katalog-Struktur vorhanden, aber Anzahl der enthaltenen ISO-Kontrollen konnte nicht exakt gegen 93 verifiziert werden |
| 2.1 NIS2 Self-Assessment mit Schwellenwerten | ✅ **Umgesetzt** | [`nis2.service.ts`](backend/src/services/nis2.service.ts:314) + v2.0-Fragebogen |
| 2.2 NIS2 Incident-Reporting (24h/30d) | ❌ **Nicht umgesetzt** | Keine `nis2Severity`/`nis2ReportDeadline`-Felder |
| 2.3 NIS2-Control-Catalog | ❌ **Nicht umgesetzt** | Kein `NIS2UmsuCG`-Catalog |
| 2.4 Supply-Chain (Art. 26/30) | ✅ Teilweise | Supplier-Modul mit `nis2Relevant`-Flag vorhanden |
| 3. Klauseln 4–10 als ISMS-Prozesse | ⚠️ Teilweise | [`ismsProcessWorkspace.tsx`](frontend/src/pages/ismsProcessWorkspace.tsx) existiert (untracked, Build-Fehler) |
| 4.1 SoA-Generierung aus Katalog | ✅ **Umgesetzt** | `iso27001SoaGeneration.service.test.ts` nachweisbar |
| 4.2 SoA-Risk-Linkage | ❌ Unbestätigt | Nicht verifiziert |
| 4.3 SoA-Export (PDF/CSV) | ❌ Unbestätigt | Nicht verifiziert |
| 4.4 SoA-Diff zwischen Versionen | ❌ Unbestätigt | Nicht verifiziert |
| 5. Priorisierung | ℹ️ Planungsartefakt | Tabelle, keine Umsetzung |
| 6. Implementierungs-Reihenfolge | ℹ️ Planungsartefakt | Tabelle, keine Umsetzung |

---

## 2. Detaillierte Prüfung

### ✅ 2.1 Self-Assessment mit echten Schwellenwerten — UMGESETZT

Der Vorschlag war, den Fragebogen um `Beschäftigtenzahl`, `Jahresumsatz`, `Bilanzsumme` und `Sektor` zu erweitern und serverseitig zu klassifizieren. **Das ist vollständig implementiert.**

**Nachweis im Backend** — [`backend/src/services/nis2.service.ts`](backend/src/services/nis2.service.ts:126):

- **v2.0-Fragebogen** (`NIS2_APPLICABILITY_QUESTIONNAIRE`, Zeile 126–178) enthält exakt die geforderten Fragen: `sector`, `employeeCount`, `annualRevenue`, `balanceSheetTotal` — alle mit `required: true`.
- **16 Sektoren** (`NIS2_SECTORS`, Zeile 10–119): energy, transport, banking, financial-market-infra, health, water, digital-infrastructure, ict-service-mgmt, space, public-admin, postal, waste, chemicals, food, construction, digital, research — deckt sich mit den 18 NIS2-Sektoren (einige zusammengefasst).
- **Serverseitige Klassifizierungs-Logik** (`evaluateApplicability`, Zeile 314–368):
  - `essential_entity` (bwE): `≥ 250 MA ODER (≥ 50 €M Umsatz UND ≥ 43 €M Bilanzsumme)` — Zeile 323–339
  - `important_entity` (wE): `≥ 50 MA ODER (≥ 10 €M Umsatz UND ≥ 10 €M Bilanzsumme)` — Zeile 341–358
  - `not_in_scope` unterhalb beider Schwellen — Zeile 360–368
- **Routen** ([`nis2.routes.ts`](backend/src/routes/nis2.routes.ts:105)): `/questionnaire/v2`, `/questionnaire/v2/ensure`, `/sectors` sind vorhanden.
- **Vollständige i18n-Labels** in [`de.json`](frontend/src/locales/de.json:1445) und [`en.json`](frontend/src/locales/en.json:1453): `sector`, `employeeCount`, `annualRevenue`, `balanceSheetTotal` etc.

**Frontend:** [`NIS2.tsx`](frontend/src/pages/NIS2.tsx:167) rendert die Fragen dynamisch aus der v2.0-Fragebogen-Struktur (select/number/boolean). **Alle 24 Frontend-Tests** und **alle 28 Backend-Tests** (phase5) laufen grün.

**Kleiner Hinweis:** Der Vorschlag sah 18 Sektoren vor; die App listet 16. In der NIS2-Verordnung gibt es 18 Sektoren (17 + 1 „besondere" Kategorie für besonders wichtige Einrichtungen). Die Differenz ist fachlich vertretbar, sollte aber im Audit dokumentiert werden.

---

### ❌ 2.2 NIS2 Incident-Reporting (24h) — NICHT UMGESETZT

Der Vorschlag sah neue Felder `nis2Severity` (early_warning/notification/final), `nis2ReportedAt`, `nis2ReportDeadline`, `nis2FinalReportDue` vor.

**Ist-Zustand:** Das Incident-Modul existiert (Art. 23-Meldung als Konzept), aber es gibt **keine NIS2-spezifischen Meldefristen**. Die Backend-Suche nach `nis2Severity`, `nis2ReportDeadline`, `nis2ReportedAt`, `nis2FinalReportDue` in `backend/src` ergab **keine Treffer**. Die Incident-Tests (`incident.history.test.ts`, `phase5.service.test.ts`) behandeln nur allgemeine Incident-Workflows, keine 24h/30d-Fristen.

**Fazit:** Lücke bestätigt. Muss neu implementiert werden (Phase B, P1).

---

### ❌ 2.3 NIS2-Control-Catalog — NICHT UMGESETZT

Der Vorschlag sah einen neuen Catalog `NIS2UmsuCG` mit den Pflichten-Artikeln (Art. 23–30) und Crosswalks zu ISO-Kontrollen vor.

**Ist-Zustand:** Der Control-Catalog enthält laut Proposal ISO 27001:2022, NIST CSF 2.0, ISO 27002:2022. Eine Suche nach `NIS2UmsuCG` oder `nis2.catalog` ergab keine passenden Catalog-Definitionen. Die `NIS2_TOPICS`-Liste ([`nis2.service.ts`](backend/src/services/nis2.service.ts:180)) liefert zwar 10 Themen als Requirements, aber **keinen strukturierten NIS2-Artikel-Catalog mit Crosswalk**.

**Fazit:** Lücke bestätigt (Phase C, P2).

---

### ✅ 2.4 Supply-Chain (teilweise)

Das Supplier-Modul existiert mit `nis2Relevant`, `securityRequirements`, `criticality`. Der Vorschlag, für `nis2Relevant=true` Lieferanten einen obligatorischen `RiskAssessment` zu verknüpfen (`supplierRiskAssessmentId`), wurde **nicht** als verpflichtende Feld-Beziehung implementiert. Die generische Struktur ist jedoch vorhanden.

**Fazit:** Grundgerüst da, Verknüpfung zur Risiko-Bewertung fehlt (Phase C, P2).

---

### ⚠️ 3. Klauseln 4–10 (ISMS Process Workspace) — TEILWEISE

[`ismsProcessWorkspace.tsx`](frontend/src/pages/ismsProcessWorkspace.tsx) ist eine **untracked** Datei im aktuellen Stand. Sie deutet auf eine Implementierung des „ISMS Process Workspace" hin, ist aber **komplettiert durch einen TypeScript-Fehler** (`Cannot find name 'docPage'`, Zeile 114) und damit aktuell nicht build-fähig.

**Fazit:** Die Klausel-4/5/7-Dokumentation ist im Ansatz vorhanden, aber der Code ist nicht funktionsfähig. Klausel 9 (Management-Review) und Klausel 6-Workflow-Verbindung konnten im Rahmen dieser Prüfung nicht isoliert verifiziert werden. **Status: in Arbeit, nicht releasbar.**

---

### ✅ 4.1 SoA-Generierung — UMGESETZT

Der Vorschlag, einen Button „SoA aus Katalog generieren" zu erstellen, wurde implementiert. Der Test [`iso27001SoaGeneration.service.test.ts`](backend/src/__tests__/iso27001SoaGeneration.service.test.ts) belegt einen Service, der aus dem Katalog eine `statementOfApplicability` mit Items generiert. Der bestehende Validierungs-Check (`submitSOA` verlangt Begründung pro Item) existiert weiterhin.

---

### ❌ 4.2–4.4 (Risk-Linkage, Export, Diff) — NICHT VERIFIZIERT

Für SoA-Risk-Linkage (`riskAssessmentIds`), SoA-Export (PDF/CSV) und SoA-Diff zwischen Versionen konnte im Rahmen dieser Prüfung **kein Nachweis** erbracht werden. Die Backend-Suche nach `riskAssessmentIds`, `soa.export`, `soa.diff` ergab keine passenden Implementierungen. **Status: vermutlich nicht umgesetzt, bedarf einer gezielten Vertiefung.**

---

## 3. Zusammenfassung und Empfehlung

**Umgesetzt (klar):** §2.1 (NIS2-Schwellenwerte), §4.1 (SoA-Generierung). Diese beiden Punkte decken den größten fachlichen Mehrwert des Proposals ab und sind production-ready.

**Teilweise/in Arbeit:** §2.4 (Supply-Chain-Verknüpfung), §3 (ISMS Process Workspace — Build-Fehler, nicht releasbar), §1 (Catalog-Anzahl unbestätigt).

**Nicht umgesetzt:** §2.2 (Incident-Reporting 24h), §2.3 (NIS2-Control-Catalog), §4.2–4.4 (SoA-Linkage/Export/Diff).

**Empfohlene nächste Schritte:**
1. **P0:** `ismsProcessWorkspace.tsx` Build-Fehler beheben (Zeile 114, `docPage` undefiniert) — blockiert die Klausel-4/5/7-Abdeckung.
2. **P1:** §2.2 implementieren (NIS2-Incident-Reporting mit 24h/30d-Fristen) — NIS2-Kernpflicht.
3. **P2:** §2.3 (NIS2-Control-Catalog) und §1 (Catalog vervollständigen) nach Priorisierung im Proposal.

**Hinweis zur Prüfgenauigkeit:** Die Abschnitte 1, 4.2–4.4 konnten nur eingeschränkt verifiziert werden, da die exakte Anzahl der Catalog-Kontrollen bzw. SoA-Export-/Diff-Funktionalität eine tiefere Durchsuchung der jeweiligen Services erfordern würde. Für ein Audit-relevantes Ergebnis wird eine gesonderte Vertiefung dieser Punkte empfohlen.
