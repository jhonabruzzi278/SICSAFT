import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 30_000,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8767',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Modo e2e dedicado (.env.e2e) — arma el bundle con VITE_MOCK_API=true, la red va mockeada
    // con MSW (src/mocks/), mismo criterio que app-qr-sicsaft/playwright.config.js. Puerto propio
    // (8767) para no chocar con el preview de app-qr-sicsaft (8765) ni el de este mismo paquete
    // (8766, ver vite.config.ts) si corren en simultáneo.
    command: 'npx vite build --mode e2e && npx vite preview --port 8767',
    url: 'http://localhost:8767',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
