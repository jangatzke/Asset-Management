/**
 * Phase 3.2 – NIS-2 ↔ ISO/IEC 27001:2022 Annex A crosswalk completeness.
 *
 * Proves:
 *  - The service derives findings from the real static catalogues and returns
 *    a structured report without throwing.
 *  - Missing vs. unknown controls are distinguished using a constructed fixture.
 *  - GET /nis2/crosswalk returns the report structurally (not 500).
 */
import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'crosswalk-user';
    next();
  },
}));

jest.mock('../middleware/entityAuth', () => ({
  authorizeEntityRead: () => (_req: any, _res: any, next: any) => next(),
  authorizeEntityWrite: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../services/nis2.service', () => ({ nis2Service: {} }));

import {
  buildCrosswalk,
  validateCrosswalkCompleteness,
} from '../services/nis2Crosswalk.service';
import { NIS2_ARTICLES } from '../data/nis2UmsuCGArticles';
import {
  ISO27001_ANNEX_A_2022_CONTROLS,
  ISO27001_ANNEX_A_2022_CONTROL_COUNT,
} from '../data/iso27001AnnexA2022';
import { nis2Router } from '../routes/nis2.routes';

describe('NIS-2 ↔ ISO27001 Annex A crosswalk service (real catalogues)', () => {
  it('builds one crosswalk entry per NIS-2 article', () => {
    const crosswalk = buildCrosswalk();
    expect(crosswalk).toHaveLength(NIS2_ARTICLES.length);
    expect(crosswalk.every((entry) => Array.isArray(entry.controls))).toBe(true);
    expect(crosswalk.map((entry) => entry.articleId)).toEqual(
      NIS2_ARTICLES.map((article) => article.articleId),
    );
  });

  it('returns a structured report from the real data sources without throwing', () => {
    const report = validateCrosswalkCompleteness();
    expect(report.articleCount).toBe(NIS2_ARTICLES.length);
    expect(report.controlCount).toBe(ISO27001_ANNEX_A_2022_CONTROL_COUNT);
    expect(Array.isArray(report.missingControls)).toBe(true);
    expect(Array.isArray(report.unknownControls)).toBe(true);
    expect(Array.isArray(report.unmappedArticles)).toBe(true);
    expect(Array.isArray(report.unmappedControls)).toBe(true);
    expect(typeof report.isComplete).toBe('boolean');
    expect(report.isComplete).toBe(
      report.missingControls.length === 0 &&
        report.unknownControls.length === 0 &&
        report.unmappedArticles.length === 0 &&
        report.unmappedControls.length === 0,
    );
  });

  it('flags Annex A controls that no NIS-2 article references as unmapped', () => {
    const report = validateCrosswalkCompleteness();
    const referenced = new Set(report.articles.flatMap((entry) => entry.validControls));
    // Every catalogue control either is referenced or explicitly reported as unmapped.
    for (const control of ISO27001_ANNEX_A_2022_CONTROLS) {
      const isReferenced = referenced.has(control.controlId);
      const isReportedUnmapped = report.unmappedControls.includes(control.controlId);
      expect(isReferenced || isReportedUnmapped).toBe(true);
    }
    expect(report.unmappedControls.every((controlId) => !referenced.has(controlId))).toBe(true);
  });
});

describe('NIS-2 ↔ ISO27001 Annex A crosswalk findings (constructed fixture)', () => {
  const fixtureArticles = [
    {
      articleId: 'fixture-1',
      article: 'Art. Fixture 1',
      titleDe: 'Fixture',
      titleEn: 'Fixture',
      descriptionDe: 'Fixture',
      descriptionEn: 'Fixture',
      isoCrosswalk: ['A.5.1', 'A.9.99', 'NOT-AN-ISO-CONTROL'],
    },
    {
      articleId: 'fixture-empty',
      article: 'Art. Fixture Empty',
      titleDe: 'Fixture empty',
      titleEn: 'Fixture empty',
      descriptionDe: 'Fixture',
      descriptionEn: 'Fixture',
      isoCrosswalk: [],
    },
  ];
  const fixtureControls = [{ controlId: 'A.5.1' }, { controlId: 'A.5.2' }];

  it('separates missing controls from unknown controls', () => {
    const report = validateCrosswalkCompleteness(fixtureArticles, fixtureControls);
    // A.9.99 matches Annex A syntax but is absent from the catalogue: missing.
    expect(report.missingControls).toEqual(['A.9.99']);
    // NOT-AN-ISO-CONTROL does not match the identifier pattern: unknown.
    expect(report.unknownControls).toEqual(['NOT-AN-ISO-CONTROL']);
    expect(report.missingControls).not.toContain('NOT-AN-ISO-CONTROL');
    expect(report.unknownControls).not.toContain('A.9.99');
  });

  it('reports unmapped articles and unmapped controls', () => {
    const report = validateCrosswalkCompleteness(fixtureArticles, fixtureControls);
    expect(report.unmappedArticles).toEqual(['fixture-empty']);
    expect(report.unmappedControls).toEqual(['A.5.2']);
    expect(report.isComplete).toBe(false);
  });

  it('does not throw when both sources are empty', () => {
    const report = validateCrosswalkCompleteness([], []);
    expect(report).toEqual(
      expect.objectContaining({
        articleCount: 0,
        controlCount: 0,
        mappedControlCount: 0,
        isComplete: true,
        articles: [],
        missingControls: [],
        unknownControls: [],
        unmappedArticles: [],
        unmappedControls: [],
      }),
    );
  });
});

describe('GET /nis2/crosswalk route', () => {
  const app = express();
  app.use(express.json());
  app.use(nis2Router);

  it('returns the completeness report structurally with HTTP 200', async () => {
    const response = await request(app).get('/crosswalk');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        articleCount: NIS2_ARTICLES.length,
        controlCount: ISO27001_ANNEX_A_2022_CONTROL_COUNT,
        isComplete: expect.any(Boolean),
        missingControls: expect.any(Array),
        unknownControls: expect.any(Array),
        unmappedArticles: expect.any(Array),
        unmappedControls: expect.any(Array),
      }),
    );
    expect(response.body.articles).toHaveLength(NIS2_ARTICLES.length);
  });

  it('does not set X-Total-Count (report, not a paginated list)', async () => {
    const response = await request(app).get('/crosswalk');
    expect(response.headers['x-total-count']).toBeUndefined();
  });
});
