import { defineConfig, devices } from "@playwright/test";

// Harness E2E del `.exe` (Electron). Dos projects, en serie:
//
//   * `principal` (specs 01..11) -- una sola instancia del `.exe` viva para todas, vía la fixture
//     worker `exe` (fixtures/electron.ts). El wizard corre en la 02 y las demás dependen de ese
//     estado; por eso workers:1, fullyParallel:false y orden alfabético de archivos.
//   * `ciclo-vida` (specs 12..13) -- relanzamiento y cierre limpio. `dependencies: ['principal']`
//     garantiza que corra DESPUÉS, en un worker nuevo (la instancia de `principal` ya se cerró),
//     así una segunda invocación no choca con el single-instance lock.
//
// global-setup aísla `%APPDATA%\sicsaft-core` (lo comparten los dos projects); global-teardown lo
// restaura (salvo KEEP_APPDATA=1). SICSAFT_CORE_EXE puede apuntar a otro `.exe`
// (default: la instalación real -- ruta con espacio -> cubre el bug de PR #108).
export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "principal",
      testMatch: /specs[\\/](0[1-9]|1[01])-.*\.spec\.ts$/,
    },
    {
      name: "ciclo-vida",
      testMatch: /specs[\\/]1[23]-.*\.spec\.ts$/,
      dependencies: ["principal"],
    },
  ],
});
