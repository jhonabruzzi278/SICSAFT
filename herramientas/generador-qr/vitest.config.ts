import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Config separada de electron.vite.config.ts -- mismo criterio que sicsaft-core/vitest.config.ts
// (no hay proceso de Electron real en los tests, todo es Node puro).
export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@": resolve(__dirname, "src/renderer/src"),
    },
  },
  test: {
    environment: "node",
    pool: "threads",
    exclude: ["**/node_modules/**", "**/release/**", "**/out/**"],
    coverage: {
      provider: "v8",
      exclude: ["out/**", "release/**"],
    },
  },
});
