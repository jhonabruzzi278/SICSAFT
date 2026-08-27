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
    coverage: {
      provider: "v8",
      exclude: ["out/**", "resources/**", "src/renderer/**"],
    },
  },
});
