/**
 * Tests for the shared inline error surface.
 *
 * The component must stay i18n-free: it receives the localized reference
 * template as a prop so callers can reuse `common.referenceId` without making
 * the component depend on the translation context.
 */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorAlert } from './ErrorAlert';
import type { ApiErrorInfo } from '../utils/apiError';

afterEach(() => cleanup());

describe('ErrorAlert', () => {
  it('renders nothing when no message or error is provided', () => {
    render(<ErrorAlert />);
    expect(screen.queryByTestId('error-alert')).toBeNull();
  });

  it('renders only the message when the error carries no reference ID', () => {
    const error: ApiErrorInfo = { message: 'Boom', fieldErrors: {} };
    render(<ErrorAlert error={error} />);

    expect(screen.getByTestId('error-alert')).toHaveTextContent('Boom');
    expect(screen.queryByTestId('error-reference-id')).toBeNull();
  });

  it('renders the reference ID substituted into the template', () => {
    const error: ApiErrorInfo = { message: 'Boom', fieldErrors: {}, referenceId: 'corr-42' };
    render(<ErrorAlert error={error} referenceTemplate="Ref: {id}" />);

    const reference = screen.getByTestId('error-reference-id');
    expect(reference).toHaveTextContent('Ref: corr-42');
  });

  it('falls back to a plain label when no template is supplied', () => {
    const error: ApiErrorInfo = { message: 'Boom', fieldErrors: {}, referenceId: 'corr-42' };
    render(<ErrorAlert error={error} />);
    expect(screen.getByTestId('error-reference-id')).toHaveTextContent('Ref: corr-42');
  });

  it('appends the ID when the template has no {id} placeholder', () => {
    const error: ApiErrorInfo = { message: 'Boom', fieldErrors: {}, referenceId: 'corr-42' };
    render(<ErrorAlert error={error} referenceTemplate="Reference" />);
    expect(screen.getByTestId('error-reference-id')).toHaveTextContent('Reference: corr-42');
  });

  it('prefers a pre-formatted message over the error object text', () => {
    const error: ApiErrorInfo = { message: 'envelope text', fieldErrors: {}, referenceId: 'corr-42' };
    render(<ErrorAlert error={error} message="formatted with (Ref: corr-42)" referenceTemplate="Ref: {id}" />);
    expect(screen.getByTestId('error-alert')).toHaveTextContent('formatted with (Ref: corr-42)');
  });

  it('exposes the alert role and invokes the dismiss handler', () => {
    const onDismiss = vi.fn();
    render(<ErrorAlert message="Boom" onDismiss={onDismiss} dismissLabel="Close" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
