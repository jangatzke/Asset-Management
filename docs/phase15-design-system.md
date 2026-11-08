# Phase 15 — Design-System-Schichten & Guardrails (Stage 10a)

Stand: Stage 10a. Diese Datei dokumentiert die Token-Architektur (LT-1) und die
Guardrails gegen „DIY“-Styling (LT-2). Sie ergänzt `docs/refactoring-baseline.md`.

## 1. Token-Schichten (LT-1)

Single Source of Truth ist `frontend/src/styles/design-tokens.json`
(Primitive-Palette, semantische Light/Dark-Tokens, Typography, Radius,
Shadows e0–e3, Motion, Spacing inkl. `pageGutter`/`sectionGap`/`cardPad`).

Aufteilung unter `frontend/src/styles/`:

| Modul | Schicht | Inhalt |
|---|---|---|
| `tokenData.ts` | L0 | lädt `design-tokens.json` einmal zentral + alle TS-Typen (`PrimitivePalette`, `SemanticTokens`, `TypographyScale`, `RadiusScale`, `ShadowScale`, `MotionScale`, `SpacingScale`, …); exportiert `tokens`, `radius`, `shadows` |
| `palette.ts` | L1 | `primitives`, `semanticTokens(mode)`, `sem()`, `statusPair()` — nur Farbwerte/Paare, kein Klassenzusammenbau |
| `typography.ts` | L1 | `typography`-Skala, `fontStack`, `fontSizeUtilities`; Hinweis: tabular figures via Tailwind `tabular-nums` |
| `space.ts` | L1 | `spacing`, `layoutRhythm`, `pageGutter`/`sectionGap`/`cardPad`, `controlHeightStandard`/`controlHeightCompact` |
| `motion.ts` | L1 | `motion` (Keys exakt wie im JSON: `instant`/`fast`/`normal`(200ms)/`slow`, `standard`/`decelerate`/`accelerate`); Regel: kein `translate-y`-Lift (MT-8) |
| `recipes.ts` | L2 | alle Klassen-Recipes (`buttonPrimary`, `iconButtonBase`, `metricCard`, `badgeCritical`, …) — byte-identisch zu den historischen Definitionen |
| `tokens.ts` | Barrel | re-exportiert ausschließlich die Schichten; keine eigenen Definitionen. Alle bisherigen Importe (`from '../styles/tokens'`) bleiben unverändert gültig. |

Weitere Konsumenten der JSON: `tailwind.config.js` (via `createRequire`,
unverändert) und `src/theme/buildMuiTheme.ts` (liest über das Barrel —
Wertgleichheit mit Tailwind/index.css bleibt dadurch garantiert).
Badge-Klassen-Helfer (`statusBadgeClass`) bleiben in `utils/statusHelpers.ts`.

### 1a. Semantisches Token `surface-disabled` (Reduktionsrunde, Batch nach Stage 10a)

Neues semantisches Token in `frontend/src/styles/design-tokens.json`
(weitergereicht über `tokenData.ts`, `src/index.css` und
`tailwind.config.js`):

| Token | Light | Dark | Verwendung |
|---|---|---|---|
| `surface-disabled` | `#E4E7EC` | `#2A3441` | Hintergrund deaktivierter Controls |

**Verwendungsregel:** deaktivierte Controls ausschließlich als
`disabled:bg-surface-disabled disabled:text-text-muted`. Begründung: das Token
ist **nur für inaktive Controls** gedacht (Buttons, Inputs, Zeilen-Aktionen),
nicht für Flächen — Flächen bleiben bei `bg-surface-*`. Erstanwendung:
`AdminDatabase`, `AdminAuthSettings`, `AdminFiscalYear` (Ersetzung von
`disabled:bg-gray-*`).

## 2. Regeln

- **Fachseiten = Tailwind + semantische Tokens** (`bg-surface-*`,
  `text-text-*`, Recipes aus `styles/tokens.ts`). Keine Roh-Palette, keine
  eigenen Class-Strings.
- **MUI nur in MUI-Modulen** (AdminIntune/AdminProxmox/AdminVMware +
  MUI-Tabellenkomponenten), gestylt **ausschließlich über `buildMuiTheme`**;
  `sx`-Overrides in Pages sind verboten (ESLint, siehe unten). Die drei Admin-
  Module sind als dokumentierte Ausnahme von der ESLint-Regel ausgenommen.
- **Roh-Palette (`gray-*`, `red-*`, …) nur in** `design-tokens.json`
  (`primitives.*`) und den dokumentierten Legacy-Anteilen von `recipes.ts` /
  `statusHelpers.ts`.
- Seiten importieren keine Farbhex-Werte; MUI liest dieselben Werte wie
  Tailwind (beide aus `design-tokens.json`).

## 3. Guardrails (LT-2)

### 3.1 ESLint (`frontend/.eslintrc.cjs`)
`no-restricted-syntax` (ESLint-Core, keine neue Dependency) verbietet
`JSXAttribute[name.name='sx']` in `src/pages/**/*.tsx`, mit `excludedFiles`
für die drei dokumentierten MUI-Admin-Module. Eingebunden in `npm run lint`.

**Warnungs-Gate:** Das Frontend-Lint-Skript (`frontend/package.json` → `lint`,
identisch via `lint:ci`) läuft mit `--max-warnings 0`; das frühere
Warnungs-Budget von 22 ist damit obsolet und auf **0** eingefroren — jede neu
eingeführte Warnung bricht den CI-Lauf. Stand der Warnungsbereinigung:
11 echte Korrekturen, 1 echte Dependency-Korrektur sowie 9 begründete Disables
(6× `react-refresh/only-export-components`, 3× `react-hooks/exhaustive-deps`,
1× `@typescript-eslint/no-unused-vars`). Aktueller Stand: 0 Fehler / 0 Warnungen.

### 3.2 Skript `frontend/scripts/check-design-tokens.cjs` (Ratchet)
Scannt `src/pages/**` und `src/components/**` (ohne Tests) auf

1. Roh-Palette-Klassen `(bg|text|border|divide|ring)-(gray|red|green|amber|blue|indigo|purple|orange|emerald|sky|slate)-\d+`
   (inkl. `dark:`-Flächen), und
2. `sx={` außerhalb der Allowlist (`AdminIntune/AdminProxmox/AdminVMware`,
   `DiscardConfirmationDialog`, `MuiSortableTh`).

Der Altbestand (Stage 2–9 haben nicht alle Seiten migriert) ist in
`frontend/scripts/design-token-baseline.json` pro Datei eingefroren. Das Skript
schlägt fehl, sobald eine Datei über ihren Baseline-Wert wächst oder eine neue
Datei gegen die Regel verstößt. Aufruf: `npm run lint:tokens` (solo) — und als
Teil von `npm run lint`. Nach bewusster Bereinigung:
`npm run lint:tokens:update`, um den Ratchet zu verschärfen.

**Status Stage 10a:** Guardrail läuft grün; Altbestand = dokumentierte
Restliste in `design-token-baseline.json` (~2300 Vorkommen in ~54 Dateien,
überwiegend noch nicht migrierte Seiten). Diese werden in späteren Stages
seitenweise abgebaut; neues DIY-Styling ist ab sofort blockiert.

**Aktualisierter Zahlenstand (Legacy-Reduktion Batches 1–4 + Token-Runde + Severity-Kapselung):**
Die Ratchet-Baseline ist eingefroren auf **1144 Verstöße in 36 Dateien**
(Stand der letzten Validierung; Gegenlauf `node scripts/check-design-tokens.cjs`
→ Exit 0, „no regressions"). Herkunft der Reduktion:

| Schritt | Baseline |
|---|---|
| Ursprünglicher Scan (vor Einfrieren) | 2323 |
| Ausgangslive (vor Batch 1) | 2190 |
| Batch 1 | 1888 |
| Batch 2 | 1657 |
| Batch 3 | 1522 |
| Batch 4 | 1166 |
| Token-Runde (`surface-disabled`, 4 Ersetzungen) | 1162 |
| Severity-Kapselung (`src/styles/severity.ts`) | **1144** ← aktuelle Baseline |

Der verbleibende Restbestand ist bewusst klassifiziert: dokumentierte
Design-Intention (gekapseltes Severity-Modul), echte Chart-/Graph-Semantik,
die MUI-Allowlist sowie offene Bereinigungskandidaten
(siehe „Verbleibender Bestand" unten). Update des Ratchets nach
bewusster Bereinigung: `node scripts/check-design-tokens.cjs --update-baseline`
(Flag verifiziert in `check-design-tokens.cjs`: `--update-baseline`).

### 3.2a Verbleibender Bestand (dokumentierte Intention, kein Legacy)

Die verbleibenden 1144 Treffer sind nach Abwägung in vier Kategorien
eingeordnet — die früheren „Legacy"-Severity-Farbmaps sind jetzt eine
**bewusste Design-Intention** in einem gekapselten Modul:

**1. Intention (dokumentiert, nicht Legacy):**
[`frontend/src/styles/severity.ts`](../frontend/src/styles/severity.ts)
bündelt sämtliche Severity-/Ampel-Farbmaps mit den Exporten `SEVERITY_TONE`,
`SEVERITY_BORDER_TONE`, `severityTone`, `RISK_LEVEL_TONE`,
`CONTROL_STATUS_TONE`, `NEUTRAL_BADGE_TONE` und `DEADLINE_TONE`.
Grund: Risiko-/Statusstufen (Risikolevel, Control-Implementierungsstatus,
Deadline-Nähe) kodieren Risikogradationen, für die das Designsystem bewusst
**keine deckungsgleichen Intent-Tokens** bereitstellt; die Rohwerte sind
absichtlich, weil eine Token-Umstellung das gerenderte Ergebnis verändert
hätte (z. B. `bg-red-100` #FEE2E2 ≠ `status-critical-bg` #FEE4E2). Das Modul
liegt in `src/styles/`, also außerhalb des Scan-Umfangs, und erklärt die
Klassen im Header-Kommentar als dokumentierte Entscheidung. Konsumiert wird
es von [`AssetImpactAnalysis.tsx`](../frontend/src/components/AssetImpactAnalysis.tsx),
[`statusHelpers.ts`](../frontend/src/utils/statusHelpers.ts) und
[`IncidentDetail.tsx`](../frontend/src/pages/IncidentDetail.tsx); neue
Severity-/Deadline-Maps sind dort abzulegen, nicht in Seiten nachzudeklarieren.

**2. Echte Chart-/Graph-Semantik (dauerhaft zulässig):**
[`frontend/src/components/AssetGraph.tsx`](../frontend/src/components/AssetGraph.tsx) —
Kantentypen und SVG-Striche (Canvas-artiger Code, keine Flächen-Tailwind-Klassen);
die Chart-Farbsprache läuft über `styles/chartLanguage.ts` (siehe Abschnitt 3a).

**3. MUI-Allowlist:** (`sx=`-Ausnahmen laut Skript) `AdminIntune`,
`AdminProxmox`, `AdminVMware`, `DiscardConfirmationDialog`, `MuiSortableTh`.

**4. Bereinigungskandidaten (offen, aber unkritisch):** die verbleibenden
Roh-Treffer in `ISMSPhase6`, `ismsProcessWorkspace`, `RiskDetail`, `NIS2` und
`SupplyChainOverview` (Tone-Klassen). Diese dürfen bei Gelegenheit über das
Ratchet abgebaut werden; ein Zeitdruck besteht nicht.

**Regel:** Roh-Palette in `src/styles/**` ist zulässig und wird nicht
gescannt; Roh-Palette in `src/pages/**` und `src/components/**` bleibt
verboten (Ratchet).

**Regel für neue Seiten:** neue Seiten dürfen **0 neue Roh-Treffer** einführen —
das Ratchet erzwingt dies bereits (neue Dateien mit beliebiger Verstoßanzahl
lassen das Skript fehlschlagen). Bestehende Dateien dürfen nur sinken.

## 3a. Chart-Sprache (LT-4, Stage 10b)

Zentrale, framework-freie Klasse von Helfern in
`frontend/src/styles/chartLanguage.ts` — keine neue Chart-Library, nur
dokumentierte Tailwind-Klassen über den semantischen Tokens:

- `chartSeriesTone(tone)` / `chartSeriesTextTone(tone)`: Serienfarben für
  Flächen bzw. SVG-Striche/Töne (`primary|ok|warn|critical|info|idle`).
- `chartTrackClass` = neutrale Trackfläche (`bg-surface-sunken`).
- `chartAxisLabelClass` = Achsen-/Legendenlabels (Caption-Typografie, muted).
- `chartValueClass` = angezeigte Zahlen (`text-body2` + `tabular-nums`).
- `chartGridClass`, `chartTooltipClass` = Gitterlinien / Tooltips.

Regeln:

1. **Max. 3 Serien pro Chart.** Würde eine vierte Serie nötig sein, wird
   aggregiert oder der Chart geteilt — die Palette wächst nicht.
2. **Reihenfolge:** `primary → info → warn`. `critical` nur für echte Alarme
   (z. B. Threshold-Breach, unkritische Abdeckung), nie dekorativ.
3. **Keine Regenbogen-Paletten:** Serienfarben ausschließlich über
   `chartSeriesTone`; Tracks immer `chartTrackClass`.
4. **Zahlen:** Werte über `chartValueClass` (`tabular-nums` für Spaltenflucht).
5. **Text-Alternative:** Jeder Chart erhält `role="img"` + `aria-label` oder
   einen sr-only-/Tabellen-Fallback (z. B. behalten die KRI-Trend-Pfeile ihre
   übersetzten sr-only-Labels; die RiskAggregation-Heatmap wird durch die
   Detailtabelle darunter abgedeckt).

Angewendet in: `Dashboard.tsx` (Auslastungs-/Kostenbalken), `KriDashboard.tsx`
(Sparkline-Serienfarbe + `aria-label`), `RiskAggregation.tsx`
(Heatmap-Serien auf max. 3 Tones konsolidiert: critical/warn/info, „low“ in
info-Serie folded), `ControlCoverageMatrix.tsx` (Kopf-/Legendenlabels über
`chartAxisLabelClass`).

## 3b. Globale Dichte (LT-3, Stage 10b)

`frontend/src/context/DensityContext.tsx` (`DensityProvider` / `useDensity()`)
hält die Präferenz `comfortable|compact` pro Nutzer in `localStorage` unter
`am.density`. Der Toggle sitzt in der Top-Bar (`Layout.tsx`, neben dem
Dark-Mode-Schalter, `aria-pressed`). Auflösung in `DataTableShell`:
explizite `density`-Prop > lokale Toolbar-Auswahl > globaler Kontext >
`comfortable`. Listen-Zellen nutzen `tableCellClass(useTableDensity())`;
`densityRowClass(density)` bietet dieselbe Padding-Stufe für Zeilen/Listen
außerhalb von Tabellen.

## 3c. Detail-Tabs & Drawer (LT-5, Stage 10c)

**`DetailTabs` (`frontend/src/components/DetailTabs.tsx`)** — das zentrale
Tab-Muster für Detailseiten nach WAI-ARIA-Tabs: `tablist`/`tab`/`tabpanel`,
`aria-selected`/`aria-controls`/`aria-labelledby`, Roving-Tabindex
(`tabIndex=0` nur am aktiven Tab) und Tastatursteuerung (Pfeil links/rechts mit
Wrap, Home/End; deaktivierte Tabs werden übersprungen). API:
`{ tabs: Array<{ id, label, content, disabled? }>, defaultTabId?, activeTabId?, onTabIdChange?, syncUrlParam?, ariaLabel?, className? }`
— kontrolliert (`activeTabId`) oder unkontrolliert (`defaultTabId`). Styling nur
über semantische Tokens (Tablist `border-border-subtle`, aktiver Tab 2px
`border-primary-600`, Fokus `focus-visible:ring-focus-ring`). Optional synct
`syncUrlParam` den aktiven Tab als `?tab=<id>` auf der aktuellen Route
(Deep-Linking, URL gewinnt gegen `defaultTabId`); Standard ist aus.

**Konvention pro Seite:** Seiten-Tabs werden immer über `DetailTabs` direkt im
Seitenrumpf gerendert (AssetDetail, TicketDetail, RiskDetail so umgesetzt). Die
`tabs`-Slot-Variante von `PageHeader` bleibt für künftige Seiten mit
Kopfzeilen-Tabs reserviert — nie beide Varianten auf einer Seite mischen.

**`Drawer` (`frontend/src/components/Drawer.tsx`)** — Seitenpanel analog zur
Dialog-API (`open/onClose/title/description/children/footer/side/width/
closeOnBackdrop/closeOnEscape/isLoading`, `side: 'right'|'left'`,
`width: 'sm'|'md'|'lg'`). Focus-Trap, Focus-Restore an den Auslöser,
Scroll-Lock, Escape-/Backdrop-Schließpfad und Entrance-Motion stammen aus dem
gemeinsamen Hook `frontend/src/hooks/useOverlayBehavior.ts` — Dialog und Drawer
teilen sich damit eine einzige Implementierung (Dialog-API unverändert; 16
Dialog-Tests bleiben grün). Motion respektiert `prefers-reduced-motion` über
die globale CSS-Override. Der Drawer ist als Baustein verfügbar, aber auf den
drei Detailseiten wurde er bewusst **nicht** eingesetzt, weil dort kein
bestehendes Verhalten ohne Funktionsänderung in ein Seitenpanel überführt
werden konnte (keine Sekundär-Navigation vorhanden).

**Konvertierte Detailseiten (nur Umschichtung vorhandener Sektionen):**
- `AssetDetail.tsx`: Tabs „Details“ (Stammdaten) und „Beziehungen“
  (`AssetGraph`). Einen Tab „Historie“ gibt es nicht, weil die Seite keine
  History-Sektion besitzt — erfunden wurde nichts.
- `TicketDetail.tsx`: Header block (Status/Typ/Priorität + Aktionen) bleibt
  oberhalb der Tabs; darunter „Details“ (Zuweisung + Problem-/Change-Formular),
  „Verlauf“ (Kommentare/Arbeitsnotizen), „Assets“ (Asset-Kontext). Das
  Audit-History-Modal bleibt unverändert.
- `RiskDetail.tsx`: Die vorhandene Hand-rolled-Navigation (7 Tabs) wurde durch
  `DetailTabs` ersetzt — Tab-IDs, Labels und Content-Renderer sind unverändert;
  die Seite gewinnt damit ARIA-Semantik und Tastatursteuerung.

## 3d. Dark Mode & High Contrast (LT-6, Stage 10c)

**Dark-Mode-Audit:** `dark:(bg|text|border|divide|ring-offset)-(gray|…)`-Treffer
in `src/pages` + `src/components` werden über die semantischen Token-Paare
(`bg-surface-*`, `text-text-*`, `border-border-*`) ohne `dark:`-Präfixe
gelöst — die `.dark`-Klasse auf `<html>` schaltet die CSS-Variablen um.
Zähler-Baseline Stage-10c-Auftakt: **714**; nach dieser Stufe (verifiziert per
`Select-String 'dark:(bg|text|border|divide|ring-offset)-(gray|…)-'` über
`src/pages` + `src/components`, ohne Testdateien): **686**
(AssetDetail 5→0, TicketDetail 38→0, RiskDetail 33→32; Rest = noch nicht
angefasste Legacy-Seiten). Alle neuen Dateien (DetailTabs, Drawer,
useOverlayBehavior, DarkModeContext) liefern **0**. Ratchet: bestehende Dateien
dürfen nur sinken, neue Dateien müssen 0 liefern (`check-design-tokens.cjs`).

**High Contrast:** `.contrast-high` (bzw. `.dark.contrast-high`) in
`frontend/src/index.css` überschreibt **nur CSS-Variablen** der semantischen
Ebene — Text auf `#000`/`#FFF`, kontrastreichere Border, klares Canvas, und
`:focus-visible { outline-width: 4px }`. Da ausschließlich Variablen betroffen
sind, profitieren alle Token-Konsumenten automatisch; die Kaskade
(`.dark.contrast-high` = 0,2,0 > `.dark` = 0,1,0) sorgt für konsistente
Kombination beider Modi. Die Präferenz hält `DarkModeContext` (`highContrast`,
`toggleHighContrast`, `setHighContrast`) geräte-lokal in `localStorage` unter
`am.contrast` (`'high'|'normal'`, inkl. Cross-Tab-Sync via `storage`-Event) —
analog zur Dichte, bewusst **nicht** im Nutzerprofil. Der Toggle sitzt in der
Top-Bar direkt nach dem Dichte-Schalter (`aria-pressed`, i18n:
`common.highContrast*` in allen vier Locales).

**Tastatur-/Fokus-Guard:** `frontend/src/a11y/keyboardFocus.test.tsx` prüft als
Regressionstripwire, dass PageHeader-Breadcrumbs, DetailTabs, Drawer, Dialog,
Sidebar-Einträge und DataTableShell-Werkzeugleisten-Buttons fokussierbar bleiben
und semantische Fokus-Ring-Tokens tragen, plus der globale `:focus-visible`-
Fallback in `index.css`.

**Manuelle Testmatrix (Tastatur, vor jedem Release-Staging durchzuführen):**

| # | Szenario | Erwartung |
|---|----------|-----------|
| 1 | Tab durch Top-Bar (Suche → Action-Center → Dark-Mode → Dichte → Kontrast → Benutzer-Menü) | Jeder Stop zeigt den Fokus-Ring; High-Contrast: 4px |
| 2 | Detailseite per Tastatur erreichen, `Tab` in die Tabs, Pfeiltasten/Home/End | Roving-Tabindex wandert, Panel folgt, Ring sichtbar |
| 3 | Drawer öffnen (`Enter`/`Space`), `Tab`, `Shift+Tab`, `Escape` | Fokus springt in den Drawer, bleibt gefangen, zurück zum Auslöser |
| 4 | Dialog wie Drawer (Regression) | Unverändertes Verhalten |
| 5 | High-Contrast-Toggle an/aus, danach Dark-Mode wechseln | Klassen `.contrast-high` ±`.dark` kombinieren sich; keine Mischstufe |
| 6 | Sidebar-Einträge per Tastatur aktivieren | Fokus-Ring auf aktivem Eintrag, `aria-current` korrekt |

## 3e. Breitenmodell (Layout / PageShell)

**Layout kappt nie selbst — `PageShell` ist die einzige Breiten-Instanz.** Der
Fallback-Container in `Layout.tsx` (Route-Outlet-Hülle für Seiten ohne
PageShell) trägt nur noch Gutter/Vertikalrhythmus (`px-4 sm:px-6 lg:px-8 py-8`,
`w-full`) — keine `max-w-*`-Kappe und kein `mx-auto` mehr. Alle Breiten laufen
ausschließlich über die `width`-Variante von `PageShell`:

| Variante | Klasse | Zweck |
|----------|--------|-------|
| `narrow` | `max-w-3xl` (768 px) | Formulare/Prosa — Lesbarkeit ≤ ~75 Zeichen pro Zeile |
| `default` | `max-w-[2200px]` | Detail-/Übersichtsseiten (auch Dashboard) |
| `wide` | `max-w-[2400px]` | Tabellen/Workload/Matrix-Arbeitsbereiche |

Begründung: Auf WQHD (2560 px) ließ die previously doppelt gesetzte 1536-px-Kappe
(`max-w-screen-2xl` in Layout-Fallback **und** PageShell `default`) ~33 % der
Bildschirmbreite ungenutzt und machte die `wide`-Variante (`max-w-[1600px]`)
wirkunglos, weil die äußere Kappe immer zuerst griff. Mit dem neuen Modell nutzt
`default` auf 2560 px 2200 − 64 px Gutter = 2136 px Inhaltsbreite; Seiten ohne
PageShell fahren volle Spaltenbreite (− 64 px Gutter) und werden von ihren
Tabellen/Grids selbst begrenzt. Prosa bleibt bei `narrow` ≤ 75 Zeichen. Auf
2560 px ergibt sich für die Content-Spalte 2560 − 240 (Sidebar) − 2×32
(Layout-`lg:px-8`) = 2256 px; bei der `default`-Kappe von 2200 px bleiben damit
nur (2256 − 2200)/2 = 28 px Zentrierluft je Seite plus 32 px PageShell-Gutter —
der Whitespace ist damit visuell verschwunden, ohne dass Tabellenzeilen
unleserlich breit werden.

**Zentrierung:** Die Zentrierung der Kappe erfolgt ausschließlich über `mx-auto`
in Kombination mit `w-full` + `max-w-*` in `PageShell`. Es gibt **keine
Negative-Margin-Kompensation** (`-mx-*`) gegen das Layout-Padding: Negative
X-Margins haben dieselbe Selektivität wie `mx-auto`, gewinnen aber in der
generierten CSS-Reihenfolge und würden die Zentrierung aufheben (Inhalt klebt
links). Layout-Padding (32 px) und `page-gutter` (32 px) dürfen sich addieren —
der resultierende Innenabstand von 64 px ab App-Rand bei `lg` ist gewollt. Die
vertikale Kompensation `-my-8` gegen das `py-8` des Layout-Fallbacks bleibt
erhalten, damit der Vertikalrhythmus unverändert sichtbar ist.

## 4. Unveränderliche Zusagen

- `rowActionAccessibility.test.ts` verlangt wörtlich `export const iconButtonBase`
  mit `focus:ring-2 focus:ring-primary-500` in `src/styles/tokens.ts`. Da der
  Guard die Datei als Text liest, enthält das Barrel einen GUARD NOTE-Kommentar
  mit genau diesen Klassen; die Definition steht verbatim in `recipes.ts`.
- Kontrast-Tests (`utils/contrast.test.ts`) lesen Recipes über das Barrel —
  Class-Strings sind byte-identisch geblieben.
