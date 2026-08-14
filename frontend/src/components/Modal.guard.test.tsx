/**
 * Modal edit-dismissal safeguard tests.
 *
 * Proves the following behaviors for the shared Modal component:
 *  - Pristine modal can dismiss via backdrop, Escape, and ×.
 *  - Dirty modal blocks backdrop/Escape/× from closing immediately.
 *  - Dirty modal opens DiscardConfirmationDialog on those exits.
 *  - Cancel/stay retains the draft.
 *  - Confirm discard invokes the onDiscardConfirm callback (which should close).
 *  - Saving (clearing isDirty) blocks exit and closes immediately.
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// --- Mock I18nContext (required by DiscardConfirmationDialog via Modal) ---
vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// --- Import after mocks ---
import { Modal } from './Modal';

// --- Helpers ---
const TEST_TITLE = 'Test Modal';

/**
 * Fires a proper backdrop click by dispatching mouseDown then click on the overlay.
 * The Modal component tracks backdrop interaction via onMouseDown + onClick.
 */
function fireBackdropClick(container: HTMLElement) {
  const overlay = container.querySelector('.fixed.inset-0') as HTMLElement;
  expect(overlay).toBeInTheDocument();
  fireEvent.mouseDown(overlay, { target: overlay });
  fireEvent.click(overlay);
}

function renderModal(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn();
  const onDiscardConfirm = vi.fn();
  const rendered = render(
    <Modal
      isOpen={true}
      onClose={onClose}
      title={TEST_TITLE}
      isDirty={props.isDirty ?? false}
      onDiscardConfirm={onDiscardConfirm}
      {...props}
    >
      <p>Modal body content</p>
    </Modal>
  );
  return { onClose, onDiscardConfirm, ...rendered };
}

// --- Pristine modal tests ---

describe('Pristine modal dismissals', () => {
  afterEach(cleanup);

  it('closes immediately on backdrop click when pristine', () => {
    const { onClose, container } = renderModal({ isDirty: false });
    fireBackdropClick(container);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes immediately on Escape key when pristine', () => {
    const { onClose } = renderModal({ isDirty: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes immediately on × button click when pristine', () => {
    const { onClose } = renderModal({ isDirty: false });
    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// --- Dirty modal tests ---

describe('Dirty modal dismissals', () => {
  afterEach(cleanup);

  it('does NOT close on backdrop click when dirty — instead shows discard confirmation', () => {
    const { onClose, onDiscardConfirm, container } = renderModal({ isDirty: true });
    fireBackdropClick(container);
    expect(onClose).not.toHaveBeenCalled();
    // DiscardConfirmationDialog should be rendered (MUI Dialog portals to body)
    expect(screen.getByText('common.discardChangesTitle')).toBeInTheDocument();
    expect(screen.getByText('common.discardChangesMessage')).toBeInTheDocument();
    // onDiscardConfirm is NOT called — the Modal sets showDiscardConfirm=true
    expect(onDiscardConfirm).not.toHaveBeenCalled();
  });

  it('does NOT close on Escape key when dirty — instead shows discard confirmation', () => {
    const { onClose, onDiscardConfirm } = renderModal({ isDirty: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('common.discardChangesTitle')).toBeInTheDocument();
    expect(onDiscardConfirm).not.toHaveBeenCalled();
  });

  it('does NOT close on × button click when dirty — instead shows discard confirmation', () => {
    const { onClose } = renderModal({ isDirty: true });
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('common.discardChangesTitle')).toBeInTheDocument();
  });

  it('guards a dirty modal even when no discard callback is supplied, then closes on confirm', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title={TEST_TITLE} isDirty={true}>
        <p>Modal body content</p>
      </Modal>
    );

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('common.discardChangesTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancel/stay keeps the draft and hides discard dialog', async () => {
    const { onClose, onDiscardConfirm } = renderModal({ isDirty: true });
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    // MUI Dialog portals content to document.body — wait for it
    await waitFor(() => {
      expect(document.body).toHaveTextContent('common.discardChangesTitle');
    });
    // Click cancel button
    const cancelBtn = screen.getByRole('button', { name: 'common.cancel' });
    fireEvent.click(cancelBtn);
    // Dialog should be hidden
    await waitFor(() => {
      expect(document.body).not.toHaveTextContent('common.discardChangesTitle');
    });
    // Neither onClose nor onDiscardConfirm was called
    expect(onClose).not.toHaveBeenCalled();
    expect(onDiscardConfirm).not.toHaveBeenCalled();
  });

  it('confirm discard hides dialog and calls onDiscardConfirm', async () => {
    const { onClose, onDiscardConfirm } = renderModal({ isDirty: true });
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    // Wait for discard dialog to appear in portal
    await waitFor(() => {
      expect(document.body).toHaveTextContent('common.discardChangesTitle');
    });
    // Click discard button
    const discardBtn = screen.getByRole('button', { name: 'common.discard' });
    fireEvent.click(discardBtn);
    // onDiscardConfirm should have been called
    expect(onDiscardConfirm).toHaveBeenCalledTimes(1);
    // onClose is NOT called by Modal — the caller is expected to close after discard
    expect(onClose).not.toHaveBeenCalled();
    // Dialog is hidden
    await waitFor(() => {
      expect(document.body).not.toHaveTextContent('common.discardChangesTitle');
    });
  });

  it('onDiscardConfirm typically calls onClose — caller responsibility', async () => {
    // This test demonstrates the expected pattern: the parent passes onDiscardConfirm
    // that calls onClose. The Modal itself only invokes onDiscardConfirm.
    const onClose = vi.fn();
    const onDiscardConfirm = vi.fn(() => onClose());
    render(
      <Modal
        isOpen={true}
        onClose={onClose}
        title={TEST_TITLE}
        isDirty={true}
        onDiscardConfirm={onDiscardConfirm}
      >
        <p>Body</p>
      </Modal>
    );
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    // Wait for discard dialog to appear
    await waitFor(() => {
      expect(document.body).toHaveTextContent('common.discardChangesTitle');
    });
    const discardBtn = screen.getByRole('button', { name: 'common.discard' });
    fireEvent.click(discardBtn);
    expect(onDiscardConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// --- isDirty state change tests ---

describe('isDirty state transitions', () => {
  afterEach(cleanup);

  it('hides discard confirmation dialog when isDirty becomes false', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={true} onClose={onClose} title={TEST_TITLE} isDirty={true} onDiscardConfirm={vi.fn()}>
        <p>Body</p>
      </Modal>
    );
    // Trigger discard dialog via ×
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    // Wait for portal content
    await waitFor(() => {
      expect(document.body).toHaveTextContent('common.discardChangesTitle');
    });

    // Now isDirty becomes false
    rerender(
      <Modal isOpen={true} onClose={vi.fn()} title={TEST_TITLE} isDirty={false}>
        <p>Body</p>
      </Modal>
    );
    // Dialog should be hidden after isDirty clears
    await waitFor(() => {
      expect(document.body).not.toHaveTextContent('common.discardChangesTitle');
    });
  });
});

// --- Custom i18n keys test ---

describe('Custom i18n keys', () => {
  afterEach(cleanup);

  it('uses custom discardTitleKey and discardMessageKey when provided', async () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title={TEST_TITLE}
        isDirty={true}
        onDiscardConfirm={vi.fn()}
        discardTitleKey="custom.discardTitle"
        discardMessageKey="custom.discardMessage"
      >
        <p>Body</p>
      </Modal>
    );
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    // Wait for portal content with custom keys
    await waitFor(() => {
      expect(document.body).toHaveTextContent('custom.discardTitle');
    });
    await waitFor(() => {
      expect(document.body).toHaveTextContent('custom.discardMessage');
    });
  });
});

// --- isOpen=false test ---

describe('Modal when closed', () => {
  afterEach(cleanup);

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title={TEST_TITLE}>
        <p>Body</p>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });
});
