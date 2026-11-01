/// <reference types="vitest" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HelpTooltip from './HelpTooltip';

const catalog: Record<string, string> = {
  'common.help.ariaLabel': 'More information about this field',
  'risks.fields.mitigationDimension.label': 'Mitigation dimension',
  'risks.fields.mitigationDimension.description': 'Risk dimension the linked control reduces: likelihood, impact, or both.',
};

vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: (key: string) => catalog[key] ?? key,
    tObject: () => ({}),
  }),
}));

test('trigger is a real button with an aria-label sourced from the i18n key', async () => {
  render(<HelpTooltip bodyKey="risks.fields.mitigationDimension.description" />);

  const trigger = screen.getByRole('button', { name: 'More information about this field' });
  expect(trigger.tagName).toBe('BUTTON');
  expect(trigger).toHaveAttribute('aria-label', 'More information about this field');
  await waitFor(() => expect(trigger).toBeInTheDocument());
});

test('tooltip exposes the i18n copy on focus and on hover', async () => {
  render(
    <HelpTooltip
      labelKey="risks.fields.mitigationDimension.label"
      bodyKey="risks.fields.mitigationDimension.description"
      ariaLabelKey="common.help.ariaLabel"
    />,
  );

  const trigger = screen.getByRole('button', { name: 'More information about this field' });

  fireEvent.focus(trigger);
  const focusedText = await screen.findByText(/Risk dimension the linked control reduces/);
  expect(focusedText).toBeInTheDocument();

  fireEvent.blur(trigger);
  fireEvent.mouseOver(trigger);
  expect(await screen.findByText(/Risk dimension the linked control reduces/)).toBeInTheDocument();
});

test('renders without crashing when no translation key is supplied and uses the children fallback', async () => {
  render(<HelpTooltip>Plain fallback text</HelpTooltip>);

  const trigger = screen.getByRole('button', { name: 'More information about this field' });
  fireEvent.focus(trigger);

  const fallback = await screen.findByText(/Plain fallback text/);
  expect(fallback).toBeInTheDocument();
});

test('renders without crashing and keeps an accessible trigger when nothing is provided', async () => {
  render(<HelpTooltip />);

  const trigger = screen.getByRole('button', { name: 'More information about this field' });
  expect(trigger).toBeInTheDocument();
});
