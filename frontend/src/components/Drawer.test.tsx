/**
 * Drawer (Stage 10c / LT-5) behavior tests.
 *
 * Mirrors the Dialog contract: open/close rendering, aria wiring, Escape and
 * backdrop dismissal flags, focus trap + focus restore, and the side/width
 * class mapping. The shared useOverlayBehavior hook must behave identically.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// --- Mock I18nContext (Drawer uses t('common.close') for the × button) ---
vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const noop = (): void => undefined;

import { Drawer } from './Drawer';

function overlay(): HTMLElement {
  const node = document.body.querySelector('[data-drawer-state]') as HTMLElement | null;
  expect(node).not.toBeNull();
  return node as HTMLElement;
}

function fireBackdropClick() {
  const backdrop = overlay();
  fireEvent.mouseDown(backdrop, { target: backdrop });
  fireEvent.click(backdrop);
}

describe('Drawer', () => {
  afterEach(cleanup);

  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onClose={noop}>
        <p>hidden body</p>
      </Drawer>,
    );
    expect(screen.queryByText('hidden body')).not.toBeInTheDocument();
    expect(document.body.querySelector('[data-drawer-state]')).toBeNull();
  });

  it('renders title, description and body with proper aria wiring', () => {
    render(
      <Drawer open onClose={noop} title="Drawer Title" description="Drawer Description">
        <p>drawer body</p>
      </Drawer>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('drawer body')).toBeInTheDocument();

    const heading = screen.getByText('Drawer Title');
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id);

    const description = screen.getByText('Drawer Description');
    expect(dialog).toHaveAttribute('aria-describedby', description.id);
  });

  it('supports aria-label when no title is given', () => {
    render(
      <Drawer open onClose={noop} aria-label="Unnamed drawer">
        <p>body</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Unnamed drawer');
  });

  it('closes on backdrop click by default and on Escape', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="T">
        <p>body</p>
      </Drawer>,
    );
    fireBackdropClick();
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('respects closeOnBackdrop=false and closeOnEscape=false', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="T" closeOnBackdrop={false} closeOnEscape={false}>
        <p>body</p>
      </Drawer>,
    );
    fireBackdropClick();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when the pointer down started inside the panel', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="T">
        <p>body</p>
      </Drawer>,
    );
    const body = screen.getByText('body');
    fireEvent.mouseDown(body, { target: body });
    fireEvent.click(overlay());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('maps side and width to layout classes', () => {
    render(
      <Drawer open onClose={noop} title="T" side="left" width="lg">
        <p>body</p>
      </Drawer>,
    );
    const backdrop = overlay();
    expect(backdrop.className).toContain('justify-start');
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('border-r');
    expect(dialog.className).toContain('sm:max-w-2xl');

    cleanup();
    render(
      <Drawer open onClose={noop} title="T">
        <p>body</p>
      </Drawer>,
    );
    expect(overlay().className).toContain('justify-end');
    expect(screen.getByRole('dialog').className).toContain('border-l');
    expect(screen.getByRole('dialog').className).toContain('sm:max-w-md');
  });

  it('traps focus and restores it to the trigger on close', () => {
    const onClose = vi.fn();
    const harness = (open: boolean) => (
      <>
        <button type="button" onClick={() => undefined}>
          trigger
        </button>
        <Drawer open={open} onClose={onClose} title="T">
          <button type="button">inside</button>
        </Drawer>
      </>
    );
    const { rerender } = render(harness(false));

    const trigger = screen.getByRole('button', { name: 'trigger' });
    trigger.focus();
    rerender(harness(true));

    // On open, focus moves into the drawer (close button is the default target).
    expect(document.activeElement).not.toBe(trigger);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    // Tab from the last focusable element wraps back to the first.
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);

    // Closing restores focus to the trigger.
    rerender(harness(false));
    expect(trigger).toHaveFocus();
  });

  it('locks body scroll while open', () => {
    render(
      <Drawer open onClose={noop} title="T">
        <p>body</p>
      </Drawer>,
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('renders a footer when provided', () => {
    render(
      <Drawer open onClose={noop} title="T" footer={<button type="button">footer action</button>}>
        <p>body</p>
      </Drawer>,
    );
    expect(screen.getByRole('button', { name: 'footer action' })).toBeInTheDocument();
  });
});
