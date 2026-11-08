/**
 * Type augmentation for the jest-dom matchers used with Vitest.
 *
 * `@testing-library/jest-dom` v7 augments `Assertion<T = any>` (a single type
 * parameter), while Vitest v5 declares
 * `Assertion<R extends void | Promise<void> = void, T = unknown>`. Interface
 * declaration merging requires identical type parameters, so the package's
 * built-in augmentation does not merge with the Vitest 5 `Assertion` type and
 * `tsc` reports TS2339 for every matcher.
 *
 * Runtime registration happens via `import '@testing-library/jest-dom/vitest'`
 * in `src/test-setup.ts`; this file only re-declares the type augmentation
 * against the actual Vitest 5 signature.
 */
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Type parameter name R must match Vitest's `Assertion<R>` declaration exactly; interface merging requires identical type-parameter names, so it cannot be renamed or removed.
  interface Assertion<R extends void | Promise<void> = void, T = unknown>
    extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<any, any> {}
}
