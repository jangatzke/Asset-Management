/**
 * NIS2-Umsetzungsgesetz (NIS2UmsuCG) – Obligation Articles for the Control-Catalog.
 *
 * Implements improvement proposal #6 (NIS2 Control-Catalog + Crosswalk): each
 * obligation Article of the NIS2-Umsetzungsgesetz is stored as a
 * `ControlCatalogItem` in the `NIS2UmsuCG` catalogue, and every Article links to
 * the relevant ISO/IEC 27001:2022 Annex A controls (crosswalk) so the app can
 * show which ISO controls fulfil which NIS2 obligation.
 *
 * The Article texts are short, original summaries of the regulatory obligations
 * (no proprietary third-party catalogue text). The identifiers follow the NIS2
 *-Umsetzungsgesetz Articles (Art. 23 Risiko-Minimierung, Art. 24
 * Management-Accountability, Art. 25 Incident-Reporting, Art. 26 Supply-Chain,
 * Art. 27 Registrierung, Art. 29 Schulungen, Art. 30 Lieferanten-Management).
 */

export const NIS2_ARTICLES_CATALOG_CODE = 'NIS2UmsuCG' as const;
export const NIS2_ARTICLES_CATALOG_VERSION = '2024' as const;

/**
 * Fixed catalogue identifier. Kept deterministic so the catalogue can be
 * referenced from the frontend and tests without a lookup.
 */
export const NIS2_ARTICLES_CATALOG_ID = '00000000-0000-4000-8000-000000000002';

/** A single NIS2-UmsuCG obligation Article with its ISO/IEC 27001:2022 crosswalk. */
export interface Nis2Article {
  /** Article number without the "Art. " prefix, e.g. "23". */
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
    articleId: '23',
    article: 'Art. 23',
    titleDe: 'Risiko-Minimierung und Sicherheitsmaßnahmen',
    titleEn: 'Risk minimization and security measures',
    descriptionDe:
      'Einrichtungen müssen angemessene und verhältnismäßige Maßnahmen zur Minimierung von Sicherheitsrisiken ergreifen und einen Sicherheitsrahmen umsetzen.',
    descriptionEn:
      'Entities shall implement appropriate and proportionate measures to minimise security risks and establish an overall security framework, including risk analysis and incident management policies.',
    isoCrosswalk: [
      'A.5.4', 'A.5.8', 'A.5.24', 'A.8.1', 'A.8.5', 'A.8.6', 'A.8.7',
      'A.8.8', 'A.8.9', 'A.8.10', 'A.8.11', 'A.8.12', 'A.8.14', 'A.8.15',
      'A.8.16', 'A.8.17', 'A.8.18', 'A.8.19', 'A.8.20', 'A.8.21', 'A.8.22',
      'A.8.23', 'A.8.24', 'A.8.32',
    ],
  },
  {
    articleId: '24',
    article: 'Art. 24',
    titleDe: 'Management-Accountability und Verantwortung',
    titleEn: 'Management accountability and responsibility',
    descriptionDe:
      'Die Geschäftsleitung muss für die Umsetzung der Maßnahmen verantwortlich sein; eine oder mehrere Personen müssen für die Kontaktaufnahme mit den zuständigen Behörden zuständig sein.',
    descriptionEn:
      'Management bodies shall be responsible for implementing the measures and shall designate a person or persons responsible for contact with competent authorities and/or the CSIRT network.',
    isoCrosswalk: [
      'A.5.4', 'A.5.35', 'A.5.36', 'A.6.2', 'A.8.2', 'A.8.32',
    ],
  },
  {
    articleId: '25',
    article: 'Art. 25',
    titleDe: 'Incident-Reporting und Meldepflichten',
    titleEn: 'Incident reporting obligations',
    descriptionDe:
      'Einrichtungen müssen schwerwiegende Incidents schnell melden: Frühwarnung, offizielle Meldung innerhalb von 24 Stunden und abschließender Bericht innerhalb von 30 Tagen.',
    descriptionEn:
      'Entities shall report serious incidents and any first measures without delay, the notification within 24 hours and the final report within 30 days.',
    isoCrosswalk: [
      'A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.5.28', 'A.5.29',
      'A.6.8', 'A.8.15', 'A.8.16',
    ],
  },
  {
    articleId: '26',
    article: 'Art. 26',
    titleDe: 'Supply-Chain-Sicherheit',
    titleEn: 'Supply-chain security',
    descriptionDe:
      'Einrichtungen müssen die Sicherheit der Lieferketten berücksichtigen, einschließlich der Sicherheit von Liefer- und Dienstleistungsverträgen und der Sicherheit in Akquisitions-, Entwicklungs- und Inbetriebnahmeprozessen.',
    descriptionEn:
      'Entities shall take into account supply-chain security, including the security of procurement, development and maintenance processes and supply-chain risk management for the components, products and services used.',
    isoCrosswalk: [
      'A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.8.19', 'A.8.25',
      'A.8.26', 'A.8.29', 'A.8.30', 'A.8.31',
    ],
  },
  {
    articleId: '27',
    article: 'Art. 27',
    titleDe: 'Registrierung',
    titleEn: 'Registration',
    descriptionDe:
      'Wichtige Einheiten müssen sich bei der zuständigen Behörde registrieren lassen und alle erforderlichen Informationen angeben.',
    descriptionEn:
      'Important entities shall register themselves with the competent authority and provide the required information in a machine-readable format.',
    isoCrosswalk: [
      'A.5.9', 'A.5.31', 'A.8.15', 'A.8.17',
    ],
  },
  {
    articleId: '29',
    article: 'Art. 29',
    titleDe: 'Schulungen, Awareness und Sensibilisierung',
    titleEn: 'Training, awareness and education',
    descriptionDe:
      'Einrichtungen müssen angemessene Schulungs-, Awareness- und Sensibilisierungsmaßnahmen für alle Mitarbeiter entsprechend ihrer Aufgaben durchführen.',
    descriptionEn:
      'Entities shall conduct appropriate training, awareness and education measures for all employees with roles related to risks to information systems.',
    isoCrosswalk: [
      'A.6.3', 'A.5.8', 'A.6.2',
    ],
  },
  {
    articleId: '30',
    article: 'Art. 30',
    titleDe: 'Lieferanten-Management',
    titleEn: 'Supplier management',
    descriptionDe:
      'Einrichtungen müssen die informationssicherheit der Lieferanten überprüfen und bewerten; Lieferanten müssen vertraglich verpflichtet werden, Sicherheitsverletzungen zu melden.',
    descriptionEn:
      'Entities may verify and assess the information security of suppliers and shall include contractual obligations requiring suppliers to report security breaches.',
    isoCrosswalk: [
      'A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.8.19', 'A.8.25',
      'A.8.26', 'A.8.29', 'A.8.30', 'A.8.31', 'A.8.15',
    ],
  },
];

export const NIS2_ARTICLES_COUNT = NIS2_ARTICLES.length;
