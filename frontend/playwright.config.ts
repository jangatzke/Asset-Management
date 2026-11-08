import { defineConfig, devices } from '@playwright/test';

/**
 * Strategy: mocked browser-contract E2E.
 *
 * `webServer` starts ONLY the Vite dev server (no Express backend, no database);
 * each spec fulfills every `/api/v1` request with `page.route()`. Route mocks are
 * installed per test page context, so specs are isolated and parallel-safe.
 *
 * This is deliberately different from the deferred full-stack “real E2E” suite
 * described in docs/e2e-testing.md; see that document for the decision record.
 */
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The mocked suite is deterministic, but CI runners are slower: serialize the
  // browser workers on CI and retry transient failures there.
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
