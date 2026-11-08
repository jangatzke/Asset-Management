/**
 * Form primitives (Stage 8 / MT-5) — verifies the documented ID /
 * aria-describedby wiring of `Field` + `FieldInput`, the required marker,
 * error announcement (`role="alert"`) and the `FormRow` responsive grid.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { Field, FieldInput, FormRow, fieldControlClass } from './FormRow';

describe('Field + FieldInput ID wiring', () => {
  it('wires label htmlFor to the control id when htmlFor is given', () => {
    render(
      <Field label="Asset name" htmlFor="asset-name">
        <FieldInput name="name" />
      </Field>,
    );
    const input = screen.getByLabelText('Asset name');
    expect(input).toHaveAttribute('id', 'asset-name');
    for (const cls of fieldControlClass(false).split(' ')) {
      expect(input.className).toContain(cls);
    }
  });

  it('generates matching ids for label and control when htmlFor is omitted', () => {
    render(
      <Field label="Serial number">
        <FieldInput name="serialNumber" />
      </Field>,
    );

    const input = screen.getByLabelText('Serial number');
    const generatedId = input.getAttribute('id');
    expect(generatedId).toBeTruthy();
    expect(document.querySelector(`label[for="${generatedId}"]`)).toBeInTheDocument();
  });

  it('marks the control invalid and links the error via aria-describedby', () => {
    render(
      <Field label="Title" htmlFor="ctl-title" required error="Title is required">
        <FieldInput name="title" />
      </Field>,
    );

    const input = screen.getByLabelText(/Title/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'ctl-title-error');

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Title is required');
    expect(error).toHaveAttribute('id', 'ctl-title-error');
    expect(error).toHaveAttribute('aria-live', 'polite');
    expect(input.className).toContain('border-status-critical-fg');
  });

  it('shows a hint linked via aria-describedby and hides it when an error appears', () => {
    const { rerender } = render(
      <Field label="Inventory number" htmlFor="inv" hint="Format: INV-0000">
        <FieldInput name="inventoryNumber" />
      </Field>,
    );

    const input = screen.getByLabelText('Inventory number');
    expect(input).toHaveAttribute('aria-describedby', 'inv-hint');
    expect(screen.getByText('Format: INV-0000')).toBeInTheDocument();

    rerender(
      <Field label="Inventory number" htmlFor="inv" hint="Format: INV-0000" error="Invalid format">
        <FieldInput name="inventoryNumber" />
      </Field>,
    );

    expect(screen.getByLabelText('Inventory number')).toHaveAttribute('aria-describedby', 'inv-error');
    expect(screen.queryByText('Format: INV-0000')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid format');
  });

  it('renders the required asterisk inside the label', () => {
    render(
      <Field label="Catalog" htmlFor="catalog" required>
        <FieldInput name="catalogId" />
      </Field>,
    );

    const label = document.querySelector('label[for="catalog"]');
    expect(label).toBeInTheDocument();
    expect(label?.querySelector('[aria-hidden="true"]')).toHaveTextContent('*');
  });
});

describe('fieldControlClass', () => {
  it('uses the strong border token when valid and critical foreground when invalid', () => {
    expect(fieldControlClass()).toContain('border-border-strong');
    expect(fieldControlClass(false)).toContain('border-border-strong');
    expect(fieldControlClass(true)).toContain('border-status-critical-fg');
    expect(fieldControlClass(true)).not.toContain('border-border-strong');
  });
});

describe('FormRow', () => {
  it('renders a single-column grid by default and per-column classes from lg up', () => {
    const { container, rerender } = render(
      <FormRow>
        <span>field-a</span>
      </FormRow>,
    );
    let row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain('grid');
    expect(row.className).toContain('grid-cols-1');
    expect(row.className).toContain('gap-section-gap');
    expect(row.className).not.toContain('lg:grid-cols-2');

    rerender(
      <FormRow columns={2}>
        <span>field-a</span>
      </FormRow>,
    );
    row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain('lg:grid-cols-2');

    rerender(
      <FormRow columns={3}>
        <span>field-a</span>
      </FormRow>,
    );
    row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain('lg:grid-cols-3');
  });
});
