/**
 * NIS2 ↔ ISO/IEC 27001:2022 Annex A crosswalk completeness service (Phase 3.2).
 *
 * Data sources (static, file-backed, no database access required):
 * - [`NIS2_ARTICLES`](../data/nis2UmsuCGArticles.ts:51) – NIS-2 obligations with the
 *   `isoCrosswalk: string[]` field (mapping exists; see line 48 of the data file).
 * - [`ISO27001_ANNEX_A_2022_CONTROLS`](../data/iso27001AnnexA2022.ts:5) – the 93
 *   Annex A controls keyed by `controlId`.
 *
 * The service is pure read/derivation logic: it never throws on missing or
 * malformed mappings. Callers (routes) decide how to surface the findings.
 *
 * Finding semantics (non-overlapping):
 * - `missingControls`   – crosswalk entries that look like Annex A identifiers
 *   (`A.<theme>.<control>`) but are absent from the reference catalogue: a gap
 *   in the catalogue coverage.
 * - `unknownControls`   – crosswalk entries that do not match the Annex A
 *   identifier pattern at all (typos / foreign identifiers).
 * - `unmappedArticles`  – NIS-2 articles whose crosswalk contains no entry that
 *   resolves to an existing Annex A control.
 * - `unmappedControls`  – catalogue controls that are not referenced by any
 *   NIS-2 article.
 */
import { NIS2_ARTICLES, type Nis2Article } from '../data/nis2UmsuCGArticles';
import { ISO27001_ANNEX_A_2022_CONTROLS } from '../data/iso27001AnnexA2022';

/** Annex A identifier pattern, e.g. `A.5.1` or `A.8.34`. */
const ANNEX_A_PATTERN = /^A\.\d+\.\d+$/;

export interface CrosswalkArticle {
  articleId: string;
  article: string;
  titleDe: string;
  titleEn: string;
  /** Crosswalk entries exactly as stored in the source data. */
  controls: string[];
  /** Entries that resolve to an existing Annex A control. */
  validControls: string[];
  /** Entries matching Annex A syntax but absent from the catalogue. */
  missingControls: string[];
  /** Entries that do not match the Annex A syntax. */
  unknownControls: string[];
}

export interface CrosswalkCompletenessReport {
  articleCount: number;
  controlCount: number;
  mappedControlCount: number;
  /** True when no finding list is populated. */
  isComplete: boolean;
  articles: CrosswalkArticle[];
  missingControls: string[];
  unknownControls: string[];
  unmappedArticles: string[];
  unmappedControls: string[];
}

/** Build the per-article crosswalk against the ISO Annex A controls. */
export function buildCrosswalk(
  articles: Nis2Article[] = NIS2_ARTICLES,
  controls: { controlId: string }[] = ISO27001_ANNEX_A_2022_CONTROLS as unknown as { controlId: string }[],
): CrosswalkArticle[] {
  const controlIds = new Set(controls.map((control) => control.controlId));

  return articles.map((article) => {
    const entries = Array.isArray(article.isoCrosswalk) ? article.isoCrosswalk : [];
    const validControls = entries.filter((entry) => controlIds.has(entry));
    const missingControls = entries.filter(
      (entry) => ANNEX_A_PATTERN.test(entry) && !controlIds.has(entry),
    );
    const unknownControls = entries.filter((entry) => !ANNEX_A_PATTERN.test(entry));

    return {
      articleId: article.articleId,
      article: article.article,
      titleDe: article.titleDe,
      titleEn: article.titleEn,
      controls: [...entries],
      validControls,
      missingControls,
      unknownControls,
    };
  });
}

/**
 * Validate crosswalk completeness and return structured findings.
 *
 * Returns empty arrays (never throws) when no mapping data is present so the
 * caller can surface the honest result. No exceptions are raised for missing
 * mappings — the route decides on the HTTP outcome.
 */
export function validateCrosswalkCompleteness(
  articles: Nis2Article[] = NIS2_ARTICLES,
  controls: { controlId: string }[] = ISO27001_ANNEX_A_2022_CONTROLS as unknown as { controlId: string }[],
): CrosswalkCompletenessReport {
  const crosswalk = buildCrosswalk(articles, controls);
  const controlIds = controls.map((control) => control.controlId);
  const referenced = new Set<string>();

  const missingControls: string[] = [];
  const unknownControls: string[] = [];
  const unmappedArticles: string[] = [];

  for (const entry of crosswalk) {
    entry.validControls.forEach((control) => referenced.add(control));
    entry.missingControls.forEach((control) => {
      if (!missingControls.includes(control)) missingControls.push(control);
    });
    entry.unknownControls.forEach((control) => {
      if (!unknownControls.includes(control)) unknownControls.push(control);
    });
    if (entry.validControls.length === 0) unmappedArticles.push(entry.articleId);
  }

  const unmappedControls = controlIds.filter((controlId) => !referenced.has(controlId));

  return {
    articleCount: crosswalk.length,
    controlCount: controlIds.length,
    mappedControlCount: referenced.size,
    isComplete:
      missingControls.length === 0 &&
      unknownControls.length === 0 &&
      unmappedArticles.length === 0 &&
      unmappedControls.length === 0,
    articles: crosswalk,
    missingControls,
    unknownControls,
    unmappedArticles,
    unmappedControls,
  };
}
