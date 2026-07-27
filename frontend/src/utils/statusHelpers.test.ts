import { getRiskColor, getControlStatusColor, getStatusColor, getErrorMessage } from './statusHelpers';

describe('getRiskColor', () => {
  it('returns red for very_high', () => {
    expect(getRiskColor('very_high')).toContain('bg-red-100');
  });
  it('returns orange for high', () => {
    expect(getRiskColor('high')).toContain('bg-orange-100');
  });
  it('returns yellow for medium', () => {
    expect(getRiskColor('medium')).toContain('bg-yellow-100');
  });
  it('returns green for low', () => {
    expect(getRiskColor('low')).toContain('bg-green-100');
  });
  it('returns gray for unknown values', () => {
    expect(getRiskColor('unknown')).toContain('bg-gray-100');
  });
  it('handles case-insensitive input', () => {
    expect(getRiskColor('HIGH')).toContain('bg-orange-100');
    expect(getRiskColor('Low')).toContain('bg-green-100');
  });
});

describe('getControlStatusColor', () => {
  it('returns green for implemented', () => {
    expect(getControlStatusColor('implemented')).toContain('bg-green-100');
  });
  it('returns blue for planned', () => {
    expect(getControlStatusColor('planned')).toContain('bg-blue-100');
  });
  it('returns yellow for in_progress', () => {
    expect(getControlStatusColor('in_progress')).toContain('bg-yellow-100');
  });
  it('returns purple for under_review', () => {
    expect(getControlStatusColor('under_review')).toContain('bg-purple-100');
  });
  it('returns gray for unknown values', () => {
    expect(getControlStatusColor('unknown')).toContain('bg-gray-100');
  });
});

describe('getStatusColor auto-detection', () => {
  it('detects control status from known values', () => {
    expect(getStatusColor('implemented')).toContain('bg-green-100');
    expect(getStatusColor('planned')).toContain('bg-blue-100');
  });
  it('defaults to risk color for non-control values', () => {
    expect(getStatusColor('high')).toContain('bg-orange-100');
  });
  it('respects explicit type parameter', () => {
    expect(getStatusColor('medium', 'control')).toContain('bg-gray-100');
    expect(getStatusColor('implemented', 'risk')).toContain('bg-green-100');
  });
});

describe('getErrorMessage', () => {
  it('returns undefined for null', () => {
    expect(getErrorMessage(null)).toBeUndefined();
  });
  it('returns undefined for non-object types', () => {
    expect(getErrorMessage('string')).toBeUndefined();
    expect(getErrorMessage(42)).toBeUndefined();
  });
  it('extracts message from axios-like error', () => {
    const err = {
      response: {
        data: {
          error: { message: 'Validation failed' }
        }
      }
    };
    expect(getErrorMessage(err)).toBe('Validation failed');
  });
  it('returns undefined when no response structure', () => {
    const err = { message: 'Network error' };
    expect(getErrorMessage(err)).toBeUndefined();
  });
});
