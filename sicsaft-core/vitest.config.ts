import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Config separada de electron.vite.config.ts -- vitest no corre dentro del pipeline de
// electron-vite (no hay proceso de Electron real en los tests, todo es Node/jsdom puro), pero
// necesita el mismo alias @shared/* para que los tests puedan importar igual que el código real.
export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "node",
    // Bug real encontrado empaquetando (Fase 8, electron-builder): release/ ahora contiene una
    // copia completa de cis/core/cip (incluye core/src/**/*.spec.ts, necesarios en runtime para
    // la migración de seed -- ver package.json "build" extraResources) -- sin excluirlo acá,
    // Vitest los recogía como tests propios y explotaba con "describe is not defined" (son specs
    // de Jest, no de Vitest, un test runner distinto). Default de Vitest ya excluye node_modules/
    // dist/.git, pero no algo tan específico de este proyecto como release/.
    exclude: ["**/node_modules/**", "**/release/**", "**/out/**"],
    coverage: {
      provider: "v8",
      exclude: ["out/**", "resources/**", "release/**", "src/renderer/**"],
    },
  },
});
