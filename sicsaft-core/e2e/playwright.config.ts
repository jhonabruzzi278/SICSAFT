import { defineConfig, devices } from "@playwright/test";

// Harness E2E del `.exe` (Electron). Se usa `_electron.launch` (no `connectOverCDP`: contra este
// build de Electron el handshake CDP se cuelga). El teardown de la fixture NO espera
// indefinidamente el `app.close()` (se colgaba 120s por el `java` de Keycloak que el `.exe` deja
// huérfano en Windows): tope de 15s + `taskkill /T` del árbol (ver fixtures/electron.ts y
// scripts/exe-process.ts).
//
//   * `principal` (specs 01..11 + 14..18) -- un solo `.exe` vivo vía la fixture worker `exe`. El
//     wizard corre en la 02 y las demás dependen de ese estado; por eso workers:1,
//     fullyParallel:false y orden alfabético de archivos. 14..18 amplían la cobertura (funciones
//     del AFT / del Directivo, validaciones, shell, ingesta de Excel) y corren después de la 11.
//   * `ciclo-vida` (specs 12..13) -- relanzamiento y cierre limpio. `dependencies: ['principal']`
//     garantiza que corra DESPUÉS (la instancia de `principal` ya se cerró); estas specs lanzan su
//     propia instancia con `_electron.launch`.
//
// global-setup aísla `%APPDATA%\sicsaft-core` (lo comparten los dos projects) y barre huérfanos;
// global-teardown restaura (salvo KEEP_APPDATA=1). SICSAFT_CORE_EXE puede apuntar a otro `.exe`
// (default: la instalación real -- ruta con espacio -> cubre el bug de PR #108).
export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Playwright recicla el worker tras cada test fallido -> el `.exe` relanza (~3 min). Contra
  // este build de Electron la sesión CDP de `_electron.launch` es intermitente (el network
  // service de Chromium crashea a veces); un retry en worker nuevo lo suele resolver.
  retries: process.env.CI ? 2 : 1,
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
      testMatch: /specs[\\/](0[1-9]|1[01]|1[4-8])-.*\.spec\.ts$/,
    },
    {
      name: "ciclo-vida",
      testMatch: /specs[\\/]1[239]-.*\.spec\.ts$/,
      dependencies: ["principal"],
    },
  ],
});
