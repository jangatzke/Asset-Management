/**
 * MetricCard (Stage 8 / MT-6) — verifies value/label rendering, drilldown
 * link behaviour, trend indicator and semantic tone classes.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MetricCard } from './MetricCard';

const renderCard = (props: ComponentProps<typeof MetricCard>) =>
  render(
    <MemoryRouter>
      <MetricCard {...props} />
    </MemoryRouter>,
  );

describe('MetricCard', () => {
  it('renders label and value', () => {
    renderCard({ label: 'Offene Risiken', value: '12' });

    expect(screen.getByText('Offene Risiken')).toBeInTheDocument();
    const value = screen.getByText('12');
    expect(value).toBeInTheDocument();
    expect(value.className).toContain('tabular-nums');
    expect(value.className).toContain('text-display');
  });

  it('renders as a plain card without href and without focus ring classes', () => {
    const { container } = renderCard({ label: 'Assets', value: '42' });

    const card = container.firstElementChild;
    expect(card?.tagName).toBe('DIV');
    expect(card?.className).not.toContain('focus-visible:ring-2');
  });

  it('renders the whole card as a router link when href is given, with focus ring', () => {
    renderCard({ label: 'Offene Vorfälle', value: '3', href: '/incidents?status=open' });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/incidents?status=open');
    expect(link.className).toContain('focus-visible:ring-2');
    expect(screen.getByText('Offene Vorfälle').closest('a')).toBe(link);
  });

  it('renders trend arrow with label and direction-specific color class', () => {
    const { rerender } = renderCard({
      label: 'Kosten',
      value: '100',
      trend: { direction: 'up', label: '+12%' },
    });
    expect(screen.getByText('+12%')).toBeInTheDocument();
    let trendNode = screen.getByText('+12%').parentElement as HTMLElement;
    expect(trendNode.className).toContain('text-status-ok-fg');

    rerender(
      <MemoryRouter>
        <MetricCard label="Kosten" value="100" trend={{ direction: 'down', label: '-5%' }} />
      </MemoryRouter>,
    );
    trendNode = screen.getByText('-5%').parentElement as HTMLElement;
    expect(trendNode.className).toContain('text-status-critical-fg');

    renderCard({ label: 'Kosten', value: '100', trend: { direction: 'flat' } });
    // flat trend renders without a label span but still with the muted class
    const flatTrend = document.querySelector('.text-text-muted.inline-flex');
    expect(flatTrend).not.toBeNull();
  });

  it('maps tone to the semantic value color class', () => {
    renderCard({ label: 'ok', value: '1', tone: 'ok' });
    expect(screen.getByText('1').className).toContain('text-status-ok-fg');

    renderCard({ label: 'warn', value: '2', tone: 'warn' });
    expect(screen.getByText('2').className).toContain('text-status-warn-fg');

    renderCard({ label: 'critical', value: '3', tone: 'critical' });
    expect(screen.getByText('3').className).toContain('text-status-critical-fg');

    renderCard({ label: 'info', value: '4', tone: 'info' });
    expect(screen.getByText('4').className).toContain('text-status-info-fg');

    renderCard({ label: 'neutral', value: '5' });
    expect(screen.getByText('5').className).toContain('text-text-primary');
  });

  it('renders optional hint text', () => {
    renderCard({ label: 'Controls', value: '9', hint: 'stand heute' });
    expect(screen.getByText('stand heute')).toBeInTheDocument();
  });
});
