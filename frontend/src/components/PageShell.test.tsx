/**
 * Tests for the page-content landmark (Stage 6a, MT-1).
 *
 * Covers the single `<main id="main-content">` contract (skip-link target),
 * the width variants, the rhythm classes and `noPadding`/`className` merging.
 */
import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PageShell from './PageShell';

afterEach(() => cleanup());

describe('PageShell', () => {
  it('renders exactly one main landmark with id="main-content" and renders children', () => {
    render(
      <PageShell>
        <h1>Page title</h1>
        <p>Section content</p>
      </PageShell>,
    );

    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page title');
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('applies the default max-width and rhythm classes', () => {
    render(
      <PageShell>
        <span>content</span>
      </PageShell>,
    );

    const main = screen.getByRole('main');
    // Centering contract: `mx-auto` is the only horizontal centering control;
    // negative x-margins would override it and pin the capped block left.
    expect(main).toHaveClass('mx-auto');
    expect(main).not.toHaveClass('-mx-4', 'sm:-mx-6', 'lg:-mx-8');
    expect(main).toHaveClass('max-w-[2200px]');
    // Distinguishability guard: `default` (2200) must not accidentally match
    // the `narrow` (768) or `wide` (2400) caps. Separate calls because
    // jest-dom's multi-arg toHaveClass only requires ALL classes together.
    expect(main).not.toHaveClass('max-w-3xl');
    expect(main).not.toHaveClass('max-w-[2400px]');
    expect(main).toHaveClass('px-4', 'sm:px-6', 'lg:px-page-gutter');
    expect(main).toHaveClass('py-6', 'lg:py-8');
    expect(main).toHaveClass('flex', 'flex-col', 'gap-section-gap');
  });

  it.each([
    ['narrow', 'max-w-3xl', ['max-w-[2200px]', 'max-w-[2400px]']],
    ['wide', 'max-w-[2400px]', ['max-w-3xl', 'max-w-[2200px]']],
  ] as const)('applies the %s width max-width', (width, maxWidthClass, forbiddenClasses) => {
    render(
      <PageShell width={width}>
        <span>content</span>
      </PageShell>,
    );

    const main = screen.getByRole('main');
    expect(main).toHaveClass(maxWidthClass);
    // Distinguishability guard: each variant cap is unique — no other variant's
    // max-width class may leak into the rendered class list. Asserted per class
    // because jest-dom's multi-arg toHaveClass only requires ALL classes together.
    forbiddenClasses.forEach((forbiddenClass) => {
      expect(main).not.toHaveClass(forbiddenClass);
    });
  });

  it('omits vertical padding when noPadding is set', () => {
    render(
      <PageShell noPadding>
        <span>content</span>
      </PageShell>,
    );

    const main = screen.getByRole('main');
    expect(main).not.toHaveClass('py-6', 'lg:py-8');
    // Gutter and rhythm remain — only the vertical padding is dropped.
    expect(main).toHaveClass('px-4', 'gap-section-gap');
  });

  it('merges a custom className onto the main element', () => {
    render(
      <PageShell className="custom-shell">
        <span>content</span>
      </PageShell>,
    );

    expect(screen.getByRole('main')).toHaveClass('custom-shell');
  });
});
