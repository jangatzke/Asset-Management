// Test setup for jsdom environment
// The plain entry registers the matchers on the global `expect` (vitest is
// configured with `globals: true`). The Vitest-specific `/vitest` entry cannot
// be used here because `@testing-library/jest-dom` is hoisted to the root
// node_modules and resolves `vitest` from there, which fails. The matching
// type augmentation lives in `src/test/jest-dom-vitest.d.ts`.
import '@testing-library/jest-dom';

// Enable React 18 act() environment for tests.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// MUI's TouchRipple performs an asynchronous state update after render that
// is not wrapped in act(), producing noisy "not wrapped in act(...)" warnings.
// The relative import inside ButtonBase.mjs cannot be intercepted by vi.mock,
// so we suppress this specific known warning in the test environment.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
    return;
  }
  originalConsoleError(...args);
};
