/**
 * Unified Dialog (Stage 7 / MT-4) behavior tests.
 *
 * Covers: open/close rendering, aria wiring (labelledby/describedby/modal),
 * Escape + backdrop dismissal flags, isLoading blocking, focus trap and
 * focus restore, and the disablePortal escape hatch used by the Modal wrapper.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// --- Mock I18nContext (Dialog uses t('common.close') for the × button) ---
vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { Dialog } from './Dialog';

const noop = (): void => undefined;

function overlay(): HTMLElement {
  const node = document.body.querySelector('.fixed.inset-0') as HTMLElement | null;
  expect(node).not.toBeNull();
  return node as HTMLElement;
}

function fireBackdropClick() {
  const backdrop = overlay();
  fireEvent.mouseDown(backdrop, { target: backdrop });
  fireEvent.click(backdrop);
}

describe('Dialog', () => {
  afterEach(cleanup);

  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={noop}>
        <p>hidden body</p>
      </Dialog>,
    );
    expect(screen.queryByText('hidden body')).not.toBeInTheDocument();
    expect(document.body.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('renders title, description and body with proper aria wiring', () => {
    render(
      <Dialog open onClose={noop} title="My Title" description="My Description">
        <p>dialog body</p>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('dialog body')).toBeInTheDocument();

    const heading = screen.getByText('My Title');
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
    expect(heading.tagName).toBe('H2');

    const description = screen.getByText('My Description');
    expect(dialog).toHaveAttribute('aria-describedby', description.id);
  });

  it('supports aria-label when no title is given', () => {
    render(
      <Dialog open onClose={noop} aria-label="Unnamed dialog">
        <p>body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Unnamed dialog');
  });

  it('closes on backdrop click by default', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        <p>body</p>
      </Dialog>,
    );
    fireBackdropClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores backdrop clicks when closeOnBackdrop=false', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T" closeOnBackdrop={false}>
        <p>body</p>
      </Dialog>,
    );
    fireBackdropClick();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when the pointer down started inside the panel', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        <p>body</p>
      </Dialog>,
    );
    const body = screen.getByText('body');
    fireEvent.mouseDown(body, { target: body });
    fireEvent.click(overlay());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape by default', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        <p>body</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape when closeOnEscape=false', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T" closeOnEscape={false}>
        <p>body</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes via the × button which carries an accessible label', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        <p>body</p>
      </Dialog>,
    );
    const closeBtn = screen.getByLabelText('common.close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks all dismissal paths and disables × while isLoading', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T" isLoading>
        <p>body</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    fireBackdropClick();
    const closeBtn = screen.getByLabelText('common.close') as HTMLButtonElement;
    expect(closeBtn).toBeDisabled();
    fireEvent.click(closeBtn);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks body scroll while open and restores it on close', () => {
    document.body.style.overflow = 'auto';
    const { rerender } = render(
      <Dialog open onClose={noop} title="T">
        <p>body</p>
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Dialog open={false} onClose={noop} title="T">
        <p>body</p>
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe('auto');
  });

  it('moves focus into the dialog on open and restores it to the trigger on close', () => {
    const harness = (open: boolean) => (
      <>
        <button type="button">open-trigger</button>
        <Dialog open={open} onClose={noop} title="T">
          <p>body</p>
        </Dialog>
      </>
    );

    const { rerender } = render(harness(false));
    const trigger = screen.getByText('open-trigger') as HTMLButtonElement;
    trigger.focus();
    expect(trigger).toHaveFocus();

    // Transition to open: the effect captures the focused trigger and moves focus in.
    rerender(harness(true));
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Closing restores focus to the trigger.
    rerender(harness(false));
    expect(trigger).toHaveFocus();
  });

  it('traps Tab focus inside the dialog', () => {
    render(
      <Dialog open onClose={noop} title="T" footer={<button type="button">footer-action</button>}>
        <input aria-label="field" />
      </Dialog>,
    );

    const closeBtn = screen.getByLabelText('common.close');
    const footerBtn = screen.getByText('footer-action');
    const field = screen.getByLabelText('field');

    // Wrap from last focusable back to the first (close button is first in DOM order).
    footerBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeBtn).toHaveFocus();

    // Wrap backwards from the first focusable (close button) to the last.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(footerBtn).toHaveFocus();

    // A Tab from a middle element is not intercepted (no forced move;
    // jsdom does not perform native tab navigation, so focus stays put).
    field.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(field).toHaveFocus();
  });

  it('renders in place when disablePortal is set (Modal wrapper path)', () => {
    const { container } = render(
      <div data-testid="host">
        <Dialog open onClose={noop} title="T" disablePortal>
          <p>body</p>
        </Dialog>
      </div>,
    );
    expect(container.querySelector('.fixed.inset-0')).toBeInTheDocument();
    expect(screen.getByRole('dialog').closest('.fixed.inset-0')!.parentElement).toBe(
      container.querySelector('[data-testid="host"]'),
    );
  });

  it('applies size classes to the panel', () => {
    const { rerender } = render(
      <Dialog open onClose={noop} title="T" size="sm">
        <p>body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('max-w-md');
    rerender(
      <Dialog open onClose={noop} title="T" size="xl">
        <p>body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('max-w-4xl');
  });

  it('lets panelClassName override the width ladder', () => {
    render(
      <Dialog open onClose={noop} title="T" size="md" panelClassName="max-w-[96vw]">
        <p>body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('max-w-[96vw]');
    expect(dialog).not.toHaveClass('max-w-lg');
  });
});
