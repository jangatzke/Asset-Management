/**
 * NIS-2 obligation catalogue for the Control-Catalog.
 *
 * Implements improvement proposal #6 (NIS2 Control-Catalog + Crosswalk): each
 * core obligation of the NIS-2 Directive (EU) 2022/2555 is stored as a
 * `ControlCatalogItem` in the `NIS2UmsuCG` catalogue, and every entry links to
 * the relevant ISO/IEC 27001:2022 Annex A controls (crosswalk) so the app can
 * show which ISO controls fulfil which NIS2 obligation.
 *
 * The identifiers follow the NIS-2 Directive chapter III obligations as
 * transposed into German law by the BSI-Gesetz (BSIG, BGBl. 2025 I Nr. 301,
 * in force since 6 December 2025):
 * - Art. 20 NIS-2 RL / § 38 BSIG   – Governance and management responsibility
 * - Art. 21 NIS-2 RL / § 30 BSIG   – Cybersecurity risk-management measures
 *   (incl. Art. 21(2)(d) supply chain and Art. 21(2)(g) cyber hygiene/training)
 * - Art. 23 NIS-2 RL / § 32 BSIG   – Reporting obligations (24h early warning,
 *   72h incident notification, final report one month after the notification)
 * - Art. 27 NIS-2 RL / § 33 BSIG   – Registration of entities with the BSI
 *
 * The texts are short, original summaries of the regulatory obligations
 * (no proprietary third-party catalogue text).
 */

export const NIS2_ARTICLES_CATALOG_CODE = 'NIS2UmsuCG' as const;
export const NIS2_ARTICLES_CATALOG_VERSION = '2025' as const;

/**
 * Fixed catalogue identifier. Kept deterministic so the catalogue can be
 * referenced from the frontend and tests without a lookup.
 */
export const NIS2_ARTICLES_CATALOG_ID = '00000000-0000-4000-8000-000000000002';

/** A single NIS2 obligation entry with its ISO/IEC 27001:2022 crosswalk. */
export interface Nis2Article {
  /** Article identifier without the "Art. " prefix, e.g. "23" or "21d". */
  articleId: string;
  /** Human-readable Article reference, e.g. "Art. 23". */
  article: string;
  /** Short German Article title. */
  titleDe: string;
  /** Short English Article title. */
  titleEn: string;
  /** Short German Article description (obligation summary). */
  descriptionDe: string;
  /** Short English Article description (obligation summary). */
  descriptionEn: string;
  /** ISO/IEC 27001:2022 Annex A control identifiers that fulfil this Article. */
  isoCrosswalk: string[];
}

export const NIS2_ARTICLES: Nis2Article[] = [
  {
    articleId: '20',
    article: 'Art. 20',
    titleDe: 'Governance und Verantwortung der Geschäftsleitung',
    titleEn: 'Governance and management-body responsibility',
    descriptionDe:
      'Die Geschäftsführung genehmigt und überwacht die Maßnahmen zur Bewältigung der Cybersicherheitsrisiken (Art. 21) und haftet für deren Verstoß gegen das BSIG; sie muss regelmäßig an Fachschulungen zur Cybersicherheit teilnehmen (§ 38 BSIG).',
    descriptionEn:
      "Management bodies shall approve and oversee the cybersecurity risk-management measures (Art. 21), are liable for infringements, and shall regularly take training on cybersecurity risks and management practices (Art. 20 NIS-2 RL; transposed by § 38 BSIG).",
    isoCrosswalk: [
      'A.5.1', 'A.5.2', 'A.5.3', 'A.5.4', 'A.5.35',
    ],
  },
  {
    articleId: '21',
    article: 'Art. 21',
    titleDe: 'Maßnahmen zum Umgang mit Cybersicherheitsrisiken',
    titleEn: 'Cybersecurity risk-management measures',
    descriptionDe:
      'Einrichtungen müssen angemessene, verhältnismäßige und wirksame Maßnahmen zur Bewältigung der Cybersicherheitsrisiken ergreifen. Die Maßnahmen umfassen die in Art. 21 Abs. 2 genannten Bereiche (u. a. Risikoanalyse, Vorfallsbehandlung, Backup- und Krisenmanagement, Lieferkette, Wirksamkeitsbewertung, Cyber-Hygiene, Kryptografie, Zugriffskontrolle, Mehr-Faktor-Authentifizierung).',
    descriptionEn:
      'Entities shall take appropriate, proportionate and effective measures to manage cybersecurity risks. The measures cover all areas listed in Art. 21(2), including risk-analysis and information-security policies, incident handling, backup, disaster-recovery and crisis management, supply-chain security, effectiveness assessment, cyber hygiene and training, cryptography, access control and asset management, and multi-factor authentication.',
    isoCrosswalk: [
      'A.5.4', 'A.5.8', 'A.5.24', 'A.8.1', 'A.8.5', 'A.8.6', 'A.8.7',
      'A.8.8', 'A.8.9', 'A.8.10', 'A.8.11', 'A.8.12', 'A.8.14', 'A.8.15',
      'A.8.16', 'A.8.17', 'A.8.18', 'A.8.19', 'A.8.20', 'A.8.21', 'A.8.22',
      'A.8.23', 'A.8.24', 'A.8.32',
    ],
  },
  {
    articleId: '21d',
    article: 'Art. 21(2)(d)',
    titleDe: 'Lieferkettensicherheit',
    titleEn: 'Supply-chain security',
    descriptionDe:
      'Als Teil der Risikomanagementmaßnahmen müssen die Cybersicherheitsrisiken in den Beziehungen zu direkten Lieferanten und Dienstleistern berücksichtigt werden, einschließlich Sicherheitsaspekten bei Akquise, Entwicklung und Inbetriebnahme (Art. 21 Abs. 2 Buchst. d; § 30 BSIG).',
    descriptionEn:
      'As part of the risk-management measures, entities shall address cybersecurity risks in the relationships with their direct suppliers and service providers, including security aspects of acquisition, development and maintenance processes (Art. 21(2)(d) NIS-2 RL; § 30 BSIG).',
    isoCrosswalk: [
      'A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.8.19', 'A.8.25',
      'A.8.26', 'A.8.29', 'A.8.30', 'A.8.31',
    ],
  },
  {
    articleId: '21g',
    article: 'Art. 21(2)(g)',
    titleDe: 'Cyber-Hygiene und Schulungen',
    titleEn: 'Cyber hygiene practices and cybersecurity training',
    descriptionDe:
      'Als Teil der Risikomanagementmaßnahmen müssen Grundpraktiken der Cyber-Hygiene und regelmäßige Cybersicherheits-Schulungen der Mitarbeiter mit rollenbezogener Ausrichtung umgesetzt werden (Art. 21 Abs. 2 Buchst. g; § 30 BSIG).',
    descriptionEn:
      'As part of the risk-management measures, entities shall implement basic cyber-hygiene practices and regular cybersecurity training for staff, oriented to their roles (Art. 21(2)(g) NIS-2 RL; § 30 BSIG).',
    isoCrosswalk: [
      'A.6.3', 'A.6.2', 'A.5.4',
    ],
  },
  {
    articleId: '23',
    article: 'Art. 23',
    titleDe: 'Meldepflichten für erhebliche Vorfälle',
    titleEn: 'Reporting obligations for significant incidents',
    descriptionDe:
      'Erhebliche Vorfälle sind dem BSI bzw. der zuständigen CSIRT zu melden: Erstmeldung unverzüglich und spätestens innerhalb von 24 Stunden, eigentliche Meldung spätestens innerhalb von 72 Stunden nach der ersten Kenntnisnahme, ein Zwischenbericht auf Anfrage und eine Abschlussmeldung innerhalb eines Monats nach der Meldung (Art. 23 NIS-2 RL; § 32 BSIG).',
    descriptionEn:
      'Significant incidents shall be reported to the BSI or the competent CSIRT: an early warning without undue delay and no later than 24 hours, the incident notification no later than 72 hours after first awareness, an intermediate report on request, and a final report within one month after the incident notification (Art. 23 NIS-2 RL; § 32 BSIG).',
    isoCrosswalk: [
      'A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.5.28', 'A.5.29',
      'A.6.8', 'A.8.15', 'A.8.16',
    ],
  },
  {
    articleId: '27',
    article: 'Art. 27',
    titleDe: 'Registrierungspflicht',
    titleEn: 'Registration of entities',
    descriptionDe:
      'Wichtige und besonders wichtige Einrichtungen müssen sich beim BSI registrieren und die erforderlichen Angaben (u. a. Kontaktdaten, Zuständigkeitsbereich) in maschinenlesbarer Form übermitteln; Änderungen sind aktualisieren zu lassen (Art. 27 NIS-2 RL; § 33 BSIG).',
    descriptionEn:
      'Important and essential entities shall register with the BSI and provide the required information (contact data, areas of activity) in a machine-readable format, updating it when it changes (Art. 27 NIS-2 RL; § 33 BSIG).',
    isoCrosswalk: [
      'A.5.9', 'A.5.31', 'A.8.15', 'A.8.17',
    ],
  },
];

export const NIS2_ARTICLES_COUNT = NIS2_ARTICLES.length;
