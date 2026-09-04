import { defineConfig, devices } from '@playwright/test';

// Harness de casos de uso contra el stack real (docker compose). El stack lo levanta
// global-setup y lo baja global-teardown — no hay `webServer` (eso es para dev servers Vite).
//
//   * workers: 1 / fullyParallel: false — un único stack compartido, corridas en serie.
//   * sin baseURL global — las specs pegan a dos orígenes (ccp.* y directivo.*), lo toman de
//     test-data.mjs (URLS).
//   * ignoreHTTPSErrors — el harness es HTTP, pero por si se agrega TLS más adelante.
//   * KEEP_STACK=1 deja el stack arriba tras la corrida (depuración).
export default defineConfig({
  testDir: './casos-de-uso',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'casos-de-uso', use: { ...devices['Desktop Chrome'] } }],
});
