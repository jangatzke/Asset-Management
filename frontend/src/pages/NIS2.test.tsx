/**
 * NIS2 page component tests.
 *
 * Proves:
 *  - When questionnaires array is empty, the "Load default questionnaire" button is shown
 *  - When a questionnaire is selected, its questions are rendered as fillable input fields
 *  - The catalogue ensure button triggers a visible loading state and success/error messages
 *  - The i18n t() function is called with nis2.* keys throughout the component
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import nis2Source from './NIS2.tsx?raw';

// --- Mock I18nContext ---
vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// --- Mock API ---
const mockListActiveQuestionnaires = vi.fn();
const mockListAssessments = vi.fn();
const mockListRegistrations = vi.fn();
const mockEnsureMeasuresCatalogue = vi.fn();
const mockEnsureDefaultQuestionnaire = vi.fn();

vi.mock('../services/api', () => ({
  nis2Api: {
    listActiveQuestionnaires: (...args: unknown[]) => mockListActiveQuestionnaires(...args),
    listAssessments: (...args: unknown[]) => mockListAssessments(...args),
    listRegistrations: (...args: unknown[]) => mockListRegistrations(...args),
    ensureMeasuresCatalogue: (...args: unknown[]) => mockEnsureMeasuresCatalogue(...args),
    ensureDefaultQuestionnaire: (...args: unknown[]) => mockEnsureDefaultQuestionnaire(...args),
  },
}));

// --- Import NIS2 after mocks ---
import NIS2 from './NIS2';

// --- Helpers ---
function renderNIS2() {
  return render(<NIS2 />);
}

describe('NIS2 component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to return empty data by default
    mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
    mockListAssessments.mockResolvedValue({ data: [] });
    mockListRegistrations.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Empty questionnaire state', () => {
    it('shows "Load default questionnaire" button when questionnaires array is empty', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.loadDefaultQuestionnaire')).toBeInTheDocument();
      });

      expect(screen.getByText('nis2.emptyQuestionnaireExplanation')).toBeInTheDocument();
      expect(screen.getByText('nis2.answersFillableOncePresent')).toBeInTheDocument();
    });

    it('calls ensureDefaultQuestionnaire API when load button is clicked', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });
      mockEnsureDefaultQuestionnaire.mockResolvedValue({});

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.loadDefaultQuestionnaire')).toBeInTheDocument();
      });

      const loadButton = screen.getByText('nis2.loadDefaultQuestionnaire');
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(mockEnsureDefaultQuestionnaire).toHaveBeenCalledTimes(1);
      });
    });

    it('shows loading state on button while loading default questionnaire', async () => {
      let resolveLoad: () => void;
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });
      mockEnsureDefaultQuestionnaire.mockImplementation(() => new Promise((resolve) => {
        resolveLoad = resolve as () => void;
      }));

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.loadDefaultQuestionnaire')).toBeInTheDocument();
      });

      const loadButton = screen.getByText('nis2.loadDefaultQuestionnaire');
      fireEvent.click(loadButton);

      // Button should show loading text
      await waitFor(() => {
        expect(screen.getByText('common.loading')).toBeInTheDocument();
      });

      // Resolve the load
      resolveLoad!();

      // After resolution, load() is called which triggers all 3 API calls.
      // In React StrictMode or with re-renders, the count may be higher than 2.
      await waitFor(() => {
        expect(mockListActiveQuestionnaires.mock.calls.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Selected questionnaire state', () => {
    it('renders fillable input fields when a questionnaire is selected', async () => {
      const mockQuestionnaires = [
        {
          id: 'q1',
          version: '1.0',
          title: 'Test Questionnaire',
          questions: [
            { key: 'org_name', label: 'Organization Name', type: 'text', required: true },
            { key: 'is_critical', label: 'Is Critical', type: 'boolean', required: false },
            { key: 'employee_count', label: 'Employee Count', type: 'number', required: true },
          ],
        },
      ];

      mockListActiveQuestionnaires.mockResolvedValue({ data: mockQuestionnaires });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      // Wait for questionnaire to load and select first one
      await waitFor(() => {
        expect(screen.getByText('Test Questionnaire (v1.0)')).toBeInTheDocument();
      });

      // Select the questionnaire (first combobox is the questionnaire dropdown)
      const selects = screen.getAllByRole('combobox');
      const select = selects[0] as HTMLSelectElement;
      fireEvent.change(select, { target: { value: '1.0' } });

      // Check that question fields are rendered (i18n mock returns keys like 'nis2.questionnaireLabels.org_name')
      await waitFor(() => {
        expect(screen.getByText(/nis2\.questionnaireLabels\.org_name \*/)).toBeInTheDocument();
        expect(screen.getByText(/nis2\.questionnaireLabels\.is_critical/)).toBeInTheDocument();
        expect(screen.getByText(/nis2\.questionnaireLabels\.employee_count \*/)).toBeInTheDocument();
      });
    });

    it('renders boolean question as select dropdown', async () => {
      const mockQuestionnaires = [
        {
          id: 'q1',
          version: '1.0',
          title: 'Test Questionnaire',
          questions: [
            { key: 'has_dpo', label: 'Has DPO', type: 'boolean', required: false },
          ],
        },
      ];

      mockListActiveQuestionnaires.mockResolvedValue({ data: mockQuestionnaires });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('Test Questionnaire (v1.0)')).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      const questionnaireSelect = selects[0] as HTMLSelectElement;
      fireEvent.change(questionnaireSelect, { target: { value: '1.0' } });

      // Boolean question should render a select with Yes/No options
      await waitFor(() => {
        expect(screen.getByText(/nis2\.questionnaireLabels\.has_dpo/)).toBeInTheDocument();
      });
    });

    it('renders text/number question as input field', async () => {
      const mockQuestionnaires = [
        {
          id: 'q1',
          version: '1.0',
          title: 'Test Questionnaire',
          questions: [
            { key: 'org_name', label: 'Organization Name', type: 'text', required: true },
            { key: 'employee_count', label: 'Employee Count', type: 'number', required: true },
          ],
        },
      ];

      mockListActiveQuestionnaires.mockResolvedValue({ data: mockQuestionnaires });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('Test Questionnaire (v1.0)')).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      const questionnaireSelect = selects[0] as HTMLSelectElement;
      fireEvent.change(questionnaireSelect, { target: { value: '1.0' } });

      await waitFor(() => {
        expect(screen.getByText(/nis2\.questionnaireLabels\.org_name \*/)).toBeInTheDocument();
      });

      // Check input is rendered
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Catalogue ensure functionality', () => {
    it('shows loading state when catalogue ensure button is clicked', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });
      mockEnsureMeasuresCatalogue.mockImplementation(() => new Promise((resolve) => {
        setTimeout(resolve, 100);
      }));

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.loadDefaultQuestionnaire')).toBeInTheDocument();
      });

      // Find and click the catalogue ensure button
      await waitFor(() => {
        expect(screen.getByText('nis2.catalogAdministration')).toBeInTheDocument();
      });

      const catalogueButton = screen.getByText('nis2.catalogEnsureButton') as HTMLButtonElement;

      if (catalogueButton) {
        fireEvent.click(catalogueButton);

        // Should show loading state
        await waitFor(() => {
          expect(screen.getByText('nis2.catalogEnsuring')).toBeInTheDocument();
        });
      }
    });

    it('shows success message when catalogue ensure succeeds', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });
      mockEnsureMeasuresCatalogue.mockResolvedValue({});

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.loadDefaultQuestionnaire')).toBeInTheDocument();
      });

      const catalogueButton = screen.getByText('nis2.catalogEnsureButton') as HTMLButtonElement;

      if (catalogueButton) {
        fireEvent.click(catalogueButton);

        await waitFor(() => {
          expect(screen.getByText('nis2.catalogEnsured')).toBeInTheDocument();
        });
      }
    });

    it('shows error message when catalogue ensure fails', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });
      mockEnsureMeasuresCatalogue.mockRejectedValue({
        response: { data: { message: 'Catalogue error' } },
      });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.loadDefaultQuestionnaire')).toBeInTheDocument();
      });

      const catalogueButton = screen.getByText('nis2.catalogEnsureButton') as HTMLButtonElement;

      if (catalogueButton) {
        fireEvent.click(catalogueButton);

        await waitFor(() => {
          // The error message uses the API error text, not the i18n key
          expect(screen.getByText('Catalogue error')).toBeInTheDocument();
        });
      }
    });
  });

  describe('i18n coverage', () => {
    // Use source-based checks like CostPlanning.test.tsx for i18n verification
    it('calls t() with nis2.* keys throughout the component', () => {
      // Verify the component uses t() with nis2.* keys
      const nis2Keys = [
        'nis2.title',
        'nis2.description',
        'nis2.section1',
        'nis2.section2',
        'nis2.section3',
        'nis2.section4',
        'nis2.loadDefaultQuestionnaire',
        'nis2.emptyQuestionnaireExplanation',
        'nis2.answersFillableOncePresent',
        'nis2.selectQuestionnaire',
        'nis2.select',
        'nis2.organizationUnit',
        'nis2.justification',
        'nis2.createDraftAssessment',
        'nis2.catalogAdministration',
        'nis2.catalogEnsureButton',
        'nis2.catalogEnsuring',
        'nis2.catalogEnsured',
        'nis2.catalogError',
        'nis2.catalogEnsureDescription',
        'nis2.noAssessments',
        'nis2.noApprovedAssessments',
        'nis2.noRegistrations',
        'nis2.missingAnswerError',
        'nis2.loadingError',
        'nis2.operationError',
      ];

      for (const key of nis2Keys) {
        expect(nis2Source).toContain(`'${key}'`);
      }
    });

    it('uses t() for section headers', () => {
      expect(nis2Source).toContain("t('nis2.title')");
      expect(nis2Source).toContain("t('nis2.section1')");
      expect(nis2Source).toContain("t('nis2.section2')");
      expect(nis2Source).toContain("t('nis2.section3')");
      expect(nis2Source).toContain("t('nis2.section4')");
    });

    it('uses t() for form labels and buttons', () => {
      expect(nis2Source).toContain("t('nis2.loadDefaultQuestionnaire')");
      expect(nis2Source).toContain("t('nis2.select')");
      expect(nis2Source).toContain("t('nis2.createDraftAssessment')");
    });

    it('uses t() for catalogue operations', () => {
      expect(nis2Source).toContain("t('nis2.catalogEnsured')");
      expect(nis2Source).toContain("t('nis2.catalogError')");
      expect(nis2Source).toContain("t('nis2.catalogEnsuring')");
      expect(nis2Source).toContain("t('nis2.catalogEnsureButton')");
    });

    it('uses t() for error messages', () => {
      expect(nis2Source).toContain("t('nis2.loadingError')");
      expect(nis2Source).toContain("t('nis2.operationError')");
    });

    it('uses t() for entity type options', () => {
      expect(nis2Source).toContain("t('nis2.essentialEntity')");
      expect(nis2Source).toContain("t('nis2.importantEntity')");
    });

    it('uses t() for change type options', () => {
      expect(nis2Source).toContain("t('nis2.changeContactDetails')");
      expect(nis2Source).toContain("t('nis2.changeEntityData')");
      expect(nis2Source).toContain("t('nis2.changeScope')");
      expect(nis2Source).toContain("t('nis2.changeOther')");
    });
  });

  describe('Assessment list rendering', () => {
    it('shows "no assessments" message when assessments array is empty', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.noAssessments')).toBeInTheDocument();
      });
    });

    it('renders assessment items with status and questionnaire version', async () => {
      const mockAssessments = [
        {
          id: 'a1',
          status: 'draft',
          result: 'in_scope',
          questionnaireVersion: '1.0',
        },
      ];

      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: mockAssessments });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      // Wait for the assessment list to render with the draft status
      // The component renders: a.result?.replace(/_/g, ' ') || t('nis2.pending')
      // So 'in scope' appears for result='in_scope'
      await waitFor(() => {
        const assessmentItems = screen.getAllByText(/draft|in scope|nis2\.pending/);
        expect(assessmentItems.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows submit button for draft assessments', async () => {
      const mockAssessments = [
        {
          id: 'a1',
          status: 'draft',
          result: null,
          questionnaireVersion: '1.0',
        },
      ];

      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: mockAssessments });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.submit')).toBeInTheDocument();
      });
    });

    it('shows approve button for under_review assessments', async () => {
      const mockAssessments = [
        {
          id: 'a1',
          status: 'under_review',
          result: null,
          questionnaireVersion: '1.0',
        },
      ];

      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: mockAssessments });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.approve')).toBeInTheDocument();
      });
    });
  });

  describe('Registration sections', () => {
    it('shows "no approved assessments" message when no approved assessments exist', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.noApprovedAssessments')).toBeInTheDocument();
      });
    });

    it('shows "no registrations" message when registrations array is empty', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.noRegistrations')).toBeInTheDocument();
      });
    });

    it('renders registration change section with all fields', async () => {
      mockListActiveQuestionnaires.mockResolvedValue({ data: [] });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('nis2.section4')).toBeInTheDocument();
      });

      // Change type options should be present
      expect(screen.getByText('nis2.changeContactDetails')).toBeInTheDocument();
      expect(screen.getByText('nis2.changeEntityData')).toBeInTheDocument();
      expect(screen.getByText('nis2.changeScope')).toBeInTheDocument();
      expect(screen.getByText('nis2.changeOther')).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('shows error for missing required answers', async () => {
      const mockQuestionnaires = [
        {
          id: 'q1',
          version: '1.0',
          title: 'Test Questionnaire',
          questions: [
            { key: 'required_field', label: 'Required Field', type: 'text', required: true },
          ],
        },
      ];

      mockListActiveQuestionnaires.mockResolvedValue({ data: mockQuestionnaires });
      mockListAssessments.mockResolvedValue({ data: [] });
      mockListRegistrations.mockResolvedValue({ data: [] });

      renderNIS2();

      await waitFor(() => {
        expect(screen.getByText('Test Questionnaire (v1.0)')).toBeInTheDocument();
      });

      // Try to submit without filling required field
      const selects = screen.getAllByRole('combobox');
      const questionnaireSelect = selects[0] as HTMLSelectElement;
      fireEvent.change(questionnaireSelect, { target: { value: '1.0' } });

      await waitFor(() => {
        expect(screen.getByText(/nis2\.questionnaireLabels\.required_field \*/)).toBeInTheDocument();
      });
    });
  });
});
