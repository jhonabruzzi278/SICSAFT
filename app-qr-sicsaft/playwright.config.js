import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Cada test levanta una instancia real de Chromium contra IndexedDB — con
  // el default (workers = núcleos disponibles) la máquina se satura y varios
  // tests dan timeout por contención de recursos, no por fallos reales.
  workers: 4,
  // Algunos specs hacen 15-20 interacciones de escaneo manual secuenciales;
  // en una máquina cargada eso solo ya se acerca a los 30s default.
  timeout: 60_000,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8765',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:8765',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
